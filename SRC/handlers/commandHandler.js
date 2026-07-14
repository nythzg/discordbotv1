const fs = require('fs');
const path = require('path');
const { REST, Routes, Events } = require('discord.js');
const logger = require('../utils/logger');

function loadApplicationCommands(client) {
    const commandFilesPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandFilesPath).filter(f => f.endsWith('.js'));

    const internalRoutesMapArray = [];

    for (const file of commandFiles) {
        const commandModule = require(path.join(commandFilesPath, file));
        const commands = commandModule.commandsArray || [commandModule];
        for (const command of commands) {
            if (!command?.data || typeof command.execute !== 'function') {
                logger.error(`Skipping invalid command module: ${file}`);
                continue;
            }
            client.commands.set(command.data.name, command);
            internalRoutesMapArray.push(command.data.toJSON());
        }
    }

    client.once(Events.ClientReady, async () => {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            logger.info('Refreshing server slash route indices...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: internalRoutesMapArray }
            );
            await Promise.all(client.guilds.cache.map(guild =>
                rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id),
                    { body: internalRoutesMapArray }
                )
            ));
            logger.info('Application routing updates successfully integrated.');
        } catch (err) {
            logger.error('Critical initialization block: Slash operational schema register failure:', err);
        }
    });
}

module.exports = { loadApplicationCommands };
