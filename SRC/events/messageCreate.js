const crypto = require('crypto');
const UserProfile = require('../models/UserProfile');
const GuildSettings = require('../models/GuildSettings');
const Reward = require('../models/Reward');
const logger = require('../utils/logger');
const { defaults, antiAbuse, levelRoles } = require('../config/botConfig');
const { getLevelFromXp } = require('../utils/levelUtils');
const { xpCooldownCache, lastMessageHashCache } = require('../utils/cacheManager');
const { sendLevelUpNotification } = require('../utils/levelUpNotifier');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot || !message.guild || !message.member) return;

        const normalized = message.content.trim().toLowerCase().replace(/\s+/g, ' ');
        if (normalized.length < antiAbuse.minWordLength) return;

        const cacheKey = `${message.guild.id}:${message.author.id}`;
        const hash = crypto.createHash('sha256').update(normalized).digest('hex');
        if (lastMessageHashCache.get(cacheKey) === hash) return;

        const settings = await GuildSettings.findOne({ guildId: message.guild.id }).lean();
        const cooldownSeconds = settings?.xpCooldown ?? defaults.xpCooldown;
        const now = Date.now();
        if (now - (xpCooldownCache.get(cacheKey) || 0) < cooldownSeconds * 1000) return;

        const xpMin = settings?.xpMin ?? defaults.xpMin;
        const xpMax = settings?.xpMax ?? defaults.xpMax;
        const low = Math.min(xpMin, xpMax);
        const high = Math.max(xpMin, xpMax);
        const gainedXp = Math.floor(Math.random() * (high - low + 1)) + low;
        const multiplier = settings?.formulaMultiplier ?? defaults.formulaMultiplier;

        const profile = await UserProfile.findOneAndUpdate(
            { userId: message.author.id, guildId: message.guild.id },
            {
                $inc: { xp: gainedXp, weeklyXp: gainedXp, monthlyXp: gainedXp, messagesCount: 1 },
                $set: { lastXpTime: new Date(now), lastMessageHash: hash }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        const oldLevel = profile.level;
        const newLevel = getLevelFromXp(profile.xp, multiplier);
        if (newLevel !== oldLevel) {
            profile.level = newLevel;
            await profile.save();
        }
        xpCooldownCache.set(cacheKey, now);
        lastMessageHashCache.set(cacheKey, hash);

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
