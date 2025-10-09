require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
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

const TENOR_API_KEY = process.env.TENOR_API_KEY;

// ======================
// Helper: fetch Tenor GIF
// ======================
async function fetchTenorGif(keyword) {
    try {
        const url = `https://g.tenor.com/v1/search?q=${encodeURIComponent(keyword)}&key=${TENOR_API_KEY}&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        return data.results[0]?.media[0]?.gif?.url || null;
    } catch (err) {
        console.error('Tenor fetch error:', err);
        return null;
    }
}

// ======================
// Slash commands
// ======================
async function registerSlashCommands() {
    const commands = [
        { name: 'joke', description: 'Get a random joke' },
        { name: 'meme', description: 'Get a random meme' },
        { name: 'cat', description: 'Get a random cat' },
        { name: 'dog', description: 'Get a random dog' },
        { name: '8ball', description: 'Ask the magic 8ball a question', options: [{ name: 'question', type: 3, description: 'Your question', required: true }] },
        { name: 'coinflip', description: 'Flip a coin' },
        { name: 'gif', description: 'Search a GIF on Tenor', options: [{ name: 'keyword', type: 3, description: 'Keyword to search', required: true }] },
        { name: 'fact', description: 'Get a random fact' },
        { name: 'quote', description: 'Get a random inspirational quote' },
        { name: 'hug', description: 'Hug a user', options: [{ name: 'user', type: 6, description: 'User to hug', required: true }] },
        { name: 'slap', description: 'Slap a user', options: [{ name: 'user', type: 6, description: 'User to slap', required: true }] },
        { name: 'highfive', description: 'Highfive a user', options: [{ name: 'user', type: 6, description: 'User to highfive', required: true }] },
        { name: 'roll', description: 'Roll a dice' },
        { name: 'pick', description: 'Pick one option', options: [{ name: 'options', type: 3, description: 'Separate options with |', required: true }] },
        { name: 'ping', description: 'Check bot latency' },
        { name: 'serverinfo', description: 'Get server info' },
        { name: 'userinfo', description: 'Get info about a user', options: [{ name: 'user', type: 6, description: 'User to get info for', required: true }] },
        { name: 'avatar', description: 'Get a user avatar', options: [{ name: 'user', type: 6, description: 'User', required: false }] },
        { name: 'stealemoji', description: 'Steal emoji from another server', options: [{ name: 'emoji', type: 3, description: 'Emoji ID or URL', required: true }] },
        { name: 'stealsticker', description: 'Steal sticker from another server', options: [{ name: 'sticker', type: 3, description: 'Sticker ID or URL', required: true }] }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Refreshing application (/) commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Slash commands registered!');
    } catch (err) {
        console.error('Error registering slash commands:', err);
    }
}

// ======================
// Bot ready
// ======================
client.once('ready', async () => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);
    await registerSlashCommands();
});

// ======================
// Slash command handler
// ======================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const name = interaction.commandName;

    try {
        // Interactive commands with Tenor GIFs
        if (['hug', 'slap', 'highfive', 'goodmorning', 'welcome'].includes(name)) {
            const target = interaction.options.getUser('user');
            const gif = await fetchTenorGif(name);
            const embed = new EmbedBuilder()
                .setTitle(target ? `${interaction.user.username} ${name}s ${target.username}!` : `${interaction.user.username} says ${name}!`)
                .setColor('Random');
            if (gif) embed.setImage(gif);
            interaction.reply({ embeds: [embed] });
        }

        if (name === 'gif') {
            const keyword = interaction.options.getString('keyword');
            const gif = await fetchTenorGif(keyword);
            if (!gif) return interaction.reply('No GIF found 😢');
            interaction.reply({ content: gif });
        }

        if (name === 'stealemoji') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) return interaction.reply('You need Manage Emojis & Stickers permission.');
            const emojiInput = interaction.options.getString('emoji');
            const url = emojiInput.includes('http') ? emojiInput : `https://cdn.discordapp.com/emojis/${emojiInput}.png`;
            try {
                const emoji = await interaction.guild.emojis.create({ attachment: url, name: `emoji_${Date.now()}` });
                interaction.reply(`Emoji added: ${emoji}`);
            } catch (err) {
                console.error(err);
                interaction.reply('Failed to add emoji.');
            }
        }

        if (name === 'stealsticker') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) return interaction.reply('You need Manage Emojis & Stickers permission.');
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
                console.error(err);
                interaction.reply('Failed to add sticker.');
            }
        }

        // Simple response commands (ping)
        if (name === 'ping') interaction.reply(`Pong! Latency is ${Date.now() - interaction.createdTimestamp}ms`);

    } catch (err) {
        console.error('Interaction error:', err);
        interaction.reply('Something went wrong 😢');
    }
});

// ======================
// Prefix command handler
// ======================
client.on('messageCreate', async message => {
    if (!message.content.startsWith(']') || message.author.bot) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    try {
        if (cmd === 'roll') {
            const result = Math.floor(Math.random() * 100) + 1;
            message.reply(`🎲 You rolled: **${result}**`);
        }

        if (cmd === 'coinflip') {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            message.reply(`🪙 ${result}`);
        }

        if (cmd === 'joke') message.reply('😂 Here is a random joke!'); // You can integrate an API
        if (cmd === 'meme') message.reply('🖼️ Random meme!'); // API integration
        if (cmd === 'cat') message.reply('🐱 Random cat!'); 
        if (cmd === 'dog') message.reply('🐶 Random dog!');
        if (cmd === '8ball') message.reply('🎱 The answer is yes!'); 
        if (cmd === 'fact') message.reply('📚 Random fact!'); 
        if (cmd === 'quote') message.reply('💡 Random quote!'); 

        if (cmd === 'pick') {
            if (!args.length) return message.reply('Provide options separated by |');
            const options = args.join(' ').split('|').map(o => o.trim());
            const choice = options[Math.floor(Math.random() * options.length)];
            message.reply(`I pick: **${choice}**`);
        }

        if (cmd === 'avatar') {
            const user = message.mentions.users.first() || message.author;
            message.reply(user.displayAvatarURL({ dynamic: true, size: 1024 }));
        }

        if (cmd === 'serverinfo') {
            const embed = new EmbedBuilder()
                .setTitle(message.guild.name)
                .setDescription('Server info')
                .addFields({ name: 'Members', value: `${message.guild.memberCount}`, inline: true })
                .setColor('Random');
            message.reply({ embeds: [embed] });
        }

        if (cmd === 'userinfo') {
            const user = message.mentions.users.first() || message.author;
            const embed = new EmbedBuilder()
                .setTitle(user.username)
                .setDescription('User info')
                .addFields({ name: 'ID', value: user.id, inline: true })
                .setColor('Random');
            message.reply({ embeds: [embed] });
        }

    } catch (err) {
        console.error('Prefix command error:', err);
        message.reply('Something went wrong 😢');
    }
});

client.login(process.env.DISCORD_TOKEN);
