const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
require('dotenv').config();

console.log('Environment check:');
console.log('PREFIX:', process.env.PREFIX);
console.log('DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);
console.log('TENOR_API_KEY exists:', !!process.env.TENOR_API_KEY);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Create server for Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

// Bot ready
client.once('ready', () => {
  console.log(`✅ Bot ready! Logged in as ${client.user.tag}`);
  console.log(`✅ Bot ID: ${client.user.id}`);
  client.user.setActivity(']help', { type: 'WATCHING' });
  console.log('🔍 Waiting for messages...');
});

// Message handler with detailed debugging
client.on('messageCreate', async (message) => {
  console.log(`📨 Message received from ${message.author.tag}: "${message.content}"`);
  console.log(`   - Bot: ${message.author.bot}`);
  console.log(`   - Guild: ${message.guild?.name || 'DM'}`);
  console.log(`   - Channel: ${message.channel.name || 'DM'}`);
  
  // Ignore bot messages
  if (message.author.bot) {
    console.log('   ↳ Ignored: message from bot');
    return;
  }
  
  const prefix = process.env.PREFIX || ']';
  console.log(`   - Checking for prefix: "${prefix}"`);
  
  // Check for prefix commands
  if (message.content.startsWith(prefix)) {
    console.log(`   ✅ Prefix detected!`);
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    console.log(`   🎯 Command: "${command}", Args:`, args);
    
    // Ping command
    if (command === 'ping') {
      console.log('   🚀 Executing ping command');
      try {
        const msg = await message.reply('Pinging...');
        const latency = msg.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        await msg.edit(`🏓 Pong! Latency: ${latency}ms | API: ${apiLatency}ms`);
        console.log('   ✅ Ping command completed');
      } catch (error) {
        console.log('   ❌ Ping command failed:', error);
      }
    }
    
    // Help command
    else if (command === 'help') {
      console.log('   🚀 Executing help command');
      try {
        await message.reply({
          embeds: [{
            color: 0x0099ff,
            title: '🤖 Bot Help',
            description: `Prefix: **${prefix}**`,
            fields: [
              { name: 'Commands', value: '`ping` - Check bot latency\n`help` - Show this message\n`cat` - Get cat GIF\n`dog` - Get dog GIF' }
            ]
          }]
        });
        console.log('   ✅ Help command completed');
      } catch (error) {
        console.log('   ❌ Help command failed:', error);
      }
    }
    
    // Cat command
    else if (command === 'cat') {
      console.log('   🚀 Executing cat command');
      try {
        await message.reply('🐱 **Random Cat GIF**\nhttps://media.tenor.com/xy5e_aWtGgcAAAAC/cat-funny-cat.gif');
        console.log('   ✅ Cat command completed');
      } catch (error) {
        console.log('   ❌ Cat command failed:', error);
      }
    }
    
    // Dog command
    else if (command === 'dog') {
      console.log('   🚀 Executing dog command');
      try {
        await message.reply('🐶 **Random Dog GIF**\nhttps://media.tenor.com/1Uf4nB71XqkAAAAC/dog-puppy.gif');
        console.log('   ✅ Dog command completed');
      } catch (error) {
        console.log('   ❌ Dog command failed:', error);
      }
    }
    
    else {
      console.log(`   ❓ Unknown command: ${command}`);
      try {
        await message.reply(`Unknown command. Use ${prefix}help for available commands.`);
      } catch (error) {
        console.log('   ❌ Unknown command reply failed:', error);
      }
    }
  } 
  // Auto-replies (no prefix)
  else {
    const content = message.content.toLowerCase();
    console.log('   🔍 Checking for auto-reply triggers');
    
    if (content.includes('welcome')) {
      console.log('   🚀 Triggering welcome auto-reply');
      try {
        await message.reply('👋 Welcome to the server!');
        console.log('   ✅ Welcome auto-reply sent');
      } catch (error) {
        console.log('   ❌ Welcome auto-reply failed:', error);
      }
    }
    else if (content.includes('good morning')) {
      console.log('   🚀 Triggering good morning auto-reply');
      try {
        await message.reply('🌞 Good morning! Have a great day!');
        console.log('   ✅ Good morning auto-reply sent');
      } catch (error) {
        console.log('   ❌ Good morning auto-reply failed:', error);
      }
    }
    else {
      console.log('   ↳ No auto-reply triggers found');
    }
  }
});

// Slash command handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  console.log(`🔧 Slash command: ${interaction.commandName} by ${interaction.user.tag}`);
  
  if (interaction.commandName === 'ping') {
    const latency = Math.round(client.ws.ping);
    await interaction.reply(`🏓 Pong! API Latency: ${latency}ms`);
  }
});

// Error handling
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login
console.log('Starting bot login...');
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ Login failed:', error);
});
