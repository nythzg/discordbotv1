require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { connectDB } = require('./database/mongo');
const { loadApplicationCommands } = require('./handlers/commandHandler');
const logger = require('./utils/logger');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

const app = express();
app.get('/health', (req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    const discordReady = client.isReady();
    const healthy = databaseReady && discordReady;
    res.status(healthy ? 200 : 503).send({
        status: healthy ? 'Operational' : 'Starting',
        databaseReady,
        discordReady,
        uptime: process.uptime()
    });
});
app.listen(process.env.PORT || 3000, () => logger.info(`Express ping back validation engine initialized.`));

async function initializeSystemInfrastructure() {
    await connectDB();

    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }

    loadApplicationCommands(client);
    await client.login(process.env.DISCORD_TOKEN);
}

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    logger.error('Critical operational fault:', err);
});

initializeSystemInfrastructure().catch(err => logger.error('Initialization failed:', err));
