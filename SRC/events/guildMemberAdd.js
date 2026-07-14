const UserProfile = require('../models/UserProfile');
const Reward = require('../models/Reward');
const logger = require('../utils/logger');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        const { id: userId, guild } = member;
        
        // Re-apply earned rewards if member re-joins server profiles
        const profile = await UserProfile.findOne({ userId, guildId: guild.id }).lean();
        if (!profile || profile.level === 0) return;

        const applicableRewards = await Reward.find({ guildId: guild.id, level: { $lte: profile.level } }).lean();
        if (applicableRewards.length > 0) {
            const syncRoleIds = applicableRewards.map(r => r.roleId);
            await member.roles.add(syncRoleIds).catch(err => logger.error('Failed restoring roles during re-entry processing:', err));
            await logger.sendLog(guild, '🔄 State Re-Sync on Entry', `Restored ${syncRoleIds.length} roles to returned user ${member.user.tag}.`, '#3498db');
        }
    }
};