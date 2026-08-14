// @ts-nocheck
import { Client, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { LobbyService } from '../services/lobby.service.js';
import { EconomyService } from '../services/economy.service.js';

export class ClosestGame {
  static async startMatch(client: Client, channelId: string) {
    const lobby = LobbyService.getLobby(channelId);
    if (!lobby) return;

    const channel = await client.channels.fetch(channelId) as TextChannel;
    
    await channel.send(`🤖 **The "Closest to Bot" Game has begun!** 🤖\nPlayers: ${lobby.players.map(p => `<@${p}>`).join(', ')}`);

    // Deduct bets
    const guildId = channel.guildId;
    for (const playerId of lobby.players) {
      try {
        await EconomyService.adjustBalance(guildId, playerId, -lobby.betAmount, 'ClosestToBot', 'BET');
      } catch (e) {
        await channel.send(`❌ Failed to deduct bet from <@${playerId}>. They might have insufficient funds. Game cancelled.`);
        LobbyService.clearLobby(channelId);
        return;
      }
    }

    const playerScores = new Map<string, number>();
    lobby.players.forEach(p => playerScores.set(p, 0));

    // Round Loop
    for (let round = 1; round <= lobby.rounds; round++) {
      const secretBotNumber = Math.floor(Math.random() * 101); // 0-100
      
      const roundEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setDescription(`🔔 **ROUND ${round} OF ${lobby.rounds}** 🔔\n\nI have picked a secret number between 0 and 100!\nYou all have **15 seconds** to DM me your guess (just send the number).`);
      
      await channel.send({ embeds: [roundEmbed] });

      const playerGuesses = new Map<string, number>();

      // Collect DMs concurrently for all players
      const dmPromises = lobby.players.map(async (playerId) => {
        let interval: any;
        try {
          const user = await client.users.fetch(playerId);
          const dmChannel = await user.createDM();
          
          const promptMsg = await dmChannel.send(`Round ${round} has started! Send me your guess (0-100) now! You have **15 seconds**.`);
          
          let timeLeft = 15;
          interval = setInterval(() => {
            timeLeft -= 3;
            if (timeLeft > 0) {
              promptMsg.edit(`Round ${round} has started! Send me your guess (0-100) now! You have **${timeLeft} seconds** left.`).catch(() => {});
            }
          }, 3000);
          
          const filter = (m: Message) => !m.author.bot && !isNaN(parseInt(m.content.trim()));
          const collected = await dmChannel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });
          clearInterval(interval);
          
          const guessStr = collected.first()?.content.trim() || '-1';
          const guess = parseInt(guessStr);
          
          if (guess >= 0 && guess <= 100) {
            playerGuesses.set(playerId, guess);
            await dmChannel.send(`Got it! Your guess is **${guess}**.`);
          } else {
            await dmChannel.send(`Invalid number (must be 0-100). You miss this round!`);
          }
        } catch (e) {
          if (interval) clearInterval(interval);
          // Time ran out or their DMs are closed
          try {
            const user = await client.users.fetch(playerId);
            const dmChannel = await user.createDM();
            await dmChannel.send(`⏳ Time's up! You are eliminated from this round.`);
          } catch(err) {}
        }
      });

      // Wait exactly 15 seconds for everyone to guess
      await Promise.all(dmPromises);

      // Determine the closest player
      let closestPlayers: string[] = [];
      let smallestDiff = 999;

      for (const [pId, guess] of playerGuesses.entries()) {
        const diff = Math.abs(secretBotNumber - guess);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestPlayers = [pId];
        } else if (diff === smallestDiff) {
          closestPlayers.push(pId); // Tie for closest
        }
      }

      const revealEmbed = new EmbedBuilder()
        .setColor('#00FFFF')
        .setTitle(`🤖 My secret number was: ${secretBotNumber}!`);

      let resultsText = '';
      for (const [pId, guess] of playerGuesses.entries()) {
        resultsText += `<@${pId}> guessed **${guess}** (Off by ${Math.abs(secretBotNumber - guess)})\n`;
      }
      if (resultsText === '') resultsText = 'No one sent a valid guess!';
      
      revealEmbed.setDescription(resultsText);
      await channel.send({ embeds: [revealEmbed] });

      if (closestPlayers.length === 1) {
        const winner = closestPlayers[0];
        playerScores.set(winner, (playerScores.get(winner) || 0) + 1);
        await channel.send(`🏆 <@${winner}> is the closest and wins Round ${round}!`);
      } else if (closestPlayers.length > 1) {
        await channel.send(`👔 **Round ${round} ended in a TIE between ${closestPlayers.map(p => `<@${p}>`).join(' and ')}!** No points awarded.`);
      } else {
        await channel.send(`👔 **No points awarded this round.**`);
      }
    }

    // Match Finished, determine overall winner
    let overallWinner = '';
    let maxWins = -1;
    let overallTie = false;

    for (const [pId, wins] of playerScores.entries()) {
      if (wins > maxWins) { maxWins = wins; overallWinner = pId; overallTie = false; }
      else if (wins === maxWins) { overallTie = true; }
    }

    const totalPot = lobby.betAmount * lobby.players.length;

    if (overallTie || maxWins === 0) {
      await channel.send(`👔 **The match ended in a TIE!** The House takes a 20% cut of the bets.`);
      const refundAmount = Math.floor(lobby.betAmount * 0.8);
      for (const playerId of lobby.players) {
        await EconomyService.adjustBalance(guildId, playerId, refundAmount, 'ClosestToBot', 'REFUND').catch(console.error);
      }
    } else {
      await channel.send(`🎉 **<@${overallWinner}> WINS THE MATCH WITH ${maxWins} ROUND WINS!** They take the pot of **${totalPot} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**!`);
      await EconomyService.adjustBalance(guildId, overallWinner, totalPot, 'ClosestToBot', 'WIN').catch(console.error);
    }

    LobbyService.clearLobby(channelId);
  }
}
