const { EmbedBuilder } = require('discord.js');

let discordClient = null;

function initLogger(client) {
    discordClient = client;
}

function info(message) {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`);
}

function error(message, err) {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, err || '');
}

async function sendLog(guild, title, description, color = '#5865f2', fields = []) {
    info(`Log Event Triggered: ${title} - ${description}`);
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId || !discordClient) return;

    try {
        const channel = await discordClient.channels.fetch(logChannelId).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .addFields(fields)
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (err) {
        error('Failed to route audit event to remote log channel:', err);
    }
}

module.exports = { initLogger, info, error, sendLog };