// index.js — Full working version (patched as requested)
// Requirements:
// npm install node-fetch discord.js dotenv express
// .env must include DISCORD_TOKEN and optionally TENOR_API_KEY, OWNER_ID, and PORT

// ---- Fetch shim for Node (works with node-fetch v3 dynamic import) ----
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
global.fetch = fetch;

// ---- Modules & config ----
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  EmbedBuilder,
  PermissionsBitField,
} = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TENOR_API_KEY = process.env.TENOR_API_KEY || '';
const OWNER_ID = process.env.OWNER_ID || ''; // used for refill admin command
const PORT = process.env.PORT || 3000;

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN missing from .env — exiting.');
  process.exit(1);
}

// ---- Express keep-alive ----
const express = require('express');
const app = express();
app.get('/', (_, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

// ---- Discord client ----
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ---- DB: bank.json ----
const BANK_FILE = path.join(__dirname, 'bank.json');
let bank = {};
try {
  if (fs.existsSync(BANK_FILE)) bank = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8') || '{}');
  else bank = {};
} catch (e) {
  console.error('Failed to load bank.json', e);
  bank = {};
}
function saveBank() {
  try { fs.writeFileSync(BANK_FILE, JSON.stringify(bank, null, 2)); } catch (e) { console.error('Failed saving bank.json', e); }
}
function ensureAccount(id) {
  if (!bank[id]) {
    bank[id] = { balance: 200, lastDaily: 0, inventory: [] }; // give a small starting balance
    saveBank();
  }
}
function getBalance(id) { ensureAccount(id); return bank[id].balance || 0; }
function addMoney(id, amount) { ensureAccount(id); bank[id].balance = (bank[id].balance || 0) + Number(amount); saveBank(); }
function removeMoney(id, amount) { ensureAccount(id); bank[id].balance = Math.max(0, (bank[id].balance || 0) - Number(amount)); saveBank(); }
function getLastDaily(id) { ensureAccount(id); return bank[id].lastDaily || 0; }
function setLastDaily(id, ts) { ensureAccount(id); bank[id].lastDaily = ts; saveBank(); }

// ---- Shop (demo) ----
const SHOP = [
  { id: 'vip', name: 'VIP Role (demo)', price: 1000, desc: 'Manual role assignment demo.' },
  { id: 'color', name: 'Color Change (demo)', price: 500, desc: 'Manual color change demo.' },
];

// ---- Tenor helper (robust) ----
async function getTenorGif(keyword) {
  // Will return a GIF (url) or null
  try {
    if (!TENOR_API_KEY) return null;
    const q = encodeURIComponent(keyword);
    const url = `https://tenor.googleapis.com/v2/search?q=${q}&key=${TENOR_API_KEY}&limit=24&random=true`;
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) return null;
    const json = await res.json();
    const items = json?.results || json?.items || [];
    if (!items.length) return null;
    // choose a random item
    const pick = items[Math.floor(Math.random() * items.length)];
    // try standard v2 shapes
    if (pick?.media_formats?.gif?.url) return pick.media_formats.gif.url;
    if (pick?.media_formats?.mediumgif?.url) return pick.media_formats.mediumgif.url;
    // older shapes
    if (pick?.media && Array.isArray(pick.media) && pick.media[0]?.gif?.url) return pick.media[0].gif.url;
    if (typeof pick === 'string') return pick;
    if (pick?.url) return pick.url;
    // last: scan object for gif/mp4/webp
    const s = JSON.stringify(pick);
    const m = s.match(/https?:\/\/[^"'\s]+?\.(?:gif|mp4|webp)/i);
    if (m) return m[0];
    return null;
  } catch (err) {
    console.error('getTenorGif error:', err && err.message ? err.message : err);
    return null;
  }
}

// ---- Utility: download to buffer (used for emoji/sticker import) ----
async function downloadToBuffer(url) {
  const r = await fetch(url, { timeout: 15000 });
  if (!r.ok) throw new Error(`Download failed: ${r.status}`);
  // node-fetch's response has arrayBuffer or buffer depending; use arrayBuffer then convert
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

// ---- Slash registration ----
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const commands = [
    { name: 'joke', description: 'Get a random joke' },
    { name: 'meme', description: 'Get a random meme' },
    { name: 'cat', description: 'Get a random cat gif' },
    { name: 'dog', description: 'Get a random dog gif' },
    { name: '8ball', description: 'Ask the magic 8ball', options: [{ name: 'question', type: 3, description: 'Your question', required: true }] },
    { name: 'coinflip', description: 'Flip a coin' },
    { name: 'gif', description: 'Search a gif', options: [{ name: 'keyword', type: 3, description: 'Keyword', required: true }] },
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
    { name: 'stealemoji', description: 'Steal emoji (URL or ID)', options: [{ name: 'emoji', type: 3, description: 'Emoji URL or ID', required: true }] },
    { name: 'stealsticker', description: 'Steal sticker (URL or ID)', options: [{ name: 'sticker', type: 3, description: 'Sticker URL or ID', required: true }] },
    { name: 'help', description: 'Show commands' },
    { name: 'balance', description: 'Show your balance' },
    { name: 'daily', description: 'Claim daily clouds (100)' },
    {
      name: 'gamble',
      description: 'Gamble clouds',
      options: [
        { name: 'amount', type: 4, description: 'Amount to gamble', required: true },
        { name: 'type', type: 3, description: 'coin or card', required: false }
      ]
    },
    { name: 'shop', description: 'Show shop' },
    { name: 'buy', description: 'Buy a shop item', options: [{ name: 'item', type: 3, description: 'Item id', required: true }] },
    { name: 'pay', description: 'Send clouds to a user', options: [{ name: 'user', type: 6, description: 'Recipient', required: true }, { name: 'amount', type: 4, description: 'Amount', required: true }] },
    { name: 'refill', description: 'Owner: refill clouds for a user', options: [{ name: 'user', type: 6, description: 'Recipient', required: true }, { name: 'amount', type: 4, description: 'Amount', required: true }] },
  ];

  try {
    console.log('Refreshing application (/) commands...');
    await rest.put(Routes.applicationCommands((await client.application.fetch()).id), { body: commands });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error('Failed to register slash commands', err);
  }
}

// ---- Core handler used by both prefix and slash ----
async function handleCommand(context, command, args = []) {
  // context: { author, member, guild, channel, sendFn, replyFn, mentions, messageTimestamp }
  const send = context.sendFn;
  const reply = context.replyFn || send;

  try {
    command = (command || '').toString().toLowerCase();

    // HELP
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Fun GIF Bot Commands')
        .setDescription(
          `**Auto replies:** "good morning" → GIF, "welcome" → GIF\n\n` +
          `**Fun:** ]joke, ]meme, ]cat, ]dog, ]8ball, ]coinflip, ]gif, ]fact, ]quote\n` +
          `**Interact:** ]hug @user, ]slap @user, ]highfive @user, ]touch @user\n` +
          `**Economy:** ]balance, ]daily, ]gamble <amt> [coin|card], ]shop, ]buy <item>, ]pay <@user> <amt>\n\n` +
          `Slash versions exist for many commands too.`
        )
        .setColor('Blue');
      return send({ embeds: [embed] });
    }

    // PING
    if (command === 'ping') {
      const latency = Date.now() - (context.messageTimestamp || Date.now());
      return send(`🏓 Pong! Latency: ${latency}ms`);
    }

    // JOKE
    if (command === 'joke') {
      try {
        const r = await fetch('https://v2.jokeapi.dev/joke/Any');
        const d = await r.json();
        return send(d.type === 'single' ? d.joke : `${d.setup}\n${d.delivery}`);
      } catch (err) {
        console.error('joke fetch error', err);
        return send('Could not fetch a joke right now.');
      }
    }

    // MEME
    if (command === 'meme') {
      // Use Tenor "meme" or fallback image
      const url = (await getTenorGif('meme')) || 'https://i.imgur.com/AI6X9bT.jpg';
      const embed = new EmbedBuilder().setImage(url).setFooter({ text: 'Random meme' });
      return send({ embeds: [embed] });
    }

    // CAT / DOG / GIF
    if (command === 'cat' || command === 'dog') {
      const url = (await getTenorGif(command)) || null;
      if (url) return send({ embeds: [new EmbedBuilder().setImage(url).setFooter({ text: `Random ${command}` })] });
      return send(`No ${command} GIF found right now.`);
    }
    if (command === 'gif') {
      const kw = args.join(' ').trim();
      if (!kw) return send('Usage: gif <keyword>');
      const url = await getTenorGif(kw);
      if (!url) return send('No GIF found for that keyword.');
      return send({ embeds: [new EmbedBuilder().setImage(url).setFooter({ text: `GIF for "${kw}"` })] });
    }

    // FACT
    if (command === 'fact') {
      try {
        const r = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
        const d = await r.json();
        return send(d.text || 'No fact found.');
      } catch (err) {
        return send('Could not fetch a fact right now.');
      }
    }

    // QUOTE
    if (command === 'quote') {
      try {
        const r = await fetch('https://api.quotable.io/random');
        const d = await r.json();
        return send(`"${d.content}" — ${d.author}`);
      } catch (e) {
        return send('Could not fetch a quote right now.');
      }
    }

    // 8BALL
    if (command === '8ball') {
      const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask again later'];
      return send(answers[Math.floor(Math.random() * answers.length)]);
    }

    // coinflip
    if (command === 'coinflip') return send(Math.random() < 0.5 ? 'Heads' : 'Tails');

    // roll
    if (command === 'roll') return send(`🎲 You rolled: ${Math.floor(Math.random() * 100) + 1}`);

    // pick
    if (command === 'pick') {
      const opts = args.join(' ').split('|').map(s => s.trim()).filter(Boolean);
      if (opts.length < 2) return send('Provide at least 2 options separated by |');
      return send(`I pick: **${opts[Math.floor(Math.random() * opts.length)]}**`);
    }

    // hug/slap/highfive/touch — FIXED mention resolution for prefix usage
    if (['hug', 'slap', 'highfive', 'touch'].includes(command)) {
      let user = null;

      // 1) Prefer explicit mentions (users or members)
      if (context.mentions) {
        user =
          (typeof context.mentions.users?.first === 'function' && context.mentions.users.first()) ||
          (typeof context.mentions.members?.first === 'function' && context.mentions.members.first()?.user) ||
          null;
      }

      // 2) Fallback: parse args[0] for ID inside <@...> or raw ID
      if (!user && args.length && args[0] && context.guild) {
        const id = String(args[0]).replace(/[^0-9]/g, '');
        if (id) {
          try {
            const member = await context.guild.members.fetch(id);
            if (member) user = member.user;
          } catch { /* ignore */ }
        }
      }

      if (!user) return send('Please mention a user!');
      const gif = await getTenorGif(command) || null;
      const embed = new EmbedBuilder().setTitle(`${context.author.username} ${command}s ${user.username}!`).setColor('Random');
      if (gif) embed.setImage(gif);
      return send({ embeds: [embed] });
    }

    // serverinfo
    if (command === 'serverinfo') {
      if (!context.guild) return send('This command must be used in a server.');
      const embed = new EmbedBuilder()
        .setTitle(context.guild.name)
        .setDescription(`ID: ${context.guild.id}\nMembers: ${context.guild.memberCount}`)
        .setColor('Blue');
      return send({ embeds: [embed] });
    }

    // userinfo
    if (command === 'userinfo') {
      let user = null;
      if (args.length && context.guild) {
        try { user = (await context.guild.members.fetch(args[0].replace(/[^0-9]/g, ''))).user; } catch (e) { /* ignore */ }
      }
      if (!user) user = context.author;
      const embed = new EmbedBuilder()
        .setTitle(user.tag)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields({ name: 'ID', value: user.id, inline: true })
        .setColor('Green');
      return send({ embeds: [embed] });
    }

    // avatar
    if (command === 'avatar') {
      let user = null;
      if (args.length && context.guild) {
        try { user = (await context.guild.members.fetch(args[0].replace(/[^0-9]/g, ''))).user; } catch (e) { /* ignore */ }
      }
      if (!user) user = context.author;
      return send({ content: `${user.tag}'s avatar:`, files: [user.displayAvatarURL({ dynamic: true, size: 1024 })] });
    }

    // stealemoji
    if (command === 'stealemoji') {
      if (!context.member?.permissions?.has?.(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return send('You need Manage Emojis & Stickers permission to use this.');
      }
      const input = args[0];
      if (!input) return send('Provide emoji URL or ID.');
      let url = input;
      const customMatch = input.match(/:(\d+)>$/);
      if (customMatch) url = `https://cdn.discordapp.com/emojis/${customMatch[1]}.png`;
      else if (!input.startsWith('http')) url = `https://cdn.discordapp.com/emojis/${input}.png`;
      try {
        const buf = await downloadToBuffer(url);
        const created = await context.guild.emojis.create({ attachment: buf, name: `emoji_${Date.now()}` });
        return send(`Emoji added: <:${created.name}:${created.id}>`);
      } catch (err) {
        console.error('stealemoji error', err);
        return send(`Failed to add emoji: ${err.message || err}`);
      }
    }

    // stealsticker
    if (command === 'stealsticker') {
      if (!context.member?.permissions?.has?.(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return send('You need Manage Emojis & Stickers permission to use this.');
      }
      const input = args[0];
      if (!input) return send('Provide sticker URL or ID.');
      let url = input;
      if (!input.startsWith('http')) url = `https://cdn.discordapp.com/stickers/${input}.png`;
      try {
        const buf = await downloadToBuffer(url);
        const sticker = await context.guild.stickers.create({ file: buf, name: `sticker_${Date.now()}`, description: 'Imported', tags: 'fun' });
        return send(`Sticker added: ${sticker.name}`);
      } catch (err) {
        console.error('stealsticker error', err);
        return send(`Failed to add sticker: ${err.message || err}`);
      }
    }

    // ----- Economy (clouds ☁️) -----
    if (command === 'balance') {
      const bal = getBalance(context.author.id);
      return send(`${context.author.username}, your balance: **${bal}** clouds ☁️`);
    }

    // daily — 100 clouds, 24h cooldown
    if (command === 'daily') {
      const uid = context.author.id;
      ensureAccount(uid);
      const now = Date.now();
      const last = getLastDaily(uid) || 0;
      const oneDay = 24 * 60 * 60 * 1000;
      if (now - last < oneDay) {
        const leftMs = oneDay - (now - last);
        const hrs = Math.floor(leftMs / (60 * 60 * 1000));
        const mins = Math.floor((leftMs % (60 * 60 * 1000)) / (60 * 1000));
        return send(`You already claimed daily. Try again in ${hrs}h ${mins}m.`);
        }
      const amount = 100;
      addMoney(uid, amount);
      setLastDaily(uid, now);
      return send(`You claimed your daily **${amount}** clouds ☁️! New balance: **${getBalance(uid)}**`);
    }

    // pay — send clouds to another user
    if (command === 'pay') {
      if (!args.length || args.length < 2) return send('Usage: ]pay <@user|userId> <amount>');
      const targetRaw = args[0];
      const amount = Number(args[1]);
      if (!amount || amount <= 0) return send('Amount must be a positive number.');

      const targetId = targetRaw.replace(/[^0-9]/g, '');
      if (!targetId) return send('Please provide a valid user mention or ID.');
      if (targetId === context.author.id) return send('You cannot pay yourself.');

      if (getBalance(context.author.id) < amount) return send("You don't have that many clouds ☁️.");
      ensureAccount(targetId);

      removeMoney(context.author.id, amount);
      addMoney(targetId, amount);
      return send(`✅ Sent **${amount}** clouds ☁️ to <@${targetId}>. Your new balance: **${getBalance(context.author.id)}**`);
    }

    // refill — owner-only
    if (command === 'refill') {
      if (context.author.id !== OWNER_ID) return send('Only the owner can use this.');
      if (!args.length || args.length < 2) return send('Usage: ]refill <@user|userId> <amount>');
      const targetId = args[0].replace(/[^0-9]/g, '');
      const amount = Number(args[1]);
      if (!targetId || !amount || amount <= 0) return send('Provide a valid target and positive amount.');
      addMoney(targetId, amount);
      return send(`Owner refill: Added **${amount}** clouds ☁️ to <@${targetId}>. New balance: **${getBalance(targetId)}**`);
    }

    // gamble — coin (default) or card
    if (command === 'gamble') {
      const amount = Number(args[0]);
      const mode = (args[1] || 'coin').toLowerCase();
      if (!amount || amount <= 0) return send('Usage: ]gamble <amount> [coin|card]');
      ensureAccount(context.author.id);
      if (amount > getBalance(context.author.id)) return send("You don't have that many clouds ☁️.");

      if (mode === 'coin') {
        const win = Math.random() < 0.5;
        if (win) {
          addMoney(context.author.id, amount);
          return send(`You won! You gained **${amount}** clouds ☁️. New balance: **${getBalance(context.author.id)}**`);
        } else {
          removeMoney(context.author.id, amount);
          return send(`You lost **${amount}** clouds ☁️. New balance: **${getBalance(context.author.id)}**`);
        }
      } else if (mode === 'card') {
        const draw = () => Math.floor(Math.random() * 13) + 1; // 1..13
        const you = draw();
        const bot = draw();
        if (you > bot) {
          const payout = Math.floor(amount * 1.5); // +0.5x net
          addMoney(context.author.id, payout);
          return send(`🃏 Card flip — You: **${you}** vs Bot: **${bot}** → **You win!** Gained **${payout}** clouds ☁️. New balance: **${getBalance(context.author.id)}**`);
        } else if (you < bot) {
          removeMoney(context.author.id, amount);
          return send(`🃏 Card flip — You: **${you}** vs Bot: **${bot}** → **You lose.** Lost **${amount}** clouds ☁️. New balance: **${getBalance(context.author.id)}**`);
        } else {
          return send(`🃏 Card flip — You: **${you}** vs Bot: **${bot}** → **Push (tie).** No clouds ☁️ lost or won.`);
        }
      } else {
        return send('Unknown gamble type. Use `coin` or `card`.');
      }
    }

    // shop
    if (command === 'shop') {
      const embed = new EmbedBuilder()
        .setTitle('Shop')
        .setDescription(SHOP.map(it => `**${it.id}** — ${it.name} — ${it.price} clouds ☁️\n${it.desc}`).join('\n\n'))
        .setColor('Purple');
      return send({ embeds: [embed] });
    }

    // buy
    if (command === 'buy') {
      const itemId = args[0];
      if (!itemId) return send('Usage: ]buy <item>');
      const item = SHOP.find(i => i.id === itemId);
      if (!item) return send('Item not found.');
      if (getBalance(context.author.id) < item.price) return send(`Not enough clouds ☁️ — you need ${item.price}.`);
      removeMoney(context.author.id, item.price);
      // NOTE: perks are demo only — you can implement role changes here
      return send(`You bought **${item.name}** for **${item.price}** clouds ☁️. New balance: **${getBalance(context.author.id)}**`);
    }

    // fallback
    return send('Unknown command. Use ]help or /help to see available commands.');
  } catch (err) {
    console.error('handleCommand error:', err);
    return context.sendFn ? context.sendFn('Oops! Something went wrong.') : null;
  }
}

// ---- Prefix message handler ----
const PREFIX = ']';
client.on('messageCreate', async message => {
  try {
    if (message.author.bot) return;

    const content = (message.content || '').toLowerCase();

    // auto-replies (good morning / welcome) — use Tenor
    if (content.includes('good morning')) {
      const gif = await getTenorGif('good morning') || null;
      if (gif) return message.channel.send({ embeds: [new EmbedBuilder().setDescription('Good morning! 🌅').setImage(gif)] });
      return message.channel.send('Good morning! 🌅');
    }
    if (content.includes('welcome')) {
      const gif = await getTenorGif('welcome') || null;
      if (gif) return message.channel.send({ embeds: [new EmbedBuilder().setDescription('Welcome! 👋').setImage(gif)] });
      return message.channel.send('Welcome! 👋');
    }

    if (!message.content.startsWith(PREFIX)) return;
    const parts = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = parts.shift().toLowerCase();
    const args = parts;

    const context = {
      author: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      mentions: message.mentions,
      messageTimestamp: message.createdTimestamp,
      sendFn: async (m) => {
        if (typeof m === 'string') return message.channel.send(m);
        return message.channel.send(m);
      },
      replyFn: async (m) => {
        if (typeof m === 'string') return message.reply(m);
        return message.reply(m);
      }
    };

    await handleCommand(context, command, args);
  } catch (err) {
    console.error('messageCreate top error', err);
  }
});

// ---- Slash interaction handler ----
client.on('interactionCreate', async interaction => {
  try {
    if (!interaction.isChatInputCommand()) return;

    // Defer — we will editReply later
    await interaction.deferReply({ ephemeral: false });

    const commandName = interaction.commandName;
    const options = interaction.options.data || [];

    // build args array
    const args = options.map(opt => {
      if (opt.type === 6) { // user
        const u = interaction.options.getUser(opt.name);
        return u ? u.id : String(opt.value);
      }
      return String(opt.value);
    });

    let replied = false;
    const context = {
      author: interaction.user,
      member: interaction.member,
      guild: interaction.guild,
      channel: interaction.channel,
      mentions: {
        first: () => {
          const uOpt = options.find(o => o.type === 6);
          if (!uOpt) return null;
          return interaction.options.getUser(uOpt.name);
        }
      },
      messageTimestamp: Date.now(),
      sendFn: async (m) => {
        try {
          if (!replied) {
            replied = true;
            if (typeof m === 'string') return interaction.editReply({ content: m });
            return interaction.editReply(m);
          } else {
            if (typeof m === 'string') return interaction.followUp({ content: m });
            return interaction.followUp(m);
          }
        } catch (err) {
          console.error('interaction.send error', err);
        }
      },
      replyFn: async (m) => {
        return context.sendFn(m);
      }
    };

    await handleCommand(context, commandName, args);
  } catch (err) {
    console.error('Slash command error:', err);
    try { if (interaction && interaction.deferred) await interaction.editReply({ content: 'Something went wrong 😢' }); } catch {}
  }
});

// ---- Ready & login ----
client.once('ready', async () => {
  console.log(`Bot ready! Logged in as ${client.user.tag}`);
  await registerSlashCommands().catch(err => console.error('Slash register error', err));
});

client.login(DISCORD_TOKEN).catch(err => {
  console.error('Login failed:', err);
  process.exit(1);
});
