// index.js — fixed version:
// - Added deferReply for all slash commands to prevent timeouts (shows "thinking..." then responds)
// - Modified ctx.send to use editReply after defer
// - Removed owner commands from help menu
// - Added logs for auto-replies (good morning/welcome)
// - Increased shop prices remain
// - Kept other debug logs

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const express = require('express');
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
const TENOR_API_KEY = process.env.TENOR_API_KEY;
const OWNER_ID = process.env.OWNER_ID; // your discord id for owner-only commands

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is required in .env');
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
const DATA_FILE = path.join(__dirname, 'balances.json');
const COOLDOWN_TIME = 10 * 1000; // 10 seconds for gamble cooldown
const cooldowns = new Map(); // userId => lastGambleTime

// ---------- Data persistence ----------
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to load data file', e);
    return { users: {} };
  }
}
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save data file', e);
  }
}
const data = loadData();
function ensureUser(id) {
  if (!data.users[id]) data.users[id] = { balance: 0, lastDaily: 0, inventory: [] };
  return data.users[id];
}

// ---------- Keep-alive (Render / Replit) ----------
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

// optional self-ping to keep service alive (can be disabled by setting SELF_PING=false)
if (process.env.SELF_PING !== 'false') {
  const SELF_URL = process.env.SELF_URL || `http://localhost:${PORT}/`;
  setInterval(() => fetch(SELF_URL).catch(() => {}), 5 * 60 * 1000).unref();
}

