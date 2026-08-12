import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { LobbyService } from '../services/lobby.service.js';
import { EconomyService } from '../services/economy.service.js';

export class NumberBattleGame {
  static async startMatch(client: Client, channelId: string) {
    const lobby = LobbyService.getLobby(channelId);
    if (!lobby) return;

    const channel = await client.channels.fetch(channelId) as TextChannel;
    
    await channel.send(`⚔️ **The High/Low Number Battle has begun!** ⚔️\nPlayers: ${lobby.players.map(p => `<@${p}>`).join(', ')}`);

    // Deduct bets
    const guildId = channel.guildId;
    for (const playerId of lobby.players) {
      try {
        await EconomyService.adjustBalance(guildId, playerId, -lobby.betAmount, 'NumberBattle', 'BET');
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
      await channel.send(`\n🔔 **ROUND ${round} OF ${lobby.rounds}** 🔔`);
      
      const roundNumbers = new Map<string, number>();

      // Player Turn Loop
      for (const playerId of lobby.players) {
        const promptMsg = await channel.send(`👉 <@${playerId}>, it is your turn! You have **15 seconds** to type \`+r\`.`);

        const filter = (m: any) => m.author.id === playerId && (m.content.toLowerCase() === '+r' || m.content.toLowerCase() === '+roll');
        
        let timeLeft = 15;
        const interval = setInterval(() => {
          timeLeft -= 3;
          if (timeLeft > 0) {
            promptMsg.edit(`👉 <@${playerId}>, it is your turn! You have **${timeLeft} seconds** to type \`+r\`.`).catch(() => {});
          }
        }, 3000);
        
        try {
          const collected = await channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });
          clearInterval(interval);
          const rolledNumber = Math.floor(Math.random() * 101); // 0 to 100
          roundNumbers.set(playerId, rolledNumber);
          
          const rollEmbed = new EmbedBuilder()
            .setColor('#00FFFF')
            .setDescription(`**<@${playerId}> rolled:**\n# 🎲 ${rolledNumber}`);
            
          await channel.send({ embeds: [rollEmbed] });
        } catch (e) {
          clearInterval(interval);
          await promptMsg.edit(`⏳ <@${playerId}> ran out of time! You are eliminated from this round.`);
          roundNumbers.set(playerId, -1); // -1 means they skipped/missed
        }
      }

      // Determine round winner
      let winningPlayer = '';
      let bestScore = lobby.mode === 'HIGH' ? -2 : 102;
      let tie = false;

      for (const [pId, num] of roundNumbers.entries()) {
        if (num === -1) continue; // skipped
        
        if (lobby.mode === 'HIGH') {
          if (num > bestScore) { bestScore = num; winningPlayer = pId; tie = false; }
          else if (num === bestScore) { tie = true; }
        } else {
          if (num < bestScore) { bestScore = num; winningPlayer = pId; tie = false; }
          else if (num === bestScore) { tie = true; }
        }
      }

      if (tie || winningPlayer === '') {
        await channel.send(`👔 **Round ${round} ended in a TIE (or no one rolled)!** No points awarded.`);
      } else {
        const currentScore = playerScores.get(winningPlayer) || 0;
        playerScores.set(winningPlayer, currentScore + 1);
        await channel.send(`🏆 <@${winningPlayer}> wins Round ${round} with a ${bestScore}!`);
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
        await EconomyService.adjustBalance(guildId, playerId, refundAmount, 'NumberBattle', 'REFUND').catch(console.error);
      }
    } else {
      await channel.send(`🎉 **<@${overallWinner}> WINS THE MATCH WITH ${maxWins} ROUND WINS!** They take the pot of **${totalPot} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**!`);
      await EconomyService.adjustBalance(guildId, overallWinner, totalPot, 'NumberBattle', 'WIN').catch(console.error);
    }

    // Clear the lobby so a new game can start
    LobbyService.clearLobby(channelId);
  }
}
