// index.js (FULL MERGED)
// Requirements:
// - env: DISCORD_TOKEN, TENOR_API_KEY, PORT (optional)
// - package.json should include node-fetch, discord.js, dotenv, express, axios (axios optional)
// - A file bank.json will be created for economy persistence

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  EmbedBuilder,
  PermissionsBitField,
  Collection
} = require('discord.js');

const TENOR_API_KEY = process.env.TENOR_API_KEY || '';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN not set. Exiting.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const PREFIX = ']';

// ----- Keep-alive / basic web server (for Render / Replit / UptimeRobot) -----
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Discord Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

// ----- Economy simple DB (file-based) -----
const BANK_FILE = path.join(__dirname, 'bank.json');
let bank = {};
try {
  if (fs.existsSync(BANK_FILE)) {
    bank = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8') || '{}');
  } else {
    bank = {};
  }
} catch (e) {
  console.error('Failed to load bank.json:', e);
  bank = {};
}
function saveBank() {
  try {
    fs.writeFileSync(BANK_FILE, JSON.stringify(bank, null, 2));
  } catch (e) {
    console.error('Failed to save bank.json:', e);
  }
}
function ensureAccount(id) {
  if (!bank[id]) {
    bank[id] = { balance: 200 }; // starter money
    saveBank();
  }
}
function addMoney(id, amount) {
  ensureAccount(id);
  bank[id].balance = (bank[id].balance || 0) + amount;
  saveBank();
}
function removeMoney(id, amount) {
  ensureAccount(id);
  bank[id].balance = Math.max(0, (bank[id].balance || 0) - amount);
  saveBank();
}
function getBalance(id) {
  ensureAccount(id);
  return bank[id].balance || 0;
}

// ----- Slash command registration -----
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
    { name: 'stealemoji', description: 'Steal emoji from another server (URL or ID)', options: [{ name: 'emoji', type: 3, description: 'Emoji ID or URL', required: true }] },
    { name: 'stealsticker', description: 'Steal sticker from another server (URL or ID)', options: [{ name: 'sticker', type: 3, description: 'Sticker ID or URL', required: true }] },
    { name: 'help', description: 'Show all commands and usage' },
    { name: 'balance', description: 'Show your balance' },
    { name: 'gamble', description: 'Gamble some coins', options: [{ name: 'amount', type: 4, description: 'Amount to gamble', required: true }] },
    { name: 'shop', description: 'Show shop items' },
    { name: 'buy', description: 'Buy a shop item', options: [{ name: 'item', type: 3, description: 'Item id', required: true }] },
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('Refreshing application (/) commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered!');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}

