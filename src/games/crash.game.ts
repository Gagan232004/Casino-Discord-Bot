import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { LobbyService } from '../services/lobby.service.js';
import { EconomyService } from '../services/economy.service.js';

export class CrashGame {
  static async startMatch(client: Client, channelId: string) {
    const lobby = LobbyService.getLobby(channelId);
    if (!lobby) return;

    const channel = await client.channels.fetch(channelId) as TextChannel;
    const guildId = channel.guildId;

    await channel.send(`🚀 **The CRASH Game is starting!** 🚀\nPlayers: ${lobby.players.map(p => `<@${p}>`).join(', ')}`);

    // Deduct bets
    for (const playerId of lobby.players) {
      try {
        await EconomyService.adjustBalance(guildId, playerId, -lobby.betAmount, 'Crash', 'BET');
      } catch (e) {
        await channel.send(`❌ Failed to deduct bet from <@${playerId}>. Game cancelled.`);
        LobbyService.clearLobby(channelId);
        return;
      }
    }

    // Determine the crash point beforehand
    let crashMultiplier = 1.00;
    if (Math.random() > 0.05) { // 5% chance of instant crash at 1.00x
      crashMultiplier = Math.max(1.00, 0.95 / (1.0 - Math.random()));
    }
    // Cap at 100x for sanity
    if (crashMultiplier > 100) crashMultiplier = 100.0;

    const growthConstant = 6514; // reaches 100x in ~30 seconds
    const crashTimeMs = Math.log(crashMultiplier) * growthConstant;
    
    const cashOuts = new Map<string, number>();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('cashout')
          .setLabel('💰 Cash Out')
          .setStyle(ButtonStyle.Success)
      );

    const embed = new EmbedBuilder()
      .setColor('#FFFF00')
      .setTitle('📈 Multiplier: 1.00x')
      .setDescription('Click the button below to secure your multiplier before it crashes!');

    const message = await channel.send({ embeds: [embed], components: [row] });

    let isCrashed = false;
    const startTime = Date.now();

    // Component Collector
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async (interaction) => {
      const elapsed = Date.now() - startTime;
      
      if (!lobby.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You are not in this game!', ephemeral: true });
        return;
      }

      if (cashOuts.has(interaction.user.id)) {
        await interaction.reply({ content: 'You already cashed out!', ephemeral: true });
        return;
      }

      if (isCrashed || elapsed >= crashTimeMs) {
        await interaction.reply({ content: 'Too late! It crashed before your click registered!', ephemeral: true });
        return;
      }

      // Calculate exact multiplier at the millisecond they clicked
      const exactMultiplier = Math.exp(elapsed / growthConstant);
      cashOuts.set(interaction.user.id, exactMultiplier);
      
      const winAmount = Math.floor(lobby.betAmount * exactMultiplier);
      
      await EconomyService.adjustBalance(guildId, interaction.user.id, winAmount, 'Crash', 'WIN').catch(console.error);
      
      await interaction.reply({ content: `✅ You cashed out at **${exactMultiplier.toFixed(2)}x** and won **${winAmount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>**!`, ephemeral: false });
    });

    // Game Loop (Update visual message every 2 seconds to avoid rate limits)
    const tickRate = 2000; 

    const gameLoop = setInterval(async () => {
      const elapsed = Date.now() - startTime;

      if (elapsed >= crashTimeMs) {
        // CRASHED!
        isCrashed = true;
        clearInterval(gameLoop);
        collector.stop('crashed');

        const crashEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle(`💥 CRASHED AT ${crashMultiplier.toFixed(2)}x!`)
          .setDescription(`Anyone who didn't cash out just lost their bet of ${lobby.betAmount} <:Gemini_Generated_Image_nele8wnel:1536424832177143898>.`);

        const disabledRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('cashout')
              .setLabel('💥 Crashed')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );

        await message.edit({ embeds: [crashEmbed], components: [disabledRow] }).catch(() => {});
        
        let summary = '**Round Summary:**\n';
        for (const p of lobby.players) {
          if (cashOuts.has(p)) {
            summary += `✅ <@${p}>: Cashed out at ${cashOuts.get(p)?.toFixed(2)}x\n`;
          } else {
            summary += `💀 <@${p}>: Crashed (Lost ${lobby.betAmount})\n`;
          }
        }
        await channel.send(summary);

        LobbyService.clearLobby(channelId);
      } else {
        // Still flying
        const currentVisualMultiplier = Math.exp(elapsed / growthConstant);
        const liveEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle(`📈 Multiplier: ${currentVisualMultiplier.toFixed(2)}x`)
          .setDescription('Click the button below to secure your multiplier before it crashes!');
        
        await message.edit({ embeds: [liveEmbed] }).catch(() => {});
      }
    }, tickRate);
  }
}
