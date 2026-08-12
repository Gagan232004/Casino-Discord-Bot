import { prisma } from '../database/prisma.js';

/**
 * EconomyService handles all monetary transactions.
 * It is completely decoupled from Discord so it can be tested independently.
 */
export class EconomyService {
  static async checkWalletExists(discordGuildId: string, discordUserId: string): Promise<boolean> {
    const wallet = await prisma.wallet.findFirst({
      where: {
        serverMember: {
          user: { discordId: discordUserId },
          server: { discordGuildId: discordGuildId }
        }
      }
    });
    return !!wallet;
  }

  /**
   * Fast query to get a user's balance without creating records.
   */
  static async getBalance(discordGuildId: string, discordUserId: string): Promise<number> {
    const wallet = await prisma.wallet.findFirst({
      where: {
        serverMember: {
          user: { discordId: discordUserId },
          server: { discordGuildId: discordGuildId }
        }
      }
    });
    return wallet?.balance || 0;
  }

  /**
   * Retrieves a wallet, creating the User, Server, and ServerMember if they don't exist.
   */
  static async getWallet(discordGuildId: string, discordUserId: string, username: string = 'Unknown') {
    // We use Prisma's nested create or upsert to ensure everything exists.
    // However, the cleanest way in a relational setup is to make sure the ServerMember exists,
    // which cascades from User and Server.
    
    // Upsert the User
    await prisma.user.upsert({
      where: { discordId: discordUserId },
      update: { username }, // update username in case they changed it
      create: { discordId: discordUserId, username },
    });

    // Upsert the Server
    await prisma.server.upsert({
      where: { discordGuildId },
      update: {},
      create: { discordGuildId },
    });

    // Find the Server and User IDs
    const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
    const server = await prisma.server.findUnique({ where: { discordGuildId } });

    if (!user || !server) throw new Error('Failed to retrieve user or server');

    // Upsert the ServerMember
    const member = await prisma.serverMember.upsert({
      where: {
        serverId_userId: {
          serverId: server.id,
          userId: user.id
        }
      },
      update: {},
      create: {
        serverId: server.id,
        userId: user.id,
      }
    });

    // Finally, Upsert the Wallet
    const wallet = await prisma.wallet.upsert({
      where: { serverMemberId: member.id },
      update: {},
      create: {
        serverMemberId: member.id,
        balance: 1000 // Starting balance for new users
      }
    });

    return { wallet, user, server, member };
  }

  /**
   * Processes a wager and potential payout atomically to prevent exploits.
   */
  static async processBet(params: {
    discordGuildId: string;
    discordUserId: string;
    gameName: string;
    betAmount: number;
    payoutMultiplier: number; // e.g., 0 for a loss, 2 for a coin flip win
  }) {
    if (params.betAmount <= 0) {
      throw new Error('Bet amount must be strictly positive.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Get the wallet (we assume getWallet was called recently, so the entities exist,
      // but we find it directly via relations to lock it or ensure we have the latest)
      const user = await tx.user.findUnique({ where: { discordId: params.discordUserId } });
      const server = await tx.server.findUnique({ where: { discordGuildId: params.discordGuildId } });
      
      if (!user || !server) throw new Error('User or Server not initialized. Check balance first.');

      const member = await tx.serverMember.findUnique({
        where: { serverId_userId: { serverId: server.id, userId: user.id } }
      });

      if (!member) throw new Error('ServerMember not found.');

      const wallet = await tx.wallet.findUnique({
        where: { serverMemberId: member.id }
      });

      if (!wallet) throw new Error('Wallet not found.');

      // 2. Check balance
      if (wallet.balance < params.betAmount) {
        throw new Error('Insufficient balance.');
      }

      const balanceBefore = wallet.balance;
      const winAmount = Math.floor(params.betAmount * params.payoutMultiplier);
      const balanceAfter = balanceBefore - params.betAmount + winAmount;

      // 3. Update the wallet
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter }
      });

