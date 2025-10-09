require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

const PREFIX = ']'; // Command prefix

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Discord Bot is running!');
});

app.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

// Tenor GIF helper
async function getRandomTenorGif(searchTerm) {
  try {
    const apiKey = process.env.TENOR_API_KEY;
    if (!apiKey) return null;

    const response = await axios.get('https://tenor.googleapis.com/v2/search', {
      params: { q: searchTerm, key: apiKey, client_key: 'discord_bot', limit: 20, random: true },
    });

    if (response.data?.results?.length) {
      const randomIndex = Math.floor(Math.random() * response.data.results.length);
      return response.data.results[randomIndex].url;
    }

    return null;
  } catch (error) {
    console.error('Error fetching Tenor GIF:', error.message);
    return null;
  }
}

client.once('ready', () => {
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  const content = message.content.toLowerCase();
  const authorUsername = message.author.username.toLowerCase();

  // Ignore bot messages
  if (message.author.bot) return;

  // ----- Automatic replies (no prefix) -----
  const isCarlbotWelcome =
    message.author.bot &&
    (authorUsername.includes('carl') || authorUsername.includes('carlbot')) &&
    (message.content.includes('@welcomer') || message.mentions.has(client.user)) &&
    message.content.includes('welcome the user');

  if (isCarlbotWelcome) {
    try {
      const gifUrl = await getRandomTenorGif('welcome');
      await message.reply(gifUrl || 'Welcome! 👋');
    } catch {
      await message.reply('Welcome! 👋');
    }
    return;
  }

  // Regular auto responses
  if (content.includes('good morning')) {
    try {
      const gifUrl = await getRandomTenorGif('good morning');
      await message.reply(gifUrl || 'Good morning! 🌅');
    } catch {
      await message.reply('Good morning! 🌅');
    }
  } else if (content.includes('welcome')) {
    try {
      const gifUrl = await getRandomTenorGif('welcome');
      await message.reply(gifUrl || 'Welcome! 👋');
    } catch {
      await message.reply('Welcome! 👋');
    }
  }

  // ----- Prefix commands -----
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'joke') {
    try {
      const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
      const joke = `${response.data.setup} ... ${response.data.punchline}`;
      await message.reply(joke);
    } catch (error) {
      console.error('Error fetching joke:', error.message);
      await message.reply('Sorry, I could not get a joke right now 😢');
    }
  }

  else if (command === 'help') {
    const helpMessage = `
Hi! I am a fun GIF bot 🤖

**Automatic replies (no prefix needed):**
- "good morning" → sends a Good Morning GIF
- "welcome" → sends a Welcome GIF

**Commands (use prefix '${PREFIX}'):**
- ${PREFIX}joke → I tell a random joke
- ${PREFIX}help → Show this help message
    `;
    await message.reply(helpMessage);
  }
});

client.on('error', (error) => console.error('Discord client error:', error));

const discordToken = process.env.DISCORD_TOKEN;
if (!discordToken) {
  console.error('DISCORD_TOKEN is not set in environment variables');
  process.exit(1);
}

client.login(discordToken).catch((error) => {
  console.error('Failed to login to Discord:', error.message);
  process.exit(1);
});
