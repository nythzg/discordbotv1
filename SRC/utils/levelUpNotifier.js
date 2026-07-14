const { AttachmentBuilder } = require('discord.js');
const { drawLevelUpCard } = require('./canvasEngine');
const { generalChannelId } = require('../config/botConfig');
const logger = require('./logger');

async function sendLevelUpNotification(guild, fallbackChannel, user, level) {
    const channel = guild.channels.cache.get(generalChannelId)
        || guild.channels.cache.find(candidate =>
            candidate.name?.toLowerCase() === 'general' && candidate.isTextBased()
        )
        || fallbackChannel;
    if (!channel?.isTextBased()) return false;

    try {
        const image = await drawLevelUpCard(
            user.username,
            user.displayAvatarURL({ extension: 'png', size: 256 }),
            level
        );
        const attachment = new AttachmentBuilder(image, { name: `level-${level}.png` });
        await channel.send({
            content: `🎉 Congratulations <@${user.id}>, you've reached level **${level}**!`,
            files: [attachment]
        });
        return true;
    } catch (error) {
        logger.error('Failed to send the level-up media notification:', error);
        return false;
    }
}

module.exports = { sendLevelUpNotification };
