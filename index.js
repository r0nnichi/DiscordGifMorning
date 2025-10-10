// index.js — DiscordGifMorning (full single-file working bot)
// - Supports: prefix + slash commands, economy (JSON), auto-replies, Tenor/gif, keep-alive
// - Use environment variables: DISCORD_TOKEN (required), OWNER_ID (recommended), TENOR_API_KEY (optional), GUILD_ID (optional for immediate slash registration), PREFIX (optional, default ']')

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

// try to use global fetch (Node 18+), otherwise require node-fetch
let fetchFn;
if (typeof fetch === 'function') fetchFn = fetch;
else {
  try {
    fetchFn = require('node-fetch'); // will work if node-fetch is installed
  } catch (e) {
    console.error('No global fetch and node-fetch not installed. Some commands (gif/cat/dog/joke) will fail.');
    fetchFn = async () => { throw new Error('fetch unavailable'); };
  }
}

// ---------- Config ----------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TENOR_API_KEY = process.env.TENOR_API_KEY || '';
const OWNER_ID = process.env.OWNER_ID || '';
const GUILD_ID = process.env.GUILD_ID || ''; // optional: set for immediate slash updates
const PREFIX = (process.env.PREFIX && process.env.PREFIX.length) ? process.env.PREFIX : ']';
const DATA_FILE = path.join(__dirname, 'balances.json');
const PORT = process.env.PORT || 3000;
const COOLDOWN_TIME = 10 * 1000; // gamble cooldown in ms

if (!DISCORD_TOKEN) {
  console.error('FATAL: DISCORD_TOKEN is required in environment variables.');
  process.exit(1);
}

// ---------- Client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ---------- Persistence ----------
function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
    }
  } catch (e) {
    console.error('Failed to ensure data file', e);
  }
}
function loadData() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to load data file, recreating', e);
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
    } catch (err) { console.error('Failed to recreate data file', err); }
    return { users: {} };
  }
}
function saveData(d) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
  } catch (e) {
    console.error('Failed to save data file', e);
  }
}
let data = loadData();
function ensureUser(id) {
  if (!data.users[id]) data.users[id] = { balance: 0, lastDaily: 0, inventory: [] };
  return data.users[id];
}

// ---------- Keep-alive server ----------
const app = express();
app.get('/', (req, res) => res.send('DiscordGifMorning is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

// ---------- Helpers ----------
async function getTenorGif(keyword) {
  if (!TENOR_API_KEY) return null;
  try {
    const q = encodeURIComponent(keyword);
    const url = `https://tenor.googleapis.com/v2/search?q=${q}&key=${TENOR_API_KEY}&limit=20`;
    const res = await fetchFn(url);
    const json = await res.json();
    if (!json || !json.results || !json.results.length) return null;
    const pick = json.results[Math.floor(Math.random() * json.results.length)];
    if (pick?.media_formats?.gif?.url) return pick.media_formats.gif.url;
    if (pick?.media_formats?.mediumgif?.url) return pick.media_formats.mediumgif.url;
    const mf = Object.values(pick?.media_formats || {})[0];
    if (mf?.url) return mf.url;
    return pick.url || null;
  } catch (e) {
    console.error('Tenor fetch error', e);
    return null;
  }
}
async function fetchJson(url) {
  const res = await fetchFn(url);
  return res.json();
}
function safeNumber(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// ---------- Shop ----------
const SHOP = [
  { id: 'rolecolor', name: 'Role Color Change (mock perk)', price: 500 },
  { id: 'nickname', name: 'Nickname Change (mock perk)', price: 250 },
  { id: 'customemoji', name: 'Custom Emoji Slot (mock perk)', price: 1000 },
];

// ---------- Slash commands definition ----------
const SLASH_COMMANDS = [
  { name: 'ping', description: 'Check bot latency' },
  { name: 'joke', description: 'Get a random joke' },
  { name: 'meme', description: 'Get a random meme' },
  { name: 'cat', description: 'Get a random cat gif' },
  { name: 'dog', description: 'Get a random dog gif' },
  { name: 'gif', description: 'Search a gif', options: [{ name: 'keyword', type: 3, description: 'Keyword', required: true }] },
  { name: 'help', description: 'Show all commands' },
  { name: 'balance', description: 'Check your balance', options: [{ name: 'user', type: 6, description: 'User (optional)', required: false }] },
  { name: 'daily', description: 'Claim your daily coins' },
  { name: 'pay', description: 'Send coins', options: [{ name: 'user', type: 6, description: 'Recipient', required: true }, { name: 'amount', type: 4, description: 'Amount', required: true }] },
  { name: 'shop', description: 'Show shop' },
  { name: 'buy', description: 'Buy an item', options: [{ name: 'item', type: 3, description: 'Item id', required: true }] },
  { name: 'inventory', description: 'Show your inventory' },
  { name: 'gamble', description: 'Gamble coins', options: [{ name: 'amount', type: 4, description: 'Amount', required: true }, { name: 'type', type: 3, description: 'coin|slots|poker', required: false }] },
  { name: 'hug', description: 'Hug a user', options: [{ name: 'user', type: 6, description: 'User', required: true }] },
  { name: 'slap', description: 'Slap a user', options: [{ name: 'user', type: 6, description: 'User', required: true }] },
  { name: 'leaderboard', description: 'Show top balances' },
];

// ---------- Register slash commands (global or guild) ----------
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('Refreshing application (/) commands...');
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: SLASH_COMMANDS });
      console.log('Slash commands registered to GUILD:', GUILD_ID);
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: SLASH_COMMANDS });
      console.log('Slash commands registered globally (may take up to 1 hour to appear).');
    }
  } catch (err) {
    console.error('Failed to register slash commands', err);
  }
}

