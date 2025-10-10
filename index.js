// add this right after client definition
client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerSlashCommands(); // register slash commands after login
});

// prefix handler for ] commands
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // wrap context object like we use in slash
  const ctx = {
    author: message.author,
    guild: message.guild,
    member: message.member,
    send: (content) => message.reply(content),
    _mentionedUser: message.mentions.users.first(),
    _msgCreatedAt: message.createdTimestamp,
  };

  try {
    await handleCommand(command, args, ctx);
  } catch (err) {
    console.error('Command error:', err);
    message.reply('❌ Something went wrong running that command.');
  }
});

// slash command handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;
  await interaction.deferReply(); // prevents timeout

  const args = [];
  options.data.forEach(opt => args.push(opt.value));

  const ctx = {
    author: interaction.user,
    guild: interaction.guild,
    member: interaction.member,
    send: (content) => interaction.editReply(content),
  };

  try {
    await handleCommand(commandName, args, ctx);
  } catch (err) {
    console.error('Slash command error:', err);
    interaction.editReply('❌ Something went wrong running that command.');
  }
});

// finally login at the very end
client.login(DISCORD_TOKEN);
