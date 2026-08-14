// @ts-nocheck
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { EconomyService } from './services/economy.service.js';
import { LobbyService } from './services/lobby.service.js';
import { NumberBattleGame } from './games/number_battle.game.js';
import { ClosestGame } from './games/closest.game.js';
import { CrashGame } from './games/crash.game.js';
import { RouletteGame } from './games/roulette.game.js';
import { ImposterGame } from './games/imposter.game.js';
import { MafiaGame } from './games/mafia.game.js';
import { CoinFlipGame } from './games/coinflip.game.js';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Ensure the token exists
const rawToken = process.env.DISCORD_TOKEN || '';
const token = rawToken.replace(/['"]/g, '').trim();

if (!token) {
  console.error("CRITICAL ERROR: Please add your DISCORD_TOKEN to the environment variables!");
  process.exit(1);
} else {
  console.log(`[DEBUG] Token Loaded! Length: ${token.length} chars. Starts with: ${token.substring(0, 5)}`);
}

// Initialize the Discord Client with the necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages, // Needed for Custom Game 2 (DM numbers)
  ],
  partials: [Partials.Channel, Partials.Message], // Needed to receive DMs
});

import { REST, Routes, SlashCommandBuilder } from 'discord.js';

client.once('ready', async () => {
  console.log(`🎰 Casino Bot is ONLINE and logged in as ${client.user?.tag}`);
  
  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
    new SlashCommandBuilder().setName('debut').setDescription('Register your VIP casino account'),
    new SlashCommandBuilder().setName('balance').setDescription('Check your wallet balance'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim your daily free coins'),
    new SlashCommandBuilder().setName('guide').setDescription('Show the Casino guide')
      .addStringOption(option => option.setName('game').setDescription('Specific game guide').addChoices(
        { name: 'Closest to Bot', value: 'hc' },
        { name: 'High/Low Battle', value: 'hb' },
        { name: 'Crash', value: 'hcr' },
        { name: 'Roulette', value: 'roulette' },
        { name: 'Imposter', value: 'hi' },
        { name: 'Mafia', value: 'mafia' }
      )),
    new SlashCommandBuilder().setName('roulette').setDescription('Open a public Roulette table'),
    new SlashCommandBuilder().setName('join').setDescription('Join the active lobby'),
    new SlashCommandBuilder().setName('leave').setDescription('Leave the active lobby'),
    new SlashCommandBuilder().setName('start').setDescription('Start the active lobby (Host only)'),
    new SlashCommandBuilder().setName('host_closest').setDescription('Host a Closest to Bot match'),
    new SlashCommandBuilder().setName('host_crash').setDescription('Host a Crash match'),
    new SlashCommandBuilder().setName('host_imposter').setDescription('Host an Imposter match'),
    new SlashCommandBuilder().setName('host_battle').setDescription('Host a High/Low Battle match'),
    new SlashCommandBuilder().setName('host_mafia').setDescription('Host a Mafia match'),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) return;

  const command = interaction.commandName;
  let args: string[] = [];
  if (command === 'guide') {
    const game = interaction.options.getString('game');
    if (game) args = [game];
  }

  const mockMessage = {
    author: interaction.user,
    guild: interaction.guild,
    guildId: interaction.guildId,
    channel: interaction.channel,
    reply: async (c: any) => {
      if (interaction.replied || interaction.deferred) return await interaction.followUp(c);
      return await interaction.reply({ ...(typeof c === 'string' ? {content: c} : c), fetchReply: true });
    }
  };

  await processCommand(command, args, mockMessage as any);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = '+';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;
  await processCommand(command, args, message);
});

