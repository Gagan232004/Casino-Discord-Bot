import { Client, TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { EconomyService } from '../services/economy.service.js';
import path from 'path';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

type BetChoice = 'red' | 'black' | 'green' | 'odd' | 'even' | number;

interface PlacedBet {
  userId: string;
  amount: number;
  choice: BetChoice;
}

export class RouletteGame {
  static activeTables = new Set<string>();

  static async startTable(client: Client, channelId: string, guildId: string) {
    if (this.activeTables.has(channelId)) return;
    this.activeTables.add(channelId);

    const channel = await client.channels.fetch(channelId) as TextChannel;
    
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🎡 The Roulette Table is OPEN!')
      .setDescription(`Place your bets now! You have **30 seconds**.\n\n**How to bet:**\nType \`+bet <amount> <choice>\`\n\n**Choices:**\n🔴 \`red\` (Pays 2x)\n⚫ \`black\` (Pays 2x)\n🟢 \`green\` (Pays 36x)\n🔢 \`odd\` / \`even\` (Pays 2x)\n🎯 \`0-36\` (Exact number, Pays 36x)\n\n*Example: \`+bet 100 red\` or \`+bet 500 17\`*`);
    
    const tableMsg = await channel.send({ embeds: [embed] });

    let timeLeft = 30;
    const timerInterval = setInterval(() => {
      timeLeft -= 5;
      if (timeLeft > 0) {
        embed.setDescription(`Place your bets now! You have **${timeLeft} seconds**.\n\n**How to bet:**\nType \`+bet <amount> <choice>\`\n\n**Choices:**\n🔴 \`red\` (Pays 2x)\n⚫ \`black\` (Pays 2x)\n🟢 \`green\` (Pays 36x)\n🔢 \`odd\` / \`even\` (Pays 2x)\n🎯 \`0-36\` (Exact number, Pays 36x)\n\n*Example: \`+bet 100 red\` or \`+bet 500 17\`*`);
        tableMsg.edit({ embeds: [embed] }).catch(() => {});
      }
    }, 5000);

    const bets: PlacedBet[] = [];
    const filter = (m: any) => m.content.toLowerCase().startsWith('+bet ');

    // Collect bets for 30 seconds
    const collector = channel.createMessageCollector({ filter, time: 30000 });

    collector.on('collect', async (m) => {
      const args = m.content.slice(5).trim().split(/ +/);
      if (args.length < 2) return;
      
      const amount = parseInt(args[0]);
      const choiceStr = args[1].toLowerCase();
      
      if (isNaN(amount) || amount <= 0) {
        await m.reply('❌ Invalid bet amount.');
        return;
      }

      let choice: BetChoice;
      if (['red', 'black', 'green', 'odd', 'even'].includes(choiceStr)) {
        choice = choiceStr as BetChoice;
      } else {
        const num = parseInt(choiceStr);
        if (isNaN(num) || num < 0 || num > 36) {
          await m.reply('❌ Invalid bet choice. Must be red/black/green/odd/even or a number 0-36.');
          return;
        }
        choice = num;
      }

      // Check balance and deduct
      try {
        m.react('✅').catch(() => {});
        await EconomyService.adjustBalance(guildId, m.author.id, -amount, 'Roulette', 'BET');
        bets.push({ userId: m.author.id, amount, choice });
      } catch (e: any) {
        m.reactions.cache.get('✅')?.remove().catch(() => {});
        await m.reply(`❌ ${e.message}`);
      }
    });

    collector.on('end', async () => {
      clearInterval(timerInterval);
      this.activeTables.delete(channelId);

      if (bets.length === 0) {
        await channel.send('🎡 No bets were placed! The Roulette table has closed.');
        return;
      }

      const spinningEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🎡 The Wheel is Spinning...')
        .setDescription('No more bets! Let\'s see where it lands...')
        .setImage('https://media.tenor.com/XqT2JzY7P2sAAAAC/roulette-spin.gif');
      
      const spinMsg = await channel.send({ embeds: [spinningEmbed] });

      // Simulate a spin (4 seconds)
      setTimeout(async () => {
        const resultNumber = Math.floor(Math.random() * 37); // 0-36
        let resultColor = 'green';
        if (RED_NUMBERS.includes(resultNumber)) resultColor = 'red';
        else if (BLACK_NUMBERS.includes(resultNumber)) resultColor = 'black';
        
        let emoji = '🟢';
        let colorHex: `#${string}` = '#00FF00';
        if (resultColor === 'red') { emoji = '🔴'; colorHex = '#FF0000'; }
        if (resultColor === 'black') { emoji = '⚫'; colorHex = '#000000'; }

        const resultEmbed = new EmbedBuilder()
          .setColor(colorHex)
          .setTitle(`${emoji} The ball landed on ${resultColor.toUpperCase()} ${resultNumber}!`)
          .setDescription('Calculating payouts...');
        
        await spinMsg.edit({ embeds: [resultEmbed] });

        let summary = '**Payouts:**\n';
        let anyWinners = false;

        for (const bet of bets) {
          let won = false;
          let multiplier = 0;

          if (bet.choice === 'red' && resultColor === 'red') { won = true; multiplier = 2; }
          else if (bet.choice === 'black' && resultColor === 'black') { won = true; multiplier = 2; }
          else if (bet.choice === 'green' && resultColor === 'green') { won = true; multiplier = 36; }
          else if (bet.choice === 'odd' && resultNumber !== 0 && resultNumber % 2 !== 0) { won = true; multiplier = 2; }
          else if (bet.choice === 'even' && resultNumber !== 0 && resultNumber % 2 === 0) { won = true; multiplier = 2; }
          else if (typeof bet.choice === 'number' && bet.choice === resultNumber) { won = true; multiplier = 36; }

          if (won) {
            anyWinners = true;
            const winnings = bet.amount * multiplier;
            await EconomyService.adjustBalance(guildId, bet.userId, winnings, 'Roulette', 'WIN').catch(console.error);
            summary += `✅ <@${bet.userId}> won **${winnings} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**! (Bet: ${bet.amount} on ${bet.choice})\n`;
          } else {
            summary += `❌ <@${bet.userId}> lost ${bet.amount}. (Bet on ${bet.choice})\n`;
          }
        }

        if (!anyWinners) summary += '\n*The House wins all! 💸*';
        
        await channel.send(summary);

      }, 6000);
    });
  }
}
