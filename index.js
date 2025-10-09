require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const translate = require('@vitalets/google-translate-api');

const PREFIX = ']';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Keep-alive server ---
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
  } catch (err) {
    console.error('Tenor error:', err.message);
    return null;
  }
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Ready event ---
client.once('ready', async () => {
  console.log(`Bot ready! Logged in as ${client.user.tag}`);

  // Register slash commands
  const commands = [
    { name: 'joke', description: 'Get a random joke' },
    { name: 'meme', description: 'Get a random meme' },
    { name: 'cat', description: 'Get a random cat picture' },
    { name: 'dog', description: 'Get a random dog picture' },
    { name: 'translate', description: 'Translate text to another language', options: [
      { name: 'text', type: 3, description: 'Text to translate', required: true },
      { name: 'lang', type: 3, description: 'Target language code (e.g., en, es, fr)', required: true }
    ]}
  ];
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error(err);
  }
});

// --- Message handler ---
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase();

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
    if (command === 'joke') {
      const res = await axios.get('https://official-joke-api.appspot.com/random_joke');
      await message.reply(`${res.data.setup} ... ${res.data.punchline}`);
    } else if (command === 'meme') {
      const res = await axios.get('https://meme-api.com/gimme');
      await message.reply(res.data.url || 'No meme 😢');
    } else if (command === 'cat') {
      const res = await axios.get('https://api.thecatapi.com/v1/images/search');
      await message.reply(res.data[0]?.url || 'No cat 😿');
    } else if (command === 'dog') {
      const res = await axios.get('https://dog.ceo/api/breeds/image/random');
      await message.reply(res.data.message || 'No dog 🐶');
    } else if (command === '8ball') {
      const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask later', 'I don’t know'];
      await message.reply(randomChoice(answers));
    } else if (command === 'coinflip') {
      await message.reply(Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙');
    } else if (command === 'gif') {
      const keyword = args.join(' ');
      if (!keyword) return message.reply('Provide a keyword for the GIF.');
      const gif = await getRandomTenorGif(keyword);
      await message.reply(gif || `No GIF found for "${keyword}" 😢`);
    } else if (command === 'fact') {
      const res = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
      await message.reply(res.data?.text || 'No fact 😢');
    } else if (command === 'quote') {
      const res = await axios.get('https://zenquotes.io/api/random');
      await message.reply(res.data[0]?.q + ' —' + res.data[0]?.a || 'No quote 😢');
    } else if (['hug','slap','highfive'].includes(command)) {
      const user = message.mentions.users.first();
      if (!user) return message.reply('Mention someone!');
      const actions = { hug: 'hugged', slap: 'slapped', highfive: 'high-fived' };
      const action = actions[command];
      const gif = await getRandomTenorGif(command);
      const embed = new EmbedBuilder()
        .setDescription(`${message.author} ${action} ${user}!`)
        .setImage(gif || '')
        .setColor('Random');
      await message.reply({ embeds: [embed] });
    } else if (command === 'roll') {
      await message.reply(`${message.author} rolled: ${Math.floor(Math.random() * 6) + 1}`);
    } else if (command === 'pick') {
      const options = args.join(' ').split('|').map(o => o.trim()).filter(Boolean);
      if (options.length < 2) return message.reply('Give at least 2 options separated by |');
      await message.reply(`I choose: ${randomChoice(options)}`);
    } else if (command === 'ping') {
      await message.reply(`Pong! 🏓 ${Math.round(client.ws.ping)}ms`);
    } else if (command === 'serverinfo') {
      const embed = new EmbedBuilder()
        .setTitle('Server Info')
        .addFields(
          { name: 'Server Name', value: message.guild.name, inline: true },
          { name: 'Members', value: `${message.guild.memberCount}`, inline: true },
          { name: 'Created On', value: `${message.guild.createdAt.toDateString()}`, inline: true }
        )
        .setColor('Blue');
      await message.reply({ embeds: [embed] });
    } else if (command === 'userinfo') {
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
    } else if (command === 'avatar') {
      const user = message.mentions.users.first() || message.author;
      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Avatar`)
        .setImage(user.displayAvatarURL({ dynamic: true }))
        .setColor('Purple');
      await message.reply({ embeds: [embed] });
    } else if (command === 'translate') {
      const text = args.slice(1).join(' ');
      const targetLang = args[0];
      if (!targetLang || !text) return message.reply('Usage: ]translate <lang> <text>');
      try {
        const res = await translate(text, { to: targetLang });
        await message.reply(`**Translated (${res.from.language.iso} → ${targetLang}):** ${res.text}`);
      } catch {
        await message.reply('Translation failed 😢');
      }
    } else if (command === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('🤖 Fun GIF Bot Commands')
        .setDescription('All commands listed below:')
        .addFields(
          { name: 'Auto replies', value: '"good morning" → GIF\n"welcome" → GIF' },
          { name: 'Fun', value: `${PREFIX}joke, ${PREFIX}meme, ${PREFIX}cat, ${PREFIX}dog, ${PREFIX}8ball, ${PREFIX}coinflip, ${PREFIX}gif <keyword>, ${PREFIX}fact, ${PREFIX}quote, ${PREFIX}translate <lang> <text>` },
          { name: 'Interactive', value: `${PREFIX}hug @user, ${PREFIX}slap @user, ${PREFIX}highfive @user, ${PREFIX}roll, ${PREFIX}pick option1 | option2` },
          { name: 'Utility', value: `${PREFIX}ping, ${PREFIX}serverinfo, ${PREFIX}userinfo @user, ${PREFIX}avatar @user` },
          { name: 'Help', value: `${PREFIX}help → Show this embed` }
        )
        .setColor('Blue')
        .setFooter({ text: 'Enjoy! 🎉' });
      await message.reply({ embeds: [helpEmbed] });
    } else {
      await message.reply(`Unknown command. Use ${PREFIX}help`);
    }
  } catch (err) {
    console.error('Command error:', err);
    await message.reply('Oops! Something went wrong 😢');
  }
});

// --- Slash commands ---
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'joke') {
      const res = await axios.get('https://official-joke-api.appspot.com/random_joke');
      await interaction.reply(`${res.data.setup} ... ${res.data.punchline}`);
    } else if (interaction.commandName === 'meme') {
      const res = await axios.get('https://meme-api.com/gimme');
      await interaction.reply(res.data.url || 'No meme 😢');
    } else if (interaction.commandName === 'cat') {
      const res = await axios.get('https://api.thecatapi.com/v1/images/search');
      await interaction.reply(res.data[0]?.url || 'No cat 😿');
    } else if (interaction.commandName === 'dog') {
      const res = await axios.get('https://dog.ceo/api/breeds/image/random');
      await interaction.reply(res.data.message || 'No dog 🐶');
    } else if (interaction.commandName === 'translate') {
      const text = interaction.options.getString('text');
      const lang = interaction.options.getString('lang');
      try {
        const res = await translate(text, { to: lang });
        await interaction.reply(`**Translated (${res.from.language.iso} → ${lang}):** ${res.text}`);
      } catch {
        await interaction.reply('Translation failed 😢');
      }
    }
  } catch (err) {
    console.error('Slash command error:', err);
    await interaction.reply('Oops! Something went wrong 😢');
  }
});

// --- Login ---
const discordToken = process.env.DISCORD_TOKEN;
if (!discordToken) {
  console.error('DISCORD_TOKEN not set');
  process.exit(1);
}
client.login(discordToken).catch(err => {
  console.error('Failed to login:', err.message);
  process.exit(1);
});
