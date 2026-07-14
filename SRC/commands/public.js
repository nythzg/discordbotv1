const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../models/UserProfile');
const GuildSettings = require('../models/GuildSettings');
const { getXpForLevel } = require('../utils/levelUtils');
const { drawRankCard } = require('../utils/canvasEngine');
const botConfig = require('../config/botConfig');

const rankCommand = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Render user experience metric profiles dashboard card.')
        .addUserOption(o => o.setName('target').setDescription('Target user member profile query')),
    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('target') || interaction.user;
        if (user.bot) return interaction.editReply('Bots do not scale experience metrics.');

        const guildId = interaction.guild.id;
        let settings = await GuildSettings.findOne({ guildId }).lean();
        const mult = settings ? settings.formulaMultiplier : botConfig.defaults.formulaMultiplier;

        const allSortedProfiles = await UserProfile.find({ guildId }).sort({ xp: -1 }).lean();
        const rankingPos = allSortedProfiles.findIndex(p => p.userId === user.id) + 1 || allSortedProfiles.length + 1;
        
        const currentProfile = allSortedProfiles.find(p => p.userId === user.id) || { xp: 0, level: 0 };

        const currentLvlBaseXp = getXpForLevel(currentProfile.level, mult);
        const nextLvlTargetXp = getXpForLevel(currentProfile.level + 1, mult);

        const relativeCurrentXp = currentProfile.xp - currentLvlBaseXp;
        const relativeTargetXp = nextLvlTargetXp - currentLvlBaseXp;

        const canvasBuffer = await drawRankCard(
            user.username,
            user.discriminator,
            user.displayAvatarURL({ extension: 'png', size: 256 }),
            currentProfile.level,
            relativeCurrentXp,
            relativeTargetXp,
            rankingPos
        );

        const imageAttachment = new AttachmentBuilder(canvasBuffer, { name: 'rank.png' });
        await interaction.editReply({ files: [imageAttachment] });
    }
};

const leaderboardCommand = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the community experience leaderboard.')
        .addStringOption(o => o.setName('type')
            .setDescription('Leaderboard filter context type')
            .addChoices(
                { name: 'Global All-Time', value: 'alltime' },
                { name: 'Weekly Metric Run', value: 'weekly' },
                { name: 'Monthly Metric Run', value: 'monthly' }
            )),
    async execute(interaction) {
        await interaction.deferReply();
        const filterType = interaction.options.getString('type') || 'alltime';
        const guildId = interaction.guild.id;

        let sortingField = 'xp';
        let displayLabelText = 'All-Time';
        if (filterType === 'weekly') { sortingField = 'weeklyXp'; displayLabelText = 'Weekly'; }
        if (filterType === 'monthly') { sortingField = 'monthlyXp'; displayLabelText = 'Monthly'; }

        const dataset = await UserProfile.find({ guildId })
            .sort({ [sortingField]: -1 })
            .limit(10)
            .lean();

        if (dataset.length === 0) {
            return interaction.editReply('No active user accounts logged in current runtime matrices.');
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${interaction.guild.name} - ${displayLabelText} Leaderboard`)
            .setColor('#7289da')
            .setTimestamp();

        let contextLinesString = '';
        for (let index = 0; index < dataset.length; index++) {
            const entry = dataset[index];
            const fetchedUser = await interaction.client.users.fetch(entry.userId).catch(() => null);
            const maskName = fetchedUser ? `**${fetchedUser.username}**` : `Left Member (\`${entry.userId}\`)`;
            const displayMetricVal = filterType === 'alltime' ? entry.xp : entry[sortingField];
            contextLinesString += `\`#${index + 1}\` ${maskName} • Level ${entry.level} (${displayMetricVal.toLocaleString()} XP)\n`;
        }

        embed.setDescription(contextLinesString);
        await interaction.editReply({ embeds: [embed] });
    }
};

module.exports = { commandsArray: [rankCommand, leaderboardCommand] };