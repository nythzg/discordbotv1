const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    weeklyXp: { type: Number, default: 0 },
    monthlyXp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    prestige: { type: Number, default: 0 },
    messagesCount: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    lastXpTime: { type: Date, default: Date.now },
    lastMessageHash: { type: String, default: null }
}, { timestamps: true });

// Optimize compound lookup indexes for rapid leaderboard sorting at scale
UserProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });
UserProfileSchema.index({ guildId: 1, xp: -1 });
UserProfileSchema.index({ guildId: 1, weeklyXp: -1 });
UserProfileSchema.index({ guildId: 1, monthlyXp: -1 });

module.exports = mongoose.model('UserProfile', UserProfileSchema);