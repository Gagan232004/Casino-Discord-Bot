# 🎰 Casino Adda - Discord Bot

Welcome to **Casino Adda**, a fully-featured, multiplayer casino bot for Discord! Built with modern TypeScript, discord.js v14, and Prisma ORM, this bot brings interactive, real-time gambling games straight to your Discord server.

## 🚀 Features

- **Economy System**: A robust global economy using Prisma & SQLite. Users get starting coins, can claim daily rewards, and track their balances.
- **Multiplayer Lobbies**: Advanced lobby system where players can join, bet, and compete against each other in real-time.
- **Slash Commands & Prefix Commands**: Full support for both `+command` and Discord native `/slash` commands.
- **Wispbyte Ready**: Pre-configured `index.js` wrapper for seamless 24/7 deployment on Pterodactyl-based hosts like Wispbyte.

### 🎮 The Games
1. **Crash (`+hcr`)**: Watch the multiplier climb and cash out before the rocket crashes! If you wait too long, you lose your bet.
2. **Closest to Bot (`+hc`)**: The bot picks a secret number. All players have 15 seconds to DM their guesses. The closest guess wins the round pot!
3. **Imposter (`+hi`)**: A social deduction game! Everyone gets a secret word in their DMs, except the Imposter who gets a slightly different word. Players give clues and vote out the Imposter in emergency meetings.
4. **High/Low Battle (`+hb`)**: Roll the highest (or lowest) number against your friends to win the pot.
5. **Roulette (`+roulette`)**: A public, interactive 30-second roulette table where anyone can place bets on Red, Black, Green, Odds, Evens, or exact numbers!
6. **Coin Flip (`+cf`)**: A simple 50/50 double-or-nothing coin flip against the house.

---

## 🛠️ Installation & Setup (Local)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Casino-Discord-Bot.git
   cd Casino-Discord-Bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Rename `.env.example` to `.env` (or create a new `.env` file) and add your Discord Bot Token:
   ```env
   DISCORD_TOKEN="YOUR_DISCORD_BOT_TOKEN_HERE"
   DATABASE_URL="file:./dev.db"
   ```

4. **Initialize the Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start the Bot!**
   ```bash
   npm run start
   ```

---

## ☁️ Hosting on Wispbyte (or Pterodactyl)

This bot is already configured to run out-of-the-box on generic Node.js hosts like Wispbyte.

1. Zip the contents of this folder (exclude `node_modules` and `.git`).
2. Upload the `.zip` file to your Wispbyte File Manager and unarchive it.
3. Go to the **Startup** tab and ensure the **Main File** is set to `index.js`.
4. Make sure your `.env` file is uploaded with your token!
5. Click **Start**. The `index.js` wrapper will automatically install packages, generate the database, and launch the TypeScript bot.

---

## 📜 Commands Reference

- `+debut` or `/debut` : Register your VIP account and claim your starting balance.
- `+balance` or `/balance` : Check your current wallet balance.
- `+daily` or `/daily` : Claim your daily free coins.
- `+guide` or `/guide` : View the interactive rulebook for all games.
- `+j` or `/join` : Join an active lobby.
- `+s` or `/start` : Start the lobby (Host only).

## 💻 Tech Stack
- **Node.js** (v20+)
- **TypeScript**
- **Discord.js** (v14)
- **Prisma ORM** (v6)
- **SQLite**

## 📝 License
This project is licensed under the MIT License - see the LICENSE file for details.
