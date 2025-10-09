// index.js (FULL MERGED + FIXES)
// ------------------------------
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
const translateLib = require('@vitalets/google-translate-api').default;
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

const PORT = process.env.PORT || 3000;
const PREFIX = ']';
const TENOR_API_KEY = process.env.TENOR_API_KEY || '';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';

/* ---------- keep-alive server ---------- */
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

/* ---------- helpers ---------- */
async function fetchBuffer(url) {
  // fetch image/sticker as buffer (throws on non-200)
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  return Buffer.from(res.data);
}

async function getRandomTenorGif(keyword) {
  try {
    if (!TENOR_API_KEY) return null;
    // use Tenor v1 search (simple) - returns many results; pick random
    const q = encodeURIComponent(keyword);
    const url = `https://g.tenor.com/v1/search?q=${q}&key=${TENOR_API_KEY}&limit=20`;
    const res = await axios.get(url, { timeout: 10000 });
    const results = res.data?.results;
    if (!results || !results.length) return null;
    const pick = results[Math.floor(Math.random() * results.length)];
    // find a usable media url
    // Try common fields where gif/mp4/png might be present
    const media = pick.media && pick.media[0];
    if (!media) {
      // fallback to result.url
      return pick.url || null;
    }
    // choose gif > mediumgif > tinygif > mp4
    if (media.gif && media.gif.url) return media.gif.url;
    if (media.mediumgif && media.mediumgif.url) return media.mediumgif.url;
    if (media.tinygif && media.tinygif.url) return media.tinygif.url;
    if (media.mp4 && media.mp4.url) return media.mp4.url;
    // fallback to pick.url
    return pick.url || null;
  } catch (err) {
    console.error('Tenor error:', err?.message || err);
    return null;
  }
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------- presence + ready ---------- */
client.once('ready', async () => {
  console.log(`Bot ready! Logged in as ${client.user.tag}`);

  // set presence so bot appears online
  try {
    await client.user.setPresence({
      activities: [{ name: 'with GIFs and commands' }],
      status: 'online'
    });
  } catch (e) {
    console.warn('Failed to set presence:', e.message || e);
  }

  // register slash commands
  await registerSlashCommands();
});

/* ---------- slash commands registration ---------- */
async function registerSlashCommands() {
  const commands = [
    { name: 'joke', description: 'Get a random joke' },
    { name: 'meme', description: 'Get a random meme' },
    { name: 'cat', description: 'Get a random cat picture' },
    { name: 'dog', description: 'Get a random dog picture' },
    { 
      name: 'translate', 
      description: 'Translate text to another language', 
      options: [
        { name: 'lang', type: 3, description: 'Target language code (e.g., en, es)', required: true },
        { name: 'text', type: 3, description: 'Text to translate', required: true }
      ]
    },
    { name: 'hug', description: 'Hug someone', options: [{ name: 'user', type: 6, description: 'User', required: true }] },
    { name: 'slap', description: 'Slap someone', options: [{ name: 'user', type: 6, description: 'User', required: true }] },
    { name: 'highfive', description: 'High-five someone', options: [{ name: 'user', type: 6, description: 'User', required: true }] },
    { name: 'stealemoji', description: 'Add an emoji to this server (staff only)', options: [{ name: 'emoji', type: 3, description: 'Emoji URL or emoji ID', required: true }] },
    { name: 'stealsticker', description: 'Add a sticker to this server (staff only)', options: [{ name: 'sticker', type: 3, description: 'Sticker URL or sticker ID', required: true }] }
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('Refreshing application (/) commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
}

/* ---------- slash interactions ---------- */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`Slash interaction: ${interaction.commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);

  try {
    // Basic fun utility slash commands
    if (interaction.commandName === 'joke') {
      const res = await axios.get('https://official-joke-api.appspot.com/random_joke');
      await interaction.reply(`${res.data.setup}\n${res.data.punchline}`);
      return;
    }

    if (interaction.commandName === 'meme') {
      const res = await axios.get('https://meme-api.com/gimme');
      await interaction.reply(res.data.url || 'No meme right now 😢');
      return;
    }

    if (interaction.commandName === 'cat') {
      const res = await axios.get('https://api.thecatapi.com/v1/images/search');
      await interaction.reply(res.data[0]?.url || 'No cat 😿');
      return;
    }

    if (interaction.commandName === 'dog') {
      const res = await axios.get('https://dog.ceo/api/breeds/image/random');
      await interaction.reply(res.data.message || 'No dog 🐶');
      return;
    }

    if (interaction.commandName === 'translate') {
      const lang = interaction.options.getString('lang');
      const text = interaction.options.getString('text');
      const translated = await translateLib(text, { to: lang }).catch(() => null);
      if (!translated) return interaction.reply('Translation failed 😢');
      return interaction.reply(`**Translated (${translated.from.language.iso} → ${lang}):** ${translated.text}`);
    }

    // hug/slap/highfive - include Tenor GIFs and embed
    if (['hug', 'slap', 'highfive'].includes(interaction.commandName)) {
      const user = interaction.options.getUser('user');
      if (!user) return interaction.reply('User not found');
      const action = interaction.commandName;
      const gif = await getRandomTenorGif(action).catch(() => null);
      const embed = new EmbedBuilder()
        .setTitle(`${interaction.user.username} ${action}s ${user.username}!`)
        .setDescription(action === 'hug' ? 'So warm 🥰' : (action === 'slap' ? 'Oof! 👋' : 'High five! ✋'))
        .setColor('Random');
      if (gif) embed.setImage(gif);
      return interaction.reply({ embeds: [embed] });
    }

    // steal emoji
    if (interaction.commandName === 'stealemoji') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return interaction.reply({ content: 'You need Manage Emojis & Stickers permission to use this.', ephemeral: true });
      }
      const emojiInput = interaction.options.getString('emoji').trim();
      // accept full URL or ID
      const url = emojiInput.includes('http') ? emojiInput : `https://cdn.discordapp.com/emojis/${emojiInput}.png`;
      try {
        const buffer = await fetchBuffer(url);
        // pick a safe name
        const name = `emoji_${Date.now()}`;
        const emoji = await interaction.guild.emojis.create({ attachment: buffer, name });
        console.log('Emoji created:', emoji.id);
        return interaction.reply(`Emoji added: <:${emoji.name}:${emoji.id}>`);
      } catch (err) {
        console.error('stealemoji error:', err?.message || err);
        return interaction.reply(`Failed to add emoji: ${err?.message || err}`);
      }
    }

    // steal sticker
    if (interaction.commandName === 'stealsticker') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return interaction.reply({ content: 'You need Manage Emojis & Stickers permission to use this.', ephemeral: true });
      }
      const stickerInput = interaction.options.getString('sticker').trim();
      // try several CDN extensions (png -> png, png?format=png -> or webp)
      // prefer png first
      const candidates = stickerInput.includes('http') ? [stickerInput] : [
        `https://cdn.discordapp.com/stickers/${stickerInput}.png`,
        `https://cdn.discordapp.com/stickers/${stickerInput}.webp`,
        `https://cdn.discordapp.com/stickers/${stickerInput}.png?quality=lossless`
      ];
      let lastError = null;
      for (const url of candidates) {
        try {
          const buffer = await fetchBuffer(url);
          const name = `sticker_${Date.now()}`;
          // tags are required for sticker creation — give a generic tag
          const sticker = await interaction.guild.stickers.create({
            file: buffer,
            name,
            description: 'Imported sticker',
            tags: 'fun'
          });
          console.log('Sticker created:', sticker.id);
          return interaction.reply(`Sticker added: ${sticker.name}`);
        } catch (err) {
          lastError = err;
          console.warn('Candidate sticker URL failed:', url, err?.message || err);
          // try next candidate
        }
      }
      console.error('Failed to add sticker:', lastError?.message || lastError);
      return interaction.reply(`Failed to add sticker: ${lastError?.message || 'Invalid sticker or unsupported format'}`);
    }

  } catch (err) {
    console.error('Slash interaction error:', err);
    try { await interaction.reply({ content: 'Something went wrong 😢', ephemeral: true }); } catch {}
  }
});

