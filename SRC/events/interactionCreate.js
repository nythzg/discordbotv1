const logger = require('../utils/logger');
const { MessageFlags } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (err) {
            logger.error(`Application command matching routing error within execution engine context:`, err);
            const rawMessage = err.rawError?.message || err.message || 'Unknown command error';
            const safeMessage = String(rawMessage)
                .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[database URI redacted]')
                .slice(0, 1200);
            const errorCode = err.code ? ` (code: ${err.code})` : '';
            const errorPayload = {
                content: `The command could not finish: **${safeMessage}**${errorCode}`
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorPayload)
                    .catch(() => interaction.followUp({ ...errorPayload, flags: MessageFlags.Ephemeral }));
            } else {
                await interaction.reply({ ...errorPayload, flags: MessageFlags.Ephemeral });
            }
        }
    }
};
