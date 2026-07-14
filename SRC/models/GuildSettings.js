const mongoose = require('mongoose');

const GuildSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    xpCooldown: { type: Number, default: 60 }, // in seconds
    xpMin: { type: Number, default: 15 },
    xpMax: { type: Number, default: 25 },
    formulaMultiplier: { type: Number, default: 100 },
    lastUpdateHistoryVersion: { type: String, default: null }
});

module.exports = mongoose.model('GuildSettings', GuildSettingsSchema);
