const mongoose = require('mongoose');

const RewardSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    level: { type: Number, required: true },
    roleId: { type: String, required: true },
    isPermissionReward: { type: Boolean, default: false }
});

RewardSchema.index({ guildId: 1, level: 1 }, { unique: true });
module.exports = mongoose.model('Reward', RewardSchema);