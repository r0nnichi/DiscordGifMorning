// index.js — full merged bot with prefix + slash commands, Tenor gifs fixed,
// emoji/sticker stealing, persisted currency (JSON), help, and currency shop.
// Install: npm i discord.js node-fetch
// Start: node index.js
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
} = require('discord.js');

const TENOR_API_KEY = process.env.TENOR_API_KEY;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN missing in environment!');
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

// -------------------- Persistence helpers --------------------
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to load data file:', err);
    return { users: {} };
  }
}
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save data file:', err);
  }
}
const data = loadData();
function ensureUser(id) {
  if (!data.users[id]) data.users[id] = { balance: 0, lastDaily: 0 };
  return data.users[id];
}

// -------------------- Keep-alive (for Render, Replit, etc.) --------------------
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Discord Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

// -------------------- Slash command registration --------------------
async function registerSlashCommands() {
  const commands = [
    { name: 'help', description: 'Show all commands and usage' },
    { name: 'joke', description: 'Get a random joke' },
    { name: 'meme', description: 'Get a random meme (Tenor)' },
    { name: 'cat', description: 'Get a random cat gif (Tenor)' },
    { name: 'dog', description: 'Get a random dog gif (Tenor)' },
    {
      name: '8ball',
      description: 'Ask the magic 8ball',
      options: [{ name: 'question', type: 3, description: 'Your question', required: true }],
    },
    { name: 'coinflip', description: 'Flip a coin' },
    { name: 'gif', description: 'Search a gif (Tenor)', options: [{ name: 'keyword', type: 3, required: true }] },
    { name: 'fact', description: 'Get a random fact' },
    { name: 'quote', description: 'Get a random quote' },
    { name: 'hug', description: 'Hug a user', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'slap', description: 'Slap a user', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'highfive', description: 'Highfive a user', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'touch', description: 'Touch a user', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'roll', description: 'Roll a dice' },
    { name: 'pick', description: 'Pick an option', options: [{ name: 'options', type: 3, required: true }] },
    { name: 'ping', description: 'Check bot latency' },
    { name: 'serverinfo', description: 'Get server info' },
    { name: 'userinfo', description: 'Get user info', options: [{ name: 'user', type: 6, required: false }] },
    { name: 'avatar', description: 'Get user avatar', options: [{ name: 'user', type: 6, required: false }] },
    { name: 'stealemoji', description: 'Steal emoji from another server', options: [{ name: 'emoji', type: 3, required: true }] },
    { name: 'stealsticker', description: 'Steal sticker from another server', options: [{ name: 'sticker', type: 3, required: true }] },
    // Currency commands
    { name: 'balance', description: 'Check your balance (or someone else)', options: [{ name: 'user', type: 6, required: false }] },
    { name: 'daily', description: 'Claim daily reward' },
    { name: 'gamble', description: 'Gamble some of your money', options: [{ name: 'amount', type: 3, required: true }] },
    { name: 'shop', description: 'Show the shop' },
    { name: 'buy', description: 'Buy an item from the shop', options: [{ name: 'item', type: 3, required: true }] },
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

// -------------------- Tenor helper (robust) --------------------
async function getTenorGif(keyword) {
  if (!TENOR_API_KEY) return null;
  try {
    const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(keyword)}&key=${TENOR_API_KEY}&limit=20`);
    const json = await res.json();
    if (!json || !json.results || json.results.length === 0) return null;
    const pick = json.results[Math.floor(Math.random() * json.results.length)];
    // media_formats may vary, try common paths
    if (pick?.media_formats?.gif?.url) return pick.media_formats.gif.url;
    if (pick?.media_formats?.mediumgif?.url) return pick.media_formats.mediumgif.url;
    if (pick?.content_description && pick?.url) return pick.url;
    // fallback: try first media object url
    const mf = Object.values(pick?.media_formats || {})[0];
    if (mf?.url) return mf.url;
    return null;
  } catch (err) {
    console.error('Tenor error:', err);
    return null;
  }
}

// -------------------- Utility: make embed senders --------------------
function makeContextForMessage(message) {
  return {
    send: content => message.channel.send(content),
    reply: content => message.reply(content),
    author: message.author,
    guild: message.guild,
    member: message.member,
  };
}
function makeContextForInteraction(interaction) {
  // We'll reply immediately; if later we need to update we can followup.
  return {
    send: content => interaction.reply(typeof content === 'string' ? { content } : content),
    reply: content => interaction.reply(typeof content === 'string' ? { content } : content),
    author: interaction.user,
    guild: interaction.guild,
    member: interaction.member,
  };
}

// -------------------- Shop (simple) --------------------
const SHOP = [
  { id: 'rolecolor', name: 'Role Color Change (mock)', price: 100 },
  { id: 'nickname', name: 'Nickname Change (mock)', price: 50 },
  { id: 'customemoji', name: 'Custom Emoji Slot (mock)', price: 200 },
];

// -------------------- Command implementation (single shared) --------------------
async function handleCommand(command, args, ctx) {
  // ctx.send / ctx.reply available
  try {
    switch (command) {
      case 'help': {
        const embed = new EmbedBuilder()
          .setTitle('🤖 Fun GIF Bot Commands')
          .setDescription(
            `**Auto replies:**\n"good morning" → GIF\n"welcome" → GIF\n\n` +
              `**Fun:**\n${PREFIX}joke, ${PREFIX}meme, ${PREFIX}cat, ${PREFIX}dog, ${PREFIX}8ball, ${PREFIX}coinflip, ${PREFIX}gif <keyword>, ${PREFIX}fact, ${PREFIX}quote\n\n` +
              `**Interactive:**\n${PREFIX}hug @user, ${PREFIX}slap @user, ${PREFIX}highfive @user, ${PREFIX}touch @user, ${PREFIX}roll, ${PREFIX}pick option1 | option2\n\n` +
              `**Utility:**\n${PREFIX}ping, ${PREFIX}serverinfo, ${PREFIX}userinfo @user, ${PREFIX}avatar @user\n\n` +
              `**Steal:**\n${PREFIX}stealemoji <emoji_id or url>\n${PREFIX}stealsticker <sticker_id or url>\n\n` +
              `**Currency:**\n${PREFIX}balance, ${PREFIX}daily, ${PREFIX}gamble <amount>, ${PREFIX}shop, ${PREFIX}buy <item>\n\nEnjoy! 🎉`
          )
          .setColor('Blue');
        return ctx.send({ embeds: [embed] });
      }

      case 'ping':
        return ctx.send(`🏓 Pong! Latency: ${Date.now() - (ctx.author ? ctx.author.createdAt?.getTime() || 0 : 0)}ms`);

      case 'joke': {
        const r = await fetch('https://v2.jokeapi.dev/joke/Any');
        const d = await r.json();
        return ctx.send(d.type === 'single' ? d.joke : `${d.setup}\n${d.delivery}`);
      }

      case 'meme': {
        const url = await getTenorGif('meme');
        return ctx.send(url || 'No meme GIF found 😢');
      }

      case 'cat': {
        const url = await getTenorGif('cat');
        return ctx.send(url || 'No cat GIF found 😢');
      }

      case 'dog': {
        const url = await getTenorGif('dog');
        return ctx.send(url || 'No dog GIF found 😢');
      }

      case '8ball': {
        const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask again later', 'I don’t know'];
        return ctx.send(answers[Math.floor(Math.random() * answers.length)]);
      }

      case 'coinflip':
        return ctx.send(Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙');

      case 'gif': {
        const keyword = args.join(' ');
        if (!keyword) return ctx.send('Please provide a keyword.');
        const url = await getTenorGif(keyword);
        return ctx.send(url || 'No GIF found 😢');
      }

      case 'fact': {
        const r = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
        const d = await r.json();
        return ctx.send(d.text || 'No fact found.');
      }

      case 'quote': {
        try {
          const r = await fetch('https://api.quotable.io/random');
          const d = await r.json();
          return ctx.send(`"${d.content}" — ${d.author}`);
        } catch {
          return ctx.send('Something went wrong fetching a quote 😢');
        }
      }

      case 'hug':
      case 'slap':
      case 'highfive':
      case 'touch': {
        const target = args[0] && typeof args[0] === 'string' && ctx.guild ? (ctx.guild.members.cache.get(args[0]) || null) : null;
        // When used from message, args parsing uses mentions; when slash, args[0] will be user id
        let user;
        if (target) user = target.user;
        else if (ctx.author && args.length && args[0].startsWith('<@')) {
          // mention string
          const id = args[0].replace(/[^0-9]/g, '');
          user = ctx.guild?.members.cache.get(id)?.user || null;
        } else {
          // fallback: in message handler we will pass message.mentions
          user = ctx._mentionedUser || null;
        }
        if (!user) return ctx.send('Please mention a user!');
        const gif = await getTenorGif(command) || null;
        const embed = new EmbedBuilder().setTitle(`${ctx.author.username} ${command}s ${user.username}!`);
        if (gif) embed.setImage(gif);
        embed.setColor('Random');
        return ctx.send({ embeds: [embed] });
      }

      case 'roll': {
        const roll = Math.floor(Math.random() * 6) + 1;
        return ctx.send(`🎲 You rolled: ${roll}`);
      }

      case 'pick': {
        const options = args.join(' ').split('|').map(s => s.trim()).filter(Boolean);
        if (options.length < 2) return ctx.send('Provide at least 2 options separated by |');
        const choice = options[Math.floor(Math.random() * options.length)];
        return ctx.send(`I pick: **${choice}**`);
      }

      case 'serverinfo': {
        const g = ctx.guild;
        if (!g) return ctx.send('Not in a guild context.');
        const embed = new EmbedBuilder()
          .setTitle(g.name)
          .setDescription(`ID: ${g.id}\nMembers: ${g.memberCount}\nRegion: ${g.preferredLocale || 'N/A'}`)
          .setColor('Green');
        return ctx.send({ embeds: [embed] });
      }

      case 'userinfo': {
        // args[0] might be user id
        let user = null;
        if (args.length && ctx.guild) {
          const id = args[0].replace(/[^0-9]/g, '');
          user = ctx.guild.members.cache.get(id)?.user || null;
        }
        if (!user) user = ctx.author;
        const embed = new EmbedBuilder()
          .setTitle(user.tag)
          .addFields({ name: 'ID', value: user.id, inline: true })
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setColor('Blue');
        return ctx.send({ embeds: [embed] });
      }

      case 'avatar': {
        let user = null;
        if (args.length && ctx.guild) {
          const id = args[0].replace(/[^0-9]/g, '');
          user = ctx.guild.members.cache.get(id)?.user || null;
        }
        if (!user) user = ctx.author;
        return ctx.send(user.displayAvatarURL({ dynamic: true, size: 1024 }));
      }

      case 'stealemoji': {
        if (!ctx.member || !ctx.member.permissions?.has(PermissionsBitField.Flags.ManageEmojisAndStickers))
          return ctx.send('You need Manage Emojis & Stickers permission to use this.');
        const emojiInput = args[0];
        if (!emojiInput) return ctx.send('Provide an emoji id or direct URL.');
        // If user pasted <:name:id> extract id
        const idMatch = emojiInput.match(/:(\d+)>?$/);
        let url = null;
        if (emojiInput.startsWith('http')) url = emojiInput;
        else if (idMatch) url = `https://cdn.discordapp.com/emojis/${idMatch[1]}.png`;
        else if (/^\d+$/.test(emojiInput)) url = `https://cdn.discordapp.com/emojis/${emojiInput}.png`;
        else return ctx.send('Unrecognized emoji input. Paste emoji (like <:name:id>) or an emoji id or a URL.');

        try {
          const created = await ctx.guild.emojis.create({ attachment: url, name: `emoji_${Date.now()}` });
          return ctx.send(`Emoji added: ${created}`);
        } catch (err) {
          console.error('Add emoji failed:', err);
          return ctx.send(`Failed to add emoji: ${err?.message || err}`);
        }
      }

      case 'stealsticker': {
        if (!ctx.member || !ctx.member.permissions?.has(PermissionsBitField.Flags.ManageEmojisAndStickers))
          return ctx.send('You need Manage Emojis & Stickers permission to use this.');
        const stickerInput = args[0];
        if (!stickerInput) return ctx.send('Provide a sticker id or URL.');
        // For stickers, Discord CDN: /stickers/{id}.png (static) or .png? Need to fetch actual URL from guilds if available.
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
          console.error('Add sticker failed:', err);
          return ctx.send(`Failed to add sticker: ${err?.message || err}`);
        }
      }

      // ---------------- Currency commands ----------------
      case 'balance': {
        const targetId = args[0] ? args[0].replace(/[^0-9]/g, '') : ctx.author.id;
        const userData = ensureUser(targetId);
        saveData(data);
        const embed = new EmbedBuilder()
          .setTitle('Balance')
          .setDescription(`<@${targetId}> has **${userData.balance}** coins`)
          .setColor('Gold');
        return ctx.send({ embeds: [embed] });
      }

      case 'daily': {
        const uid = ctx.author.id;
        const userData = ensureUser(uid);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (now - (userData.lastDaily || 0) < oneDay) {
          const left = Math.ceil((oneDay - (now - userData.lastDaily)) / (60 * 60 * 1000));
          return ctx.send(`You already claimed daily. Try again in about ${left} hour(s).`);
        }
        const amount = 100;
        userData.balance += amount;
        userData.lastDaily = now;
        saveData(data);
        return ctx.send(`You claimed your daily **${amount}** coins!`);
      }

      case 'gamble': {
        let amt = args[0];
        if (!amt) return ctx.send('Usage: gamble <amount> (or "all")');
        const uid = ctx.author.id;
        const userData = ensureUser(uid);
        if (amt === 'all') amt = userData.balance;
        amt = parseInt(amt, 10);
        if (!amt || amt <= 0) return ctx.send('Provide a valid amount.');
        if (amt > userData.balance) return ctx.send("You don't have enough coins.");
        const win = Math.random() < 0.5;
        if (win) {
          userData.balance += amt;
          saveData(data);
          return ctx.send(`You won! You gained **${amt}** coins. New balance: **${userData.balance}**`);
        } else {
          userData.balance -= amt;
          saveData(data);
          return ctx.send(`You lost **${amt}** coins. New balance: **${userData.balance}**`);
        }
      }

      case 'shop': {
        const embed = new EmbedBuilder().setTitle('Shop').setColor('Purple');
        const lines = SHOP.map(i => `**${i.id}** — ${i.name} — ${i.price} coins`);
        embed.setDescription(lines.join('\n'));
        return ctx.send({ embeds: [embed] });
      }

      case 'buy': {
        const itemId = args[0];
        if (!itemId) return ctx.send('Usage: buy <item_id>');
        const item = SHOP.find(s => s.id.toLowerCase() === itemId.toLowerCase());
        if (!item) return ctx.send('Item not found.');
        const uid = ctx.author.id;
        const userData = ensureUser(uid);
        if (userData.balance < item.price) return ctx.send("You don't have enough coins.");
        userData.balance -= item.price;
        saveData(data);
        // NOTE: this example does not actually change server settings (mock perks).
        return ctx.send(`You bought **${item.name}** for **${item.price}** coins. (This is a mock perk.)`);
      }

      default:
        return ctx.send("Unknown command. Use help to see available commands.");
    }
  } catch (err) {
    console.error('handleCommand error:', err);
    try {
      return ctx.send('Something went wrong executing the command 😢');
    } catch (e) {
      console.error('Failed to report error to user:', e);
    }
  }
}

