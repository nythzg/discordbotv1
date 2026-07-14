const logger = require('../utils/logger');

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
            const errorPayload = { content: 'An execution crash occurred mapping this command routing workflow.', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorPayload);
            } else {
                await interaction.reply(errorPayload);
            }
        }
    }
};