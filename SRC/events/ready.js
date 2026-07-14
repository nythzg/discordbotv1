const { ActivityType, Events } = require('discord.js');
const UserProfile = require('../models/UserProfile');
const Reward = require('../models/Reward');
const logger = require('../utils/logger');

async function synchronizeGuildRewards(guild) {
    const rewards = await Reward.find({ guildId: guild.id }).sort({ level: 1 }).lean();
    if (!rewards.length) return 0;

    const profiles = await UserProfile.find({
        guildId: guild.id,
        level: { $gte: rewards[0].level }
    }).lean();
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
        if (!missingRoleIds.length) continue;

        try {
            await member.roles.add([...new Set(missingRoleIds)], 'Synchronizing saved level rewards on bot startup');
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
