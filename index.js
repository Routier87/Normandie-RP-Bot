require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

const Xp = require('./schemas/xpSchema');

client.once('ready', () => {
  console.log(`Normandie RP prêt — connecté en tant que ${client.user.tag}`);
});

// Interaction (slash commands)
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction, client);
  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Une erreur est survenue.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true });
    }
  }
});

// Système XP simple (messages)
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  // anti-spam basique: ne compter que messages >= 5 char
  if (message.content.length < 5) return;

  let data = await Xp.findOne({ userID: message.author.id, guildID: message.guild.id });
  if (!data) {
    data = new Xp({ userID: message.author.id, guildID: message.guild.id });
  }

  // Ajout XP aléatoire entre 5 et 15
  const gained = Math.floor(Math.random() * 11) + 5;
  data.xp += gained;

  const needed = data.level * 100;
  if (data.xp >= needed) {
    data.level += 1;
    data.xp = data.xp - needed;
    const canal = message.channel;
    canal.send(`🎉 **${message.author.username}** est monté au niveau **${data.level}** !`);
  }

  await data.save();
});

mongoose.connect(process.env.MONGO, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connecté.');
  client.login(process.env.TOKEN);
}).catch(err => {
  console.error('Erreur connexion MongoDB:', err);
});
