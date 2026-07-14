const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../models/UserProfile');
const { getXpForLevel } = require('../utils/levelUtils');
const { drawRankCard } = require('../utils/canvasEngine');
const { progression } = require('../config/botConfig');

const rankCommand = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Show a member level and qualifying-message progress.')
        .addUserOption(option => option.setName('target').setDescription('Member to view')),
    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('target') || interaction.user;
        if (user.bot) return interaction.editReply('Bots do not receive levels.');

        const guildId = interaction.guild.id;
        const profiles = await UserProfile.find({ guildId }).sort({ messagesCount: -1 }).lean();
        const foundIndex = profiles.findIndex(profile => profile.userId === user.id);
        const rankingPosition = foundIndex >= 0 ? foundIndex + 1 : profiles.length + 1;
        const profile = foundIndex >= 0 ? profiles[foundIndex] : { messagesCount: 0, level: 0 };

        const currentLevelStart = getXpForLevel(profile.level, progression.messagesPerLevel);
        const nextLevelTarget = getXpForLevel(profile.level + 1, progression.messagesPerLevel);
        const currentProgress = profile.messagesCount - currentLevelStart;
        const requiredProgress = nextLevelTarget - currentLevelStart;

        const canvasBuffer = await drawRankCard(
            user.username,
            user.discriminator,
            user.displayAvatarURL({ extension: 'png', size: 256 }),
            profile.level,
            currentProgress,
            requiredProgress,
            rankingPosition
        );
        await interaction.editReply({ files: [new AttachmentBuilder(canvasBuffer, { name: 'rank.png' })] });
    }
};

const leaderboardCommand = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the qualifying-message leaderboard.')
        .addStringOption(option => option.setName('type')
            .setDescription('Leaderboard period')
            .addChoices(
                { name: 'All-Time', value: 'alltime' },
                { name: 'Weekly', value: 'weekly' },
                { name: 'Monthly', value: 'monthly' }
            )),
    async execute(interaction) {
        await interaction.deferReply();
        const filterType = interaction.options.getString('type') || 'alltime';
        const guildId = interaction.guild.id;

        let sortingField = 'messagesCount';
        let periodLabel = 'All-Time';
        if (filterType === 'weekly') { sortingField = 'weeklyXp'; periodLabel = 'Weekly'; }
        if (filterType === 'monthly') { sortingField = 'monthlyXp'; periodLabel = 'Monthly'; }

        const profiles = await UserProfile.find({ guildId })
            .sort({ [sortingField]: -1 })
            .limit(10)
            .lean();
        if (!profiles.length) return interaction.editReply('No qualifying messages have been recorded yet.');

        const lines = [];
        for (let index = 0; index < profiles.length; index++) {
            const profile = profiles[index];
            const user = await interaction.client.users.fetch(profile.userId).catch(() => null);
            const name = user ? `**${user.username}**` : `Former Member (\`${profile.userId}\`)`;
            lines.push(`\`#${index + 1}\` ${name} • Level ${profile.level} (${profile[sortingField].toLocaleString()} messages)`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${interaction.guild.name} — ${periodLabel} Leaderboard`)
            .setColor('#7289da')
            .setDescription(lines.join('\n'))
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
};

module.exports = { commandsArray: [rankCommand, leaderboardCommand] };
