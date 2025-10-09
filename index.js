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

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

const PREFIX = ']';

client.once('ready', () => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);
    registerSlashCommands();
});

// ---------------------
// SLASH COMMANDS
// ---------------------
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

// ---------------------
// PREFIX COMMANDS
// ---------------------
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    try {
        switch (cmd) {
            // Fun commands
            case 'joke':
                const jokeRes = await axios.get('https://official-joke-api.appspot.com/jokes/random');
                message.channel.send(`${jokeRes.data.setup}\n${jokeRes.data.punchline}`);
                break;

            case 'meme':
                const memeRes = await axios.get('https://meme-api.com/gimme');
                message.channel.send(memeRes.data.url);
                break;

            case 'cat':
                const catRes = await axios.get('https://api.thecatapi.com/v1/images/search');
                message.channel.send(catRes.data[0].url);
                break;

            case 'dog':
                const dogRes = await axios.get('https://dog.ceo/api/breeds/image/random');
                message.channel.send(dogRes.data.message);
                break;

            case '8ball':
                const responses = ['Yes', 'No', 'Maybe', 'Absolutely', 'Definitely not', 'Ask again later'];
                message.channel.send(responses[Math.floor(Math.random() * responses.length)]);
                break;

            case 'coinflip':
                message.channel.send(Math.random() < 0.5 ? 'Heads' : 'Tails');
                break;

            case 'roll':
                message.channel.send(`🎲 You rolled: ${Math.floor(Math.random() * 100) + 1}`);
                break;

            case 'pick':
                const pickOptions = args.join(' ').split('|').map(o => o.trim());
                if (pickOptions.length < 2) return message.channel.send('Please provide options separated by |');
                message.channel.send(`I pick: **${pickOptions[Math.floor(Math.random() * pickOptions.length)]}**`);
                break;

            case 'ping':
                message.channel.send(`Pong! 🏓 Latency: ${client.ws.ping}ms`);
                break;

            case 'avatar':
                const user = message.mentions.users.first() || message.author;
                message.channel.send(user.displayAvatarURL({ dynamic: true, size: 1024 }));
                break;

            case 'userinfo':
                const u = message.mentions.users.first() || message.author;
                message.channel.send(`Username: ${u.tag}\nID: ${u.id}\nCreated: ${u.createdAt}`);
                break;

            case 'serverinfo':
                const s = message.guild;
                message.channel.send(`Server: ${s.name}\nID: ${s.id}\nMembers: ${s.memberCount}`);
                break;

            case 'gif':
                if (!args.length) return message.channel.send('Provide a keyword for the GIF.');
                const gifRes = await axios.get(`https://g.tenor.com/v1/search?q=${encodeURIComponent(args.join(' '))}&key=${process.env.TENOR_API_KEY}&limit=1`);
                if (!gifRes.data.results[0]) return message.channel.send('No GIF found 😢');
                message.channel.send(gifRes.data.results[0].url);
                break;

            case 'fact':
                const factRes = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
                message.channel.send(factRes.data.text);
                break;

            case 'quote':
                const quoteRes = await axios.get('https://api.quotable.io/random');
                message.channel.send(`${quoteRes.data.content} — *${quoteRes.data.author}*`);
                break;

            case 'translate':
                if (args.length < 2) return message.channel.send('Usage: ]translate <lang> <text>');
                const lang = args.shift();
                const text = args.join(' ');
                const tRes = await translate(text, { to: lang }).catch(() => null);
                if (!tRes) return message.channel.send('Translation failed 😢');
                message.channel.send(`**Translated (${lang}):** ${tRes.text}`);
                break;

            case 'help':
                const helpEmbed = new EmbedBuilder()
                    .setTitle('🤖 Fun GIF Bot Commands')
                    .setColor('Random')
                    .setDescription(`
**Auto replies**
"good morning" → GIF
"welcome" → GIF

**Fun**
]joke, ]meme, ]cat, ]dog, ]8ball, ]coinflip, ]gif <keyword>, ]fact, ]quote, ]translate <lang> <text>

**Interactive**
]hug @user, ]slap @user, ]highfive @user, ]roll, ]pick option1 | option2

**Utility**
]ping, ]serverinfo, ]userinfo @user, ]avatar @user

**Help**
]help → Show this embed

Enjoy! 🎉
                `);
                message.channel.send({ embeds: [helpEmbed] });
                break;

            default:
                // Auto replies
                const msg = message.content.toLowerCase();
                if (msg.includes('good morning')) {
                    const morningGif = await axios.get(`https://g.tenor.com/v1/search?q=good+morning&key=${process.env.TENOR_API_KEY}&limit=1`);
                    message.channel.send(morningGif.data.results[0].url);
                }
                if (msg.includes('welcome')) {
                    const welcomeGif = await axios.get(`https://g.tenor.com/v1/search?q=welcome&key=${process.env.TENOR_API_KEY}&limit=1`);
                    message.channel.send(welcomeGif.data.results[0].url);
                }
                break;
        }
    } catch (err) {
        console.error('Prefix command error:', err);
        message.channel.send('Something went wrong 😢');
    }
});

// ---------------------
// SLASH COMMAND HANDLER
// ---------------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const { commandName } = interaction;

        if (commandName === 'translate') {
            const lang = interaction.options.getString('lang');
            const text = interaction.options.getString('text');
            const result = await translate(text, { to: lang }).catch(() => null);
            if (!result) return interaction.reply('Translation failed 😢');
            interaction.reply(`**Translated (${lang}):** ${result.text}`);
        }

        if (commandName === 'hug') {
            const user = interaction.options.getUser('user');
            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} hugs ${user.username}! 🤗`)
                .setColor('Random');
            interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'slap') {
            const user = interaction.options.getUser('user');
            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} slaps ${user.username}! 👋`)
                .setColor('Random');
            interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'stealemoji') {
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

        if (commandName === 'stealsticker') {
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

