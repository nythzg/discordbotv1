const { EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = '1303577092491051102';
let discordClient = null;
let logChannelPromise = null;
let remoteQueue = Promise.resolve();
const pendingLines = [];

function sanitize(value) {
    let text;
    if (value instanceof Error) text = value.stack || value.message;
    else if (typeof value === 'string') text = value;
    else {
        try { text = JSON.stringify(value); }
        catch { text = String(value); }
    }
    return String(text || '')
        .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[DATABASE_URI_REDACTED]')
        .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}/g, '[DISCORD_TOKEN_REDACTED]')
        .replace(/(authorization\s*[:=]\s*)[^\s,}]+/gi, '$1[REDACTED]')
        .replace(/```/g, "''' ")
        .slice(0, 1500);
}

async function getLogChannel() {
    if (!discordClient) return null;
    if (!logChannelPromise) {
        logChannelPromise = discordClient.channels.fetch(LOG_CHANNEL_ID)
            .then(channel => channel?.isTextBased() ? channel : null)
            .catch(() => null);
    }
    return logChannelPromise;
}

function queueRemoteLine(line) {
    if (!discordClient) {
        pendingLines.push(line);
        if (pendingLines.length > 100) pendingLines.shift();
        return;
    }
    remoteQueue = remoteQueue.then(async () => {
        const channel = await getLogChannel();
        if (channel) await channel.send({ content: `\`\`\`text\n${line.slice(0, 1850)}\n\`\`\`` });
    }).catch(err => console.error('[LOGGER] Remote log delivery failed:', err.message));
}

function initLogger(client) {
    discordClient = client;
    for (const line of pendingLines.splice(0)) queueRemoteLine(line);
}

function info(message) {
    const line = `[INFO] [${new Date().toISOString()}] ${sanitize(message)}`;
    console.log(line);
    queueRemoteLine(line);
}

function error(message, err) {
    const details = err ? `\n${sanitize(err)}` : '';
    const line = `[ERROR] [${new Date().toISOString()}] ${sanitize(message)}${details}`;
    console.error(line);
    queueRemoteLine(line);
}

async function sendLog(guild, title, description, color = '#5865f2', fields = []) {
    console.log(`[AUDIT] [${new Date().toISOString()}] ${sanitize(title)} - ${sanitize(description)}`);
    if (!discordClient) return false;

    try {
        const channel = await getLogChannel();
        if (!channel) return false;
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .addFields(fields)
            .setFooter({ text: guild?.name || 'Discord Leveling Bot' })
            .setTimestamp();
        await channel.send({ embeds: [embed] });
        return true;
    } catch (err) {
        error('Failed to route audit event to the configured log channel:', err);
        return false;
    }
}

async function sendUpdateHistory(guild) {
    const channel = await getLogChannel();
    if (!channel || channel.guildId !== guild.id) return false;

    const embeds = [
        new EmbedBuilder()
            .setTitle('Bot Update History and Logging Activated')
            .setColor('#5865f2')
            .setDescription(
                'This is the verified development update history reconstructed from Git. ' +
                'Historical Railway console output before this deployment is not recoverable. ' +
                'All new startup, error, audit, moderation, role, and member-event logs will be routed here.'
            )
            .addFields(
                { name: 'Log channel', value: `<#${LOG_CHANNEL_ID}>`, inline: true },
                { name: 'Server', value: guild.name, inline: true }
            )
            .setTimestamp(),
        new EmbedBuilder()
            .setTitle('Runtime and Deployment Updates')
            .setColor('#3498db')
            .setDescription([
                '`3ed0394` Rebuilt the project as a clean, secret-free repository.',
                'Standardized Node modules and repaired event/command loading.',
                'Added MongoDB connection handling, Windows SRV fallback, and readiness health reporting.',
                'Added VS Code launch configuration and Railway-compatible startup.',
                'Registered global and server-scoped slash commands for immediate refresh.'
            ].join('\n')),
        new EmbedBuilder()
            .setTitle('Role and Permission Automation')
            .setColor('#9b59b6')
            .setDescription([
                '`ecc6ddd` Added automatic milestone role creation, reward mapping, and member synchronization.',
                '`fb036ce` Removed the role-position operation that caused Discord error 50013.',
                'Added startup reconciliation for missing and unearned reward roles.',
                'Level 5: displayed role; Level 10: external emojis/stickers; Level 20: reactions.',
                'Level 30: pictures/files; Level 40: GIF embeds; Level 50: move/disconnect voice members.'
            ].join('\n')),
        new EmbedBuilder()
            .setTitle('Leveling and Moderation Updates')
            .setColor('#2ecc71')
            .setDescription([
                '`ba86e69` Changed progression to one level per 600 qualifying messages.',
                'Only non-bot, non-empty, non-duplicate messages in <#1395944374931685517> count.',
                'Added automatic level-up role assignment and startup profile migration.',
                'Added `/adminlevel warn` to deduct three levels, remove unearned roles, announce the warning, and attempt a DM.',
                'Updated rank cards and leaderboards to show message-based progression.'
            ].join('\n')),
        new EmbedBuilder()
            .setTitle('Media and Command Updates')
            .setColor('#f1c40f')
            .setDescription([
                '`92d9297` Bundled Poppins fonts to fix Railway tofu/missing-glyph rendering.',
                'Added generated PNG level-up cards with avatar, username, and level.',
                'Configured level-up media notifications for <#1395944374931685517>.',
                'Commands: `/rank`, `/leaderboard`, `/adminlevel xpadd`, `setreward`, `setuproles`, `warn`, and `resetall`.'
            ].join('\n')),
        new EmbedBuilder()
            .setTitle('Last Recoverable Railway Runtime Log')
            .setColor('#95a5a6')
            .setDescription([
                '`2026-07-14 04:20 UTC` Container and Express health service started.',
                'MongoDB connection established successfully.',
                'Discord authenticated as Wardrum tracker#9340.',
                'Slash-command routes refreshed successfully.',
                'Reward role synchronization completed for WAR DRUM ESPORTS with 0 members changed.',
                'The `/adminlevel setuproles` role-position request failed with Discord 50013 Missing Permissions; this was fixed in `fb036ce`.',
                'The Railway fontconfig warning was addressed by bundling font configuration and local Poppins fonts.'
            ].join('\n')),
        new EmbedBuilder()
            .setTitle('Continuous Logs Now Routed Here')
            .setColor('#e74c3c')
            .setDescription([
                '• Process startup and database/Discord readiness',
                '• Command registration and role synchronization',
                '• Unhandled errors and command failures (secrets redacted)',
                '• Admin XP/message-credit changes, role setup, warnings, and resets',
                '• Member join/leave and reward restoration events'
            ].join('\n'))
    ];

    await channel.send({ embeds });
    return true;
}

module.exports = {
    LOG_CHANNEL_ID,
    initLogger,
    info,
    error,
    sendLog,
    sendUpdateHistory
};