// -------------------- Message (prefix) handler --------------------
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Auto replies (no prefix)
  const content = message.content.toLowerCase();
  if (content.includes('good morning')) {
    const gif = await getTenorGif('good morning');
    return message.channel.send(gif || 'Good morning! 🌞');
  }
  if (content.includes('welcome')) {
    const gif = await getTenorGif('welcome');
    return message.channel.send(gif || 'Welcome!');
  }

  if (!message.content.startsWith(PREFIX)) return;

  // parse
  const raw = message.content.slice(PREFIX.length).trim();
  if (!raw) return;
  const parts = raw.split(/ +/);
  const command = parts.shift().toLowerCase();
  const args = parts;

  // for interactive commands using mentions, attach mentioned user to ctx
  const ctx = makeContextForMessage(message);
  // attach convenience for mentioned user
  if (message.mentions && message.mentions.users && message.mentions.users.first) {
    ctx._mentionedUser = message.mentions.users.first();
  }

  // call shared handler
  await handleCommand(command, args, ctx);
});

// -------------------- Interaction (slash) handler --------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const commandName = interaction.commandName;
  const opts = interaction.options.data || [];
  // Build args array: for user type options we will pass user id; others pass value
  const args = opts.map(o => {
    if (o.type === 6) return o.value; // user id
    return String(o.value);
  });

  const ctx = makeContextForInteraction(interaction);

  // attach mentioned user when appropriate (so hug/slap can use it)
  if (opts.length) {
    const userOpt = opts.find(o => o.type === 6);
    if (userOpt) {
      // fetch member if possible
      try {
        const mem = await interaction.guild.members.fetch(userOpt.value);
        if (mem) ctx._mentionedUser = mem.user;
      } catch {}
    }
  }

  // run command
  await handleCommand(commandName, args, ctx);
});

// -------------------- Ready --------------------
client.once('ready', async () => {
  console.log(`Bot ready! Logged in as ${client.user.tag}`);
  await registerSlashCommands().catch(console.error);
});

// -------------------- Login --------------------
client.login(DISCORD_TOKEN).catch(err => {
  console.error('Login failed:', err);
  process.exit(1);
});
