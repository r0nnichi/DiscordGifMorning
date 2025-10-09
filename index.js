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

async function getRandomTenorGif(searchTerm) {
  try {
    const apiKey = process.env.TENOR_API_KEY;
    if (!apiKey) {
      console.error('TENOR_API_KEY is not set');
      return null;
    }

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
  const content = message.content.toLowerCase();
  const authorUsername = message.author.username.toLowerCase();
  
  // Check if carlbot is mentioning @welcomer to welcome the user
  const isCarlbotWelcome = message.author.bot && 
                          (authorUsername.includes('carl') || authorUsername.includes('carlbot')) &&
                          (content.includes('@welcomer') || message.mentions.has(client.user)) &&
                          content.includes('welcome the user');
  
  if (isCarlbotWelcome) {
    try {
      const gifUrl = await getRandomTenorGif('welcome');
      
      if (gifUrl) {
        await message.reply(gifUrl);
      } else {
        await message.reply('Welcome! 👋');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      await message.reply('Welcome! 👋');
    }
    return;
  }
  
  // Ignore other bot messages
  if (message.author.bot) return;
  
  if (content.includes('good morning')) {
    try {
      const gifUrl = await getRandomTenorGif('good morning');
      
      if (gifUrl) {
        await message.reply(gifUrl);
      } else {
        await message.reply('Good morning! 🌅');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      await message.reply('Good morning! 🌅');
    }
  } else if (content.includes('welcome')) {
    try {
      const gifUrl = await getRandomTenorGif('welcome');
      
      if (gifUrl) {
        await message.reply(gifUrl);
      } else {
        await message.reply('Welcome! 👋');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      await message.reply('Welcome! 👋');
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
