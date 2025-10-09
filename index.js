require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder, PermissionsBitField } = require('discord.js');
const translate = require('@vitalets/google-translate-api');
const axios = require('axios');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildEmojisAndStickers
    ],
    partials: [Partials.Channel]
});

const TENOR_API_KEY = process.env.TENOR_API_KEY;
const PREFIX = ']';
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

client.once('ready', () => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);
    registerSlashCommands();
});

// ------------------- Slash Commands -------------------
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
            description: 'Send a hug GIF',
            options: [{ name: 'user', type: 6, description: 'User to hug', required: true }]
        },
        {
            name: 'slap',
            description: 'Slap a user with a GIF',
            options: [{ name: 'user', type: 6, description: 'User to slap', required: true }]
        },
        {
            name: 'highfive',
            description: 'Highfive a user',
            options: [{ name: 'user', type: 6, description: 'User to highfive', required: true }]
        },
        {
            name: 'stealemoji',
            description: 'Steal emoji from another server',
            options: [{ name: 'emoji', type: 3, description: 'Emoji ID', required: true }]
        },
        {
            name: 'stealsticker',
            description: 'Steal sticker from another server',
            options: [{ name: 'sticker', type: 3, description: 'Sticker ID', required: true }]
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

// ------------------- Interaction Commands -------------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    try {
        if (interaction.commandName === 'translate') {
            const lang = interaction.options.getString('lang');
            const text = interaction.options.getString('text');
            const result = await translate.default(text, { to: lang }).catch(() => null);
            if (!result) return interaction.reply('Translation failed 😢');
            interaction.reply(`**Translated (${lang}):** ${result.text}`);
        }

        const fetchTenor = async (keyword) => {
            try {
                const res = await axios.get(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(keyword)}&key=${TENOR_API_KEY}&limit=50&random=true`);
                if (res.data.results && res.data.results.length > 0) {
                    return res.data.results[Math.floor(Math.random() * res.data.results.length)].media_formats.gif.url;
                }
            } catch (err) { console.error(err); }
            return null;
        };

        if (interaction.commandName === 'hug') {
            const user = interaction.options.getUser('user');
            const gif = await fetchTenor('hug');
            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} hugs ${user.username}! 🤗`)
                .setColor('Random')
                .setImage(gif || null);
            interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === 'slap') {
            const user = interaction.options.getUser('user');
            const gif = await fetchTenor('slap');
            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} slaps ${user.username}! 👋`)
                .setColor('Random')
                .setImage(gif || null);
            interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === 'highfive') {
            const user = interaction.options.getUser('user');
            const gif = await fetchTenor('highfive');
            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} highfives ${user.username}! ✋`)
                .setColor('Random')
                .setImage(gif || null);
            interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === 'stealemoji') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) return interaction.reply('You need Manage Emojis & Stickers permission.');
            const emojiId = interaction.options.getString('emoji');
            try {
                const emoji = await interaction.guild.emojis.create({ attachment: `https://cdn.discordapp.com/emojis/${emojiId}.png`, name: `emoji_${Date.now()}` });
                interaction.reply(`Emoji added: ${emoji}`);
            } catch (err) { interaction.reply(`Failed to add emoji: ${err.message}`); console.error(err); }
        }

        if (interaction.commandName === 'stealsticker') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) return interaction.reply('You need Manage Emojis & Stickers permission.');
            const stickerId = interaction.options.getString('sticker');
            try {
                const sticker = await interaction.guild.stickers.create({ file: `https://cdn.discordapp.com/stickers/${stickerId}.png`, name: `sticker_${Date.now()}`, description: 'Stolen sticker', tags: 'fun' });
                interaction.reply(`Sticker added: ${sticker.name}`);
            } catch (err) { interaction.reply(`Failed to add sticker: ${err.message}`); console.error(err); }
        }

    } catch (err) {
        console.error('Interaction error:', err);
        interaction.reply('Something went wrong 😢');
    }
});

// ------------------- Prefix Commands -------------------
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const sendTenorGif = async (keyword, contentFallback) => {
        try {
            const gif = await axios.get(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(keyword)}&key=${TENOR_API_KEY}&limit=50&random=true`);
            if (gif.data.results && gif.data.results.length > 0) {
                const url = gif.data.results[Math.floor(Math.random() * gif.data.results.length)].media_formats.gif.url;
                return { embeds: [new EmbedBuilder().setImage(url).setColor('Random')] };
            }
        } catch (err) { console.error(err); }
        return contentFallback ? { content: contentFallback } : null;
    };

    // Auto-replies
    const contentLower = message.content.toLowerCase();
    if (contentLower.includes('good morning')) {
        const embedResp = await sendTenorGif('good morning', 'Good morning!');
        if (embedResp) message.channel.send(embedResp);
    } else if (contentLower.includes('welcome')) {
        const embedResp = await sendTenorGif('welcome', 'Welcome!');
        if (embedResp) message.channel.send(embedResp);
    }

    // Commands
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    try {
        if (cmd === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('🤖 Fun GIF Bot Commands')
                .setColor('Random')
                .setDescription(`
All commands listed below:

Auto replies:
"good morning" → GIF
"welcome" → GIF

Fun:
]joke, ]meme, ]cat, ]dog, ]8ball, ]coinflip, ]gif <keyword>, ]fact, ]quote, ]translate <lang> <text>

Interactive:
]hug @user, ]slap @user, ]highfive @user, ]roll, ]pick option1 | option2

Utility:
]ping, ]serverinfo, ]userinfo @user, ]avatar @user

Steal:
]stealemoji <emoji_id>
]stealsticker <sticker_id>

Enjoy! 🎉`);
            message.channel.send({ embeds: [embed] });
        }

        if (cmd === 'translate') {
            const lang = args.shift();
            const text = args.join(' ');
            const result = await translate.default(text, { to: lang }).catch(() => null);
            message.channel.send(result ? `**Translated (${lang}):** ${result.text}` : 'Translation failed 😢');
        }

        // Example fun commands
        if (cmd === 'hug') {
            const user = message.mentions.users.first();
            if (!user) return message.channel.send('Mention someone to hug!');
            const embedResp = await sendTenorGif('hug', `${message.author.username} hugs ${user.username}! 🤗`);
            if (embedResp) message.channel.send(embedResp);
        }

        if (cmd === 'slap') {
            const user = message.mentions.users.first();
            if (!user) return message.channel.send('Mention someone to slap!');
            const embedResp = await sendTenorGif('slap', `${message.author.username} slaps ${user.username}! 👋`);
            if (embedResp) message.channel.send(embedResp);
        }

        if (cmd === 'highfive') {
            const user = message.mentions.users.first();
            if (!user) return message.channel.send('Mention someone to highfive!');
            const embedResp = await sendTenorGif('highfive', `${message.author.username} highfives ${user.username}! ✋`);
            if (embedResp) message.channel.send(embedResp);
        }

        // Add your other old fun/utility commands here (joke, meme, cat, dog, 8ball, coinflip, gif, fact, quote, ping, userinfo, serverinfo, avatar, roll, pick)
    } catch (err) {
        console.error('Prefix command error:', err);
        message.channel.send('Something went wrong 😢');
    }
});

client.login(process.env.DISCORD_TOKEN);