// ----- Tenor helper (robust) -----
async function getTenorGif(keyword) {
  try {
    if (!TENOR_API_KEY) return null;
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(keyword)}&key=${TENOR_API_KEY}&limit=24&random=true`;
    const res = await fetch(url, { timeout: 10000 });
    const data = await res.json();
    if (!data) return null;
    // try a few shapes
    const results = data.results || data.items || [];
    if (!results.length) return null;
    const pick = results[Math.floor(Math.random() * results.length)];
    // common v2 shape: pick.media_formats.gif.url
    if (pick.media_formats && pick.media_formats.gif && pick.media_formats.gif.url) return pick.media_formats.gif.url;
    // older shapes:
    if (pick.media && pick.media[0] && pick.media[0].gif && pick.media[0].gif.url) return pick.media[0].gif.url;
    if (pick.url) return pick.url;
    // try finding any .gif or .mp4 in pick object
    const asString = JSON.stringify(pick);
    const m = asString.match(/https?:\/\/[^"\s]*\.(?:gif|mp4|webp)/i);
    if (m) return m[0];
    return null;
  } catch (err) {
    console.error('Tenor API error:', err && err.message ? err.message : err);
    return null;
  }
}

// ----- Utility: download to buffer -----
async function downloadToBuffer(url) {
  try {
    const r = await fetch(url, { timeout: 15000 });
    if (!r.ok) throw new Error(`Download failed: ${r.status}`);
    const buf = await r.buffer();
    return buf;
  } catch (err) {
    throw err;
  }
}

// ----- Shop data -----
const SHOP = [
  { id: 'vip', name: 'VIP Role (demo)', price: 1000, desc: 'A demo VIP (you must manually add role).' },
  { id: 'color', name: 'Color Change (demo)', price: 500, desc: 'A demo color perk (manual).' }
];

// ----- Core command handler (used by prefix and by slash wrapper) -----
async function handleCommand(context, command, args) {
  // context: { author, channel, guild, member, replyFn, sendFn }
  // sendFn(content/obj) and replyFn(content/obj) must be functions returning Promises
  const send = context.sendFn;
  const reply = context.replyFn || send;

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
            `**Steal:**\n]stealemoji <emoji_id|url>\n]stealsticker <sticker_id|url>\n\n` +
            `**Economy:**\n]balance, ]gamble <amount>, ]shop, ]buy <item>\n\nEnjoy! 🎉`
          )
          .setColor('Blue');
        return send({ embeds: [embed] });
      }

      case 'ping':
        return send(`🏓 Pong! Latency: ${Date.now() - context.messageTimestamp}ms`);

      case 'joke': {
        const r = await fetch('https://v2.jokeapi.dev/joke/Any');
        const d = await r.json();
        return send(d.type === 'single' ? d.joke : `${d.setup}\n${d.delivery}`);
      }

      case 'meme': {
        // meme via Tenor search "meme"
        const url = await getTenorGif('meme') || 'https://i.imgur.com/AI6X9bT.jpg';
        const embed = new EmbedBuilder().setImage(url).setFooter({ text: 'Random meme (Tenor)' });
        return send({ embeds: [embed] });
      }

      case 'cat': {
        const url = await getTenorGif('cat') || 'https://i.imgur.com/J5qZb.gif';
        return send({ embeds: [new EmbedBuilder().setImage(url).setFooter({ text: 'Random cat (Tenor)' })] });
      }

      case 'dog': {
        const url = await getTenorGif('dog') || 'https://i.imgur.com/8pQGQ.gif';
        return send({ embeds: [new EmbedBuilder().setImage(url).setFooter({ text: 'Random dog (Tenor)' })] });
      }

      case '8ball': {
        const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask again later'];
        return send(answers[Math.floor(Math.random() * answers.length)]);
      }

      case 'coinflip':
        return send(Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙');

      case 'gif': {
        const keyword = args.join(' ').trim();
        if (!keyword) return send('Please provide a keyword.');
        const url = await getTenorGif(keyword);
        if (!url) return send('No GIF found 😢');
        return send({ embeds: [new EmbedBuilder().setImage(url).setFooter({ text: `GIF for "${keyword}"` })] });
      }

      case 'fact': {
        const r = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
        const d = await r.json();
        return send(d.text || 'No fact found.');
      }

      case 'quote': {
        try {
          const r = await fetch('https://api.quotable.io/random');
          const d = await r.json();
          return send(`"${d.content}" — ${d.author}`);
        } catch {
          return send('Something went wrong fetching a quote 😢');
        }
      }

      case 'hug':
      case 'slap':
      case 'highfive':
      case 'touch': {
        const target = context.mentions?.first && context.mentions.first() || context.mentionedUser || (args && args[0] && context.guild?.members?.cache?.get(args[0]));
        // fallback: try args first as raw id
        let user = null;
        if (context.mentions && typeof context.mentions.first === 'function') user = context.mentions.first();
        if (!user && args.length && args[0]) {
          try { user = await context.guild?.members.fetch(args[0]).then(m=>m.user).catch(()=>null); } catch {}
        }
        if (!user) return send('Please mention a user!');
        const gif = await getTenorGif(command) || null;
        const embed = new EmbedBuilder().setTitle(`${context.author.username} ${command}s ${user.username}!`).setColor('Random');
        if (gif) embed.setImage(gif);
        return send({ embeds: [embed] });
      }

      case 'roll': {
        const n = Math.floor(Math.random() * 100) + 1;
        return send(`🎲 You rolled: ${n}`);
      }

      case 'pick': {
        const options = args.join(' ').split('|').map(o=>o.trim()).filter(Boolean);
        if (options.length < 2) return send('Provide at least 2 options separated by |');
        const choice = options[Math.floor(Math.random() * options.length)];
        return send(`I pick: **${choice}**`);
      }

      case 'serverinfo': {
        const embed = new EmbedBuilder().setTitle(context.guild.name).setDescription(`ID: ${context.guild.id}\nMembers: ${context.guild.memberCount}`).setColor('Blue');
        return send({ embeds: [embed] });
      }

      case 'userinfo': {
        let user = null;
        if (args.length && args[0]) {
          try { user = await context.guild.members.fetch(args[0]).then(m=>m.user).catch(()=>null); } catch {}
        }
        if (!user) user = context.author;
        const embed = new EmbedBuilder().setTitle(`${user.tag}`).setThumbnail(user.displayAvatarURL({ dynamic: true })).addFields(
          { name: 'ID', value: user.id, inline: true }
        ).setColor('Green');
        return send({ embeds: [embed] });
      }

      case 'avatar': {
        let user = null;
        if (args.length && args[0]) {
          try { user = await context.guild.members.fetch(args[0]).then(m=>m.user).catch(()=>null); } catch {}
        }
        if (!user) user = context.author;
        return send({ content: `${user.username}'s Avatar:`, files: [user.displayAvatarURL({ dynamic: true, size: 1024 })] });
      }

      case 'stealemoji': {
        if (!context.member?.permissions?.has?.(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
          return send('You need Manage Emojis & Stickers permission to use this.');
        }
        const emojiInput = args[0];
        if (!emojiInput) return send('Provide an emoji ID or URL.');
        // Try to form a usable URL or accept direct URL
        let url = emojiInput;
        // If input looks like <:name:id> pattern, extract id
        const customMatch = emojiInput.match(/:(\d+)>$/);
        if (customMatch) {
          const id = customMatch[1];
          url = `https://cdn.discordapp.com/emojis/${id}.png`;
        } else if (!emojiInput.startsWith('http')) {
          // maybe they passed raw id
          url = `https://cdn.discordapp.com/emojis/${emojiInput}.png`;
        }
        try {
          const buf = await downloadToBuffer(url);
          // if buffer is tiny, maybe the url is gif; still okay
          const emoji = await context.guild.emojis.create({ attachment: buf, name: `emoji_${Date.now()}` });
          return send(`Emoji added: <:${emoji.name}:${emoji.id}>`);
        } catch (err) {
          console.error('Failed to add emoji:', err && err.message ? err.message : err);
          return send(`Failed to add emoji: ${err.message || err}`);
        }
      }

      case 'stealsticker': {
        if (!context.member?.permissions?.has?.(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
          return send('You need Manage Emojis & Stickers permission to use this.');
        }
        const stickerInput = args[0];
        if (!stickerInput) return send('Provide a sticker ID or URL.');
        let url = stickerInput;
        // user might pass sticker id -> sticker CDN path (may be webp)
        if (!stickerInput.startsWith('http')) {
          url = `https://cdn.discordapp.com/stickers/${stickerInput}.png`;
        }
        try {
          const buf = await downloadToBuffer(url);
          const sticker = await context.guild.stickers.create({
            file: buf,
            name: `sticker_${Date.now()}`,
            description: 'Added by bot',
            tags: 'fun'
          });
          return send(`Sticker added: ${sticker.name}`);
        } catch (err) {
          console.error('Failed to add sticker:', err && err.message ? err.message : err);
          return send(`Failed to add sticker: ${err.message || err}`);
        }
      }

      // ----- Economy
      case 'balance': {
        const bal = getBalance(context.author.id);
        return send(`${context.author.username}, your balance: **${bal}** coins`);
      }

      case 'gamble': {
        const amount = Number(args[0]);
        if (!amount || amount <= 0) return send('Usage: ]gamble <amount>');
        ensureAccount(context.author.id);
        const bal = getBalance(context.author.id);
        if (amount > bal) return send('You don\'t have that many coins.');
        const win = Math.random() < 0.5;
        if (win) {
          addMoney(context.author.id, amount);
          return send(`You won! You gained **${amount}** coins. New balance: **${getBalance(context.author.id)}**`);
        } else {
          removeMoney(context.author.id, amount);
          return send(`You lost **${amount}** coins. New balance: **${getBalance(context.author.id)}**`);
        }
      }

      case 'shop': {
        const embed = new EmbedBuilder().setTitle('Shop').setDescription(SHOP.map(i=>`**${i.id}** — ${i.name} — ${i.price} coins\n${i.desc}`).join('\n\n')).setColor('Purple');
        return send({ embeds: [embed] });
      }

      case 'buy': {
        const itemId = args[0];
        if (!itemId) return send('Usage: ]buy <item>');
        const item = SHOP.find(i=>i.id === itemId);
        if (!item) return send('Item not found.');
        const bal2 = getBalance(context.author.id);
        if (bal2 < item.price) return send(`Not enough coins. ${item.price} needed.`);
        removeMoney(context.author.id, item.price);
        // NOTE: actual perks (roles etc.) require server-side config - this is a demo
        return send(`You bought **${item.name}** for **${item.price}** coins. New balance: **${getBalance(context.author.id)}**`);
      }

      default:
        return send('Unknown command. Use ]help to see available commands.');
    }
  } catch (err) {
    console.error('Command handler error:', err);
    return send('Oops! Something went wrong 😢');
  }
}

