function getXpForLevel(level, multiplier = 600) {
    if (level <= 0) return 0;
    return multiplier * level;
}

function getLevelFromXp(xp, multiplier = 600) {
    if (!Number.isFinite(xp) || xp <= 0 || multiplier <= 0) return 0;
    return Math.floor(xp / multiplier);
}

module.exports = { getXpForLevel, getLevelFromXp };
