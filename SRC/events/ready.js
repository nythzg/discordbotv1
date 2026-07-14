const { ActivityType, Events } = require('discord.js');
const UserProfile = require('../models/UserProfile');
const Reward = require('../models/Reward');
const logger = require('../utils/logger');
const { applyLevelRoleFeatures } = require('../utils/levelRoleFeatures');
const { progression } = require('../config/botConfig');
const { getLevelFromXp } = require('../utils/levelUtils');

async function synchronizeGuildRewards(guild) {
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
    if (!rewards.length) return profileUpdates.length;

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
    return membersUpdated;
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`Session Authorized. Authenticated as global target: ${client.user.tag}`);
        logger.initLogger(client);

        client.user.setActivity('community activity tracking metrics', { type: ActivityType.Watching });

        for (const guild of client.guilds.cache.values()) {
            const membersUpdated = await synchronizeGuildRewards(guild);
            logger.info(`Reward role synchronization completed for ${guild.name}: ${membersUpdated} member(s) updated.`);
        }
    }
};