async function processCommand(command: string, args: string[], message: any) {
  // 1. Unlocked Commands (Anyone can use)
  if (command === 'debut') {
    try {
      const exists = await EconomyService.checkWalletExists(message.guildId!, message.author.id);
      if (exists) {
        return (await message.reply('❌ You have already debuted! Use `+balance` to check your current funds.'));
      }

      const animMsg = await message.reply('🔓 *Connecting to the Casino Adda Vault...*');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      await animMsg.edit('🪪 *Registering new VIP Player...*').catch(() => {});
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      await animMsg.edit('💸 *Transferring 1000 starting coins...*').catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 1500));
      const { wallet } = await EconomyService.getWallet(message.guildId!, message.author.id, message.author.username);
      
      const welcomeEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎉 WELCOME TO CASINO ADDA! 🎉')
        .setDescription(`Your VIP account is successfully registered, <@${message.author.id}>!\n\nWe have credited your vault with **1000 <:Gemini_Generated_Image_nele8wnel:1536424832177143898>** to get you started.\n\n*Type \`+guide\` to learn how to play!*`)
        .setImage('https://media.giphy.com/media/xTiTnqUxyWbsAXq7Ju/giphy.gif');
        
      await animMsg.edit({ content: ' ', embeds: [welcomeEmbed] }).catch(() => {});
    } catch (err: any) {
      console.error('Debut Error:', err);
      await message.reply('❌ Database Error: ' + err.message);
    }
    return;
  }

  if (command === 'guide') {
    const sub = args[0]?.toLowerCase();
    
    if (sub === 'hc') {
      const hcEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🤖 Guide: Closest to Bot (+hc)')
        .setDescription(`
**Objective:** Guess the bot's secret number (0-100) closer than anyone else!

**How to Play:**
1. The host types \`+hc\` and sets the number of rounds and the bet amount.
2. Players type \`+j\` to join the lobby.
3. The host types \`+s\` to start the game.
4. **The DMs:** For each round, the bot will send a Direct Message to every player. You have **15 seconds** to reply to the bot's DM with a number between 0 and 100.
5. **The Reveal:** After 15 seconds, the bot announces the secret number in the server. The player with the smallest difference wins the round!
6. The player with the most round wins takes the entire pot! (Ties result in a 20% house fee, and 80% is refunded to players).

*(Note: Make sure your Discord Privacy Settings allow Direct Messages from server members!)*`);
      return await message.reply({ embeds: [hcEmbed] });
    } else if (sub === 'hb') {
      const hbEmbed = new EmbedBuilder()
        .setColor('#FF00FF')
        .setTitle('⚔️ Guide: High/Low Number Battle (+hb)')
        .setDescription(`
**Objective:** Roll the highest (or lowest) number to win the round!

**How to Play:**
1. The host types \`+hb\` and sets the rounds, bet amount, and mode (\`high\` or \`low\`).
2. Players type \`+j\` to join the lobby.
3. The host types \`+s\` to start the game.
4. When it is your turn, you have **15 seconds** to type \`+r\` in the channel to roll a random number (0-100).
5. The highest (or lowest, depending on the mode) roll wins the round!
6. The player with the most round wins takes the entire pot!`);
      return await message.reply({ embeds: [hbEmbed] });
    } else if (sub === 'hcr') {
      const hcrEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🚀 Guide: Crash (+hcr)')
        .setDescription(`
**Objective:** Secure your multiplier before the rocket crashes!

**How to Play:**
1. The host types \`+hcr\` and sets the buy-in bet.
2. Players type \`+j\` to join the lobby.
3. The host types \`+s\` to launch the rocket!
4. The multiplier will start increasing (1.00x, 1.20x, 1.50x...). Click the green **💰 Cash Out** button at any time to instantly secure your winnings!
5. If the graph flashes **💥 CRASHED!** before you cash out, you lose your bet!`);
      return await message.reply({ embeds: [hcrEmbed] });
    } else if (sub === 'roulette') {
      const rouletteEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎡 Guide: Roulette (+roulette)')
        .setDescription(`
**Objective:** Bet on the color or number where the ball will land!

**How to Play:**
1. Any player can type \`+roulette\` to open the table in the current channel.
2. The table is open for **30 seconds**. Anyone can place as many bets as they want!
3. To place a bet, type \`+bet <amount> <choice>\` (Example: \`+bet 100 red\`).
4. **Valid Choices:** \`red\`, \`black\`, \`green\`, \`odd\`, \`even\`, or any exact number \`0-36\`.
5. When the 30 seconds are up, the wheel spins and payouts are automatically distributed to the winners!`);
      return await message.reply({ embeds: [rouletteEmbed] });
    } else if (sub === 'hi') {
      const hiEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('🔪 Guide: Imposter (+hi)')
        .setDescription(`
**Objective:** Find the Imposter who doesn't know the secret word! (Min 4, Max 8 players).

**How to Play:**
1. The host types \`+hi\` to create the lobby.
2. The bot will ask the host to set the **Buy-in Bet**, **Number of Rounds**, and **Category** (Cricketer/Footballer/Celebrity).
3. Players type \`+j\` to join.
4. The host types \`+s\` to start.
5. The bot DMs everyone a secret word. The Imposter gets a related but different word!
6. **The Rounds:** Players take turns typing a subtle clue about their word (You get 20s).
7. **The Vote:** After each round, an Emergency Meeting is called! Use the dropdown menu to vote for the Imposter.
8. **The Defense:** The highest voted player gets 30 seconds to defend themselves before the final elimination vote!
9. If the Imposter is eliminated, the Innocents split their bet! If the Imposter survives, they take ALL the money!`);
      return await message.reply({ embeds: [hiEmbed] });
    } else if (sub === 'mafia') {
        const mafiaEmbed = new EmbedBuilder()
          .setColor('#2C3E50')
          .setTitle('🎙️ Guide: Voice Mafia (+mafia)')
          .setDescription(`
**Objective:** Survive the night and execute your enemies! (Min 5, Max 15 players).

**How to Play:**
1. The host must be in a Voice Channel. They type \`+mafia\` to create the lobby.
2. The bot asks for the Buy-in Bet and if you want to include the **Guardian** or **Jester**.
3. Players type \`+j\` to join. Host types \`+s\` to start.
4. **The Bot joins the VC and takes over!** It auto-mutes everyone when Night falls.
5. **Night Phase:** The Imposter gets a DM to kill someone. The Guardian gets a DM to save someone.
6. **Day Phase:** The bot unmutes everyone. You have 45s to argue, then 20s to vote in the chat.
7. If the Jester is voted out, they win instantly! Otherwise, find the Imposter to win!`);
        return await message.reply({ embeds: [mafiaEmbed] });
      }

    const guideEmbed = new EmbedBuilder()
      .setColor('#FF00FF')
      .setTitle('🎰 Casino Adda - Command Guide')
      .setDescription(`
**User Commands:**
\`+debut\` - Register your account and get 1000 starting <:Gemini_Generated_Image_nele8wnel:1536424832177143898>!
\`+welcome\` - Claim your one-time 5000 coins bonus!
\`+balance\` - Check your wallet balance.
\`+daily\` - Claim your daily free <:Gemini_Generated_Image_nele8wnel:1536424832177143898>.
\`+give @user <amount>\` - Give coins to another player.

**Single Player Games:**
\`+cf <amount> <heads/tails>\` - Bet on a coin flip (2x payout).

**Multiplayer Games:**
*(Type \`+guide <command>\` for detailed rules, e.g. \`+guide hc\`)*
\`+hb\` - Host a High/Low Number Battle.
\`+hc\` - Host a "Closest to Bot" match.
\`+hcr\` - Host a "Crash" match.
\`+hi\` - Host an "Imposter" match.
\`+mafia\` - Host a Voice Channel Mafia game!
\`+roulette\` - Open a public Roulette table.
\`+j\` - Join the active lobby in this channel.
\`+l\` - Leave the lobby.
\`+lobby\` - View the players currently inside the lobby.
\`+end\` - Cancel the lobby (Host only).
\`+s\` - Start the game (Host only).
      `);
    return await message.reply({ embeds: [guideEmbed] });
  }

  // 2. Locked Commands (Require Debut)
  const hasDebuted = await EconomyService.checkWalletExists(message.guild.id, message.author.id);
  if (!hasDebuted) {
    return await message.reply('🛑 **Stop!** You must register first. Please type \`+debut\` to unlock the casino and get your starting <:Gemini_Generated_Image_nele8wnel:1536424832177143898>!');
  }

  // 3. Channel Locks for Multiplayer Games (STRICT TWO-WAY)
  const lobbyCommands = ['hc', 'host_closest', 'hcr', 'host_crash', 'hi', 'host_imposter', 'hb', 'host_battle', 'mafia'];
  
  // If trying to start a lobby, check if Roulette is active
  if (lobbyCommands.includes(command)) {
    if (RouletteGame.activeTables.has(message.channel.id)) {
      return await message.reply('❌ **There is already an active Roulette table in this channel!** Please wait for it to finish, or use a different channel.');
    }
  }

  // If trying to start Roulette, check if a Lobby or another Roulette is active
  if (command === 'roulette') {
    if (LobbyService.activeLobbies.has(message.channel.id)) {
      return await message.reply('❌ **There is already an active multiplayer lobby in this channel!** Please wait for it to finish, or use a different channel.');
    }
    if (RouletteGame.activeTables.has(message.channel.id)) {
      return await message.reply('❌ **There is already an active Roulette table in this channel!** Please wait for it to finish, or use a different channel.');
    }
  }

  // Handle other commands
  if (command === 'hc' || command === 'host_closest') {
    try {
      const lobby = LobbyService.createLobby(message.channel.id, message.author.id, 'CLOSEST');
      
      const setupEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🤖 Setting up "Closest to Bot"')
        .setDescription('**How many rounds?**\nPlease type `3`, `5`, `7`, or `9`.');
      
      await message.reply({ embeds: [setupEmbed] });
      const filter = (m: any) => m.author.id === message.author.id;
      
      // Await Rounds
      const roundsCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!roundsCol) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Setup timed out.')); }
      const rounds = parseInt(roundsCol.first()?.content || '0');
      if (![3, 5, 7, 9].includes(rounds)) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Invalid rounds.')); }
      lobby.rounds = rounds;

      // Await Bet
      setupEmbed.setDescription('**What is the Buy-in Bet amount per player?**\nType a number (e.g. `100`).');
      await message.channel.send({ embeds: [setupEmbed] });
      const betCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!betCol) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Setup timed out.')); }
      const bet = parseInt(betCol.first()?.content || '0');
      if (isNaN(bet) || bet <= 0) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Invalid bet.')); }
      lobby.betAmount = bet;

      // Setup Complete!
      lobby.state = 'WAITING';
      const openEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🤖 "Closest to Bot" Lobby OPEN!')
        .setDescription(`**Host:** <@${lobby.hostId}>\n**Rounds:** ${lobby.rounds}\n**Buy-in:** ${lobby.betAmount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>\n\nType \`+j\` to enter! (1/8 Players)`);
      
      await message.channel.send({ embeds: [openEmbed] });

    } catch (err: any) {
      await message.reply(err.message);
    }
  } else if (command === 'hcr' || command === 'host_crash') {
    try {
      const lobby = LobbyService.createLobby(message.channel.id, message.author.id, 'CRASH');
      lobby.rounds = 1; // Crash is just a single round where it flies up

      const setupEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🚀 Setting up "Crash"')
        .setDescription('**What is the Buy-in Bet amount per player?**\nType a number (e.g. `100`).');
      
      await message.reply({ embeds: [setupEmbed] });
      const filter = (m: any) => m.author.id === message.author.id;

      // Await Bet
      const betCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!betCol) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Setup timed out.')); }
      const bet = parseInt(betCol.first()?.content || '0');
      if (isNaN(bet) || bet <= 0) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Invalid bet.')); }
      lobby.betAmount = bet;

      // Setup Complete!
      lobby.state = 'WAITING';
      const openEmbed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle('🚀 "CRASH" Lobby OPEN!')
        .setDescription(`**Host:** <@${lobby.hostId}>\n**Buy-in:** ${lobby.betAmount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>\n\nType \`+j\` to enter! (1/8 Players)`);
      
      await message.channel.send({ embeds: [openEmbed] });

    } catch (err: any) {
      await message.reply(err.message);
    }
  } else if (command === 'hi' || command === 'host_imposter') {
    try {
      const lobby = LobbyService.createLobby(message.channel.id, message.author.id, 'IMPOSTER');
      
      const setupEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🕵️ Setting up "Imposter"')
        .setDescription('**What is the Buy-in Bet amount per player?**\nType a number (e.g. `100`).');
      
      await message.reply({ embeds: [setupEmbed] });
      const filter = (m: any) => m.author.id === message.author.id;

      // Await Bet
      const betCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!betCol) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Setup timed out.')); }
      const bet = parseInt(betCol.first()?.content || '0');
      if (isNaN(bet) || bet <= 0) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Invalid bet.')); }
      lobby.betAmount = bet;

      // Await Rounds
      setupEmbed.setDescription('**How many rounds?**\nType `3`, `5`, `7`, or `9`.');
      await message.channel.send({ embeds: [setupEmbed] });
      const roundsCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!roundsCol) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Setup timed out.')); }
      const rounds = parseInt(roundsCol.first()?.content || '0');
      if (![3, 5, 7, 9].includes(rounds)) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Invalid rounds.')); }
      lobby.rounds = rounds;

      // Await Topic
      setupEmbed.setDescription('**Select a Topic Category:**\nType `1` for Cricketer\nType `2` for Footballer\nType `3` for Celebrity');
      await message.channel.send({ embeds: [setupEmbed] });
      const topicCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!topicCol) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Setup timed out.')); }
      const topic = topicCol.first()?.content.trim() || '1';
      if (!['1', '2', '3'].includes(topic)) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Invalid topic.')); }
      
      lobby.mode = topic as any;

      // Setup Complete!
      lobby.state = 'WAITING';
      const openEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('🔪 "Imposter" Lobby OPEN!')
        .setDescription(`**Host:** <@${lobby.hostId}>\n**Buy-in:** ${lobby.betAmount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>\n**Rounds:** ${lobby.rounds}\n\nType \`+j\` to enter! (1/8 Players, Min 4)`);
      
      await message.channel.send({ embeds: [openEmbed] });
    } catch (err: any) {
      await message.reply(err.message);
    }
  } else if (command === 'hb' || command === 'host_battle') {
    try {
      const lobby = LobbyService.createLobby(message.channel.id, message.author.id, 'BATTLE');
      
      const setupEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('⚔️ Setting up High/Low Battle')
        .setDescription('**How many rounds?**\nPlease type `3`, `5`, `7`, or `9`.');
      
      await message.reply({ embeds: [setupEmbed] });

      const filter = (m: any) => m.author.id === message.author.id;
      
      // Await Rounds
      const roundsCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!roundsCol) {
        LobbyService.clearLobby(message.channel.id);
        return (await message.channel.send('Setup timed out. Lobby cancelled.'));
      }
      const rounds = parseInt(roundsCol.first()?.content || '0');
      if (![3, 5, 7, 9].includes(rounds)) {
        LobbyService.clearLobby(message.channel.id);
        return (await message.channel.send('Invalid rounds. Lobby cancelled.'));
      }
      lobby.rounds = rounds;

      // Await Bet
      setupEmbed.setDescription('**What is the Buy-in Bet amount per player?**\nType a number (e.g. `100`).');
      await message.channel.send({ embeds: [setupEmbed] });
      const betCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!betCol) {
        LobbyService.clearLobby(message.channel.id);
        return (await message.channel.send('Setup timed out. Lobby cancelled.'));
      }
      const bet = parseInt(betCol.first()?.content || '0');
      if (isNaN(bet) || bet <= 0) {
        LobbyService.clearLobby(message.channel.id);
        return (await message.channel.send('Invalid bet amount. Lobby cancelled.'));
      }
      lobby.betAmount = bet;

      // Await Mode
      setupEmbed.setDescription('**Which mode?**\nType `high` (Highest wins) or `low` (Lowest wins).');
      await message.channel.send({ embeds: [setupEmbed] });
      const modeCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!modeCol) {
        LobbyService.clearLobby(message.channel.id);
        return (await message.channel.send('Setup timed out. Lobby cancelled.'));
      }
      const modeText = modeCol.first()?.content.toLowerCase();
      if (modeText !== 'high' && modeText !== 'low') {
        LobbyService.clearLobby(message.channel.id);
        return (await message.channel.send('Invalid mode. Lobby cancelled.'));
      }
      lobby.mode = modeText === 'high' ? 'HIGH' : 'LOW';

      // Setup Complete!
      lobby.state = 'WAITING';
      const openEmbed = new EmbedBuilder()
        .setColor('#FF00FF')
        .setTitle('⚔️ High/Low Battle Lobby OPEN!')
        .setDescription(`**Host:** <@${lobby.hostId}>\n**Rounds:** ${lobby.rounds}\n**Buy-in:** ${lobby.betAmount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>\n**Mode:** ${lobby.mode === 'HIGH' ? 'Highest Wins' : 'Lowest Wins'}\n\nType \`+j\` to enter! (1/8 Players)`);
      
      await message.channel.send({ embeds: [openEmbed] });

    } catch (err: any) {
      await message.reply(err.message);
    }
  } else if (command === 'mafia') {
    try {
      const lobby = LobbyService.createLobby(message.channel.id, message.author.id, 'MAFIA');
      
      const setupEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('🎙️ Setting up Voice Mafia')
        .setDescription('**What is the Buy-in Bet amount per player?**\nType a number (e.g. `100`).');
      
      await message.reply({ embeds: [setupEmbed] });
      const filter = (m: any) => m.author.id === message.author.id;
      
      const betCol = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      if (!betCol) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Setup timed out. Lobby cancelled.')); }
      const bet = parseInt(betCol.first()?.content || '0');
      if (isNaN(bet) || bet <= 0) { LobbyService.clearLobby(message.channel.id); return (await message.channel.send('Invalid bet amount. Lobby cancelled.')); }
      lobby.betAmount = bet;

      const configEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('🎙️ Mafia Game Configuration')
        .setDescription(`**Bet Amount:** ${lobby.betAmount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>\n\nUse the menus below to configure the game settings. When you are ready, click **Open Lobby**!`);

      lobby.settings = { hasGuardian: false, hasJester: false, discussTime: 60, voteTime: 30 };

      const rowRoles = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('mafia_roles')
          .setPlaceholder('Select Optional Roles...')
          .setMinValues(0)
          .setMaxValues(2)
          .addOptions(
            { label: 'Guardian (Protects at night)', value: 'guardian', emoji: '🛡️' },
            { label: 'Jester (Wants to be executed)', value: 'jester', emoji: '🤡' }
          )
      );

      const rowDiscuss = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('mafia_discuss')
          .setPlaceholder('Discussion Time (Default: 60s)')
          .addOptions(
            { label: '30 Seconds', value: '30' },
            { label: '45 Seconds', value: '45' },
            { label: '60 Seconds (1 Min)', value: '60' },
            { label: '90 Seconds (1.5 Min)', value: '90' },
            { label: '120 Seconds (2 Min)', value: '120' }
          )
      );

      const rowVote = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('mafia_vote')
          .setPlaceholder('Voting Time (Default: 30s)')
          .addOptions(
            { label: '15 Seconds', value: '15' },
            { label: '20 Seconds', value: '20' },
            { label: '30 Seconds', value: '30' },
            { label: '45 Seconds', value: '45' },
            { label: '60 Seconds', value: '60' }
          )
      );

      const rowConfirm = new ActionRowBuilder<any>().addComponents(
        { type: ComponentType.Button, customId: 'mafia_confirm', label: '✅ Open Lobby', style: 3 }
      );

      const configMsg = await message.channel.send({ embeds: [configEmbed], components: [rowRoles, rowDiscuss, rowVote, rowConfirm] });

      const collector = configMsg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });

      collector.on('collect', async (i) => {
        if (i.customId === 'mafia_roles') {
          lobby.settings.hasGuardian = i.values.includes('guardian');
          lobby.settings.hasJester = i.values.includes('jester');
          await i.reply({ content: 'Roles updated!', ephemeral: true });
        } else if (i.customId === 'mafia_discuss') {
          lobby.settings.discussTime = parseInt(i.values[0]);
          await i.reply({ content: `Discussion time set to ${i.values[0]}s!`, ephemeral: true });
        } else if (i.customId === 'mafia_vote') {
          lobby.settings.voteTime = parseInt(i.values[0]);
          await i.reply({ content: `Voting time set to ${i.values[0]}s!`, ephemeral: true });
        } else if (i.customId === 'mafia_confirm') {
          collector.stop('confirmed');
          await i.deferUpdate().catch(() => {});
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason !== 'confirmed') {
          LobbyService.clearLobby(message.channel.id);
          await configMsg.edit({ content: '❌ Setup timed out. Lobby cancelled.', embeds: [], components: [] });
          return;
        }

        lobby.state = 'WAITING';
        const openEmbed = new EmbedBuilder()
          .setColor('#8B0000')
          .setTitle('🎙️ Voice Mafia Lobby OPEN!')
          .setDescription(`**Host:** <@${lobby.hostId}>\n**Buy-in:** ${lobby.betAmount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>\n\n**Settings:**\n🛡️ Guardian: ${lobby.settings.hasGuardian ? '✅' : '❌'}\n🤡 Jester: ${lobby.settings.hasJester ? '✅' : '❌'}\n🗣️ Discuss: ${lobby.settings.discussTime}s\n🗳️ Vote: ${lobby.settings.voteTime}s\n\nType \`+j\` to enter! (1/15 Players) (Min: 5)`);
        
        await configMsg.edit({ embeds: [openEmbed], components: [] });
      });
    } catch (err: any) {
      await message.reply(err.message);
    }
  } else if (command === 'j' || command === 'join') {
    try {
      const lobbyTemp = LobbyService.getLobby(message.channel.id);
      if (lobbyTemp) {
        const balance = await EconomyService.getBalance(message.guild.id, message.author.id);
        if (balance < lobbyTemp.betAmount) {
          return await message.reply(`❌ You have insufficient balance to join! It requires **${lobbyTemp.betAmount}**, but you only have **${balance}**.`);
        }
      }

      const lobby = LobbyService.joinLobby(message.channel.id, message.author.id);
      
      await message.reply(`✅ <@${message.author.id}> joined the lobby! (${lobby.players.length}/8 Players)`);
    } catch (err: any) {
      await message.reply(`❌ ${err.message}`);
    }
  } else if (command === 'l') {
    try {
      const result = LobbyService.leaveLobby(message.channel.id, message.author.id);
      
      if (result.destroyed) {
        await message.reply(`🚪 <@${message.author.id}> left the lobby. Since they were the host (or the lobby is empty), the lobby has been **cancelled**.`);
      } else {
        const max = result.lobby.gameType === 'MAFIA' ? 15 : 8;
        await message.reply(`🚪 <@${message.author.id}> left the lobby. (${result.lobby.players.length}/${max} Players)`);
      }
    } catch (err: any) {
      await message.reply(`❌ ${err.message}`);
    }
  } else if (command === 'lobby') {
    const lobby = LobbyService.getLobby(message.channel.id);
    if (!lobby) return await message.reply('There is no active lobby in this channel.');
    
    const playerList = lobby.players.map(p => `<@${p}>`).join('\n');
    const max = lobby.gameType === 'MAFIA' ? 15 : 8;
    const lobbyEmbed = new EmbedBuilder()
      .setColor('#00FFFF')
      .setTitle('👥 Current Lobby')
      .setDescription(`**Host:** <@${lobby.hostId}>\n**Game:** ${lobby.gameType}\n**Buy-in:** ${lobby.betAmount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>\n\n**Players in Lobby (${lobby.players.length}/${max}):**\n${playerList}`);
      
    await message.reply({ embeds: [lobbyEmbed] });
  } else if (command === 'end') {
    const lobby = LobbyService.getLobby(message.channel.id);
    if (!lobby) return await message.reply('There is no active lobby to end!');
    if (lobby.hostId !== message.author.id) return await message.reply('Only the host can end the lobby!');
    
    LobbyService.clearLobby(message.channel.id);
    await message.reply('🛑 **The host has manually ended and cancelled the lobby!**');
  } else if (command === 's' || command === 'start') {
    const lobby = LobbyService.getLobby(message.channel.id);
    if (!lobby) return (await message.reply('There is no lobby to start!'));
    if (lobby.hostId !== message.author.id) return (await message.reply('Only the host can start the game!'));
    if (lobby.players.length < 2) return (await message.reply('You need at least 2 players to start!'));
    
    if (lobby.gameType === 'BATTLE') {
      lobby.state = 'IN_PROGRESS';
      await message.reply('🚀 **Starting the High/Low Battle!**');
      // Launch game engine in the background
      NumberBattleGame.startMatch(client, message.channel.id).catch(console.error);
    } else if (lobby.gameType === 'CLOSEST') {
      lobby.state = 'IN_PROGRESS';
      await message.reply('🚀 **Starting "Closest to Bot"! Check your DMs!**');
      ClosestGame.startMatch(client, message.channel.id).catch(console.error);
    } else if (lobby.gameType === 'CRASH') {
      lobby.state = 'IN_PROGRESS';
      await message.reply('🚀 **Starting CRASH! Get ready to Cash Out!**');
      CrashGame.startMatch(client, message.channel.id).catch(console.error);
    } else if (lobby.gameType === 'IMPOSTER') {
      lobby.state = 'IN_PROGRESS';
      await message.reply('🔪 **Starting Imposter! Check your DMs for your secret word!**');
      ImposterGame.startMatch(client, message.channel.id).catch(console.error);
    } else if (lobby.gameType === 'MAFIA') {
      lobby.state = 'IN_PROGRESS';
      // Bot joins VC and starts logic
      MafiaGame.startMatch(client, message.channel.id).catch(console.error);
    }
  } else if (command === 'ping') {
    await message.reply('Pong! 🏓 The Casino engine is running via Prefix Command!');
  } else if (command === 'balance') {
    const balance = await EconomyService.getBalance(message.guild.id, message.author.id);
    
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setDescription(`**Balance**\n${balance} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>`);
      
    await message.reply({ embeds: [embed] });
  } else if (command === 'daily') {
    try {
      const wallet = await EconomyService.claimDaily(message.guild.id, message.author.id);
      
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setDescription(`🎉 You claimed your daily reward of **500 <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**!\nYour new balance is **${wallet.balance}**.`);
        
      await message.reply({ embeds: [embed] });
    } catch (err: any) {
      await message.reply(`❌ ${err.message}`);
    }
  } else if (command === 'welcome') {
    try {
      const wallet = await EconomyService.claimWelcome(message.guild.id, message.author.id);
      
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 WELCOME TO CASINO ADDA! 🎉')
        .setDescription(`Congratulations <@${message.author.id}>!\nYou have successfully claimed your one-time welcome bonus of **5000 <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**!\nYour new balance is **${wallet.balance}**!`)
        .setImage('https://media.tenor.com/b_xZ2J969oYAAAAC/welcome-neon.gif');
        
      await message.reply({ embeds: [embed] });
    } catch (err: any) {
      await message.reply(`❌ ${err.message}`);
    }
  } else if (command === 'give' || command === 'pay') {
    if (args.length < 2) return await message.reply('❌ Usage: `+give @user <amount>`');
    
    const target = message.mentions.users.first();
    if (!target) return await message.reply('❌ You must explicitly mention a user to give coins to.');
    if (target.id === message.author.id) return await message.reply('❌ You cannot give coins to yourself.');
    if (target.bot) return await message.reply('❌ You cannot give coins to bots.');

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 10 || amount > 1000) {
      return await message.reply('❌ The amount must be a valid number between **10** and **1000**.');
    }

    const senderBalance = await EconomyService.getBalance(message.guild.id, message.author.id);
    if (senderBalance < amount) return await message.reply(`❌ You don't have enough balance! You need **${amount}**, but you only have **${senderBalance}**.`);

    const receiverExists = await EconomyService.checkWalletExists(message.guild.id, target.id);
    if (!receiverExists) return await message.reply('❌ That user has not registered yet. Tell them to type `+debut` first.');

    try {
      await EconomyService.adjustBalance(message.guild.id, message.author.id, -amount, 'Give', 'BET');
      const newWallet = await EconomyService.adjustBalance(message.guild.id, target.id, amount, 'Give', 'WIN');
      
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('💸 Coins Transferred!')
        .setDescription(`Successfully sent **${amount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>** to <@${target.id}>!`);
      await message.reply({ embeds: [embed] });
    } catch (e: any) {
      await message.reply(`❌ ${e.message}`);
    }
  } else if (command === 'roulette') {
    try {
      await message.reply('🎲 Setting up the Roulette Table...');
      RouletteGame.startTable(client, message.channel.id, message.guild.id).catch(console.error);
    } catch (err: any) {
      await message.reply(`❌ ${err.message}`);
    }
  } else if (command === 'cf') {
    if (args.length < 2) {
      return await message.reply('❌ Usage: `+cf <amount> <heads/tails>` (e.g. `+cf 100 heads`)');
    }
    const amount = parseInt(args[0]);
    const choice = args[1].toUpperCase();

    if (isNaN(amount) || amount <= 0) return await message.reply('❌ Invalid bet amount.');
    if (choice !== 'HEADS' && choice !== 'TAILS') return await message.reply('❌ You must pick HEADS or TAILS.');

    try {
      // 1. Send the spinning coin GIF immediately
      const spinEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🪙 Flipping the coin...')
        .setImage('https://media.tenor.com/264qJk02YF8AAAAC/coin-flip-flip.gif');
      const flipMessage = await message.reply({ embeds: [spinEmbed] });

      // 2. Play game (DB transaction)
      const result = await CoinFlipGame.play(message.guild.id, message.author.id, amount, choice as 'HEADS' | 'TAILS');
      
      // 3. Edit the message instantly with the final result
      const resultEmbed = new EmbedBuilder()
        .setColor(result.won ? '#00FF00' : '#FF0000')
        .setTitle(`🪙 Coin Flip: ${result.result}`)
        .setDescription(`You bet **${amount}** on **${choice}**.\n\n${result.won ? `🎉 **YOU WON!**` : `💥 **YOU LOST!**`}\n\nYour new balance is **${result.newBalance} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**`);
        
      await flipMessage.edit({ embeds: [resultEmbed] });
    } catch (err: any) {
      await message.reply(`❌ ${err.message}`);
    }
  }
}

client.login(token);
