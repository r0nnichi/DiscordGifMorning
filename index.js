require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const PREFIX = ']';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Keep-alive server for Render/Replit ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Discord Bot is running!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

// --- Helper functions ---
async function getRandomTenorGif(searchTerm) {
  try {
    const apiKey = process.env.TENOR_API_KEY;
    if (!apiKey) return null;
    const response = await axios.get('https://tenor.googleapis.com/v2/search', {
      params: { q: searchTerm, key: apiKey, client_key: 'discord_bot', limit: 20, random: true },
    });
    if (response.data?.results?.length) {
      return response.data.results[Math.floor(Math.random() * response.data.results.length)].url;
    }
    return null;
  } catch (error) {
    console.error('Tenor error:', error.message);
    return null;
  }
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Bot ready ---
client.once('ready', () => {
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
});

// --- Message handler ---
client.on('messageCreate', async (message) => {
  const content = message.content.toLowerCase();

  // Ignore bot messages
  if (message.author.bot) return;

  // --- Auto replies ---
  if (content.includes('good morning')) {
    const gif = await getRandomTenorGif('good morning');
    await message.reply(gif || 'Good morning! 🌅');
    return;
  }

  if (content.includes('welcome')) {
    const gif = await getRandomTenorGif('welcome');
    await message.reply(gif || 'Welcome! 👋');
    return;
  }

  // --- Prefix commands ---
  if (!content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    // ----- Fun commands -----
    if (command === 'joke') {
      const res = await axios.get('https://official-joke-api.appspot.com/random_joke');
      await message.reply(`${res.data.setup} ... ${res.data.punchline}`);
    }

    else if (command === 'meme') {
      const res = await axios.get('https://some-random-api.ml/meme');
      await message.reply(res.data?.image || 'Could not fetch meme 😢');
    }

    else if (command === 'cat') {
      const res = await axios.get('https://api.thecatapi.com/v1/images/search');
      await message.reply(res.data[0]?.url || 'No cat today 😿');
    }

    else if (command === 'dog') {
      const res = await axios.get('https://dog.ceo/api/breeds/image/random');
      await message.reply(res.data.message || 'No dog today 🐶');
    }

    else if (command === '8ball') {
      const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask later', 'I don’t know'];
      await message.reply(randomChoice(answers));
    }

    else if (command === 'coinflip') {
      await message.reply(Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙');
    }

    else if (command === 'gif') {
      const keyword = args.join(' ');
      if (!keyword) return message.reply('Please give me a keyword for the GIF.');
      const gif = await getRandomTenorGif(keyword);
      await message.reply(gif || `No GIF found for "${keyword}" 😢`);
    }

    else if (command === 'fact') {
      const res = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
      await message.reply(res.data?.text || 'No fact today 😢');
    }

    else if (command === 'quote') {
      const res = await axios.get('https://zenquotes.io/api/random');
      await message.reply(res.data[0]?.q + ' —' + res.data[0]?.a || 'No quote today 😢');
    }

    // ----- Interactive -----
    else if (['hug','slap','highfive'].includes(command)) {
      const user = message.mentions.users.first();
      if (!user) return message.reply('Please mention someone!');
      const actions = { hug: 'hugged', slap: 'slapped', highfive: 'high-fived' };
      const action = actions[command];
      const gif = await getRandomTenorGif(command);
      await message.reply(`${message.author} ${action} ${user}! ${gif || ''}`);
    }

    else if (command === 'roll') {
      await message.reply(`${message.author} rolled a dice: ${Math.floor(Math.random() * 6) + 1}`);
    }

    else if (command === 'pick') {
      const options = args.join(' ').split('|').map(o => o.trim()).filter(Boolean);
      if (options.length < 2) return message.reply('Give me at least 2 options separated by |');
      await message.reply(`I choose: ${randomChoice(options)}`);
    }

    // ----- Utility -----
    else if (command === 'ping') {
      const ping = Math.round(client.ws.ping);
      await message.reply(`Pong! 🏓 Latency: ${ping}ms`);
    }

    else if (command === 'serverinfo') {
      const embed = new EmbedBuilder()
        .setTitle('Server Info')
        .addFields(
          { name: 'Server Name', value: message.guild.name, inline: true },
          { name: 'Members', value: `${message.guild.memberCount}`, inline: true },
          { name: 'Created On', value: `${message.guild.createdAt.toDateString()}`, inline: true }
        )
        .setColor('Blue');
      await message.reply({ embeds: [embed] });
    }

    else if (command === 'userinfo') {
      const user = message.mentions.users.first() || message.author;
      const member = message.guild.members.cache.get(user.id);
      const embed = new EmbedBuilder()
        .setTitle(`${user.username} Info`)
        .addFields(
          { name: 'ID', value: user.id, inline: true },
          { name: 'Joined Server', value: member ? member.joinedAt.toDateString() : 'N/A', inline: true },
          { name: 'Roles', value: member ? member.roles.cache.map(r => r.name).join(', ') : 'N/A' }
        )
        .setColor('Green')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }));
      await message.reply({ embeds: [embed] });
    }

    else if (command === 'avatar') {
      const user = message.mentions.users.first() || message.author;
      await message.reply({ content: `${user.username}'s Avatar:`, files: [user.displayAvatarURL({ dynamic: true })] });
    }

    // ----- Help -----
    else if (command === 'help') {
      const helpMsg = `
Hi! I am a fun GIF bot 🤖

**Automatic replies (no prefix needed):**
- "good morning" → Good Morning GIF
- "welcome" → Welcome GIF

**Commands (use prefix '${PREFIX}'):**
- ${PREFIX}joke → Random joke
- ${PREFIX}meme → Random meme
- ${PREFIX}cat → Random cat picture
- ${PREFIX}dog → Random dog picture
- ${PREFIX}8ball → Magic 8-ball answer
- ${PREFIX}coinflip → Flip a coin
- ${PREFIX}gif <keyword> → Random GIF
- ${PREFIX}fact → Random fact
- ${PREFIX}quote → Random quote
- ${PREFIX}hug @user → Hug someone
- ${PREFIX}slap @user → Slap someone
- ${PREFIX}highfive @user → High-five someone
- ${PREFIX}roll → Roll a dice
- ${PREFIX}pick option1 | option2 | ... → Pick one option
- ${PREFIX}ping → Check bot latency
- ${PREFIX}serverinfo → Info about the server
- ${PREFIX}userinfo @user → Info about a user
- ${PREFIX}avatar @user → Get user avatar
- ${PREFIX}help → Show this help menu
      `;
      await message.reply(helpMsg);
    }

    else {
      await message.reply(`Unknown command. Use ${PREFIX}help to see all commands.`);
    }

  } catch (err) {
    console.error('Command error:', err);
    await message.reply('Oops! Something went wrong 😢');
  }
});

client.on('error', console.error);

// --- Login ---
const discordToken = process.env.DISCORD_TOKEN;
if (!discordToken) {
  console.error('DISCORD_TOKEN is not set in environment variables');
  process.exit(1);
}

client.login(discordToken).catch((err) => {
  console.error('Failed to login to Discord:', err.message);
  process.exit(1);
});
