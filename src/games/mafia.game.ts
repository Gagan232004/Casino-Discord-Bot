import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, GuildMember } from 'discord.js';
import { LobbyService } from '../services/lobby.service.js';
import { EconomyService } from '../services/economy.service.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice';
import * as googleTTS from 'google-tts-api';

export class MafiaGame {
  static async startMatch(client: Client, channelId: string) {
    const lobby = LobbyService.getLobby(channelId);
    if (!lobby) return;

    const channel = await client.channels.fetch(channelId) as TextChannel;
    const guildId = channel.guildId;

    if (lobby.players.length < 5) {
      await channel.send('❌ You need at least 5 players to play Mafia!');
      LobbyService.clearLobby(channelId);
      return;
    }

    const hostMember = await channel.guild.members.fetch(lobby.hostId);
    const voiceChannel = hostMember.voice.channel;
    
    if (!voiceChannel) {
      await channel.send('❌ The Host must be in a Voice Channel to start the game!');
      LobbyService.clearLobby(channelId);
      return;
    }

    await channel.send(`🎙️ **Joining Voice Channel and starting Mafia!**\nPlayers: ${lobby.players.map(p => `<@${p}>`).join(', ')}`);

    // Deduct bets
    for (const playerId of lobby.players) {
      try {
        await EconomyService.adjustBalance(guildId, playerId, -lobby.betAmount, 'Mafia', 'BET');
      } catch (e) {
        await channel.send(`❌ Failed to deduct bet from <@${playerId}>. Game cancelled.`);
        LobbyService.clearLobby(channelId);
        return;
      }
    }

    // Connect to Voice
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator as any,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    const speak = (text: string) => {
      return new Promise<void>((resolve) => {
        try {
          const url = googleTTS.getAudioUrl(text, { lang: 'en', slow: false, host: 'https://translate.google.com' });
          const resource = createAudioResource(url);
          player.play(resource);
          player.once(AudioPlayerStatus.Idle, () => resolve());
          player.once('error', (err) => {
            console.error('TTS Error:', err);
            resolve();
          });
        } catch (e) {
          console.error('TTS URL Error:', e);
          resolve(); 
        }
      });
    };

    // Helper to mute/unmute all players in VC
    const setVcMute = async (mute: boolean) => {
      await Promise.all(lobby.players.map(async (playerId) => {
        try {
          const member = await channel.guild.members.fetch(playerId);
          if (member.voice.channelId === voiceChannel.id) {
            await member.voice.setMute(mute, 'Mafia Game Phase');
          }
        } catch (e) {}
      }));
    };

    // Setup Roles
    let alivePlayers = [...lobby.players];
    // Shuffle array
    for (let i = alivePlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [alivePlayers[i], alivePlayers[j]] = [alivePlayers[j], alivePlayers[i]];
    }

    let imposterId = alivePlayers[0];
    let guardianId = lobby.settings?.hasGuardian ? alivePlayers[1] : null;
    let jesterId = lobby.settings?.hasJester ? alivePlayers[lobby.settings?.hasGuardian ? 2 : 1] : null;

    const getRoleName = (id: string) => {
      if (id === imposterId) return 'Imposter';
      if (id === guardianId) return 'Guardian';
      if (id === jesterId) return 'Jester';
      return 'Crewmate';
    };

    // DM Roles
    await Promise.all(lobby.players.map(async (playerId) => {
      try {
        const user = await client.users.fetch(playerId);
        const role = getRoleName(playerId);
        let msg = '';
        if (role === 'Imposter') msg = `🔪 **YOU ARE THE IMPOSTER!** 🔪\nEliminate the crewmates at night!`;
        if (role === 'Guardian') msg = `🛡️ **YOU ARE THE GUARDIAN!** 🛡️\nProtect someone at night!`;
        if (role === 'Jester') msg = `🤡 **YOU ARE THE JESTER!** 🤡\nGet yourself voted out during the day to win!`;
        if (role === 'Crewmate') msg = `👨‍🌾 **YOU ARE A CREWMATE!** 👨‍🌾\nFind the Imposter during the day!`;
        await user.send(msg);
      } catch (e) {
        await channel.send(`❌ Could not DM <@${playerId}>. Make sure DMs are open!`);
      }
    }));

    await speak("Welcome to Mafia. Check your DMs for your secret role.");
    await new Promise(r => setTimeout(r, 10000)); // 10 seconds for reading roles

    let gameActive = true;

    while (gameActive) {
      // NIGHT PHASE
      await channel.send("🌙 **Night has fallen. The village goes to sleep.**");
      await setVcMute(true);
      await speak("Night has fallen. Everyone close your eyes.");

      // Imposter Turn
      let imposterTarget: string | null = null;
      if (alivePlayers.includes(imposterId)) {
        const speakPromise = speak("Imposter, awake. Whom do you want to kill?");
        
        try {
          const impUser = await client.users.fetch(imposterId);
          const options = alivePlayers.filter(p => p !== imposterId).map(p => ({ label: `Player ID: ${p}`, value: p })); // Fetching names for DM is tricky, let's keep it simple or fetch
          
          const richOptions = await Promise.all(options.map(async (opt) => {
            const u = await client.users.fetch(opt.value);
            return { label: u.username.substring(0, 25), value: opt.value };
          }));

          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId('kill_vote').setPlaceholder('Select target...').addOptions(richOptions)
          );
          
          const dmMsg = await impUser.send({ content: 'Who do you want to kill? You have 15 seconds.', components: [row] });
          await speakPromise;
          const collected = await dmMsg.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 15000 });
          imposterTarget = collected.values[0];
          await collected.reply('Target locked.');
        } catch (e) {
          // Timed out or error
        }
        await speak("Imposter, go to sleep.");
      }

      // Guardian Turn
      let guardianTarget: string | null = null;
      if (guardianId && alivePlayers.includes(guardianId)) {
        const speakPromise = speak("Guardian, awake. Whom do you want to protect?");
        
        try {
          const guardUser = await client.users.fetch(guardianId);
          const richOptions = await Promise.all(alivePlayers.map(async (p) => {
            const u = await client.users.fetch(p);
            return { label: u.username.substring(0, 25), value: p };
          }));

          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId('protect_vote').setPlaceholder('Select target...').addOptions(richOptions)
          );
          
          const dmMsg = await guardUser.send({ content: 'Who do you want to protect? You have 15 seconds.', components: [row] });
          await speakPromise;
          const collected = await dmMsg.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 15000 });
          guardianTarget = collected.values[0];
          await collected.reply('Target locked.');
        } catch (e) {
          // Timed out
        }
        await speak("Guardian, go to sleep.");
      }

      // Process Night
      let nightKill: string | null = imposterTarget;
      if (imposterTarget && imposterTarget === guardianTarget) {
        nightKill = null; // Saved!
      }

      // DAY PHASE
      await channel.send("☀️ **The sun has risen. The village awakens.**");
      await setVcMute(false);
      
      if (nightKill) {
        alivePlayers = alivePlayers.filter(p => p !== nightKill);
        const killedUser = await client.users.fetch(nightKill);
        await channel.send(`💀 <@${nightKill}> was found dead.`);
        await speak(`The sun has risen. ${killedUser.username} was found dead.`);
      } else {
        await channel.send(`🕊️ Nobody was killed last night!`);
        await speak("The sun has risen. Nobody was killed last night.");
      }

      // Check Win (Imposter wins if ratio >= 50%)
      if (!alivePlayers.includes(imposterId)) {
        // Handled in execution, but if Imposter left/died somehow
        gameActive = false;
        break;
      }
      
      const innocentsAlive = alivePlayers.length - 1;
      if (1 >= innocentsAlive) { // 1 imposter >= innocents
        await channel.send(`🔪 **THE IMPOSTER WINS!** They have overpowered the village!`);
        await speak("The Imposter has overpowered the village. Imposter wins.");
        
        const totalPot = lobby.betAmount * lobby.players.length;
        await EconomyService.adjustBalance(guildId, imposterId, totalPot, 'Mafia', 'WIN').catch(console.error);
        gameActive = false;
        break;
      }

      // Discussion
      const discussEnd = Math.floor(Date.now() / 1000) + 45;
      await channel.send(`🗣️ **Discussion Phase (45 seconds)**\nTalk in the VC and figure out who is suspicious! Discussion ends <t:${discussEnd}:R>!`);
      await speak("You have 45 seconds to discuss. The timer starts now.");
      await new Promise(r => setTimeout(r, 45000));

      // Voting
      const voteEnd = Math.floor(Date.now() / 1000) + 20;
      await channel.send(`🗳️ **Voting Phase (20 seconds)**\nSelect who to execute! Voting ends <t:${voteEnd}:R>!`);
      await speak("Voting has started. You have 20 seconds.");

      const richOptions = await Promise.all(alivePlayers.map(async (p) => {
        const u = await client.users.fetch(p);
        return { label: u.username.substring(0, 25), value: p };
      }));

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId('village_vote').setPlaceholder('Vote to execute...').addOptions(richOptions)
      );

      const voteMsg = await channel.send({ content: 'Vote now:', components: [row] });
      
      const votes = new Map<string, string>();
      const collector = voteMsg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 20000 });

      collector.on('collect', async (interaction) => {
        if (!alivePlayers.includes(interaction.user.id)) {
          await interaction.reply({ content: 'You are dead or not playing!', ephemeral: true });
          return;
        }
        votes.set(interaction.user.id, interaction.values[0]);
        await interaction.reply({ content: 'Vote counted.', ephemeral: true });
      });

      await new Promise(resolve => collector.on('end', resolve));
      await voteMsg.edit({ components: [] }).catch(() => {});

      // Tally votes
      const tallies: Record<string, number> = {};
      for (const votedId of votes.values()) {
        tallies[votedId] = (tallies[votedId] || 0) + 1;
      }

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

      if (tie || !highestVoted) {
        await channel.send(`⚖️ The vote was a tie or skipped! Nobody is executed.`);
        await speak("The vote was tied. Nobody was executed.");
      } else {
        const executedUser = await client.users.fetch(highestVoted);
        await channel.send(`🚨 <@${highestVoted}> was executed by the village!`);
        await speak(`${executedUser.username} was executed.`);
        alivePlayers = alivePlayers.filter(p => p !== highestVoted);

        // Check Jester Win
        if (jesterId && highestVoted === jesterId) {
          await channel.send(`🤡 **THE JESTER WINS!** You fools fell for it!`);
          await speak("The Jester fooled you all. Jester wins!");
          const totalPot = lobby.betAmount * lobby.players.length;
          await EconomyService.adjustBalance(guildId, jesterId, totalPot, 'Mafia', 'WIN').catch(console.error);
          gameActive = false;
          break;
        }

        // Check Imposter Dead
        if (highestVoted === imposterId) {
          await channel.send(`🎉 **THE VILLAGE WINS!** The Imposter has been defeated!`);
          await speak("The Imposter has been defeated. The village wins!");
          
          const potToShare = lobby.betAmount * lobby.players.length;
          const innocents = lobby.players.filter(p => p !== imposterId && p !== jesterId);
          const payout = Math.floor(potToShare / innocents.length);
          for (const inno of innocents) {
            await EconomyService.adjustBalance(guildId, inno, payout, 'Mafia', 'WIN').catch(console.error);
          }
          gameActive = false;
          break;
        }
        
        // Otherwise, game continues
      }
    }

    // Cleanup
    LobbyService.clearLobby(channelId);
    connection.destroy();
    await setVcMute(false); // Make sure everyone is unmuted when game ends
  }
}
