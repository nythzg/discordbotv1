const { ActivityType, Events, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const UserProfile = require('../models/UserProfile');
const Reward = require('../models/Reward');
const GuildSettings = require('../models/GuildSettings');
const logger = require('../utils/logger');
const {
    parseLevelRoleName,
    applyLevelRoleFeatures,
    hasLevelRewardPermissions,
    removeLevelRewardFeatures
} = require('../utils/levelRoleFeatures');
const { progression } = require('../config/botConfig');
const { getLevelFromXp } = require('../utils/levelUtils');

const UPDATE_HISTORY_VERSION = '2026-07-14-runtime-log-rollup-v1';

async function ensurePublicCommandAccess(guild) {
    const everyoneRole = guild.roles.everyone;
    if (everyoneRole.permissions.has(PermissionFlagsBits.UseApplicationCommands, false)) {
        return { publicCommandAccessUpdated: false, publicCommandAccessBlocked: false };
    }

    if (!everyoneRole.editable) {
        logger.error(`Cannot enable public slash commands on @everyone in ${guild.name}; check Manage Roles.`);
        return { publicCommandAccessUpdated: false, publicCommandAccessBlocked: true };
    }

    try {
        const permissions = new PermissionsBitField(everyoneRole.permissions.bitfield)
            .add(PermissionFlagsBits.UseApplicationCommands);
        await everyoneRole.edit({
            permissions,
            reason: 'Allowing every server member to use public rank and leaderboard commands'
        });
        return { publicCommandAccessUpdated: true, publicCommandAccessBlocked: false };
    } catch (error) {
        logger.error(`Could not enable public slash commands for @everyone in ${guild.name}:`, error);
        return { publicCommandAccessUpdated: false, publicCommandAccessBlocked: true };
    }
}

async function discoverAndConfigureLevelRoles(guild) {
    const discoveredByLevel = new Map();
    let blockedRoles = 0;
    let permissionsUpdated = 0;
    let nonLevelRolesUpdated = 0;

    for (const role of guild.roles.cache.values()) {
        const level = parseLevelRoleName(role.name);
        if (role.managed) continue;
        if (!role.editable) {
            if (level !== null || hasLevelRewardPermissions(role)) {
                blockedRoles++;
                logger.error(`Cannot update ${role.name}: move the bot's highest role above it.`);
            }
            continue;
        }

        if (level === null) {
            try {
                if (await removeLevelRewardFeatures(role)) nonLevelRolesUpdated++;
            } catch (error) {
                blockedRoles++;
                logger.error(`Could not remove level rewards from ${role.name}:`, error);
            }
            continue;
        }

        try {
            if (await applyLevelRoleFeatures(
                role,
                level,
                `Enforcing exact Level ${level} permission criteria on bot startup`
            )) permissionsUpdated++;
        } catch (error) {
            blockedRoles++;
            logger.error(`Could not configure ${role.name}; check Manage Roles and role hierarchy:`, error);
            continue;
        }

        const existing = discoveredByLevel.get(level);
        const isCanonical = role.name.toLowerCase() === `level ${level}`;
        const existingIsCanonical = existing?.name.toLowerCase() === `level ${level}`;
        if (!existing || (isCanonical && !existingIsCanonical)) discoveredByLevel.set(level, role);
    }

    for (const [level, role] of discoveredByLevel) {
        try {
            await Reward.findOneAndUpdate(
                { guildId: guild.id, level },
                { roleId: role.id },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (error) {
            blockedRoles++;
            logger.error(`Could not configure ${role.name}; check Manage Roles and role hierarchy:`, error);
        }
    }

    return { rolesMapped: discoveredByLevel.size, permissionsUpdated, nonLevelRolesUpdated, blockedRoles };
}

async function synchronizeGuildRewards(guild) {
    const publicCommandAccess = await ensurePublicCommandAccess(guild);
    const roleConfiguration = await discoverAndConfigureLevelRoles(guild);
    const rewards = await Reward.find({ guildId: guild.id }).sort({ level: 1 }).lean();
    const profiles = await UserProfile.find({ guildId: guild.id }).lean();

    const profileUpdates = [];
    for (const profile of profiles) {
        const messageCount = Math.max(0, profile.messagesCount || 0);
        const calculatedLevel = getLevelFromXp(messageCount, progression.messagesPerLevel);
        if (profile.level !== calculatedLevel || profile.xp !== messageCount) {
            profileUpdates.push({
                updateOne: {
                    filter: { _id: profile._id },
                    update: { $set: { level: calculatedLevel, xp: messageCount } }
                }
            });
            profile.level = calculatedLevel;
            profile.xp = messageCount;
        }
    }
    if (profileUpdates.length) await UserProfile.bulkWrite(profileUpdates);
    if (!rewards.length) {
        return { membersUpdated: 0, profilesUpdated: profileUpdates.length, ...roleConfiguration, ...publicCommandAccess };
    }

    for (const reward of rewards) {
        const role = guild.roles.cache.get(reward.roleId);
        if (role?.name === `Level ${reward.level}`) {
            await applyLevelRoleFeatures(role, reward.level, 'Synchronizing level milestone permissions on startup')
                .catch(error => logger.error(`Could not update permissions for ${role.name}:`, error));
        }
    }

    let membersUpdated = 0;

    for (const profile of profiles) {
        const member = await guild.members.fetch(profile.userId).catch(() => null);
        if (!member) continue;
        const missingRoleIds = rewards
            .filter(reward => reward.level <= profile.level)
            .map(reward => reward.roleId)
            .filter(roleId => {
                const role = guild.roles.cache.get(roleId);
                return role && role.editable && !member.roles.cache.has(roleId);
            });
        const unearnedRoleIds = rewards
            .filter(reward => reward.level > profile.level)
            .map(reward => reward.roleId)
            .filter(roleId => {
                const role = guild.roles.cache.get(roleId);
                return role && role.editable && member.roles.cache.has(roleId);
            });
        if (!missingRoleIds.length && !unearnedRoleIds.length) continue;

        try {
            if (missingRoleIds.length) {
                await member.roles.add([...new Set(missingRoleIds)], 'Synchronizing saved level rewards on bot startup');
            }
            if (unearnedRoleIds.length) {
                await member.roles.remove([...new Set(unearnedRoleIds)], 'Removing rewards above the saved member level');
            }
            membersUpdated++;
        } catch (error) {
            logger.error(`Could not synchronize reward roles for ${member.user.tag}:`, error);
        }
    }
    return { membersUpdated, profilesUpdated: profileUpdates.length, ...roleConfiguration, ...publicCommandAccess };
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`Session Authorized. Authenticated as global target: ${client.user.tag}`);
        logger.initLogger(client);

        client.user.setActivity('community activity tracking metrics', { type: ActivityType.Watching });

        for (const guild of client.guilds.cache.values()) {
            const result = await synchronizeGuildRewards(guild);
            logger.info(
                `Level reconciliation completed for ${guild.name}: ` +
                `${result.permissionsUpdated} level role permission sets changed, ` +
                `${result.rolesMapped} level rewards mapped, ` +
                `${result.nonLevelRolesUpdated} non-level roles had level rewards removed, ` +
                `public commands ${result.publicCommandAccessUpdated ? 'enabled for everyone' : result.publicCommandAccessBlocked ? 'blocked' : 'already enabled'}, ` +
                `${result.profilesUpdated} profiles recalculated, ${result.membersUpdated} members updated, ` +
                `${result.blockedRoles} roles blocked by hierarchy.`
            );

            const settings = await GuildSettings.findOne({ guildId: guild.id }).lean();
            if (settings?.lastUpdateHistoryVersion !== UPDATE_HISTORY_VERSION) {
                const sent = await logger.sendUpdateHistory(guild);
                if (sent) {
                    await GuildSettings.findOneAndUpdate(
                        { guildId: guild.id },
                        { $set: { lastUpdateHistoryVersion: UPDATE_HISTORY_VERSION } },
                        { upsert: true, setDefaultsOnInsert: true }
                    );
                    logger.info(`Posted the complete bot update history to channel ${logger.LOG_CHANNEL_ID}.`);
                } else {
                    logger.error(`Could not post update history: channel ${logger.LOG_CHANNEL_ID} is unavailable in ${guild.name}.`);
                }
            }
        }
    }
};
