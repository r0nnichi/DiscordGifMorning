// -------------------- index.js --------------------

// Fetch polyfill for Node
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
global.fetch = fetch;

// Load env and modules
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
  InteractionResponseFlags
} = require('discord.js');

// Environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TENOR_API_KEY = process.env.TENOR_API_KEY;
const OWNER_ID = process.env.OWNER_ID;

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is required in .env');
  process.exit(1);
}

// -------------------- Client --------------------
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
const COOLDOWN_TIME = 10 * 1000; // 10s for gamble cooldown
const cooldowns = new Map();

// -------------------- Data persistence --------------------
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

// -------------------- Keep-alive --------------------
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

if (process.env.SELF_PING !== 'false') {
  const SELF_URL = process.env.SELF_URL || `http://localhost:${PORT}/`;
  setInterval(() => fetch(SELF_URL).catch(() => {}), 5 * 60 * 1000).unref();
}

// -------------------- Tenor helper --------------------
async function getTenorGif(keyword) {
  if (!TENOR_API_KEY) return null;
  try {
    const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(keyword)}&key=${TENOR_API_KEY}&limit=20`);
    const json = await res.json();
    if (!json?.results?.length) return null;
    const pick = json.results[Math.floor(Math.random() * json.results.length)];
    return pick?.media_formats?.gif?.url
        || pick?.media_formats?.mediumgif?.url
        || Object.values(pick?.media_formats || {})[0]?.url
        || pick.url
        || null;
  } catch (err) {
    console.error('Tenor API error:', err);
    return null;
  }
}

// -------------------- Shop --------------------
const SHOP = [
  { id: 'rolecolor', name: 'Role Color Change (mock perk)', price: 500 },
  { id: 'nickname', name: 'Nickname Change (mock perk)', price: 250 },
  { id: 'customemoji', name: 'Custom Emoji Slot (mock perk)', price: 1000 },
];

// -------------------- Slash registration --------------------
async function registerSlashCommands() {
  const commands = [
    // Fun / Misc
    { name: 'joke', description: 'Get a random joke' },
    { name: 'meme', description: 'Get a random meme' },
    { name: 'cat', description: 'Get a random cat gif' },
    { name: 'dog', description: 'Get a random dog gif' },
    { name: '8ball', description: 'Ask the magic 8ball', options: [{ name: 'question', type: 3, description: 'Your question', required: true }] },
    { name: 'coinflip', description: 'Flip a coin' },
    { name: 'gif', description: 'Search a gif', options: [{ name: 'keyword', type: 3, description: 'Keyword', required: true }] },
    { name: 'fact', description: 'Get a random fact' },
    { name: 'quote', description: 'Get a random quote' },
    // Interactive
    { name: 'hug', description: 'Hug a user', options: [{ name: 'user', type: 6, description: 'User to hug', required: true }] },
    { name: 'slap', description: 'Slap a user', options: [{ name: 'user', type: 6, description: 'User to slap', required: true }] },
    { name: 'highfive', description: 'Highfive a user', options: [{ name: 'user', type: 6, description: 'User to highfive', required: true }] },
    { name: 'touch', description: 'Touch a user', options: [{ name: 'user', type: 6, description: 'User to touch', required: true }] },
    { name: 'roll', description: 'Roll a dice' },
    { name: 'pick', description: 'Pick an option', options: [{ name: 'options', type: 3, description: 'Options separated by |', required: true }] },
    // Utility
    { name: 'ping', description: 'Check bot latency' },
    { name: 'serverinfo', description: 'Get server info' },
    { name: 'userinfo', description: 'Get user info', options: [{ name: 'user', type: 6, description: 'User', required: false }] },
    { name: 'avatar', description: 'Get user avatar', options: [{ name: 'user', type: 6, description: 'User', required: false }] },
    // Stealers
    { name: 'stealemoji', description: 'Steal emoji', options: [{ name: 'emoji', type: 3, description: 'Emoji', required: true }] },
    { name: 'stealsticker', description: 'Steal sticker', options: [{ name: 'sticker', type: 3, description: 'Sticker id or URL', required: true }] },
    // Help
    { name: 'help', description: 'Show all commands and usage' },
    // Economy
    { name: 'balance', description: 'Check balance', options: [{ name: 'user', type: 6, description: 'User to check', required: false }] },
    { name: 'daily', description: 'Claim daily coins' },
    { name: 'pay', description: 'Send coins', options: [{ name: 'user', type: 6, description: 'Recipient', required: true }, { name: 'amount', type: 4, description: 'Amount', required: true }] },
    { name: 'inventory', description: 'Show your inventory' },
    { name: 'shop', description: 'Show the shop' },
    { name: 'buy', description: 'Buy an item', options: [{ name: 'item', type: 3, description: 'Item id', required: true }] },
    { name: 'use', description: 'Use an item', options: [{ name: 'item', type: 3, description: 'Item id', required: true }] },
    // Gamble
    { name: 'gamble', description: 'Gamble coins: coin | slots | poker', options: [{ name: 'amount', type: 4, description: 'Amount', required: true }, { name: 'type', type: 3, description: 'coin|slots|poker', required: false }] },
    // Owner
    { name: 'givemoney', description: '(Owner) Give money', options: [{ name: 'user', type: 6, description: 'User', required: true }, { name: 'amount', type: 4, description: 'Amount', required: true }] },
    { name: 'takemoney', description: '(Owner) Take money', options: [{ name: 'user', type: 6, description: 'User', required: true }, { name: 'amount', type: 4, description: 'Amount', required: true }] },
    // Trade / Leaderboard
    { name: 'trade', description: 'Trade item', options: [{ name: 'user', type: 6, description: 'Recipient', required: true }, { name: 'item', type: 3, description: 'Item id', required: true }] },
    { name: 'leaderboard', description: 'Top balances' },
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('Refreshing slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error('Slash registration error:', err);
  }
}

// -------------------- Helper: Poker --------------------
function createDeck() {
  const suits = ['♠','♥','♦','♣'], ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  return suits.flatMap(s => ranks.map(r => r+s));
}
function shuffle(array) { for (let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[array[i],array[j]]=[array[j],array[i]];} return array; }

// -------------------- Command handler --------------------
async function handleCommand(ctx, command, args = []) {
  const user = ensureUser(ctx.user.id);
  switch(command.toLowerCase()) {
    case 'ping':
      return ctx.reply(`Pong! ${client.ws.ping}ms`);
    case 'balance':
      const target = args[0] || ctx.user;
      const tUser = ensureUser(target.id);
      return ctx.reply(`${target.username} has ${tUser.balance} coins.`);
    case 'daily':
      const now = Date.now();
      if (now - user.lastDaily < 24*60*60*1000) return ctx.reply('You already claimed daily today.');
      user.balance += 500;
      user.lastDaily = now;
      saveData(data);
      return ctx.reply('You claimed 500 coins!');
    case 'pay':
      const payUser = args[0];
      const amount = args[1];
      if (!payUser || !amount || amount <= 0) return ctx.reply('Invalid pay command.');
      if (user.balance < amount) return ctx.reply('Not enough coins.');
      const rUser = ensureUser(payUser.id);
      user.balance -= amount;
      rUser.balance += amount;
      saveData(data);
      return ctx.reply(`Paid ${amount} coins to ${payUser.username}.`);
    case 'shop':
      return ctx.reply('Shop items:\n' + SHOP.map(i => `${i.name} - ${i.price} coins (id: ${i.id})`).join('\n'));
    case 'buy':
      const itemId = args[0];
      const item = SHOP.find(i => i.id === itemId);
      if (!item) return ctx.reply('Item not found.');
      if (user.balance < item.price) return ctx.reply('Not enough coins.');
      user.balance -= item.price;
      user.inventory.push(item.id);
      saveData(data);
      return ctx.reply(`You bought ${item.name}!`);
    // Add the rest: use, trade, gamble, fun commands, gifs, etc.
    default:
      return ctx.reply('Unknown command.');
  }
}

// -------------------- Prefix handler --------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Auto-replies
  if (/good morning/i.test(content)) return message.reply('Good morning! ☀️');
  if (/welcome/i.test(content)) return message.reply('Welcome! 🎉');

  if (!content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();
  handleCommand({ user: message.author, reply: (m) => message.channel.send(m) }, command, args);
});

// -------------------- Slash handler --------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  const args = [];
  interaction.options.data.forEach(o => args.push(o.value));
  await handleCommand({ user: interaction.user, reply: (m) => interaction.reply({ content: m, ephemeral: true }) }, interaction.commandName, args);
});

// -------------------- Ready --------------------
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  registerSlashCommands();
});

client.login(DISCORD_TOKEN);

