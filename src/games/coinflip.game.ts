import { EconomyService } from '../services/economy.service.js';

export class CoinFlipGame {
  /**
   * Simulates a coin flip and processes the bet.
   * @param choice 'HEADS' or 'TAILS'
   */
  static async play(discordGuildId: string, discordUserId: string, betAmount: number, choice: 'HEADS' | 'TAILS') {
    // 1. Determine the outcome server-side
    const isHeads = Math.random() < 0.5;
    const result = isHeads ? 'HEADS' : 'TAILS';
    
    // 2. Check if the user won
    const won = choice === result;
    
    // 3. Process the transaction securely
    // If they win, they get 2x their bet (their bet back + profit). If they lose, they get 0x (lose the bet).
    const payoutMultiplier = won ? 2 : 0;

    const transactionResult = await EconomyService.processBet({
      discordGuildId,
      discordUserId,
      gameName: 'COIN_FLIP',
      betAmount,
      payoutMultiplier
    });

    return {
      result,
      won,
      ...transactionResult
    };
  }
}
