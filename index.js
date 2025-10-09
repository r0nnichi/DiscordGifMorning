require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

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

async function getRandomTenorGif() {
  try {
    const apiKey = process.env.TENOR_API_KEY;
    if (!apiKey) {
      console.error('TENOR_API_KEY is not set');
      return null;
    }

    const searchTerm = 'good morning';
    const response = await axios.get('https://tenor.googleapis.com/v2/search', {
      params: {
        q: searchTerm,
        key: apiKey,
        client_key: 'discord_bot',
        limit: 20,
        random: true,
      },
    });

    if (response.data && response.data.results && response.data.results.length > 0) {
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
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  
  if (content.includes('good morning')) {
    try {
      const gifUrl = await getRandomTenorGif();
      
      if (gifUrl) {
        await message.reply(gifUrl);
      } else {
        await message.reply('Good morning! 🌅');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      await message.reply('Good morning! 🌅');
    }
  }
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

const discordToken = process.env.DISCORD_TOKEN;

if (!discordToken) {
  console.error('DISCORD_TOKEN is not set in environment variables');
  process.exit(1);
}

client.login(discordToken).catch((error) => {
  console.error('Failed to login to Discord:', error.message);
  process.exit(1);
});
