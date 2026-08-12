import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { LobbyService } from '../services/lobby.service.js';
import { EconomyService } from '../services/economy.service.js';

const TOPICS: Record<string, { inno: string; imp: string }[]> = {
  '1': [
    { inno: 'MS Dhoni', imp: 'Virat Kohli' }, { inno: 'Sachin Tendulkar', imp: 'Virender Sehwag' },
    { inno: 'Jasprit Bumrah', imp: 'Mohammed Shami' }, { inno: 'Rohit Sharma', imp: 'Hardik Pandya' },
    { inno: 'Yuvraj Singh', imp: 'Mohammad Kaif' }, { inno: 'Sourav Ganguly', imp: 'Rahul Dravid' },
    { inno: 'R Ashwin', imp: 'Ravindra Jadeja' }, { inno: 'KL Rahul', imp: 'Rishabh Pant' },
    { inno: 'Shikhar Dhawan', imp: 'Gautam Gambhir' }, { inno: 'Zaheer Khan', imp: 'Ashish Nehra' },
    { inno: 'Harbhajan Singh', imp: 'Anil Kumble' }, { inno: 'Suryakumar Yadav', imp: 'Ishan Kishan' },
    { inno: 'Shreyas Iyer', imp: 'Shubman Gill' }, { inno: 'Mohammed Siraj', imp: 'Arshdeep Singh' },
    { inno: 'Yuzvendra Chahal', imp: 'Kuldeep Yadav' }, { inno: 'Ajinkya Rahane', imp: 'Cheteshwar Pujara' },
    { inno: 'VVS Laxman', imp: 'Rahul Dravid' }, { inno: 'Kapil Dev', imp: 'Sunil Gavaskar' },
    { inno: 'Ishant Sharma', imp: 'Umesh Yadav' }, { inno: 'Rinku Singh', imp: 'Tilak Varma' },
    { inno: 'Sanju Samson', imp: 'Dinesh Karthik' }, { inno: 'Ricky Ponting', imp: 'Michael Clarke' },
    { inno: 'Steve Smith', imp: 'David Warner' }, { inno: 'Brett Lee', imp: 'Glenn McGrath' },
    { inno: 'Shane Warne', imp: 'Muttiah Muralitharan' }, { inno: 'AB de Villiers', imp: 'Faf du Plessis' },
    { inno: 'Jacques Kallis', imp: 'Graeme Smith' }, { inno: 'Dale Steyn', imp: 'Morne Morkel' },
    { inno: 'Kane Williamson', imp: 'Ross Taylor' }, { inno: 'Trent Boult', imp: 'Tim Southee' },
    { inno: 'Joe Root', imp: 'Alastair Cook' }, { inno: 'Ben Stokes', imp: 'Jos Buttler' },
    { inno: 'James Anderson', imp: 'Stuart Broad' }, { inno: 'Jofra Archer', imp: 'Mark Wood' },
    { inno: 'Chris Gayle', imp: 'Kieron Pollard' }, { inno: 'Brian Lara', imp: 'Viv Richards' },
    { inno: 'Andre Russell', imp: 'Sunil Narine' }, { inno: 'Rashid Khan', imp: 'Mohammad Nabi' },
    { inno: 'Babar Azam', imp: 'Mohammad Rizwan' }, { inno: 'Shaheen Afridi', imp: 'Haris Rauf' },
    { inno: 'Wasim Akram', imp: 'Waqar Younis' }, { inno: 'Imran Khan', imp: 'Javed Miandad' },
    { inno: 'Shakib Al Hasan', imp: 'Tamim Iqbal' }, { inno: 'Lasith Malinga', imp: 'Chaminda Vaas' },
    { inno: 'Kumar Sangakkara', imp: 'Mahela Jayawardene' }, { inno: 'Sanath Jayasuriya', imp: 'Tillakaratne Dilshan' },
    { inno: 'Pat Cummins', imp: 'Mitchell Starc' }, { inno: 'Glenn Maxwell', imp: 'Marcus Stoinis' },
    { inno: 'Kagiso Rabada', imp: 'Lungi Ngidi' }, { inno: 'Quinton de Kock', imp: 'Hashim Amla' }
  ],
  '2': [
    { inno: 'Lionel Messi', imp: 'Cristiano Ronaldo' }, { inno: 'Neymar Jr', imp: 'Kylian Mbappe' },
    { inno: 'Pele', imp: 'Maradona' }, { inno: 'Erling Haaland', imp: 'Kevin De Bruyne' },
    { inno: 'Mohamed Salah', imp: 'Sadio Mane' }, { inno: 'Robert Lewandowski', imp: 'Karim Benzema' },
    { inno: 'Luka Modric', imp: 'Toni Kroos' }, { inno: 'Andres Iniesta', imp: 'Xavi Hernandez' },
    { inno: 'Ronaldinho', imp: 'Kaka' }, { inno: 'Zinedine Zidane', imp: 'Luis Figo' },
    { inno: 'Sergio Ramos', imp: 'Gerard Pique' }, { inno: 'Manuel Neuer', imp: 'Gianluigi Buffon' },
    { inno: 'Iker Casillas', imp: 'David De Gea' }, { inno: 'Paolo Maldini', imp: 'Alessandro Nesta' },
    { inno: 'Roberto Carlos', imp: 'Cafu' }, { inno: 'Thierry Henry', imp: 'Dennis Bergkamp' },
    { inno: 'Wayne Rooney', imp: 'Robin Van Persie' }, { inno: 'Sergio Aguero', imp: 'Carlos Tevez' },
    { inno: 'Luis Suarez', imp: 'Edinson Cavani' }, { inno: 'Zlatan Ibrahimovic', imp: 'Olivier Giroud' },
    { inno: 'Vinicius Jr', imp: 'Rodrygo' }, { inno: 'Jude Bellingham', imp: 'Phil Foden' },
    { inno: 'Bukayo Saka', imp: 'Marcus Rashford' }, { inno: 'Antoine Griezmann', imp: 'Paul Pogba' },
    { inno: 'N\'Golo Kante', imp: 'Claude Makelele' }, { inno: 'Virgil Van Dijk', imp: 'Matthijs De Ligt' },
    { inno: 'Alisson Becker', imp: 'Ederson Moraes' }, { inno: 'Thibaut Courtois', imp: 'Jan Oblak' },
    { inno: 'Marcelo', imp: 'Dani Alves' }, { inno: 'Sergio Busquets', imp: 'Casemiro' },
    { inno: 'Steven Gerrard', imp: 'Frank Lampard' }, { inno: 'Paul Scholes', imp: 'Roy Keane' },
    { inno: 'Andrea Pirlo', imp: 'Gennaro Gattuso' }, { inno: 'Francesco Totti', imp: 'Alessandro Del Piero' },
    { inno: 'Roberto Baggio', imp: 'Gianfranco Zola' }, { inno: 'Didier Drogba', imp: 'Samuel Eto\'o' },
    { inno: 'Yaya Toure', imp: 'Michael Essien' }, { inno: 'Son Heung-min', imp: 'Park Ji-sung' },
    { inno: 'Khvicha Kvaratskhelia', imp: 'Victor Osimhen' }, { inno: 'Rafael Leao', imp: 'Theo Hernandez' },
    { inno: 'Achraf Hakimi', imp: 'Hakim Ziyech' }, { inno: 'Riyad Mahrez', imp: 'Bernardo Silva' },
    { inno: 'Angel Di Maria', imp: 'Paulo Dybala' }, { inno: 'Lautaro Martinez', imp: 'Enzo Fernandez' },
    { inno: 'Josko Gvardiol', imp: 'Mateo Kovacic' }, { inno: 'Christian Pulisic', imp: 'Gio Reyna' },
    { inno: 'Alphonso Davies', imp: 'David Alaba' }, { inno: 'Andy Robertson', imp: 'Trent Alexander-Arnold' },
    { inno: 'Xabi Alonso', imp: 'Cesc Fabregas' }, { inno: 'Thomas Muller', imp: 'Marco Reus' },
    { inno: 'Bastian Schweinsteiger', imp: 'Philipp Lahm' }, { inno: 'Michael Ballack', imp: 'Miroslav Klose' }
  ],
  '3': [
    { inno: 'Shahrukh Khan', imp: 'Salman Khan' }, { inno: 'Tom Cruise', imp: 'Brad Pitt' },
    { inno: 'Leonardo DiCaprio', imp: 'Johnny Depp' }, { inno: 'Aamir Khan', imp: 'Akshay Kumar' },
    { inno: 'Amitabh Bachchan', imp: 'Rajinikanth' }, { inno: 'Hrithik Roshan', imp: 'Tiger Shroff' },
    { inno: 'Ranbir Kapoor', imp: 'Ranveer Singh' }, { inno: 'Vicky Kaushal', imp: 'Ayushmann Khurrana' },
    { inno: 'Kartik Aaryan', imp: 'Varun Dhawan' }, { inno: 'Allu Arjun', imp: 'Ram Charan' },
    { inno: 'Prabhas', imp: 'Mahesh Babu' }, { inno: 'Yash', imp: 'Dulquer Salmaan' },
    { inno: 'Will Smith', imp: 'Martin Lawrence' }, { inno: 'Robert Downey Jr', imp: 'Chris Evans' },
    { inno: 'Chris Hemsworth', imp: 'Tom Hiddleston' }, { inno: 'Ryan Reynolds', imp: 'Hugh Jackman' },
    { inno: 'Dwayne Johnson', imp: 'Kevin Hart' }, { inno: 'Vin Diesel', imp: 'Paul Walker' },
    { inno: 'Keanu Reeves', imp: 'Matt Damon' }, { inno: 'Christian Bale', imp: 'Ben Affleck' },
    { inno: 'Joaquin Phoenix', imp: 'Heath Ledger' }, { inno: 'Morgan Freeman', imp: 'Samuel L Jackson' },
    { inno: 'Denzel Washington', imp: 'Will Smith' }, { inno: 'Tom Hanks', imp: 'Harrison Ford' },
    { inno: 'Al Pacino', imp: 'Robert De Niro' }, { inno: 'George Clooney', imp: 'Brad Pitt' },
    { inno: 'Matt Damon', imp: 'Mark Wahlberg' }, { inno: 'Ryan Gosling', imp: 'Jake Gyllenhaal' },
    { inno: 'Chris Pratt', imp: 'Chris Pine' }, { inno: 'Bradley Cooper', imp: 'Zack Galifianakis' },
    { inno: 'Jim Carrey', imp: 'Adam Sandler' }, { inno: 'Steve Carell', imp: 'Paul Rudd' },
    { inno: 'Will Ferrell', imp: 'Jack Black' }, { inno: 'Seth Rogen', imp: 'Jonah Hill' },
    { inno: 'Kevin Hart', imp: 'Dave Chappelle' }, { inno: 'Rowan Atkinson', imp: 'Charlie Chaplin' },
    { inno: 'Jackie Chan', imp: 'Bruce Lee' }, { inno: 'Sylvester Stallone', imp: 'Arnold Schwarzenegger' },
    { inno: 'Jason Statham', imp: 'Jet Li' }, { inno: 'Daniel Craig', imp: 'Pierce Brosnan' },
    { inno: 'Sean Connery', imp: 'Roger Moore' }, { inno: 'Ian McKellen', imp: 'Patrick Stewart' },
    { inno: 'Elijah Wood', imp: 'Daniel Radcliffe' }, { inno: 'Rupert Grint', imp: 'Tom Felton' },
    { inno: 'Robert Pattinson', imp: 'Taylor Lautner' }, { inno: 'Zac Efron', imp: 'Channing Tatum' },
    { inno: 'Justin Bieber', imp: 'Shawn Mendes' }, { inno: 'Ed Sheeran', imp: 'Charlie Puth' },
    { inno: 'Bruno Mars', imp: 'The Weeknd' }, { inno: 'Drake', imp: 'Kendrick Lamar' },
    { inno: 'Eminem', imp: 'Snoop Dogg' }, { inno: 'Jay-Z', imp: 'Kanye West' }
  ]
};

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
    
    const topicCategory = lobby.mode || '1';
    const pairs = TOPICS[topicCategory];
    const chosenPair = pairs[Math.floor(Math.random() * pairs.length)];

    let alivePlayers = [...lobby.players];
    const initialInnocents = lobby.players.filter(p => p !== imposterId);

    // DM Players
    for (const playerId of lobby.players) {
      try {
        const user = await client.users.fetch(playerId);
        if (playerId === imposterId) {
          await user.send(`🔪 **YOU ARE THE IMPOSTER!** 🔪\nYour secret word is: **${chosenPair.imp}**\n*Try to blend in! Do not let them know you have a different word!*`);
        } else {
          await user.send(`😇 **YOU ARE INNOCENT!** 😇\nYour secret word is: **${chosenPair.inno}**\n*Find the person who doesn't know this word!*`);
        }
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
      for (const playerId of alivePlayers) {
        const promptMsg = await channel.send(`🗣️ <@${playerId}>, it is your turn! You have **20 seconds** to type a clue.`);
        
        const filter = (m: any) => m.author.id === playerId;
        
        let timeLeft = 20;
        const interval = setInterval(() => {
          timeLeft -= 4;
          if (timeLeft > 0) {
            promptMsg.edit(`🗣️ <@${playerId}>, it is your turn! You have **${timeLeft} seconds** to type a clue.`).catch(() => {});
          }
        }, 4000);
        
        try {
          const collected = await channel.awaitMessages({ filter, max: 1, time: 20000, errors: ['time'] });
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
        .setDescription(`🚨 The Innocents failed to eliminate anyone! <@${imposterId}> survived! They were the **IMPOSTER**!\nThe Imposter's word was: **${chosenPair.imp}**\nThe Innocents' word was: **${chosenPair.inno}**`)
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
        .setDescription(`🚨 <@${imposterId}> was ejected. They were the **IMPOSTER**!\nThe Imposter's word was: **${chosenPair.imp}**\nThe Innocents' word was: **${chosenPair.inno}**`)
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
        .setDescription(`🚨 The wrong person was ejected! <@${imposterId}> survived! They were the **IMPOSTER**!\nThe Imposter's word was: **${chosenPair.imp}**\nThe Innocents' word was: **${chosenPair.inno}**`)
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
