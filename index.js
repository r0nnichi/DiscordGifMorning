// index.js
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');
require('dotenv').config();

// Basic bot client
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

// ---------------------
// Economy storage (in-memory for now, can swap with DB)
let economy = {};
const shopItems = {
    "apple": 50,
    "sword": 500,
    "shield": 400
};

// ---------------------
// Helper Functions
const getGif = async (keyword) => {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(keyword)}&key=${process.env.TENOR_KEY}&client_key=mydiscordbot&limit=10`;
    const res = await fetch(url);
    const data = await res.json();
    if(data.results && data.results.length > 0){
        return data.results[Math.floor(Math.random()*data.results.length)].media_formats.gif.url;
    } 
    return null;
};

const ensureUser = (id) => {
    if(!economy[id]){
        economy[id] = { balance: 0, inventory: {} };
    }
};

// ---------------------
// Slash Commands
const commands = [
    // Fun GIF commands
    new SlashCommandBuilder().setName('gif').setDescription('Get a gif').addStringOption(option => option.setName('keyword').setDescription('Keyword for gif').setRequired(true)),
    new SlashCommandBuilder().setName('joke').setDescription('Get a joke'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8ball').addStringOption(option => option.setName('question').setDescription('Your question').setRequired(true)),

    // Interactive
    new SlashCommandBuilder().setName('hug').setDescription('Hug someone').addUserOption(option => option.setName('target').setDescription('User to hug').setRequired(true)),
    new SlashCommandBuilder().setName('slap').setDescription('Slap someone').addUserOption(option => option.setName('target').setDescription('User to slap').setRequired(true)),

    // Utility
    new SlashCommandBuilder().setName('ping').setDescription('Check ping'),
    new SlashCommandBuilder().setName('userinfo').setDescription('Get user info').addUserOption(option => option.setName('target').setDescription('User info to fetch').setRequired(false)),
    new SlashCommandBuilder().setName('avatar').setDescription('Get user avatar').addUserOption(option => option.setName('target').setDescription('User avatar').setRequired(false)),

    // Economy
    new SlashCommandBuilder().setName('balance').setDescription('Check your balance'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim daily reward'),
    new SlashCommandBuilder().setName('pay').setDescription('Pay another user').addUserOption(option => option.setName('target').setDescription('User to pay').setRequired(true)).addIntegerOption(option => option.setName('amount').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('shop').setDescription('View shop items'),
    new SlashCommandBuilder().setName('buy').setDescription('Buy an item').addStringOption(option => option.setName('item').setDescription('Item name').setRequired(true)),
    new SlashCommandBuilder().setName('inventory').setDescription('Check inventory'),
    new SlashCommandBuilder().setName('gamble').setDescription('Gamble your coins').addIntegerOption(option => option.setName('amount').setDescription('Amount to gamble').setRequired(true))
];

// ---------------------
// Register commands
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try{
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch(e){
        console.error(e);
    }
})();

// ---------------------
// Interaction handler
client.on('interactionCreate', async (interaction) => {
    if(!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const userId = interaction.user.id;
    ensureUser(userId);

    // ---- Fun ----
    if(commandName === 'gif'){
        const keyword = interaction.options.getString('keyword');
        const url = await getGif(keyword);
        if(url) return interaction.reply({ content: url });
        return interaction.reply({ content: "No gif found!" });
    }

    if(commandName === 'joke'){
        const res = await fetch('https://v2.jokeapi.dev/joke/Any');
        const data = await res.json();
        if(data.type === 'single') return interaction.reply(data.joke);
        return interaction.reply(`${data.setup}\n||${data.delivery}||`);
    }

    if(commandName === '8ball'){
        const answers = ["Yes","No","Maybe","Definitely","Absolutely not","Ask again later"];
        return interaction.reply(answers[Math.floor(Math.random()*answers.length)]);
    }

    // ---- Interactive ----
    if(commandName === 'hug' || commandName === 'slap'){
        const target = interaction.options.getUser('target');
        const action = commandName;
        const url = await getGif(action);
        return interaction.reply({ content: `${interaction.user} ${action}s ${target}`, files: [url] });
    }

    // ---- Utility ----
    if(commandName === 'ping'){
        return interaction.reply(`Pong! ${client.ws.ping}ms`);
    }

    if(commandName === 'userinfo'){
        const target = interaction.options.getUser('target') || interaction.user;
        return interaction.reply(`User: ${target.tag}\nID: ${target.id}\nCreated: ${target.createdAt}`);
    }

    if(commandName === 'avatar'){
        const target = interaction.options.getUser('target') || interaction.user;
        return interaction.reply(target.displayAvatarURL({ dynamic: true, size: 512 }));
    }

    // ---- Economy ----
    if(commandName === 'balance'){
        return interaction.reply(`You have ${economy[userId].balance} coins.`);
    }

    if(commandName === 'daily'){
        const lastClaim = economy[userId].lastDaily || 0;
        const now = Date.now();
        if(now - lastClaim < 24*60*60*1000) return interaction.reply("You already claimed your daily today.");
        economy[userId].balance += 100;
        economy[userId].lastDaily = now;
        return interaction.reply("You claimed 100 coins daily!");
    }

    if(commandName === 'pay'){
        const target = interaction.options.getUser('target');
        const amount = interaction.options.getInteger('amount');
        ensureUser(target.id);
        if(economy[userId].balance < amount) return interaction.reply("Not enough coins.");
        economy[userId].balance -= amount;
        economy[target.id].balance += amount;
        return interaction.reply(`You paid ${amount} coins to ${target.tag}`);
    }

    if(commandName === 'shop'){
        const items = Object.entries(shopItems).map(([item, price]) => `${item}: ${price} coins`).join('\n');
        return interaction.reply(`Shop Items:\n${items}`);
    }

    if(commandName === 'buy'){
        const item = interaction.options.getString('item');
        if(!shopItems[item]) return interaction.reply("Item does not exist!");
        if(economy[userId].balance < shopItems[item]) return interaction.reply("Not enough coins!");
        economy[userId].balance -= shopItems[item];
        if(!economy[userId].inventory[item]) economy[userId].inventory[item] = 0;
        economy[userId].inventory[item] += 1;
        return interaction.reply(`You bought 1 ${item}`);
    }

    if(commandName === 'inventory'){
        const items = Object.entries(economy[userId].inventory).map(([item, qty]) => `${item}: ${qty}`).join('\n') || "Empty";
        return interaction.reply(`Your Inventory:\n${items}`);
    }

    if(commandName === 'gamble'){
        const amount = interaction.options.getInteger('amount');
        if(economy[userId].balance < amount) return interaction.reply("Not enough coins.");
        const win = Math.random() < 0.5;
        if(win){
            economy[userId].balance += amount;
            return interaction.reply(`You won! You now have ${economy[userId].balance} coins.`);
        } else {
            economy[userId].balance -= amount;
            return interaction.reply(`You lost! You now have ${economy[userId].balance} coins.`);
        }
    }
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