// ---------- Poker helper (same as your previous) ----------
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = [2,3,4,5,6,7,8,9,10,11,12,13,14];
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
  const counts = {};
  hand.forEach(c => counts[c.r] = (counts[c.r] || 0) + 1);
  const countsArr = Object.values(counts).sort((a,b)=>b-a);
  const uniqueRanks = Object.keys(counts).map(x=>parseInt(x,10)).sort((a,b)=>a-b);
  const suits = hand.map(h=>h.s);
  const flush = suits.every(s => s === suits[0]);
  let straight = false;
  if (uniqueRanks.length === 5 && uniqueRanks[4] - uniqueRanks[0] === 4) straight = true;
  if (JSON.stringify(uniqueRanks) === JSON.stringify([2,3,4,5,14])) straight = true;
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

// ---------- Shared command execution ----------
const gambleCooldowns = new Map(); // userId -> last gamble timestamp

async function handleCommand(command, args, ctx) {
  // ctx: { source: 'prefix'|'slash', author, member, guild, channel, send: async(content) -> responds (prefix: send channel message, slash: editReply/followUp), _msgCreatedAt (prefix) }
  try {
    command = (command || '').toLowerCase();
    console.log(`Executing command: ${command} by ${ctx.author.id} in guild ${ctx.guild?.id || 'DM'}`);

    // HELP
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 DiscordGifMorning — Commands')
        .setDescription(
          `**Prefix:** \`${PREFIX}command\` or use slash (/)\n\n` +
          `**Fun:** ${PREFIX}joke, ${PREFIX}meme, ${PREFIX}cat, ${PREFIX}dog, ${PREFIX}gif <keyword>\n` +
          `**Interact:** ${PREFIX}hug @user, ${PREFIX}slap @user\n` +
          `**Utility:** ${PREFIX}ping, ${PREFIX}serverinfo, ${PREFIX}userinfo @user, ${PREFIX}avatar\n` +
          `**Currency:** ${PREFIX}balance, ${PREFIX}daily, ${PREFIX}pay @user <amt>, ${PREFIX}gamble <amt> [coin|slots|poker], ${PREFIX}shop, ${PREFIX}buy <id>, ${PREFIX}inventory\n`
        )
        .setColor('Random');
      return ctx.send({ embeds: [embed] });
    }

    // PING
    if (command === 'ping') {
      // For prefix commands, prefer to compute round-trip using message created time; for slash we use ws ping
      const latency = ctx._msgCreatedAt ? `${Date.now() - ctx._msgCreatedAt}ms` : `${Math.round(client.ws.ping)}ms`;
      return ctx.send(`🏓 Pong! Latency: ${latency}`);
    }

    // JOKE
    if (command === 'joke') {
      try {
        const r = await fetchJson('https://v2.jokeapi.dev/joke/Any');
        return ctx.send(r.type === 'single' ? r.joke : `${r.setup}\n${r.delivery}`);
      } catch (e) {
        return ctx.send('Could not fetch a joke right now.');
      }
    }

    // MEME / GIFS
    if (command === 'meme') {
      const url = TENOR_API_KEY ? await getTenorGif('meme') : null;
      return ctx.send(url || 'No meme GIF found 😢');
    }
    if (command === 'cat') {
      try {
        const res = await fetchFn('https://api.thecatapi.com/v1/images/search');
        const j = await res.json();
        return ctx.send(j?.[0]?.url || 'No cat found.');
      } catch (e) {
        return ctx.send('Failed to fetch cat image.');
      }
    }
    if (command === 'dog') {
      try {
        const res = await fetchFn('https://dog.ceo/api/breeds/image/random');
        const j = await res.json();
        return ctx.send(j?.message || 'No dog found.');
      } catch (e) {
        return ctx.send('Failed to fetch dog image.');
      }
    }

    // GIF search (Tenor)
    if (command === 'gif') {
      const keyword = (args || []).join(' ').trim();
      if (!keyword) return ctx.send('Usage: gif <keyword>');
      const url = await getTenorGif(keyword);
      return ctx.send(url || 'No GIF found.');
    }

    // FACT
    if (command === 'fact') {
      try {
        const r = await fetchJson('https://uselessfacts.jsph.pl/random.json?language=en');
        return ctx.send(r.text || 'No fact right now.');
      } catch (e) {
        return ctx.send('Could not fetch a fact.');
      }
    }

    // QUOTE
    if (command === 'quote') {
      try {
        const r = await fetchJson('https://api.quotable.io/random');
        return ctx.send(`"${r.content}" — ${r.author}`);
      } catch (e) {
        return ctx.send('Could not fetch a quote.');
      }
    }

    // INTERACTIONS (hug/slap)
    if (['hug', 'slap', 'highfive', 'touch'].includes(command)) {
      let user = ctx._mentionedUser || null;
      if (!user && args && args[0]) {
        const maybeId = args[0].replace(/[^0-9]/g, '');
        if (ctx.guild && ctx.guild.members.cache.has(maybeId)) user = ctx.guild.members.cache.get(maybeId).user;
      }
      if (!user) return ctx.send('Please mention a user!');
      if (user.id === ctx.author.id) return ctx.send(`You can't ${command} yourself!`);
      const gif = TENOR_API_KEY ? await getTenorGif(command) : null;
      const embed = new EmbedBuilder().setTitle(`${ctx.author.username} ${command}s ${user.username}!`).setColor('Random');
      if (gif) embed.setImage(gif);
      return ctx.send({ embeds: [embed] });
    }

    // SERVER INFO
    if (command === 'serverinfo') {
      if (!ctx.guild) return ctx.send('Not in a guild context.');
      const embed = new EmbedBuilder()
        .setTitle(ctx.guild.name)
        .setDescription(`ID: ${ctx.guild.id}\nMembers: ${ctx.guild.memberCount}`)
        .setColor('Random');
      return ctx.send({ embeds: [embed] });
    }

    // USER INFO
    if (command === 'userinfo') {
      let user = ctx.author;
      if (args && args.length && ctx.guild) {
        const id = args[0].replace(/[^0-9]/g, '');
        const mem = ctx.guild.members.cache.get(id);
        if (mem) user = mem.user;
        else return ctx.send('User not found in this server.');
      }
      const embed = new EmbedBuilder()
        .setTitle(user.tag)
        .setDescription(`ID: ${user.id}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setColor('Random');
      return ctx.send({ embeds: [embed] });
    }

    // AVATAR
    if (command === 'avatar') {
      let user = ctx.author;
      if (args && args.length && ctx.guild) {
        const id = args[0].replace(/[^0-9]/g, '');
        const mem = ctx.guild.members.cache.get(id);
        if (mem) user = mem.user;
        else return ctx.send('User not found in this server.');
      }
      return ctx.send(user.displayAvatarURL({ dynamic: true, size: 1024 }));
    }

    // STEAL EMOJI (prefix/slash) - requires Manage Emojis & Stickers on the guild
    if (command === 'stealemoji') {
      if (!ctx.guild) return ctx.send('This must be used in a server.');
      if (!ctx.member || !ctx.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return ctx.send('You need Manage Emojis & Stickers permission to use this.');
      }
      const emojiInput = args[0];
      if (!emojiInput) return ctx.send('Provide emoji (paste <:name:id>, id, or URL).');
      let idMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
      let url = null;
      let name = idMatch ? idMatch[1] : `emoji_${Date.now()}`;
      let ext = '.png';
      if (emojiInput.startsWith('<a:')) ext = '.gif';
      if (emojiInput.startsWith('http')) url = emojiInput;
      else if (idMatch) url = `https://cdn.discordapp.com/emojis/${idMatch[2]}${ext}`;
      else if (/^\d+$/.test(emojiInput)) url = `https://cdn.discordapp.com/emojis/${emojiInput}${ext}`;
      else url = emojiInput;
      try {
        const created = await ctx.guild.emojis.create({ attachment: url, name });
        return ctx.send(`Emoji added: ${created.toString()}`);
      } catch (err) {
        console.error('Add emoji failed', err);
        // fallback .gif/.png
        try {
          const altExt = ext === '.png' ? '.gif' : '.png';
          url = url.replace(ext, altExt);
          const created = await ctx.guild.emojis.create({ attachment: url, name });
          return ctx.send(`Emoji added (fallback): ${created.toString()}`);
        } catch (e) {
          return ctx.send(`Failed to add emoji: ${err?.message || err}`);
        }
      }
    }

    // STEAL STICKER
    if (command === 'stealsticker') {
      if (!ctx.guild) return ctx.send('This must be used in a server.');
      if (!ctx.member || !ctx.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
        return ctx.send('You need Manage Emojis & Stickers permission to use this.');
      }
      const stickerInput = args[0];
      if (!stickerInput) return ctx.send('Provide sticker id or URL.');
      let url = stickerInput.startsWith('http') ? stickerInput : `https://cdn.discordapp.com/stickers/${stickerInput}.png`;
      try {
        const sticker = await ctx.guild.stickers.create({ file: url, name: `sticker_${Date.now()}`, description: 'Imported sticker', tags: 'fun' });
        return ctx.send(`Sticker added: ${sticker.name}`);
      } catch (err) {
        console.error('Add sticker failed', err);
        return ctx.send(`Failed to add sticker: ${err?.message || err}`);
      }
    }

    // ---------------- ECONOMY ----------------
    if (command === 'balance') {
      const id = args && args[0] ? args[0].replace(/[^0-9]/g, '') : ctx.author.id;
      if (!id) return ctx.send('User not specified.');
      const u = ensureUser(id);
      const embed = new EmbedBuilder().setTitle('Balance').setDescription(`<@${id}> has **${u.balance}** coins`).setColor('Gold');
      return ctx.send({ embeds: [embed] });
    }

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

    if (command === 'inventory' || command === 'inv') {
      const u = ensureUser(ctx.author.id);
      const inv = u.inventory || [];
      if (!inv.length) return ctx.send('Your inventory is empty.');
      return ctx.send({ embeds: [new EmbedBuilder().setTitle(`${ctx.author.username}'s Inventory`).setDescription(inv.map(i => `• ${i}`).join('\n')).setColor('Blue')] });
    }

    if (command === 'shop') {
      const embed = new EmbedBuilder().setTitle('Shop').setColor('Purple');
      embed.setDescription(SHOP.map(i => `**${i.id}** — ${i.name} — ${i.price} coins`).join('\n'));
      return ctx.send({ embeds: [embed] });
    }

    if (command === 'buy') {
      const itemId = (args[0] || '').toLowerCase();
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

    if (command === 'trade') {
      const targetId = (args[0] || '').replace(/[^0-9]/g, '');
      const itemId = (args[1] || '').toLowerCase();
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

    if (command === 'leaderboard' || command === 'lb') {
      const users = Object.entries(data.users).sort((a,b) => b[1].balance - a[1].balance).slice(0,10);
      if (!users.length) return ctx.send('No users with balances yet.');
      const embed = new EmbedBuilder().setTitle('Leaderboard (Top)').setColor('Green');
      embed.setDescription(users.map(([id,u], idx) => `${idx+1}. <@${id}> — **${u.balance}**`).join('\n'));
      return ctx.send({ embeds: [embed] });
    }

    // GAMBLE (coin/slots/poker)
    if (command === 'gamble' || command === 'bet') {
      const uid = ctx.author.id;
      const now = Date.now();
      if (gambleCooldowns.has(uid) && now - gambleCooldowns.get(uid) < COOLDOWN_TIME) {
        const left = Math.ceil((COOLDOWN_TIME - (now - gambleCooldowns.get(uid))) / 1000);
        return ctx.send(`Cooldown! Wait ${left} second(s) before gambling again.`);
      }
      gambleCooldowns.set(uid, now);

      const amt = parseInt(args[0], 10);
      const type = (args[1] || 'coin').toLowerCase();
      if (!amt || amt <= 0) return ctx.send('Usage: gamble <amount> [coin|slots|poker]');
      const u = ensureUser(uid);
      if (amt > u.balance) return ctx.send("You don't have enough coins.");
      u.balance -= amt;

      if (type === 'coin' || type === 'coinflip') {
        const win = Math.random() < 0.5;
        if (win) {
          const payout = amt * 2;
          u.balance += payout;
          saveData(data);
          return ctx.send(`You won! Gained **${payout - amt}** profit. New balance: **${u.balance}**`);
        } else {
          saveData(data);
          return ctx.send(`You lost **${amt}** coins. New balance: **${u.balance}**`);
        }
      }

      if (type === 'slots') {
        const symbols = ['🍒','🍋','🍊','🍇','🔔','⭐'];
        const s1 = symbols[Math.floor(Math.random()*symbols.length)];
        const s2 = symbols[Math.floor(Math.random()*symbols.length)];
        const s3 = symbols[Math.floor(Math.random()*symbols.length)];
        let multiplier = 0;
        if (s1 === s2 && s2 === s3) multiplier = 6;
        else if (s1 === s2 || s2 === s3 || s1 === s3) multiplier = 3;
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

      if (type === 'poker') {
        const hand = drawHand();
        const evalRes = evaluateHand(hand);
        const rankMap = {11: 'J',12:'Q',13:'K',14:'A'};
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

    // OWNER give/take (slash only commands not included here; but preserved if included)
    if (command === 'givemoney') {
      if (ctx.author.id !== OWNER_ID) return ctx.send('Only the owner can do that.');
      const target = (args[0]||'').replace(/[^0-9]/g,'');
      const amount = parseInt(args[1], 10);
      if (!target || !amount) return ctx.send('Usage: givemoney <user_id> <amount>');
      const u = ensureUser(target);
      u.balance += amount;
      saveData(data);
      return ctx.send(`Gave ${amount} coins to <@${target}>.`);
    }
    if (command === 'takemoney') {
      if (ctx.author.id !== OWNER_ID) return ctx.send('Only the owner can do that.');
      const target = (args[0]||'').replace(/[^0-9]/g,'');
      const amount = parseInt(args[1], 10);
      if (!target || !amount) return ctx.send('Usage: takemoney <user_id> <amount>');
      const u = ensureUser(target);
      u.balance = Math.max(0, u.balance - amount);
      saveData(data);
      return ctx.send(`Took ${amount} coins from <@${target}>.`);
    }

    // unknown
    return ctx.send('Unknown command. Use help to see available commands.');
  } catch (err) {
    console.error('Command execution error:', err);
    try { return ctx.send('Something went wrong executing that command 😢'); } catch (e) { console.error('Also failed to send error to user', e); }
  }
}

// ---------- Single messageCreate handler (prefix + autoreplies) ----------
client.on('messageCreate', async (message) => {
  if (!message || message.author?.bot) return;

  // Auto replies (keyword triggers)
  const content = (message.content || '').toLowerCase();
  if (content.includes('good morning')) {
    console.log(`Auto-reply triggered: good morning by ${message.author.id} in guild ${message.guild?.id}`);
    const gif = TENOR_API_KEY ? await getTenorGif('good morning') : null;
    return message.channel.send(gif || `Good morning, ${message.author.username}!`);
  }
  if (content.includes('welcome')) {
    console.log(`Auto-reply triggered: welcome by ${message.author.id} in guild ${message.guild?.id}`);
    const gif = TENOR_API_KEY ? await getTenorGif('welcome') : null;
    return message.channel.send(gif || `Welcome, ${message.author.username}!`);
  }

  // Prefix commands
  if (!content.startsWith(PREFIX)) return;
  const raw = message.content.slice(PREFIX.length).trim();
  if (!raw) return;
  const parts = raw.split(/ +/);
  const command = parts.shift().toLowerCase();
  const args = parts;

  const ctx = {
    source: 'prefix',
    author: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    _msgCreatedAt: message.createdTimestamp,
    _mentionedUser: message.mentions?.users?.first() || null,
    send: async (payload) => {
      try {
        // payload could be string or object (embed)
        if (typeof payload === 'string') return await message.channel.send({ content: payload });
        return await message.channel.send(payload);
      } catch (err) {
        console.error('Prefix send error', err);
      }
    }
  };

  console.log(`Prefix command detected: ${command} by ${message.author.id} in guild ${message.guild?.id}`);
  await handleCommand(command, args, ctx);
});

// ---------- Interaction (slash) handler ----------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`Slash command detected: ${interaction.commandName} by ${interaction.user.id} in guild ${interaction.guild?.id}`);

  // Defer reply immediately to avoid "The application did not respond"
  try {
    await interaction.deferReply({ ephemeral: false });
  } catch (e) {
    console.warn('deferReply failed (maybe already acknowledged):', e?.message || e);
  }

  const commandName = interaction.commandName;
  // build args for compatibility with handleCommand (array of strings)
  const opts = interaction.options;
  const args = [];
  // push user mentions / values in order of options
  try {
    for (const opt of opts.data || []) {
      if (opt.type === 6) args.push(String(opt.value)); // user id
      else if (opt.type === 4) args.push(String(opt.value)); // integer
      else args.push(String(opt.value));
    }
  } catch (e) {
    // fallback: no args
  }

  let replied = false;
  const ctx = {
    source: 'slash',
    author: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
    _mentionedUser: null,
    send: async (payload) => {
      try {
        if (!replied) {
          replied = true;
          // first response after defer: use editReply
          if (typeof payload === 'string') return await interaction.editReply({ content: payload });
          return await interaction.editReply(payload);
        } else {
          // later responses: followUp
          if (typeof payload === 'string') return await interaction.followUp({ content: payload });
          return await interaction.followUp(payload);
        }
      } catch (err) {
        console.error('Interaction send error', err);
      }
    }
  };

  // attach mentioned user if option exists
  const userOpt = opts.getUser ? opts.getUser('user') : null;
  if (userOpt) ctx._mentionedUser = userOpt;

  await handleCommand(commandName, args, ctx);
});

// ---------- Welcome message ----------
client.on('guildMemberAdd', member => {
  try {
    const ch = member.guild.systemChannel;
    if (ch) ch.send(`🎉 Welcome to the server, ${member}!`);
  } catch (e) {
    console.error('Welcome send failed', e);
  }
});

// ---------- Ready & login ----------
client.once('ready', async () => {
  console.log(`✅ Bot ready! Logged in as ${client.user.tag}`);
  // register slash commands
  await registerSlashCommands().catch(err => console.error('Slash reg error', err));
});

client.on('error', err => console.error('Client error', err));
process.on('unhandledRejection', (r) => console.error('Unhandled Rejection', r));
process.on('uncaughtException', (e) => console.error('Uncaught exception', e));

console.log('Starting bot login...');
client.login(DISCORD_TOKEN).then(() => {
  console.log('Login successful');
}).catch(err => {
  console.error('Login failed:', err);
});

