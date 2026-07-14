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

const managedMilestonePermissions = [
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.UseExternalStickers,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.MoveMembers
];

async function applyLevelRoleFeatures(role, level, reason = 'Updating level milestone permissions') {
    const feature = levelRoleFeatures[level];
    if (!feature || !role.editable) return false;

    const desiredPermissions = role.permissions
        .remove(managedMilestonePermissions)
        .add(feature.permissions);
    const changes = {};
    if (desiredPermissions.bitfield !== role.permissions.bitfield) changes.permissions = desiredPermissions;
    if (!role.hoist) changes.hoist = true;
    if (!Object.keys(changes).length) return false;

    await role.edit({ ...changes, reason });
    return true;
}

module.exports = { levelRoleFeatures, applyLevelRoleFeatures };
