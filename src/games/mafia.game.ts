import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ChannelType, PermissionFlagsBits } from 'discord.js';
import { LobbyService } from '../services/lobby.service.js';
import { EconomyService } from '../services/economy.service.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import discordTTS from 'discord-tts';

export class MafiaGame {
  static async startMatch(client: Client, originalChannelId: string) {
    const lobby = LobbyService.getLobby(originalChannelId);
    if (!lobby) return;

    const originalChannel = await client.channels.fetch(originalChannelId) as TextChannel;
    const guild = originalChannel.guild;
    const guildId = guild.id;

    if (lobby.players.length < 5) {
      await originalChannel.send('❌ You need at least 5 players to play Mafia!');
      LobbyService.clearLobby(originalChannelId);
      return;
    }

    // Deduct bets
    for (const playerId of lobby.players) {
      try {
        await EconomyService.adjustBalance(guildId, playerId, -lobby.betAmount, 'Mafia', 'BET');
      } catch (e) {
        await originalChannel.send(`❌ Failed to deduct bet from <@${playerId}>. Game cancelled.`);
        LobbyService.clearLobby(originalChannelId);
        return;
      }
    }

    // CREATE PRIVATE CHANNELS
    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
      },
      {
        id: client.user!.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.SendMessages],
      },
      ...lobby.players.map(pId => ({
        id: pId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Speak],
      }))
    ];

    const privateVc = await guild.channels.create({
      name: '🎙️ Voice Mafia',
      type: ChannelType.GuildVoice,
      permissionOverwrites: overwrites,
    });

    const privateText = await guild.channels.create({
      name: '🕵️-mafia-chat',
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
    });

    await originalChannel.send(`✅ **Mafia Channels Created!**\nHost <@${lobby.hostId}>, you have 20 seconds to join ${privateVc}!\nAll players must move to ${privateText} to play!`);

    let hostJoined = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const hostMember = await guild.members.fetch(lobby.hostId).catch(() => null);
      if (hostMember && hostMember.voice.channelId === privateVc.id) {
        hostJoined = true;
        break;
      }
    }

    if (!hostJoined) {
      await originalChannel.send('❌ The Host did not join the Voice Channel in time. Cancelling...');
      await privateVc.delete().catch(() => {});
      await privateText.delete().catch(() => {});
      LobbyService.clearLobby(originalChannelId);
      // Refund bets
      for (const p of lobby.players) EconomyService.adjustBalance(guildId, p, lobby.betAmount, 'Mafia Refund', 'WIN').catch(() => {});
      return;
    }

    // Bot connects to VC
    const connection = joinVoiceChannel({
      channelId: privateVc.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator as any,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    const speak = (text: string) => {
      return new Promise<void>((resolve) => {
        try {
          const stream = discordTTS.getVoiceStream(text);
          const resource = createAudioResource(stream);
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

    // Helper to mute/unmute ALIVE players in VC
    let alivePlayers = [...lobby.players];
    const setVcMute = async (mute: boolean) => {
      await Promise.all(alivePlayers.map(async (playerId) => {
        try {
          const member = await guild.members.fetch(playerId);
          if (member.voice.channelId === privateVc.id) {
            await member.voice.setMute(mute, 'Mafia Game Phase');
          }
        } catch (e) {}
      }));
    };

    // Kill Player Helper (Mutes them forever in VC & Text)
    const killPlayer = async (playerId: string) => {
      alivePlayers = alivePlayers.filter(p => p !== playerId);
      await privateVc.permissionOverwrites.edit(playerId, { Speak: false }).catch(() => {});
      await privateText.permissionOverwrites.edit(playerId, { SendMessages: false }).catch(() => {});
      try {
        const member = await guild.members.fetch(playerId);
        if (member.voice.channelId === privateVc.id) {
          await member.voice.setMute(true, 'Eliminated');
        }
      } catch (e) {}
    };

    // Setup Roles
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
        await privateText.send(`❌ Could not DM <@${playerId}>. Make sure DMs are open!`);
      }
    }));

    await speak("Welcome to Mafia. Check your DMs for your secret role.");
    await new Promise(r => setTimeout(r, 10000)); // 10 seconds for reading roles

    // WIN CONDITION CHECKER
    let gameActive = true;
    const checkWinCondition = async () => {
      if (!alivePlayers.includes(imposterId)) {
        await privateText.send(`🎉 **THE VILLAGE WINS!** The Imposter has been defeated!`);
        await speak("The Imposter has been defeated. The village wins!");
        const potToShare = lobby.betAmount * lobby.players.length;
        const innocents = lobby.players.filter(p => p !== imposterId && p !== jesterId);
        const payout = Math.floor(potToShare / innocents.length);
        for (const inno of innocents) {
          await EconomyService.adjustBalance(guildId, inno, payout, 'Mafia', 'WIN').catch(console.error);
        }
        return true;
      }
      const innocentsAlive = alivePlayers.length - 1;
      if (1 >= innocentsAlive) { // Imposter is 50% or more of the remaining players
        const winEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔪 THE IMPOSTER WINS!')
          .setDescription('They have overpowered the village!')
          .setImage('https://media.tenor.com/l_4cT_9pGkAAAAAC/among-us-imposter.gif');
        await privateText.send({ embeds: [winEmbed] });
        await speak("The Imposter has overpowered the village. Imposter wins.");
        const totalPot = lobby.betAmount * lobby.players.length;
        await EconomyService.adjustBalance(guildId, imposterId, totalPot, 'Mafia', 'WIN').catch(console.error);
        return true;
      }
      return false;
    };

    while (gameActive) {
      // NIGHT PHASE
      const nightEmbed = new EmbedBuilder().setColor('#000000').setTitle('🌙 Night has fallen').setImage('https://media.tenor.com/FwB8lU7H2KAAAAAC/among-us-shh.gif');
      await privateText.send({ embeds: [nightEmbed] });
      await setVcMute(true);
      await speak("Night has fallen. Everyone close your eyes.");

      // Imposter Turn
      let imposterTarget: string | null = null;
      if (alivePlayers.includes(imposterId)) {
        const speakPromise = speak("Imposter, awake. Whom do you want to kill?");
        try {
          const impUser = await client.users.fetch(imposterId);
          const options = alivePlayers.filter(p => p !== imposterId).map(p => ({ label: `Player ID: ${p}`, value: p }));
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
        } catch (e) {}
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
        } catch (e) {}
        await speak("Guardian, go to sleep.");
      }

      // Process Night
      let nightKill: string | null = imposterTarget;
      if (imposterTarget && imposterTarget === guardianTarget) {
        nightKill = null; // Saved!
      }

      // DAY PHASE
      await privateText.send("☀️ **The sun has risen. The village awakens.**");
      await setVcMute(false);
      
      if (nightKill) {
        const killedUser = await client.users.fetch(nightKill);
        const killEmbed = new EmbedBuilder().setColor('#FF0000').setTitle('💀 A Body Was Found!').setDescription(`<@${nightKill}> was killed in the night.`).setImage('https://media.tenor.com/5Xh_J7tL2pEAAAAC/among-us-kill.gif');
        await privateText.send({ embeds: [killEmbed] });
        await speak(`The sun has risen. ${killedUser.username} was found dead.`);
        await killPlayer(nightKill);
      } else {
        await privateText.send(`🕊️ Nobody was killed last night!`);
        await speak("The sun has risen. Nobody was killed last night.");
      }

      if (await checkWinCondition()) {
        gameActive = false;
        break;
      }

      // Discussion
      const discussEnd = Math.floor(Date.now() / 1000) + 60;
      await privateText.send(`🗣️ **Discussion Phase (60 seconds)**\nTalk in the VC and figure out who is suspicious! Discussion ends <t:${discussEnd}:R>!`);
      await speak("You have 60 seconds to discuss. The timer starts now.");
      await new Promise(r => setTimeout(r, 60000));

      // Voting
      const voteEnd = Math.floor(Date.now() / 1000) + 30;
      await privateText.send(`🗳️ **Voting Phase (30 seconds)**\nSelect who to execute! Voting ends <t:${voteEnd}:R>!`);
      await speak("Voting has started. You have 30 seconds.");

      const richOptions = await Promise.all(alivePlayers.map(async (p) => {
        const u = await client.users.fetch(p);
        return { label: u.username.substring(0, 25), value: p };
      }));
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId('village_vote').setPlaceholder('Vote to execute...').addOptions(richOptions)
      );

      const voteMsg = await privateText.send({ content: 'Vote now:', components: [row] });
      const votes = new Map<string, string>();
      const collector = voteMsg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 30000 });

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
        await privateText.send(`⚖️ The vote was a tie or skipped! Nobody is executed.`);
        await speak("The vote was tied. Nobody was executed.");
      } else {
        const executedUser = await client.users.fetch(highestVoted);
        const ejectEmbed = new EmbedBuilder().setColor('#FFA500').setTitle('🚨 Execution!').setDescription(`<@${highestVoted}> was executed by the village!`).setImage('https://media.tenor.com/bI3U_x1H-fMAAAAC/among-us-ejected.gif');
        await privateText.send({ embeds: [ejectEmbed] });
        await speak(`${executedUser.username} was executed.`);
        await killPlayer(highestVoted);

        // Check Jester Win
        if (jesterId && highestVoted === jesterId) {
          await privateText.send(`🤡 **THE JESTER WINS!** You fools fell for it!`);
          await speak("The Jester fooled you all. Jester wins!");
          const totalPot = lobby.betAmount * lobby.players.length;
          await EconomyService.adjustBalance(guildId, jesterId, totalPot, 'Mafia', 'WIN').catch(console.error);
          gameActive = false;
          break;
        }

        if (await checkWinCondition()) {
          gameActive = false;
          break;
        }
      }
    }

    // Cleanup & Summary
    let summaryText = "";
    for(const p of lobby.players) {
       summaryText += `<@${p}> - **${getRoleName(p)}**\n`;
    }
    const sumEmbed = new EmbedBuilder().setColor('#FFD700').setTitle('🏆 Final Game Results').setDescription(summaryText);
    await privateText.send({ embeds: [sumEmbed] });
    await privateText.send('Channels will be automatically deleted in 60 seconds...');
    
    LobbyService.clearLobby(originalChannelId);
    connection.destroy();
    
    setTimeout(() => {
       privateVc.delete().catch(()=>{});
       privateText.delete().catch(()=>{});
    }, 60000);
  }
}