// ---------- Tenor helper ----------
async function getTenorGif(keyword) {
  if (!TENOR_API_KEY) return null;
  try {
    const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(keyword)}&key=${TENOR_API_KEY}&limit=20`);
    const json = await res.json();
    if (!json || !json.results || json.results.length === 0) return null;
    const pick = json.results[Math.floor(Math.random() * json.results.length)];
    // try several media formats
    if (pick?.media_formats?.gif?.url) return pick.media_formats.gif.url;
    if (pick?.media_formats?.mediumgif?.url) return pick.media_formats.mediumgif.url;
    // fallback to first media url
    const mf = Object.values(pick?.media_formats || {})[0];
    if (mf?.url) return mf.url;
    return pick.url || null;
  } catch (err) {
    console.error('Tenor API error:', err);
    return null;
  }
}

// ---------- Shop (higher prices) ----------
const SHOP = [
  { id: 'rolecolor', name: 'Role Color Change (mock perk)', price: 500 },
  { id: 'nickname', name: 'Nickname Change (mock perk)', price: 250 },
  { id: 'customemoji', name: 'Custom Emoji Slot (mock perk)', price: 1000 },
];

// ---------- Slash registration ----------
async function registerSlashCommands() {
  const commands = [
    // fun + misc (original)
    { name: 'joke', description: 'Get a random joke' },
    { name: 'meme', description: 'Get a random meme' },
    { name: 'cat', description: 'Get a random cat gif' },
    { name: 'dog', description: 'Get a random dog gif' },
    { name: '8ball', description: 'Ask the magic 8ball', options: [{ name: 'question', type: 3, description: 'Your question', required: true }] },
    { name: 'coinflip', description: 'Flip a coin' },
    { name: 'gif', description: 'Search a gif', options: [{ name: 'keyword', type: 3, description: 'Keyword', required: true }] },
    { name: 'fact', description: 'Get a random fact' },
    { name: 'quote', description: 'Get a random quote' },

    // interactive
    { name: 'hug', description: 'Hug a user', options: [{ name: 'user', type: 6, description: 'User to hug', required: true }] },
    { name: 'slap', description: 'Slap a user', options: [{ name: 'user', type: 6, description: 'User to slap', required: true }] },
    { name: 'highfive', description: 'Highfive a user', options: [{ name: 'user', type: 6, description: 'User to highfive', required: true }] },
    { name: 'touch', description: 'Touch a user', options: [{ name: 'user', type: 6, description: 'User to touch', required: true }] },
    { name: 'roll', description: 'Roll a dice' },
    { name: 'pick', description: 'Pick an option', options: [{ name: 'options', type: 3, description: 'Options separated by |', required: true }] },

    // utility
    { name: 'ping', description: 'Check bot latency' },
    { name: 'serverinfo', description: 'Get server info' },
    { name: 'userinfo', description: 'Get user info', options: [{ name: 'user', type: 6, description: 'User', required: false }] },
    { name: 'avatar', description: 'Get user avatar', options: [{ name: 'user', type: 6, description: 'User', required: false }] },

    // stealers
    { name: 'stealemoji', description: 'Steal emoji from another server', options: [{ name: 'emoji', type: 3, description: 'Emoji (paste <:name:id> or id or URL)', required: true }] },
    { name: 'stealsticker', description: 'Steal sticker from another server', options: [{ name: 'sticker', type: 3, description: 'Sticker id or URL', required: true }] },

    // help
    { name: 'help', description: 'Show all commands and usage' },

    // economy
    { name: 'balance', description: 'Check balance', options: [{ name: 'user', type: 6, description: 'User to check', required: false }] },
    { name: 'daily', description: 'Claim daily coins' },
    { name: 'pay', description: 'Send coins to another user', options: [{ name: 'user', type: 6, description: 'Recipient', required: true }, { name: 'amount', type: 4, description: 'Amount', required: true }] },
    { name: 'inventory', description: 'Show your inventory' },
    { name: 'shop', description: 'Show the shop' },
    { name: 'buy', description: 'Buy an item', options: [{ name: 'item', type: 3, description: 'Item id', required: true }] },
    { name: 'use', description: 'Use an item from inventory', options: [{ name: 'item', type: 3, description: 'Item id', required: true }] },

    // gamble
    { name: 'gamble', description: 'Gamble coins: coin | slots | poker', options: [{ name: 'amount', type: 4, description: 'Amount', required: true }, { name: 'type', type: 3, description: 'coin|slots|poker', required: false }] },

    // owner controls
    { name: 'givemoney', description: '(Owner) Give money', options: [{ name: 'user', type: 6, description: 'User', required: true }, { name: 'amount', type: 4, description: 'Amount', required: true }] },
    { name: 'takemoney', description: '(Owner) Take money', options: [{ name: 'user', type: 6, description: 'User', required: true }, { name: 'amount', type: 4, description: 'Amount', required: true }] },

    // trade
    { name: 'trade', description: 'Trade an item to another user (instant transfer)', options: [{ name: 'user', type: 6, description: 'Recipient', required: true }, { name: 'item', type: 3, description: 'Item id', required: true }] },

    // new: leaderboard
    { name: 'leaderboard', description: 'Show top balances' },
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('Refreshing application (/) commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error('Failed to register slash commands', err);
  }
}

// ---------- Poker helper (simple evaluator) ----------
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = [2,3,4,5,6,7,8,9,10,11,12,13,14]; // 11-J,12-Q,13-K,14-A
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ r, s });
  return deck;
}
function drawHand() {
  const deck = createDeck();
  const hand = [];
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    hand.push(deck.splice(idx,1)[0]);
  }
  return hand;
}
function evaluateHand(hand) {
  // returns {name, multiplier, rankValue} higher rankValue = better
  const counts = {};
  hand.forEach(c => counts[c.r] = (counts[c.r] || 0) + 1);
  const countsArr = Object.values(counts).sort((a,b)=>b-a); // e.g. [3,2]
  const uniqueRanks = Object.keys(counts).map(x=>parseInt(x,10)).sort((a,b)=>a-b);
  const suits = hand.map(h=>h.s);
  const flush = suits.every(s => s === suits[0]);
  // straight detection (account for A low)
  let straight = false;
  // check normal
  if (uniqueRanks.length === 5 && uniqueRanks[4] - uniqueRanks[0] === 4) straight = true;
  // check wheel A-2-3-4-5
  if (JSON.stringify(uniqueRanks) === JSON.stringify([2,3,4,5,14])) straight = true;
  // rank checks
  if (straight && flush) return { name: 'Straight Flush', multiplier: 8, rankValue: 800 };
  if (countsArr[0] === 4) return { name: 'Four of a Kind', multiplier: 6, rankValue: 700 };
  if (countsArr[0] === 3 && countsArr[1] === 2) return { name: 'Full House', multiplier: 4, rankValue: 600 };
  if (flush) return { name: 'Flush', multiplier: 3.5, rankValue: 500 };
  if (straight) return { name: 'Straight', multiplier: 3, rankValue: 400 };
  if (countsArr[0] === 3) return { name: 'Three of a Kind', multiplier: 2.5, rankValue: 300 };
  if (countsArr[0] === 2 && countsArr[1] === 2) return { name: 'Two Pair', multiplier: 2, rankValue: 200 };
  if (countsArr[0] === 2) return { name: 'One Pair', multiplier: 1.5, rankValue: 100 };
  return { name: 'High Card', multiplier: 0, rankValue: 10 };
}

// ---------- Shared command handler ----------
async function handleCommand(command, args, ctx) {
  try {
    command = (command || '').toLowerCase();
    console.log(`Executing command: ${command} by ${ctx.author.id} in guild ${ctx.guild?.id || 'DM'}`);

    // ---------- HELP ----------
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Fun GIF Bot Commands')
        .setDescription(
          `**Auto replies:**\n"good morning" → GIF\n"welcome" → GIF\n\n` +
          `**Fun:**\n${PREFIX}joke, ${PREFIX}meme, ${PREFIX}cat, ${PREFIX}dog, ${PREFIX}8ball <question>, ${PREFIX}coinflip, ${PREFIX}gif <keyword>, ${PREFIX}fact, ${PREFIX}quote\n\n` +
          `**Interactive:**\n${PREFIX}hug @user, ${PREFIX}slap @user, ${PREFIX}highfive @user, ${PREFIX}touch @user, ${PREFIX}roll, ${PREFIX}pick option1 | option2\n\n` +
          `**Utility:**\n${PREFIX}ping, ${PREFIX}serverinfo, ${PREFIX}userinfo @user, ${PREFIX}avatar @user\n\n` +
          `**Steal:**\n${PREFIX}stealemoji <emoji_id or url or <:name:id>>\n${PREFIX}stealsticker <sticker_id or url>\n\n` +
          `**Currency:**\n${PREFIX}balance [@user], ${PREFIX}daily, ${PREFIX}pay <@user> <amount>, ${PREFIX}gamble <amount> [coin|slots|poker], ${PREFIX}shop, ${PREFIX}buy <item>, ${PREFIX}use <item>, ${PREFIX}inventory, ${PREFIX}trade <@user> <item>, ${PREFIX}leaderboard\n`
        )
        .setColor('Random');
      return ctx.send({ embeds: [embed] });
    }

    // ---------- PING ----------
    if (command === 'ping') {
      return ctx.send(`🏓 Pong! Latency: ${Date.now() - (ctx._msgCreatedAt || Date.now())}ms`);
    }

    // ---------- JOKE ----------
    if (command === 'joke') {
      const r = await fetch('https://v2.jokeapi.dev/joke/Any');
      const d = await r.json();
      return ctx.send(d.type === 'single' ? d.joke : `${d.setup}\n${d.delivery}`);
    }

    // ---------- MEME / GIFS ----------
    if (command === 'meme') {
      const url = await getTenorGif('meme');
      return ctx.send(url || 'No meme GIF found 😢');
    }
    if (command === 'cat') {
      const url = await getTenorGif('cat');
      return ctx.send(url || 'No cat GIF found 😢');
    }
    if (command === 'dog') {
      const url = await getTenorGif('dog');
      return ctx.send(url || 'No dog GIF found 😢');
    }

    // ---------- 8BALL ----------
    if (command === '8ball') {
      const question = args.join(' ');
      if (!question) return ctx.send('Please ask a question.');
      const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask again later'];
      const answer = answers[Math.floor(Math.random() * answers.length)];
      return ctx.send(`Question: ${question}\nAnswer: ${answer}`);
    }

    // ---------- COINFLIP ----------
    if (command === 'coinflip') {
      return ctx.send(Math.random() < 0.5 ? 'Heads' : 'Tails');
    }

    // ---------- GIF SEARCH ----------
    if (command === 'gif') {
      const keyword = args.join(' ');
      if (!keyword) return ctx.send('Please provide a keyword.');
      const url = await getTenorGif(keyword);
      return ctx.send(url || 'No GIF found 😢');
    }

    // ---------- FACT ----------
    if (command === 'fact') {
      const r = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
      const d = await r.json();
      return ctx.send(d.text || 'No fact found.');
    }

    // ---------- QUOTE ----------
    if (command === 'quote') {
      try {
        const r = await fetch('https://api.quotable.io/random');
        const d = await r.json();
        return ctx.send(`"${d.content}" — ${d.author}`);
      } catch (e) {
        return ctx.send('Something went wrong fetching a quote 😢');
      }
    }

    // ---------- HUG / SLAP / HIGHFIVE / TOUCH ----------
    if (['hug', 'slap', 'highfive', 'touch'].includes(command)) {
      let user = null;
      if (ctx._mentionedUser) user = ctx._mentionedUser;
      else if (args && args[0]) {
        const maybeId = args[0].replace(/[^0-9]/g, '');
        if (ctx.guild && ctx.guild.members.cache.has(maybeId)) user = ctx.guild.members.cache.get(maybeId).user;
      }
      if (!user) return ctx.send('Please mention a user!');
      if (user.id === ctx.author.id) return ctx.send(`You can't ${command} yourself!`);
      const gif = await getTenorGif(command) || null;
      const embed = new EmbedBuilder().setTitle(`${ctx.author.username} ${command}s ${user.username}!`);
      if (gif) embed.setImage(gif);
      embed.setColor('Random');
      return ctx.send({ embeds: [embed] });
    }

    // ---------- ROLL ----------
    if (command === 'roll') {
      const roll = Math.floor(Math.random() * 100) + 1;
      return ctx.send(`🎲 You rolled: ${roll}`);
    }

    // ---------- PICK ----------
    if (command === 'pick') {
      const options = args.join(' ').split('|').map(o => o.trim()).filter(Boolean);
      if (options.length < 2) return ctx.send('Provide at least 2 options separated by |');
      const choice = options[Math.floor(Math.random() * options.length)];
      return ctx.send(`I pick: **${choice}**`);
    }

    // ---------- SERVER INFO ----------
    if (command === 'serverinfo') {
      if (!ctx.guild) return ctx.send('Not in a guild context.');
      const embed = new EmbedBuilder()
        .setTitle(ctx.guild.name)
        .setDescription(`ID: ${ctx.guild.id}\nMembers: ${ctx.guild.memberCount}`)
        .setColor('Random');
      return ctx.send({ embeds: [embed] });
    }

    // ---------- USER INFO ----------
    if (command === 'userinfo') {
      let user = ctx.author;
      if (args.length && ctx.guild) {
        const id = args[0].replace(/[^0-9]/g, '');
        const member = ctx.guild.members.cache.get(id);
        if (member) user = member.user;
        else return ctx.send('User not found in this server.');
      }
      const embed = new EmbedBuilder()
        .setTitle(user.tag)
        .setDescription(`ID: ${user.id}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setColor('Random');
      return ctx.send({ embeds: [embed] });
    }

    // ---------- AVATAR ----------
    if (command === 'avatar') {
      let user = ctx.author;
      if (args.length && ctx.guild) {
        const id = args[0].replace(/[^0-9]/g, '');
        const member = ctx.guild.members.cache.get(id);
        if (member) user = member.user;
        else return ctx.send('User not found in this server.');
      }
      return ctx.send(user.displayAvatarURL({ dynamic: true, size: 1024 }));
    }

    // ---------- STEAL EMOJI ----------
    if (command === 'stealemoji') {
      if (!ctx.member || !ctx.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return ctx.send('You need Manage Emojis & Stickers permission to use this.');
      }
      const emojiInput = args[0];
      if (!emojiInput) return ctx.send('Provide emoji (paste <:name:id>, id, or URL).');

      // parse
      let idMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
      let url = null;
      let name = idMatch ? idMatch[1] : `emoji_${Date.now()}`;
      let ext = '.png';
      if (emojiInput.startsWith('<a:')) ext = '.gif'; // animated
      if (emojiInput.startsWith('http')) url = emojiInput;
      else if (idMatch) url = `https://cdn.discordapp.com/emojis/${idMatch[2]}${ext}`;
      else if (/^\d+$/.test(emojiInput)) url = `https://cdn.discordapp.com/emojis/${emojiInput}${ext}`;
      else url = emojiInput; // fallback

      try {
        const created = await ctx.guild.emojis.create({ attachment: url, name });
        return ctx.send(`Emoji added: ${created}`);
      } catch (err) {
        console.error('Add emoji failed', err);
        // Try fallback ext if failed
        const altExt = ext === '.png' ? '.gif' : '.png';
        try {
          url = url.replace(ext, altExt);
          const created = await ctx.guild.emojis.create({ attachment: url, name });
          return ctx.send(`Emoji added (fallback format): ${created}`);
        } catch (fallbackErr) {
          return ctx.send(`Failed to add emoji: ${err?.message || err}`);
        }
      }
    }

    // ---------- STEAL STICKER ----------
    if (command === 'stealsticker') {
      if (!ctx.member || !ctx.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return ctx.send('You need Manage Emojis & Stickers permission to use this.');
      }
      const stickerInput = args[0];
      if (!stickerInput) return ctx.send('Provide a sticker id or URL.');
      let url = stickerInput.startsWith('http') ? stickerInput : `https://cdn.discordapp.com/stickers/${stickerInput}.png`;
      try {
        const sticker = await ctx.guild.stickers.create({
          file: url,
          name: `sticker_${Date.now()}`,
          description: 'Imported sticker',
          tags: 'fun',
        });
        return ctx.send(`Sticker added: ${sticker.name}`);
      } catch (err) {
        // Fallback to .gif for animated stickers
        url = url.replace('.png', '.gif');
        try {
          const sticker = await ctx.guild.stickers.create({
            file: url,
            name: `sticker_${Date.now()}`,
            description: 'Imported sticker',
            tags: 'fun',
          });
          return ctx.send(`Sticker added (fallback format): ${sticker.name}`);
        } catch (fallbackErr) {
          console.error('Add sticker failed', err);
          return ctx.send(`Failed to add sticker: ${err?.message || err}`);
        }
      }
    }

    // ------------------- ECONOMY -------------------

    // BALANCE
    if (command === 'balance') {
      let id = args[0] ? args[0].replace(/[^0-9]/g, '') : ctx.author.id;
      if (!id || !data.users[id]) return ctx.send('User not found or has no balance.');
      const u = ensureUser(id);
      const embed = new EmbedBuilder().setTitle('Balance').setDescription(`<@${id}> has **${u.balance}** coins`).setColor('Gold');
      return ctx.send({ embeds: [embed] });
    }

    // DAILY
    if (command === 'daily') {
      const uid = ctx.author.id;
      const u = ensureUser(uid);
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (now - (u.lastDaily || 0) < oneDay) {
        const left = Math.ceil((oneDay - (now - u.lastDaily)) / (60 * 60 * 1000));
        return ctx.send(`You already claimed daily. Try again in about ${left} hour(s).`);
      }
      const amount = 100;
      u.balance += amount;
      u.lastDaily = now;
      saveData(data);
      return ctx.send(`You claimed your daily **${amount}** coins! New balance: **${u.balance}**`);
    }

    // PAY / SEND
    if (command === 'pay' || command === 'send') {
      const targetId = (args[0] || '').replace(/[^0-9]/g, '');
      const amt = parseInt(args[1], 10);
      if (!targetId || !amt || amt <= 0) return ctx.send('Usage: pay <@user> <amount>');
      if (targetId === ctx.author.id) return ctx.send("You can't pay yourself.");
      const sender = ensureUser(ctx.author.id);
      if (sender.balance < amt) return ctx.send("You don't have enough coins.");
      const receiver = ensureUser(targetId);
      sender.balance -= amt;
      receiver.balance += amt;
      saveData(data);
      return ctx.send(`✅ Sent **${amt}** coins to <@${targetId}>. Your new balance: **${sender.balance}**`);
    }

    // INVENTORY
    if (command === 'inventory' || command === 'inv') {
      const uid = ctx.author.id;
      const u = ensureUser(uid);
      const inv = (u.inventory || []);
      if (!inv.length) return ctx.send('Your inventory is empty.');
      return ctx.send({ embeds: [new EmbedBuilder().setTitle(`${ctx.author.username}'s Inventory`).setDescription(inv.map(i => `• ${i}`).join('\n')).setColor('Blue')] });
    }

    // SHOP
    if (command === 'shop') {
      const embed = new EmbedBuilder().setTitle('Shop').setColor('Purple');
      embed.setDescription(SHOP.map(i => `**${i.id}** — ${i.name} — ${i.price} coins`).join('\n'));
      return ctx.send({ embeds: [embed] });
    }

    // BUY
    if (command === 'buy') {
      const itemId = args[0]?.toLowerCase();
      if (!itemId) return ctx.send('Usage: buy <item_id>');
      const item = SHOP.find(s => s.id.toLowerCase() === itemId);
      if (!item) return ctx.send('Item not found.');
      const u = ensureUser(ctx.author.id);
      if (u.balance < item.price) return ctx.send("You don't have enough coins.");
      u.balance -= item.price;
      u.inventory = u.inventory || [];
      u.inventory.push(item.id);
      saveData(data);
      return ctx.send(`You bought **${item.name}** for **${item.price}** coins. New balance: **${u.balance}**`);
    }

    // USE (stub for now)
    if (command === 'use') {
      const itemId = args[0]?.toLowerCase();
      if (!itemId) return ctx.send('Usage: use <item_id>');
      const u = ensureUser(ctx.author.id);
      if (!u.inventory || !u.inventory.includes(itemId)) return ctx.send("You don't own that item.");
      // Remove from inventory (optional, depending on if consumable)
      u.inventory = u.inventory.filter(i => i !== itemId);
      saveData(data);
      return ctx.send(`You used **${itemId}**! (Mock action: Perk applied)`);
    }

    // TRADE (immediate transfer)
    if (command === 'trade') {
      const targetId = (args[0] || '').replace(/[^0-9]/g, '');
      const itemId = args[1]?.toLowerCase();
      if (!targetId || !itemId) return ctx.send('Usage: trade <@user> <item_id>');
      const me = ensureUser(ctx.author.id);
      const you = ensureUser(targetId);
      if (!me.inventory || !me.inventory.includes(itemId)) return ctx.send("You don't own that item.");
      me.inventory = me.inventory.filter(i => i !== itemId);
      you.inventory = you.inventory || [];
      you.inventory.push(itemId);
      saveData(data);
      return ctx.send(`Transferred **${itemId}** to <@${targetId}>.`);
    }

    // LEADERBOARD (new)
    if (command === 'leaderboard' || command === 'lb') {
      const users = Object.entries(data.users)
        .sort((a, b) => b[1].balance - a[1].balance)
        .slice(0, 5);
      if (!users.length) return ctx.send('No users with balances yet.');
      const embed = new EmbedBuilder().setTitle('Leaderboard (Top 5)').setColor('Green');
      embed.setDescription(users.map(([id, u], idx) => `${idx + 1}. <@${id}>: **${u.balance}** coins`).join('\n'));
      return ctx.send({ embeds: [embed] });
    }

    // GAMBLE
    if (command === 'gamble' || command === 'bet') {
      const uid = ctx.author.id;
      const now = Date.now();
      if (cooldowns.has(uid) && now - cooldowns.get(uid) < COOLDOWN_TIME) {
        const left = Math.ceil((COOLDOWN_TIME - (now - cooldowns.get(uid))) / 1000);
        return ctx.send(`Cooldown! Wait ${left} seconds before gambling again.`);
      }
      cooldowns.set(uid, now);

      let amt = parseInt(args[0], 10);
      const type = (args[1] || 'coin').toLowerCase();
      if (!amt || amt <= 0) return ctx.send('Usage: gamble <amount> [coin|slots|poker]');
      const u = ensureUser(uid);
      if (amt > u.balance) return ctx.send("You don't have enough coins.");
      u.balance -= amt; // always subtract bet first

      // COIN
      if (type === 'coin' || type === 'coinflip') {
        const win = Math.random() < 0.5;
        if (win) {
          const payout = amt * 2; // return 2x (net +amt profit)
          u.balance += payout;
          saveData(data);
          return ctx.send(`You won! Gained **${payout - amt}** profit. New balance: **${u.balance}**`);
        } else {
          saveData(data);
          return ctx.send(`You lost **${amt}** coins. New balance: **${u.balance}**`);
        }
      }

      // SLOTS (3 symbols)
      if (type === 'slots') {
        const symbols = ['🍒','🍋','🍊','🍇','🔔','⭐'];
        const s1 = symbols[Math.floor(Math.random()*symbols.length)];
        const s2 = symbols[Math.floor(Math.random()*symbols.length)];
        const s3 = symbols[Math.floor(Math.random()*symbols.length)];
        let multiplier = 0;
        if (s1 === s2 && s2 === s3) multiplier = 6; // big win: 6x return (net +5x profit)
        else if (s1 === s2 || s2 === s3 || s1 === s3) multiplier = 3; // pair: 3x (net +2x)
        const payout = amt * multiplier;
        if (payout > 0) {
          u.balance += payout;
          saveData(data);
          return ctx.send(`Slots: ${s1} ${s2} ${s3}\n🎉 Won **${payout - amt}** profit! New balance: **${u.balance}**`);
        } else {
          saveData(data);
          return ctx.send(`Slots: ${s1} ${s2} ${s3}\n😢 Lost **${amt}**. New balance: **${u.balance}**`);
        }
      }

      // POKER (simplified 5-card evaluation)
      if (type === 'poker') {
        const hand = drawHand();
        const evalRes = evaluateHand(hand);
        const rankMap = {11: 'J', 12: 'Q', 13: 'K', 14: 'A'};
        const handStr = hand.map(c => `${rankMap[c.r] || c.r}${c.s}`).join(' ');
        const multiplier = evalRes.multiplier;
        const payout = Math.floor(amt * multiplier);
        if (multiplier > 0) {
          u.balance += payout;
          saveData(data);
          return ctx.send(`Hand: ${handStr}\n${evalRes.name} — Won **${payout - amt}** profit! New balance: **${u.balance}**`);
        } else {
          saveData(data);
          return ctx.send(`Hand: ${handStr}\n${evalRes.name} — Lost **${amt}**. New balance: **${u.balance}**`);
        }
      }

      return ctx.send('Unknown gamble type. Use coin, slots, or poker.');
    }

    // OWNER give/take
    if (command === 'givemoney') {
      if (ctx.author.id !== OWNER_ID) return ctx.send('Only the owner can do that.');
      const target = (args[0] || '').replace(/[^0-9]/g, '');
      const amount = parseInt(args[1], 10);
      if (!target || !amount) return ctx.send('Usage: givemoney <user_id or @user> <amount>');
      const u = ensureUser(target);
      u.balance += amount;
      saveData(data);
      return ctx.send(`Gave ${amount} coins to <@${target}>.`);
    }

    if (command === 'takemoney') {
      if (ctx.author.id !== OWNER_ID) return ctx.send('Only the owner can do that.');
      const target = (args[0] || '').replace(/[^0-9]/g, '');
      const amount = parseInt(args[1], 10);
      if (!target || !amount) return ctx.send('Usage: takemoney <user_id or @user> <amount>');
      const u = ensureUser(target);
      u.balance = Math.max(0, u.balance - amount);
      saveData(data);
      return ctx.send(`Took ${amount} coins from <@${target}>.`);
    }

    // fallback to unknown command
    return ctx.send('Unknown command. Use help to see available commands.');
  } catch (err) {
    console.error('Command execution error:', err);
    try { return ctx.send('Something went wrong executing that command 😢'); } catch (e) { console.error('Also failed to send error to user', e); }
  }
}