      // 4. Create the transaction log
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          serverId: server.id,
          type: winAmount > params.betAmount ? 'WIN' : 'LOSS',
          amount: params.betAmount,
          balanceBefore,
          balanceAfter,
          game: params.gameName
        }
      });

      return {
        success: true,
        won: winAmount > params.betAmount,
        payout: winAmount,
        newBalance: updatedWallet.balance,
        transaction
      };
    });
  }

  static async adjustBalance(discordGuildId: string, discordUserId: string, amount: number, gameName: string, type: 'WIN' | 'LOSS' | 'REFUND' | 'BET') {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { discordId: discordUserId } });
      const server = await tx.server.findUnique({ where: { discordGuildId } });
      if (!user || !server) throw new Error('User/Server missing.');

      const member = await tx.serverMember.findUnique({ where: { serverId_userId: { serverId: server.id, userId: user.id } }});
      if (!member) throw new Error('ServerMember missing.');

      const wallet = await tx.wallet.findUnique({ where: { serverMemberId: member.id } });
      if (!wallet) throw new Error('Wallet missing.');

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      if (balanceAfter < 0) throw new Error('Insufficient balance.');

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter }
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          serverId: server.id,
          type: type,
          amount: Math.abs(amount),
          balanceBefore,
          balanceAfter,
          game: gameName
        }
      });

      return updatedWallet;
    });
  }

  static async claimDaily(discordGuildId: string, discordUserId: string) {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { discordId: discordUserId } });
      const server = await tx.server.findUnique({ where: { discordGuildId } });
      if (!user || !server) throw new Error('You must use `+debut` first.');

      const member = await tx.serverMember.findUnique({ where: { serverId_userId: { serverId: server.id, userId: user.id } }});
      if (!member) throw new Error('You must use `+debut` first.');

      const wallet = await tx.wallet.findUnique({ where: { serverMemberId: member.id } });
      if (!wallet) throw new Error('Wallet missing. You must use `+debut` first.');

      const now = new Date();
      if (wallet.lastDaily) {
        const timeDiff = now.getTime() - wallet.lastDaily.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          const hoursLeft = Math.ceil(24 - hoursDiff);
          throw new Error(`You have already claimed your daily reward! Come back in ${hoursLeft} hours.`);
        }
      }

      const rewardAmount = 500;
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { 
          balance: wallet.balance + rewardAmount,
          lastDaily: now
        }
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          serverId: server.id,
          type: 'DAILY',
          amount: rewardAmount,
          balanceBefore: wallet.balance,
          balanceAfter: updatedWallet.balance,
          game: 'DailyReward'
        }
      });

      return updatedWallet;
    });
  }

  static async claimWelcome(discordGuildId: string, discordUserId: string) {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { discordId: discordUserId } });
      const server = await tx.server.findUnique({ where: { discordGuildId } });
      if (!user || !server) throw new Error('You must use `+debut` first.');

      const member = await tx.serverMember.findUnique({ where: { serverId_userId: { serverId: server.id, userId: user.id } }});
      if (!member) throw new Error('You must use `+debut` first.');

      const wallet = await tx.wallet.findUnique({ where: { serverMemberId: member.id } });
      if (!wallet) throw new Error('Wallet missing. You must use `+debut` first.');

      const existingWelcome = await tx.transaction.findFirst({
        where: { userId: user.id, serverId: server.id, type: 'WELCOME' }
      });
      
      if (existingWelcome) throw new Error('You have already claimed your one-time welcome bonus!');

      const rewardAmount = 5000;
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: wallet.balance + rewardAmount }
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          serverId: server.id,
          type: 'WELCOME',
          amount: rewardAmount,
          balanceBefore: wallet.balance,
          balanceAfter: updatedWallet.balance,
          game: 'WelcomeBonus'
        }
      });

      return updatedWallet;
    });
  }
}
