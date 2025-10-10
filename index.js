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
        // Use built-in fetch (available in Node.js 18+)
        const res = await global.fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(keyword)}&key=${TENOR_API_KEY}&limit=20`);
        const data = await res.json();
        if (!data.results || data.results.length === 0) return null;
        const gif = data.results[Math.floor(Math.random() * data.results.length)];
        return gif.media_formats.gif.url;
    } catch (err) {
        console.error('Tenor API error:', err);
        return null;
    }
}

// Simple commands that don't rely on external APIs
const simpleCommands = {
    'ping': (message) => message.reply(`🏓 Pong! Latency: ${Date.now() - message.createdTimestamp}ms`),
    '8ball': (message) => {
        const responses = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask again later'];
        message.reply(responses[Math.floor(Math.random() * responses.length)]);
    },
    'coinflip': (message) => message.reply(Math.random() < 0.5 ? 'Heads' : 'Tails'),
    'roll': (message) => message.reply(`🎲 You rolled: ${Math.floor(Math.random() * 100) + 1}`),
    'pick': (message, args) => {
        const options = args.join(' ').split('|').map(o => o.trim()).filter(o => o);
        if (options.length < 2) return message.reply('Provide at least 2 options separated by |');
        const choice = options[Math.floor(Math.random() * options.length)];
        message.reply(`I pick: **${choice}**`);
    }
};

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    console.log(`📨 Message: "${message.content}" from ${message.author.tag}`);

    // Auto-replies
    const content = message.content.toLowerCase();
    if (content.includes('good morning')) {
        console.log('🌞 Triggering good morning auto-reply');
        message.reply('Good morning! 🌞');
    }
    if (content.includes('welcome')) {
        console.log('👋 Triggering welcome auto-reply');
        message.reply('Welcome! 👋');
    }

    // Prefix commands
    if (!message.content.startsWith(PREFIX)) return;
    
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    console.log(`🎯 Prefix command: ${command}`);

    try {
        // Handle simple commands first
        if (simpleCommands[command]) {
            return simpleCommands[command](message, args);
        }

        switch (command) {
            case 'help': {
                const embed = new EmbedBuilder()
                    .setTitle('🤖 Fun GIF Bot Commands')
                    .setDescription(
                        `**Prefix:** ${PREFIX}\n\n` +
                        `**Auto replies:**\n"good morning" → Reply\n"welcome" → Reply\n\n` +
                        `**Simple Commands:**\n${PREFIX}ping, ${PREFIX}8ball, ${PREFIX}coinflip, ${PREFIX}roll, ${PREFIX}pick\n\n` +
                        `**Need API (may not work):**\n${PREFIX}joke, ${PREFIX}meme, ${PREFIX}cat, ${PREFIX}dog, ${PREFIX}gif, ${PREFIX}fact, ${PREFIX}quote\n\n` +
                        `Enjoy! 🎉`
                    )
                    .setColor('Random');
                message.reply({ embeds: [embed] });
                break;
            }

            case 'cat':
                message.reply('🐱 Meow! (GIF feature temporarily disabled)');
                break;

            case 'dog':
                message.reply('🐶 Woof! (GIF feature temporarily disabled)');
                break;

            case 'gif':
                message.reply('🎬 GIF search temporarily disabled');
                break;

            case 'serverinfo': {
                const embed = new EmbedBuilder()
                    .setTitle(message.guild.name)
                    .setDescription(`ID: ${message.guild.id}\nMembers: ${message.guild.memberCount}`)
                    .setColor('Random');
                message.reply({ embeds: [embed] });
                break;
            }

            case 'userinfo': {
                const user = message.mentions.users.first() || message.author;
                const embed = new EmbedBuilder()
                    .setTitle(user.tag)
                    .setDescription(`ID: ${user.id}`)
                    .setColor('Random')
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }));
                message.reply({ embeds: [embed] });
                break;
            }

            case 'avatar': {
                const user = message.mentions.users.first() || message.author;
                message.reply(user.displayAvatarURL({ dynamic: true, size: 1024 }));
                break;
            }

            default:
                message.reply(`Unknown command. Use ${PREFIX}help for available commands.`);
        }
    } catch (err) {
        console.error('Prefix command error:', err);
        message.reply('Something went wrong 😢');
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    console.log(`🔧 Slash command: ${interaction.commandName}`);
    
    try {
        // Handle simple slash commands
        if (interaction.commandName === 'ping') {
            await interaction.reply(`🏓 Pong! Latency: ${Math.round(client.ws.ping)}ms`);
        } else if (interaction.commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('🤖 Bot Help')
                .setDescription('Use prefix commands with `]` or slash commands with `/`')
                .setColor('Random');
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply('Command temporarily disabled for maintenance');
        }
    } catch (err) {
        console.error('Slash command error:', err);
        await interaction.reply('Something went wrong 😢');
    }
});

client.login(process.env.DISCORD_TOKEN);