// ---------- Message (prefix) handler ----------
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Auto replies
  const content = (message.content || '').toLowerCase();
  if (content.includes('good morning')) {
    console.log(`Auto-reply triggered: good morning in message by ${message.author.id} in guild ${message.guild?.id}`);
    const gif = await getTenorGif('good morning');
    return message.channel.send(gif || 'Good morning! 🌞');
  }
  if (content.includes('welcome')) {
    console.log(`Auto-reply triggered: welcome in message by ${message.author.id} in guild ${message.guild?.id}`);
    const gif = await getTenorGif('welcome');
    return message.channel.send(gif || 'Welcome!');
  }

  if (!message.content.startsWith(PREFIX)) return;

  console.log(`Prefix command detected in message: ${message.content} by ${message.author.id} in guild ${message.guild?.id}`);

  const raw = message.content.slice(PREFIX.length).trim();
  if (!raw) return;
  const parts = raw.split(/ +/);
  const command = parts.shift().toLowerCase();
  const args = parts;

  // Build ctx for message
  const ctx = {
    send: c => message.channel.send(c),
    author: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    _mentionedUser: message.mentions?.users?.first() || null,
    _msgCreatedAt: message.createdTimestamp
  };

  await handleCommand(command, args, ctx);
});

// ---------- Interaction (slash) handler ----------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`Slash command detected: ${interaction.commandName} by ${interaction.user.id} in guild ${interaction.guild?.id}`);

  // Defer reply to avoid timeout
  await interaction.deferReply();

  const commandName = interaction.commandName;
  const opts = interaction.options?.data || [];

  // build args: user options -> ids, string options -> strings, integer -> stringified number
  const args = opts.map(o => {
    if (o.type === 6) return String(o.value); // user id
    if (o.type === 4) return String(o.value); // integer
    return String(o.value);
  });

  // build ctx for interaction
  let replied = false;
  const ctx = {
    send: async content => {
      try {
        if (!replied) {
          replied = true;
          // Since deferred, use editReply for first response
          return await interaction.editReply(typeof content === 'string' ? { content } : content);
        } else {
          return await interaction.followUp(typeof content === 'string' ? { content } : content);
        }
      } catch (err) {
        console.error('Interaction send error', err);
      }
    },
    author: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
    _mentionedUser: null
  };

  // If there's a user option, attach the user object to ctx._mentionedUser
  const userOpt = opts.find(o => o.type === 6);
  if (userOpt && interaction.guild) {
    try {
      const mem = await interaction.guild.members.fetch(userOpt.value);
      if (mem) ctx._mentionedUser = mem.user;
    } catch (e) {
      // ignore
    }
  }

  await handleCommand(commandName, args, ctx);
});

// ---------- Ready ----------
client.once('ready', async () => {
  console.log(`Bot ready! Logged in as ${client.user.tag}`);
  await registerSlashCommands().catch(err => console.error('Slash reg error', err));
});

// ---------- Login ----------
console.log('Starting bot login...');
client.login(DISCORD_TOKEN).then(() => {
  console.log('Login successful');
}).catch(err => {
  console.error('Login failed:', err);
  process.exit(1);
});
