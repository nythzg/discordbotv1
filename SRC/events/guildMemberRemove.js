const logger = require('../utils/logger');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member) {
        await logger.sendLog(member.guild, '❌ Member Left Guild Server', `Tracking data retained for user: ${member.user.tag}`, '#e74c3c');
    }
};