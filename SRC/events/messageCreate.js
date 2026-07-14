const crypto = require('crypto');
const UserProfile = require('../models/UserProfile');
const Reward = require('../models/Reward');
const logger = require('../utils/logger');
const { progression, levelRoles, generalChannelId } = require('../config/botConfig');
const { getLevelFromXp } = require('../utils/levelUtils');
const { lastMessageHashCache } = require('../utils/cacheManager');
const { sendLevelUpNotification } = require('../utils/levelUpNotifier');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot || !message.guild || !message.member) return;
        if (message.channel.id !== generalChannelId) return;

        const normalized = message.content.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!normalized) return;

        const cacheKey = `${message.guild.id}:${message.author.id}`;
        const hash = crypto.createHash('sha256').update(normalized).digest('hex');
        if (lastMessageHashCache.get(cacheKey) === hash) return;

        const now = Date.now();
        const profile = await UserProfile.findOneAndUpdate(
            { userId: message.author.id, guildId: message.guild.id },
            {
                $inc: { xp: 1, weeklyXp: 1, monthlyXp: 1, messagesCount: 1 },
                $set: { lastXpTime: new Date(now), lastMessageHash: hash }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        lastMessageHashCache.set(cacheKey, hash);

        const oldLevel = profile.level;
        const newLevel = getLevelFromXp(profile.messagesCount, progression.messagesPerLevel);
        if (newLevel !== oldLevel) {
            profile.level = newLevel;
            profile.xp = profile.messagesCount;
            await profile.save();
        }

        if (newLevel > oldLevel) {
            await sendLevelUpNotification(message.guild, message.channel, message.author, newLevel);

            const configuredRewards = await Reward.find({
                guildId: message.guild.id,
                level: { $lte: newLevel }
            }).lean();
            const roleIds = [...new Set([...configuredRewards.map(reward => reward.roleId), levelRoles[newLevel]]
                .filter(roleId => {
                    if (!roleId || roleId.startsWith('PASTE_') || message.member.roles.cache.has(roleId)) return false;
                    const role = message.guild.roles.cache.get(roleId);
                    return role && role.editable;
                }))];
            if (roleIds.length) {
                await message.member.roles.add(roleIds, `Automatic rewards for reaching Level ${newLevel}`)
                    .catch(error => logger.error('Failed to add level reward roles:', error));
            }
        }
    }
};
