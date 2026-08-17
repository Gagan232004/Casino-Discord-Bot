// @ts-nocheck
import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { LobbyService } from '../services/lobby.service.js';
import { EconomyService } from '../services/economy.service.js';

import { CRICKETERS } from '../data/cricketers.js';

export class ImposterGame {
  static async startMatch(client: Client, channelId: string) {
    const lobby = LobbyService.getLobby(channelId);
    if (!lobby) return;

    const channel = await client.channels.fetch(channelId) as TextChannel;
    const guildId = channel.guildId;

    if (lobby.players.length < 4) {
      await channel.send('❌ You need at least 4 players to play Imposter!');
      LobbyService.clearLobby(channelId);
      return;
    }

    await channel.send(`🔪 **The Imposter Game is starting!** 🔪\nPlayers: ${lobby.players.map(p => `<@${p}>`).join(', ')}`);

    // Deduct bets
    for (const playerId of lobby.players) {
      try {
        await EconomyService.adjustBalance(guildId, playerId, -lobby.betAmount, 'Imposter', 'BET');
      } catch (e) {
        await channel.send(`❌ Failed to deduct bet from <@${playerId}>. Game cancelled.`);
        LobbyService.clearLobby(channelId);
        return;
      }
    }

    // Setup Roles
    const imposterIndex = Math.floor(Math.random() * lobby.players.length);
    const imposterId = lobby.players[imposterIndex];
    
    // Pick 2 random unique cricketers
    let shuffledList = [...CRICKETERS].sort(() => 0.5 - Math.random());
    const innoWord = shuffledList[0];
    const impWord = shuffledList[1];

    let alivePlayers = [...lobby.players];
    const initialInnocents = lobby.players.filter(p => p !== imposterId);

    // DM Players without revealing who is the imposter
    for (const playerId of lobby.players) {
      try {
        const user = await client.users.fetch(playerId);
        const secretName = (playerId === imposterId) ? impWord : innoWord;
        await user.send(`🕵️ **YOUR SECRET NAME IS:** \`${secretName}\` 🕵️\n*Find the imposter who has a different name than the rest of the group!*\nhttps://media.tenor.com/8Qj87u0G7hQAAAAC/mr-bean-suspicious.gif`);
      } catch (e) {
        await channel.send(`❌ Could not DM <@${playerId}>. Please make sure your DMs are open! Game cancelled.`);
        LobbyService.clearLobby(channelId);
        return;
      }
    }

    const startEmbed = new EmbedBuilder()
      .setColor('#000000')
      .setDescription('✅ Everyone has received their secret words in their DMs!\n\n**Let the games begin...**')
      .setImage('https://media.tenor.com/M6LqVvS4620AAAAC/among-us-shh.gif');
      
    await channel.send({ embeds: [startEmbed] });

    // Game Loop (Clue Rounds Only)
    for (let round = 1; round <= lobby.rounds; round++) {
      const roundEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle(`🔪 ROUND ${round} OF ${lobby.rounds} 🔪`)
        .setDescription(`Everyone must give exactly ONE clue about their secret word without saying it directly!`);
      
      await channel.send({ embeds: [roundEmbed] });

      // CLUE PHASE
      const diff = lobby.settings?.difficulty || 'easy';
      let maxTime = 25;
      if (diff === 'medium') maxTime = 15;
      if (diff === 'hard') maxTime = 8;
      
      // Randomize the order of players each round!
      let roundOrder = [...alivePlayers].sort(() => 0.5 - Math.random());

      for (const playerId of roundOrder) {
        const promptMsg = await channel.send(`🗣️ <@${playerId}>, it is your turn! You have **${maxTime} seconds** to type a clue.`);
        
        const filter = (m: any) => m.author.id === playerId;
        
        let timeLeft = maxTime;
        const interval = setInterval(() => {
          timeLeft -= 4;
          if (timeLeft > 0) {
            promptMsg.edit(`🗣️ <@${playerId}>, it is your turn! You have **${timeLeft} seconds** to type a clue.`).catch(() => {});
          }
        }, 4000);
        
        try {
          const collected = await channel.awaitMessages({ filter, max: 1, time: maxTime * 1000, errors: ['time'] });
          clearInterval(interval);
          const clue = collected.first()?.content;
          await promptMsg.edit(`✅ <@${playerId}> gave a clue: **"${clue}"**`).catch(() => {});
        } catch (e) {
          clearInterval(interval);
          await promptMsg.edit(`⏳ <@${playerId}> ran out of time! They stayed silent.`).catch(() => {});
        }
      }

      await channel.send('💬 All clues for this round have been given!');
    }

    // VOTING PHASE (Occurs once after all rounds are complete)
    const emergencyEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setImage('https://media.tenor.com/D4s3vR6hR-sAAAAC/among-us-emergency-meeting.gif');
    await channel.send({ embeds: [emergencyEmbed] });
    const voteMsg = await this.runVoting(client, channel, alivePlayers, `🕵️ **FINAL EMERGENCY MEETING**\nAll rounds are complete! Select who you think the Imposter is! You have 30 seconds.`);
    
    let trialId = voteMsg.highestVoted;

    if (!trialId) {
      await channel.send('⚖️ The votes were tied or no one voted! The Imposter slipped away...');
    } else {
      await channel.send(`🚨 **<@${trialId}> HAS THE MOST VOTES!** 🚨\nThey are now on trial.`);

      // DEFENSE PHASE
      const defMsg = await channel.send(`⚖️ <@${trialId}>, you have **30 seconds** to defend yourself! Type your defense now.`);
      let timeLeftDef = 30;
      const defInterval = setInterval(() => {
        timeLeftDef -= 5;
        if (timeLeftDef > 0) defMsg.edit(`⚖️ <@${trialId}>, you have **${timeLeftDef} seconds** to defend yourself!`).catch(() => {});
      }, 5000);

      try {
        const filter = (m: any) => m.author.id === trialId;
        const collected = await channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
        clearInterval(defInterval);
        await channel.send(`🗣️ **Defense from <@${trialId}>:** "${collected.first()?.content}"`);
      } catch (e) {
        clearInterval(defInterval);
        await channel.send(`⏳ <@${trialId}> remained silent in their defense.`);
      }

      // FINAL VOTING PHASE
      const finalVoteMsg = await this.runVoting(client, channel, alivePlayers, `💀 **FINAL VERDICT**\nDo we eliminate <@${trialId}> or someone else? Select a name to eliminate them. You have 30 seconds.`);

      trialId = finalVoteMsg.highestVoted;
    }

    if (!trialId) {
      // Imposter wins because nobody was eliminated
      const winEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔪 THE IMPOSTER WINS! 🔪')
        .setDescription(`🚨 The Innocents failed to eliminate anyone! <@${imposterId}> survived! They were the **IMPOSTER**!\nThe Imposter's name was: **${impWord}**\nThe Innocents' name was: **${innoWord}**`)
        .setImage('https://media.tenor.com/zW-z_xU0iYAAAAAC/among-us-imposter.gif');
      
      await channel.send({ embeds: [winEmbed] });
      const totalPot = lobby.betAmount * lobby.players.length;
      await EconomyService.adjustBalance(guildId, imposterId, totalPot, 'Imposter', 'WIN').catch(console.error);
      await channel.send(`💰 The Imposter stole the entire pot of **${totalPot} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**!`);
      LobbyService.clearLobby(channelId);
      return;
    }

    const eliminatedId = trialId;

    // CHECK WIN CONDITIONS
    if (eliminatedId === imposterId) {
      const winEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 THE INNOCENTS WIN! 🎉')
        .setDescription(`🚨 <@${imposterId}> was ejected. They were the **IMPOSTER**!\nThe Imposter's name was: **${impWord}**\nThe Innocents' name was: **${innoWord}**`)
        .setImage('https://media.tenor.com/zW-z_xU0iYAAAAAC/among-us-imposter.gif');
      
      await channel.send({ embeds: [winEmbed] });

      // Calculate payout
      const potToShare = lobby.betAmount * lobby.players.length;
      const payout = Math.floor(potToShare / initialInnocents.length);

      for (const inno of initialInnocents) {
        await EconomyService.adjustBalance(guildId, inno, payout, 'Imposter', 'WIN').catch(console.error);
      }
      await channel.send(`💰 The Innocents successfully split the pot! Each innocent receives **${payout} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**!`);
      LobbyService.clearLobby(channelId);
      return;
    } else {
      const ejectEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setDescription(`💀 <@${eliminatedId}> was ejected. They were **INNOCENT**.`)
        .setImage('https://media.tenor.com/2cR3B8m7S4AAAAAC/among-us-ejected.gif');
        
      await channel.send({ embeds: [ejectEmbed] });
      
      const winEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔪 THE IMPOSTER WINS! 🔪')
        .setDescription(`🚨 The wrong person was ejected! <@${imposterId}> survived! They were the **IMPOSTER**!\nThe Imposter's name was: **${impWord}**\nThe Innocents' name was: **${innoWord}**`)
        .setImage('https://media.tenor.com/zW-z_xU0iYAAAAAC/among-us-imposter.gif');
      
      await channel.send({ embeds: [winEmbed] });

      // Calculate payout
      const totalPot = lobby.betAmount * lobby.players.length;
      await EconomyService.adjustBalance(guildId, imposterId, totalPot, 'Imposter', 'WIN').catch(console.error);
      await channel.send(`💰 The Imposter stole the entire pot of **${totalPot} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**!`);
      LobbyService.clearLobby(channelId);
      return;
    }
  }

