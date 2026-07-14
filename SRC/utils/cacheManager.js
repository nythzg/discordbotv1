// Local key tracking store mapping: userId_guildId -> UNIX timestamp
const xpCooldownCache = new Map();
// Tracking identical string repeats to defeat copy-paste farm utilities
const lastMessageHashCache = new Map();

module.exports = { xpCooldownCache, lastMessageHashCache };