/* ---------- prefix commands & auto replies ---------- */
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Auto replies (no prefix)
  const lc = message.content.toLowerCase();
  if (lc.includes('good morning')) {
    const gif = await getRandomTenorGif('good morning').catch(() => null);
    return message.reply(gif || 'Good morning! 🌅');
  }
  if (lc.includes('welcome')) {
    const gif = await getRandomTenorGif('welcome').catch(() => null);
    return message.reply(gif || 'Welcome! 👋');
  }

  // Only handle prefix commands below
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    // = Fun =
    if (command === 'joke') {
      const res = await axios.get('https://official-joke-api.appspot.com/jokes/random');
      return message.channel.send(`${res.data.setup}\n${res.data.punchline}`);
    }

    if (command === 'meme') {
      const res = await axios.get('https://meme-api.com/gimme');
      return message.channel.send(res.data?.url || 'No meme right now 😢');
    }

    if (command === 'cat') {
      const res = await axios.get('https://api.thecatapi.com/v1/images/search');
      return message.channel.send(res.data[0]?.url || 'No cat 😿');
    }

    if (command === 'dog') {
      const res = await axios.get('https://dog.ceo/api/breeds/image/random');
      return message.channel.send(res.data.message || 'No dog 🐶');
    }

    if (command === '8ball') {
      const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask later', 'I don’t know'];
      return message.channel.send(randomChoice(answers));
    }

    if (command === 'coinflip') {
      return message.channel.send(Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙');
    }

    if (command === 'gif') {
      if (!args.length) return message.channel.send('Please give a keyword for the GIF.');
      const keyword = args.join(' ');
      const gif = await getRandomTenorGif(keyword).catch(() => null);
      return message.channel.send(gif || `No GIF found for "${keyword}" 😢`);
    }

    if (command === 'fact') {
      const res = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
      return message.channel.send(res.data?.text || 'No fact right now 😢');
    }

    if (command === 'quote') {
      const res = await axios.get('https://api.quotable.io/random');
      return message.channel.send(`${res.data.content} — *${res.data.author}*`);
    }

    // translate (prefix)
    if (command === 'translate') {
      if (args.length < 2) return message.channel.send('Usage: ]translate <lang> <text>');
      const lang = args.shift();
      const text = args.join(' ');
      const translated = await translateLib(text, { to: lang }).catch(() => null);
      if (!translated) return message.channel.send('Translation failed 😢');
      return message.channel.send(`**Translated (${translated.from.language.iso} → ${lang}):** ${translated.text}`);
    }

    // = Interactive (embeds + gifs) =
    if (['hug','slap','highfive'].includes(command)) {
      const target = message.mentions.users.first();
      if (!target) return message.channel.send('Please mention someone!');
      const action = command;
      const gif = await getRandomTenorGif(action).catch(() => null);
      const embed = new EmbedBuilder()
        .setTitle(`${message.author.username} ${action}s ${target.username}!`)
        .setDescription(action === 'hug' ? 'So warm 🥰' : (action === 'slap' ? 'Oof! 👋' : 'High five! ✋'))
        .setColor('Random');
      if (gif) embed.setImage(gif);
      return message.channel.send({ embeds: [embed] });
    }

    if (command === 'roll') {
      const roll = Math.floor(Math.random() * 6) + 1;
      return message.channel.send(`${message.author} rolled a dice: ${roll}`);
    }

    if (command === 'pick') {
      const options = args.join(' ').split('|').map(o => o.trim()).filter(Boolean);
      if (options.length < 2) return message.channel.send('Give me at least 2 options separated by |');
      return message.channel.send(`I choose: **${randomChoice(options)}**`);
    }

    // = Utility =
    if (command === 'ping') {
      return message.channel.send(`Pong! 🏓 Latency: ${Math.round(client.ws.ping)}ms`);
    }

    if (command === 'serverinfo') {
      const guild = message.guild;
      const embed = new EmbedBuilder()
        .setTitle('Server Info')
        .addFields(
          { name: 'Server Name', value: guild.name, inline: true },
          { name: 'Members', value: `${guild.memberCount}`, inline: true },
          { name: 'Created On', value: `${guild.createdAt.toDateString()}`, inline: true }
        )
        .setColor('Blue');
      return message.channel.send({ embeds: [embed] });
    }

    if (command === 'userinfo') {
      const user = message.mentions.users.first() || message.author;
      const member = message.guild.members.cache.get(user.id);
      const embed = new EmbedBuilder()
        .setTitle(`${user.username} Info`)
        .addFields(
          { name: 'ID', value: user.id, inline: true },
          { name: 'Joined Server', value: member ? member.joinedAt.toDateString() : 'N/A', inline: true },
          { name: 'Roles', value: member ? member.roles.cache.map(r => r.name).join(', ') || 'None' : 'N/A' }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setColor('Green');
      return message.channel.send({ embeds: [embed] });
    }

    if (command === 'avatar') {
      const user = message.mentions.users.first() || message.author;
      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Avatar`)
        .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .setColor('Purple');
      return message.channel.send({ embeds: [embed] });
    }

    // = Steal emoji/sticker (prefix) =
    if (command === 'stealemoji') {
      // mantain staff-only rule: Manage Emojis & Stickers
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return message.channel.send('You need Manage Emojis & Stickers permission to use this.');
      }
      const emojiInput = args.join(' ').trim();
      const url = emojiInput.includes('http') ? emojiInput : `https://cdn.discordapp.com/emojis/${emojiInput}.png`;
      try {
        const buffer = await fetchBuffer(url);
        const name = `emoji_${Date.now()}`;
        const emoji = await message.guild.emojis.create({ attachment: buffer, name });
        return message.channel.send(`Emoji added: <:${emoji.name}:${emoji.id}>`);
      } catch (err) {
        console.error('stealemoji prefix error:', err);
        return message.channel.send(`Failed to add emoji: ${err?.message || 'Invalid asset'}`);
      }
    }

    if (command === 'stealsticker') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return message.channel.send('You need Manage Emojis & Stickers permission to use this.');
      }
      const stickerInput = args.join(' ').trim();
      const candidates = stickerInput.includes('http') ? [stickerInput] : [
        `https://cdn.discordapp.com/stickers/${stickerInput}.png`,
        `https://cdn.discordapp.com/stickers/${stickerInput}.webp`,
        `https://cdn.discordapp.com/stickers/${stickerInput}.png?quality=lossless`
      ];
      let lastError = null;
      for (const url of candidates) {
        try {
          const buffer = await fetchBuffer(url);
          const name = `sticker_${Date.now()}`;
          const sticker = await message.guild.stickers.create({
            file: buffer,
            name,
            description: 'Imported sticker',
            tags: 'fun'
          });
          return message.channel.send(`Sticker added: ${sticker.name}`);
        } catch (err) {
          lastError = err;
          console.warn('candidate sticker failed:', url, err?.message || err);
        }
      }
      console.error('stealsticker error:', lastError);
      return message.channel.send(`Failed to add sticker: ${lastError?.message || 'Invalid sticker or unsupported format'}`);
    }

    // = Help / default =
    if (command === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('🤖 Fun GIF Bot Commands')
        .setColor('Blue')
        .setDescription('All commands listed below:')
        .addFields(
          { name: 'Auto replies', value: '"good morning" → GIF\n"welcome" → GIF' },
          { name: 'Fun', value: `${PREFIX}joke, ${PREFIX}meme, ${PREFIX}cat, ${PREFIX}dog, ${PREFIX}8ball, ${PREFIX}coinflip, ${PREFIX}gif <keyword>, ${PREFIX}fact, ${PREFIX}quote, ${PREFIX}translate <lang> <text>` },
          { name: 'Interactive', value: `${PREFIX}hug @user, ${PREFIX}slap @user, ${PREFIX}highfive @user, ${PREFIX}roll, ${PREFIX}pick option1 | option2` },
          { name: 'Utility', value: `${PREFIX}ping, ${PREFIX}serverinfo, ${PREFIX}userinfo @user, ${PREFIX}avatar @user` },
          { name: 'Admin (staff)', value: `${PREFIX}stealemoji <url|id>, ${PREFIX}stealsticker <url|id>` },
          { name: 'Help', value: `${PREFIX}help → Show this embed` }
        )
        .setFooter({ text: 'Enjoy! 🎉' });
      return message.channel.send({ embeds: [helpEmbed] });
    }

    // default fallback for unhandled prefixed commands:
    return message.channel.send(`Unknown command. Use ${PREFIX}help to see all commands.`);
  } catch (err) {
    console.error('Prefix command error:', err);
    try { await message.channel.send('Something went wrong 😢'); } catch {}
  }
});

/* ---------- global error logging ---------- */
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

/* ---------- login ---------- */
if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN not set. Exiting.');
  process.exit(1);
}
client.login(DISCORD_TOKEN).catch(err => {
  console.error('Failed to login:', err);
  process.exit(1);
});
