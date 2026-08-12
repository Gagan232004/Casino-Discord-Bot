import { EconomyService } from './services/economy.service.js';
import { CoinFlipGame } from './games/coinflip.game.js';

async function runTest() {
  const guildId = 'test-guild-123';
  const userId = 'test-user-456';
  
  console.log('1. Fetching/Creating Wallet...');
  const data = await EconomyService.getWallet(guildId, userId, 'GaganTester');
  console.log(`Starting Balance: ${data.wallet.balance} coins`);

  console.log('\n2. Playing Coin Flip (Bet: 100 on HEADS)...');
  try {
    const result = await CoinFlipGame.play(guildId, userId, 100, 'HEADS');
    console.log(`Coin landed on: ${result.result}`);
    if (result.won) {
      console.log(`🎉 We WON! New Balance: ${result.newBalance}`);
    } else {
      console.log(`😢 We LOST. New Balance: ${result.newBalance}`);
    }
  } catch (err: any) {
    console.error('Error playing game:', err.message);
  }

  console.log('\n3. Trying an exploit (betting more than we have)...');
  try {
    await CoinFlipGame.play(guildId, userId, 999999, 'TAILS');
  } catch (err: any) {
    console.log(`🛡️ Exploit blocked! Error message: ${err.message}`);
  }

  process.exit(0);
}

runTest();
