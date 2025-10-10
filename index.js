// ===== DiscordGifMorning FINAL STABLE BOT =====
// Supports: Slash + Prefix commands, Auto replies, Welcome, and Economy (JSON-based)
// Owner ID: 989035158919336006
// Prefix: ]

import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import fs from 'fs';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

// ===== Keep-alive (Render) =====
const server = express();
server.all('/', (req, res) => res.send('✅ Bot is alive.'));
server.listen(3000, () => console.log('🌐 Keep-alive server running.'));

// ===== Discord Client Setup =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const PREFIX = process.env.PREFIX || ']';
const OWNER_ID = '989035158919336006';
const TOKEN = process.env.TOKEN;

// ===== Economy =====
const ECON_FILE = './economy.json';
let economy = {};
if (fs.existsSync(ECON_FILE)) {
  economy = JSON.parse(fs.readFileSync(ECON_FILE));
} else fs.writeFileSync(ECON_FILE, '{}');

function saveEconomy() {
  fs.writeFileSync(ECON_FILE, JSON.stringify(economy, null, 2));
}
function getUser(id) {
  if (!economy[id]) economy[id] = { balance: 100, items: [] }; // default 100
  return economy[id];
}

// ===== Slash Commands Registration =====
const slashCommands = [
  { name: 'ping', description: 'Check bot latency.' },
  { name: 'cat', description: 'Get a random cat image.' },
  { name: 'balance', description: 'Check your wallet balance.' },
  {
    name: 'give',
    description: 'Give money to another user.',
    options: [
      { name: 'user', description: 'User to give money to', type: 6, required: true },
      { name: 'amount', description: 'Amount to give', type: 4, required: true }
    ]
  },
  {
    name: 'take',
    description: '[Owner Only] Take money from a user.',
    options: [
      { name: 'user', description: 'User to take money from', type: 6, required: true },
      { name: 'amount', description: 'Amount to take', type: 4, required: true }
    ]
  }
];

// ===== On Ready =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
    console.log('✅ Slash commands registered successfully.');
  } catch (err) {
    console.error('❌ Slash registration failed:', err);
  }
});

// ===== Slash Command Handler =====
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName, user, options } = interaction;

    if (commandName === 'ping') {
      return interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
    }

    if (commandName === 'cat') {
      await interaction.deferReply();
      const res = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await res.json();
      return interaction.editReply({ content: data[0].url });
    }

    if (commandName === 'balance') {
      const bal = getUser(user.id).balance;
      return interaction.reply(`💰 You have $${bal}.`);
    }

    if (commandName === 'give') {
      const target = options.getUser('user');
      const amount = options.getInteger('amount');
      const sender = getUser(user.id);

      if (amount <= 0) return interaction.reply('❌ Amount must be positive.');
      if (sender.balance < amount) return interaction.reply('❌ Not enough money.');

      sender.balance -= amount;
      getUser(target.id).balance += amount;
      saveEconomy();
      return interaction.reply(`✅ You gave $${amount} to ${target.username}.`);
    }

    if (commandName === 'take') {
      if (user.id !== OWNER_ID)
        return interaction.reply('❌ Only the owner can use this.');
      const target = options.getUser('user');
      const amount = options.getInteger('amount');
      const t = getUser(target.id);
      if (amount <= 0) return interaction.reply('❌ Invalid amount.');
      if (t.balance < amount) return interaction.reply('❌ Target doesn’t have enough.');

      t.balance -= amount;
      saveEconomy();
      return interaction.reply(`💀 Took $${amount} from ${target.username}.`);
    }
  } catch (err) {
    console.error('❌ Slash command error:', err);
    if (interaction.deferred) interaction.editReply('❌ Something went wrong.');
    else interaction.reply('❌ Something went wrong.');
  }
});

// ===== Prefix Command Handler =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  console.log(`Prefix command detected: ${command} by ${message.author.tag}`);

  try {
    if (command === 'ping') {
      return message.channel.send(`🏓 Pong! ${client.ws.ping}ms`);
    }

    if (command === 'cat') {
      const res = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await res.json();
      return message.channel.send(data[0].url);
    }

    if (command === 'balance') {
      const bal = getUser(message.author.id).balance;
      return message.channel.send(`💰 You have $${bal}.`);
    }

    if (command === 'give') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      const sender = getUser(message.author.id);

      if (!target || isNaN(amount) || amount <= 0)
        return message.channel.send('❌ Usage: ]give @user <amount>');
      if (sender.balance < amount)
        return message.channel.send('❌ Not enough money.');

      sender.balance -= amount;
      getUser(target.id).balance += amount;
      saveEconomy();
      return message.channel.send(`✅ You gave $${amount} to ${target.username}.`);
    }

    if (command === 'take') {
      if (message.author.id !== OWNER_ID)
        return message.channel.send('❌ Only the owner can use this.');
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      const t = getUser(target?.id);
      if (!target || isNaN(amount) || amount <= 0)
        return message.channel.send('❌ Usage: ]take @user <amount>');
      if (t.balance < amount)
        return message.channel.send('❌ Target doesn’t have enough.');

      t.balance -= amount;
      saveEconomy();
      return message.channel.send(`💀 Took $${amount} from ${target.username}.`);
    }
  } catch (err) {
    console.error('❌ Prefix error:', err);
    message.channel.send('❌ Error running that command.');
  }
});

// ===== Auto Replies =====
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const text = msg.content.toLowerCase();
  if (text.includes('good morning'))
    return msg.reply(`☀️ Good morning, ${msg.author.username}!`);
  if (text.includes('good night'))
    return msg.reply(`🌙 Sleep well, ${msg.author.username}!`);
});

// ===== Welcome =====
client.on('guildMemberAdd', (member) => {
  const channel = member.guild.systemChannel;
  if (channel) channel.send(`🎉 Welcome to the server, ${member}!`);
});

// ===== Login =====
console.log('🔑 Logging in...');
client.login(TOKEN);
