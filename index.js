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
const fetch = require('node-fetch');

const TENOR_API_KEY = process.env.TENOR_API_KEY;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

const PREFIX = ']';
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

client.once('ready', async () => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);
    await registerSlashCommands();
});

async function registerSlashCommands() {
    const commands = [
        { name: 'joke', description: 'Get a random joke' },
        { name: 'meme', description: 'Get a random meme' },
        { name: 'cat', description: 'Get a random cat gif' },
        { name: 'dog', description: 'Get a random dog gif' },
        { name: '8ball', description: 'Ask the magic 8ball', options: [{ name: 'question', type: 3, description: 'Your question', required: true }] },
        { name: 'coinflip', description: 'Flip a coin' },
        { name: 'gif', description: 'Search a gif', options: [{ name: 'keyword', type: 3, description: 'Keyword to search', required: true }] },
        { name: 'fact', description: 'Get a random fact' },
        { name: 'quote', description: 'Get a random quote' },
        { name: 'hug', description: 'Hug a user', options: [{ name: 'user', type: 6, description: 'User to hug', required: true }] },
        { name: 'slap', description: 'Slap a user', options: [{ name: 'user', type: 6, description: 'User to slap', required: true }] },
        { name: 'highfive', description: 'Highfive a user', options: [{ name: 'user', type: 6, description: 'User to highfive', required: true }] },
        { name: 'touch', description: 'Touch a user', options: [{ name: 'user', type: 6, description: 'User to touch', required: true }] },
        { name: 'roll', description: 'Roll a dice' },
        { name: 'pick', description: 'Pick an option', options: [{ name: 'options', type: 3, description: 'Options separated by |', required: true }] },
        { name: 'ping', description: 'Check bot latency' },
        { name: 'serverinfo', description: 'Get server info' },
        { name: 'userinfo', description: 'Get user info', options: [{ name: 'user', type: 6, description: 'User', required: false }] },
        { name: 'avatar', description: 'Get user avatar', options: [{ name: 'user', type: 6, description: 'User', required: false }] },
        { name: 'stealemoji', description: 'Steal emoji from another server', options: [{ name: 'emoji', type: 3, description: 'Emoji ID or URL', required: true }] },
        { name: 'stealsticker', description: 'Steal sticker from another server', options: [{ name: 'sticker', type: 3, description: 'Sticker ID or URL', required: true }] },
        { name: 'help', description: 'Show all commands and usage' }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Refreshing application (/) commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Slash commands registered!');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
}

async function getTenorGif(keyword) {
    try {
        const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(keyword)}&key=${TENOR_API_KEY}&limit=20`);
        const data = await res.json();
        if (!data.results || data.results.length === 0) return null;
        const gif = data.results[Math.floor(Math.random() * data.results.length)];
        return gif.media_formats.gif.url;
    } catch (err) {
        console.error('Tenor API error:', err);
        return null;
    }
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();
    if (content.includes('good morning')) {
        const gif = await getTenorGif('good morning');
        message.channel.send(gif || 'Good morning! 🌞');
    }
    if (content.includes('welcome')) {
        const gif = await getTenorGif('welcome');
        message.channel.send(gif || 'Welcome!');
    }

    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        switch (command) {
            case 'help': {
                const embed = new EmbedBuilder()
                    .setTitle('🤖 Fun GIF Bot Commands')
                    .setDescription(
                        `**Auto replies:**\n"good morning" → GIF\n"welcome" → GIF\n\n` +
                        `**Fun:**\n]joke, ]meme, ]cat, ]dog, ]8ball, ]coinflip, ]gif <keyword>, ]fact, ]quote\n\n` +
                        `**Interactive:**\n]hug @user, ]slap @user, ]highfive @user, ]touch @user, ]roll, ]pick option1 | option2\n\n` +
                        `**Utility:**\n]ping, ]serverinfo, ]userinfo @user, ]avatar @user\n\n` +
                        `**Steal:**\n]stealemoji <emoji_id>\n]stealsticker <sticker_id>\n\nEnjoy! 🎉`
                    )
                    .setColor('Random');
                message.channel.send({ embeds: [embed] });
                break;
            }

            case 'ping':
                message.channel.send(`🏓 Pong! Latency: ${Date.now() - message.createdTimestamp}ms`);
                break;

            case 'joke': {
                const response = await fetch('https://v2.jokeapi.dev/joke/Any');
                const data = await response.json();
                message.channel.send(data.type === 'single' ? data.joke : `${data.setup}\n${data.delivery}`);
                break;
            }

            case 'meme': {
                const url = await getTenorGif('meme');
                message.channel.send(url || 'No meme GIF found 😢');
                break;
            }

            case 'cat': {
                const url = await getTenorGif('cat');
                message.channel.send(url || 'No cat GIF found 😢');
                break;
            }

            case 'dog': {
                const url = await getTenorGif('dog');
                message.channel.send(url || 'No dog GIF found 😢');
                break;
            }

            case '8ball': {
                const responses = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask again later'];
                message.channel.send(responses[Math.floor(Math.random() * responses.length)]);
                break;
            }

            case 'coinflip':
                message.channel.send(Math.random() < 0.5 ? 'Heads' : 'Tails');
                break;

            case 'gif': {
                const keyword = args.join(' ');
                if (!keyword) return message.channel.send('Please provide a keyword.');
                const url = await getTenorGif(keyword);
                message.channel.send(url || 'No GIF found 😢');
                break;
            }

            case 'fact': {
                const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
                const data = await response.json();
                message.channel.send(data.text);
                break;
            }

            case 'quote': {
                try {
                    const response = await fetch('https://api.quotable.io/random');
                    const data = await response.json();
                    message.channel.send(`"${data.content}" — ${data.author}`);
                } catch {
                    message.channel.send('Something went wrong fetching a quote 😢');
                }
                break;
            }

            case 'hug':
            case 'slap':
            case 'highfive':
            case 'touch': {
                const user = message.mentions.users.first();
                if (!user) return message.channel.send('Please mention a user!');
                const gif = await getTenorGif(command);
                const embed = new EmbedBuilder()
                    .setTitle(`${message.author.username} ${command}s ${user.username}!`)
                    .setImage(gif)
                    .setColor('Random');
                message.channel.send({ embeds: [embed] });
                break;
            }

            case 'roll': {
                const roll = Math.floor(Math.random() * 100) + 1;
                message.channel.send(`🎲 You rolled: ${roll}`);
                break;
            }

            case 'pick': {
                const options = args.join(' ').split('|').map(o => o.trim()).filter(o => o);
                if (options.length < 2) return message.channel.send('Provide at least 2 options separated by |');
                const choice = options[Math.floor(Math.random() * options.length)];
                message.channel.send(`I pick: **${choice}**`);
                break;
            }

            case 'serverinfo': {
                const embed = new EmbedBuilder()
                    .setTitle(message.guild.name)
                    .setDescription(`ID: ${message.guild.id}\nMembers: ${message.guild.memberCount}`)
                    .setColor('Random');
                message.channel.send({ embeds: [embed] });
                break;
            }

            case 'userinfo': {
                const user = message.mentions.users.first() || message.author;
                const embed = new EmbedBuilder()
                    .setTitle(user.tag)
                    .setDescription(`ID: ${user.id}`)
                    .setColor('Random')
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }));
                message.channel.send({ embeds: [embed] });
                break;
            }

            case 'avatar': {
                const user = message.mentions.users.first() || message.author;
                message.channel.send(user.displayAvatarURL({ dynamic: true, size: 1024 }));
                break;
            }

            case 'stealemoji': {
                if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
                    return message.channel.send('You need Manage Emojis & Stickers permission to use this.');
                }
                const emojiInput = args[0];
                const url = emojiInput.includes('http') ? emojiInput : `https://cdn.discordapp.com/emojis/${emojiInput}.png`;
                try {
                    const emoji = await message.guild.emojis.create({ attachment: url, name: `emoji_${Date.now()}` });
                    message.channel.send(`Emoji added: ${emoji}`);
                } catch (err) {
                    console.error(err);
                    message.channel.send(`Failed to add emoji: ${err.message}`);
                }
                break;
            }

            case 'stealsticker': {
                if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
                    return message.channel.send('You need Manage Emojis & Stickers permission to use this.');
                }
                const stickerInput = args[0];
                try {
                    const sticker = await message.guild.stickers.create({
                        file: stickerInput,
                        name: `sticker_${Date.now()}`,
                        description: 'Stolen sticker',
                        tags: 'fun'
                    });
                    message.channel.send(`Sticker added: ${sticker.name}`);
                } catch (err) {
                    console.error(err);
                    message.channel.send(`Failed to add sticker: ${err.message}`);
                }
                break;
            }
        }
    } catch (err) {
        console.error('Prefix command error:', err);
        message.channel.send('Something went wrong 😢');
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    try {
        const { commandName } = interaction;
        const argsText = interaction.options.data.map(o => o.value).join(' ');
        const fakeMessage = {
            content: `${PREFIX}${commandName} ${argsText}`,
            author: interaction.user,
            mentions: { users: new Map(interaction.options.data.filter(o => o.type === 6).map(o => [o.value, interaction.user])) },
            guild: interaction.guild,
            channel: interaction.channel,
            member: interaction.member,
            reply: msg => interaction.reply({ content: msg, ephemeral: false })
        };
        client.emit('messageCreate', fakeMessage);
    } catch (err) {
        console.error('Slash command error:', err);
        interaction.reply('Something went wrong 😢');
    }
});

client.login(process.env.DISCORD_TOKEN);