  static async runVoting(client: Client, channel: TextChannel, alivePlayers: string[], promptText: string) {
    const options = await Promise.all(alivePlayers.map(async p => {
      let name = 'Unknown';
      try {
        const user = await client.users.fetch(p);
        name = user.username.substring(0, 25); // Discord select menu labels must be <= 100 chars
      } catch (e) {}
      return {
        label: name,
        description: `Vote for ${name}`,
        value: p
      };
    }));

    // Hack because discord requires labels to be strings, but we only have IDs, we will mention them in chat, 
    // but in select menu we must use fetched members if possible, or just ID.
    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('imposter_vote')
          .setPlaceholder('Select a player to vote for...')
          .addOptions(options.map((opt) => ({ label: opt.label, value: opt.value, description: `ID: ${opt.value}` })))
      );

    const voteEmbed = new EmbedBuilder()
      .setColor('#FFFF00')
      .setDescription(promptText + '\n\n**Players:**\n' + alivePlayers.map((p, i) => `${i + 1}. <@${p}>`).join('\n'));

    const voteMsg = await channel.send({ embeds: [voteEmbed], components: [row] });
    
    const votes = new Map<string, string>(); // voterId -> votedForId
    const collector = voteMsg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 30000 });

    collector.on('collect', async (interaction) => {
      if (!alivePlayers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You are dead or not in the game!', ephemeral: true });
        return;
      }
      votes.set(interaction.user.id, interaction.values[0]);
      await interaction.reply({ content: `You voted for Player ID ${interaction.values[0]}!`, ephemeral: true });
    });

    await new Promise(resolve => collector.on('end', resolve));
    
    // Tally
    const tallies: Record<string, number> = {};
    for (const votedId of votes.values()) {
      tallies[votedId] = (tallies[votedId] || 0) + 1;
    }

    await voteMsg.edit({ components: [] }).catch(() => {});

    let highestVoted = null;
    let maxVotes = 0;
    let tie = false;

    for (const [pId, count] of Object.entries(tallies)) {
      if (count > maxVotes) {
        maxVotes = count;
        highestVoted = pId;
        tie = false;
      } else if (count === maxVotes) {
        tie = true;
      }
    }

    return { highestVoted: tie ? null : highestVoted, votes };
  }
}