// ----- Message (prefix) handling wrapper that builds context expected by handleCommand -----
client.on('messageCreate', async message => {
  try {
    if (message.author.bot) return;

    // Auto-replies (no prefix)
    const raw = message.content.toLowerCase();
    if (raw.includes('good morning')) {
      const gif = await getTenorGif('good morning');
      if (gif) {
        const embed = new EmbedBuilder().setDescription('Good morning! 🌅').setImage(gif);
        await message.channel.send({ embeds: [embed] });
      } else {
        await message.channel.send('Good morning! 🌅');
      }
      return;
    }
    if (raw.includes('welcome')) {
      const gif = await getTenorGif('welcome');
      if (gif) {
        const embed = new EmbedBuilder().setDescription('Welcome! 👋').setImage(gif);
        await message.channel.send({ embeds: [embed] });
      } else {
        await message.channel.send('Welcome! 👋');
      }
      return;
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const context = {
      author: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      messageTimestamp: message.createdTimestamp,
      mentions: message.mentions,
      mentionedUser: message.mentions.users.first ? message.mentions.users.first() : null,
      // functions used by handler
      replyFn: async (m) => {
        if (typeof m === 'string') return message.reply(m);
        return message.reply(m);
      },
      sendFn: async (m) => {
        if (typeof m === 'string') return message.channel.send(m);
        return message.channel.send(m);
      },
    };

    await handleCommand(context, command, args);

  } catch (err) {
    console.error('messageCreate top error:', err);
  }
});

// ----- Slash commands: translate slash interaction to command execution while wiring replies correctly -----
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await interaction.deferReply({ ephemeral: false }); // allow multiple followups
    const commandName = interaction.commandName;
    const options = interaction.options.data || [];

    // build args array from options (strings, integers, user ids) - preserve order
    const args = options.map(opt => {
      // user type is 6 in the registration; opt.value will be user id sometimes — prefer interaction.options.getUser
      if (opt.type === 6) return interaction.options.getUser(opt.name).id;
      return opt.value;
    }).filter(Boolean);

    // Build a context that maps sendFn/replyFn to interaction.reply/followUp
    let firstReplySent = false;
    const sendQueue = [];
    const context = {
      author: interaction.user,
      member: interaction.member,
      guild: interaction.guild,
      channel: interaction.channel,
      messageTimestamp: Date.now(),
      mentions: {
        first: () => {
          // try to get first user option
          const uOpt = options.find(o => o.type === 6);
          if (!uOpt) return null;
          return interaction.options.getUser(uOpt.name);
        }
      },
      replyFn: async (m) => {
        if (!firstReplySent) {
          firstReplySent = true;
          if (typeof m === 'string') return interaction.editReply({ content: m });
          return interaction.editReply(m);
        } else {
          return interaction.followUp(typeof m === 'string' ? { content: m } : m);
        }
      },
      sendFn: async (m) => {
        return context.replyFn(m);
      }
    };

    await handleCommand(context, commandName, args);
    // If no reply was made at all (edge case), finalize with a small ping
    // (We assume handleCommand always replies; if not, ensure we editReply)
    // No extra handling here.

  } catch (err) {
    console.error('Slash command error:', err);
    try { await interaction.followUp({ content: 'Something went wrong 😢', ephemeral: false }); } catch {}
  }
});

// ----- Ready -----
client.once('ready', async () => {
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
  await registerSlashCommands().catch(err => console.error('Slash register error:', err));
});

// ----- login -----
client.login(DISCORD_TOKEN).catch(err => {
  console.error('Failed to login:', err && err.message ? err.message : err);
  process.exit(1);
});
