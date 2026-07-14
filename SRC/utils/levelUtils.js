function getXpForLevel(level, multiplier = 100) {
    if (level <= 0) return 0;
    return multiplier * Math.pow(level, 2) + 100 * level;
}

function getLevelFromXp(xp, multiplier = 100) {
    let level = 0;
    while (xp >= getXpForLevel(level + 1, multiplier)) {
        level++;
    }
    return level;
}

module.exports = { getXpForLevel, getLevelFromXp };