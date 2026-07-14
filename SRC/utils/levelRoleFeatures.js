const { PermissionFlagsBits, PermissionsBitField } = require('discord.js');

const levelRoleFeatures = Object.freeze({
    5: {
        label: 'Displayed level role',
        permissions: []
    },
    10: {
        label: 'External emojis and stickers',
        permissions: [PermissionFlagsBits.UseExternalEmojis, PermissionFlagsBits.UseExternalStickers]
    },
    20: {
        label: 'Add reactions',
        permissions: [PermissionFlagsBits.AddReactions]
    },
    30: {
        label: 'Send pictures (Attach Files)',
        permissions: [PermissionFlagsBits.AttachFiles]
    },
    40: {
        label: 'Send GIFs (Embed Links)',
        permissions: [PermissionFlagsBits.EmbedLinks]
    },
    50: {
        label: 'Move or disconnect members in voice channels',
        permissions: [PermissionFlagsBits.MoveMembers]
    }
});

const levelRewardPermissions = Object.freeze([
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.UseExternalStickers,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.MoveMembers
]);

function parseLevelRoleName(name) {
    const match = String(name || '').trim().match(/^(?:level|lvl)\s*(\d+)$/i);
    return match ? Number(match[1]) : null;
}

async function applyLevelRoleFeatures(role, level, reason = 'Updating level milestone permissions') {
    const feature = levelRoleFeatures[level];
    if (!role.editable) return false;

    const desiredPermissions = new PermissionsBitField(feature?.permissions || []);
    const shouldHoist = Boolean(feature);
    const changes = {};
    if (desiredPermissions.bitfield !== role.permissions.bitfield) changes.permissions = desiredPermissions;
    if (role.hoist !== shouldHoist) changes.hoist = shouldHoist;
    if (!Object.keys(changes).length) return false;

    await role.edit({ ...changes, reason });
    return true;
}

function hasLevelRewardPermissions(role) {
    return levelRewardPermissions.some(permission => (role.permissions.bitfield & permission) === permission);
}

async function removeLevelRewardFeatures(role, reason = 'Restricting level rewards to level roles') {
    if (!role.editable || !hasLevelRewardPermissions(role)) return false;

    const desiredPermissions = new PermissionsBitField(role.permissions.bitfield)
        .remove(levelRewardPermissions);
    await role.edit({ permissions: desiredPermissions, reason });
    return true;
}

module.exports = {
    levelRoleFeatures,
    levelRewardPermissions,
    parseLevelRoleName,
    applyLevelRoleFeatures,
    hasLevelRewardPermissions,
    removeLevelRewardFeatures
};
