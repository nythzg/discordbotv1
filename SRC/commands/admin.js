const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const UserProfile = require('../models/UserProfile');
const Reward = require('../models/Reward');
const GuildSettings = require('../models/GuildSettings');
const { getLevelFromXp } = require('../utils/levelUtils');
const { defaults } = require('../config/botConfig');
const { sendLevelUpNotification } = require('../utils/levelUpNotifier');
const { levelRoleFeatures, applyLevelRoleFeatures } = require('../utils/levelRoleFeatures');
const logger = require('../utils/logger');

const adminSuiteCommand = {
    data: new SlashCommandBuilder()
        .setName('adminlevel')
        .setDescription('Manage the server leveling system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('xpadd')
            .setDescription('Add XP directly to a user.')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('XP to add').setRequired(true).setMinValue(1)))
        .addSubcommand(sub => sub.setName('setreward')
            .setDescription('Map an existing role to a level milestone.')
            .addIntegerOption(o => o.setName('level').setDescription('Required level').setRequired(true).setMinValue(1))
            .addRoleOption(o => o.setName('role').setDescription('Role to award').setRequired(true)))
        .addSubcommand(sub => sub.setName('setuproles')
            .setDescription('Create level roles and configure them as automatic rewards.')
            .addIntegerOption(o => o.setName('maxlevel')
                .setDescription('Highest role level (default: 50)')
                .setMinValue(5)
                .setMaxValue(250))
            .addIntegerOption(o => o.setName('interval')
                .setDescription('Levels between roles (default: 5)')
                .setMinValue(1)
                .setMaxValue(50)))
        .addSubcommand(sub => sub.setName('resetall')
            .setDescription('Delete all leveling profiles for this server.')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'xpadd') {
            const user = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const settings = await GuildSettings.findOne({ guildId }).lean();
            const multiplier = settings?.formulaMultiplier ?? defaults.formulaMultiplier;

            const data = await UserProfile.findOneAndUpdate(
                { userId: user.id, guildId },
                { $inc: { xp: amount } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            const previousLevel = data.level;
            data.level = getLevelFromXp(data.xp, multiplier);
            await data.save();

            let rolesAdded = 0;
            let roleWarning = '';
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (member) {
                const earnedRewards = await Reward.find({ guildId, level: { $lte: data.level } }).lean();
                const missingRoleIds = [...new Set(earnedRewards.map(reward => reward.roleId))]
                    .filter(roleId => {
                        const role = interaction.guild.roles.cache.get(roleId);
                        return role && role.editable && !member.roles.cache.has(roleId);
                    });
                if (missingRoleIds.length) {
                    try {
                        await member.roles.add(missingRoleIds, `Level rewards synchronized after XP was added by ${interaction.user.tag}`);
                        rolesAdded = missingRoleIds.length;
                    } catch (error) {
                        logger.error('XP was added, but reward roles could not be synchronized:', error);
                        roleWarning = ' I could not assign the earned roles; check my **Manage Roles** permission and role position.';
                    }
                }
            }

            if (data.level > previousLevel) {
                await sendLevelUpNotification(interaction.guild, interaction.channel, user, data.level);
            }

            await interaction.editReply(
                `Added ${amount} XP to ${user.username}. Total: ${data.xp}; level: ${data.level}; ` +
                `new reward roles: ${rolesAdded}.${roleWarning}`
            );
            await logger.sendLog(interaction.guild, 'Admin Action: XP Added', `${interaction.user.tag} added ${amount} XP to ${user.tag}.`, '#e74c3c');
            return;
        }

        if (sub === 'setreward') {
            const level = interaction.options.getInteger('level');
            const role = interaction.options.getRole('role');

            if (role.managed || !role.editable) {
                return interaction.editReply('I cannot assign that role. Move my bot role above it and ensure it is not managed by an integration.');
            }
            await Reward.findOneAndUpdate(
                { guildId, level },
                { roleId: role.id },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            let membersSynced = 0;
            const eligibleProfiles = await UserProfile.find({ guildId, level: { $gte: level } }).lean();
            for (const profile of eligibleProfiles) {
                const member = await interaction.guild.members.fetch(profile.userId).catch(() => null);
                if (!member || member.roles.cache.has(role.id)) continue;
                await member.roles.add(role, `Synchronizing Level ${level} reward`);
                membersSynced++;
            }

            await interaction.editReply(`Level ${level} will now automatically receive ${role}. Existing members synchronized: ${membersSynced}.`);
            await logger.sendLog(interaction.guild, 'Admin Action: Reward Changed', `${interaction.user.tag} mapped Level ${level} to ${role.name}.`, '#e74c3c');
            return;
        }

        if (sub === 'setuproles') {
            const botMember = interaction.guild.members.me;
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.editReply('I need the **Manage Roles** permission before I can create and assign level roles.');
            }

            const maxLevel = interaction.options.getInteger('maxlevel') || 50;
            const interval = interaction.options.getInteger('interval') || 5;
            const levels = [];
            for (let level = interval; level <= maxLevel; level += interval) levels.push(level);

            const missingCount = levels.filter(level =>
                !interaction.guild.roles.cache.some(role => role.name === `Level ${level}` && !role.managed && role.editable)
            ).length;
            if (interaction.guild.roles.cache.size + missingCount > 250) {
                return interaction.editReply(`This server does not have enough available role slots. ${missingCount} new roles are required.`);
            }

            const created = [];
            const reused = [];
            const rewards = [];
            for (const level of levels) {
                const roleName = `Level ${level}`;
                let role = interaction.guild.roles.cache.find(existing =>
                    existing.name === roleName && !existing.managed && existing.editable
                );
                if (!role) {
                    role = await interaction.guild.roles.create({
                        name: roleName,
                        reason: `Level reward setup requested by ${interaction.user.tag}`
                    });
                    created.push(roleName);
                } else {
                    reused.push(roleName);
                }

                await applyLevelRoleFeatures(
                    role,
                    level,
                    `Applying Level ${level} milestone features requested by ${interaction.user.tag}`
                );

                await Reward.findOneAndUpdate(
                    { guildId, level },
                    { roleId: role.id },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                rewards.push({ level, roleId: role.id });
            }

            await interaction.guild.roles.setPositions(
                rewards.map((reward, index) => ({ role: reward.roleId, position: index + 1 }))
            );

            let membersSynced = 0;
            const profiles = await UserProfile.find({ guildId, level: { $gte: interval } }).lean();
            for (const profile of profiles) {
                const member = await interaction.guild.members.fetch(profile.userId).catch(() => null);
                if (!member) continue;
                const earnedRoleIds = rewards.filter(reward => reward.level <= profile.level).map(reward => reward.roleId);
                const missingRoleIds = earnedRoleIds.filter(roleId => !member.roles.cache.has(roleId));
                if (!missingRoleIds.length) continue;
                await member.roles.add(missingRoleIds, 'Synchronizing earned level rewards');
                membersSynced++;
            }

            await interaction.editReply(
                `Configured **${levels.length}** automatic level roles through Level ${maxLevel}. ` +
                `Created: **${created.length}**; reused: **${reused.length}**; existing members synchronized: **${membersSynced}**.\n` +
                Object.entries(levelRoleFeatures)
                    .filter(([level]) => Number(level) <= maxLevel)
                    .map(([level, feature]) => `Level ${level}: ${feature.label}`)
                    .join('\n')
            );
            await logger.sendLog(interaction.guild, 'Admin Action: Level Roles Configured', `${interaction.user.tag} configured ${levels.length} level roles.`, '#e74c3c');
            return;
        }

        if (sub === 'resetall') {
            await UserProfile.deleteMany({ guildId });
            await interaction.editReply('All leveling profiles for this server were deleted.');
            await logger.sendLog(interaction.guild, 'Admin Action: Level Data Reset', `All server leveling data was cleared by ${interaction.user.tag}.`, '#e74c3c');
        }
    }
};

module.exports = adminSuiteCommand;
