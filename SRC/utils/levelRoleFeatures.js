const { PermissionFlagsBits } = require('discord.js');

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
        label: 'Send GIFs (Embed Links)',
        permissions: [PermissionFlagsBits.EmbedLinks]
    },
    40: {
        label: 'Send pictures (Attach Files)',
        permissions: [PermissionFlagsBits.AttachFiles]
    }
});

async function applyLevelRoleFeatures(role, level, reason = 'Updating level milestone permissions') {
    const feature = levelRoleFeatures[level];
    if (!feature || !role.editable) return false;

    const missingPermissions = feature.permissions.filter(permission => !role.permissions.has(permission));
    const changes = {};
    if (missingPermissions.length) changes.permissions = role.permissions.add(missingPermissions);
    if (!role.hoist) changes.hoist = true;
    if (!Object.keys(changes).length) return false;

    await role.edit({ ...changes, reason });
    return true;
}

module.exports = { levelRoleFeatures, applyLevelRoleFeatures };
