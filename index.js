require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    REST, 
    Routes, 
    EmbedBuilder, 
    PermissionsBitField 
} = require('discord.js');
const translate = require('@vitalets/google-translate-api');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

client.once('ready', async () => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);

    // Set presence to online
    client.user.setPresence({ 
        activities: [{ name: 'with commands!' }], 
        status: 'online' 
    });

    // Register commands
    await registerSlashCommands();
});

// Slash commands registration
async function registerSlashCommands() {
    const commands = [
        {
            name: 'translate',
            description: 'Translate text to another language',
            options: [
                { name: 'lang', type: 3, description: 'Language code', required: true },
                { name: 'text', type: 3, description: 'Text to translate', required: true }
            ]
        },
        {
            name: 'hug',
            description: 'Send a hug',
            options: [{ name: 'user', type: 6, description: 'User to hug', required: true }]
        },
        {
            name: 'slap',
            description: 'Slap a user',
            options: [{ name: 'user', type: 6, description: 'User to slap', required: true }]
        },
        {
            name: 'stealemoji',
            description: 'Steal emoji from another server',
            options: [
                { name: 'emoji', type: 3, description: 'Emoji URL or ID', required: true }
            ]
        },
        {
            name: 'stealsticker',
            description: 'Steal sticker from another server',
            options: [
                { name: 'sticker', type: 3, description: 'Sticker URL or ID', required: true }
            ]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Slash commands registered!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

// Interaction handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    console.log(`Interaction received: ${interaction.commandName}`);

    try {
        if (interaction.commandName === 'translate') {
            const lang = interaction.options.getString('lang');
            const text = interaction.options.getString('text');
            const result = await translate(text, { to: lang }).catch(() => null);
            if (!result) return interaction.reply('Translation failed 😢');
            interaction.reply(`**Translated (${lang}):** ${result.text}`);
        }

        if (interaction.commandName === 'hug') {
            const user = interaction.options.getUser('user');
            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} hugs ${user.username}! 🤗`)
                .setColor('Random');
            interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === 'slap') {
            const user = interaction.options.getUser('user');
            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} slaps ${user.username}! 👋`)
                .setColor('Random');
            interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === 'stealemoji') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
                return interaction.reply('You need Manage Emojis & Stickers permission to use this.');
            }
            const emojiInput = interaction.options.getString('emoji');
            const url = emojiInput.includes('http') ? emojiInput : `https://cdn.discordapp.com/emojis/${emojiInput}.png`;
            try {
                const emoji = await interaction.guild.emojis.create({ attachment: url, name: `emoji_${Date.now()}` });
                interaction.reply(`Emoji added: ${emoji}`);
            } catch (err) {
                interaction.reply(`Failed to add emoji: ${err.message}`);
                console.error(err);
            }
        }

        if (interaction.commandName === 'stealsticker') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
                return interaction.reply('You need Manage Emojis & Stickers permission to use this.');
            }
            const stickerInput = interaction.options.getString('sticker');
            try {
                const sticker = await interaction.guild.stickers.create({
                    file: stickerInput,
                    name: `sticker_${Date.now()}`,
                    description: 'Stolen sticker',
                    tags: 'fun'
                });
                interaction.reply(`Sticker added: ${sticker.name}`);
            } catch (err) {
                interaction.reply(`Failed to add sticker: ${err.message}`);
                console.error(err);
            }
        }
    } catch (err) {
        console.error('Interaction error:', err);
        interaction.reply('Something went wrong 😢');
    }
});

client.login(process.env.DISCORD_TOKEN);

