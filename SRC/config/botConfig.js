const defaults = {
    xpCooldown: 60,
    xpMin: 15,
    xpMax: 25,
    formulaMultiplier: 100
};

const progression = {
    messagesPerLevel: 600
};

const antiAbuse = {
    minWordLength: 4,
    maxIdenticalHashesTracked: 3
};

const levelRoles = {
    5: 'PASTE_ROLE_ID_1',
    10: 'PASTE_ROLE_ID_2',
    20: 'PASTE_ROLE_ID_3'
};

const generalChannelId = process.env.GENERAL_CHANNEL_ID || '1395944374931685517';
const memberRoleId = process.env.MEMBER_ROLE_ID || '1408734349460897933';

module.exports = { defaults, progression, antiAbuse, levelRoles, generalChannelId, memberRoleId };
