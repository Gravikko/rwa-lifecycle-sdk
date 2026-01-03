import { IndexerModule } from '../src/IndexerModule.js';

async function main() {
  const indexer = new IndexerModule({
    l1RpcUrl: 'https://rpc.sepolia.mantle.xyz',
    l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
    l1BridgeAddress: '0x21F308067241B2028503c07bd7cB3751FFab0Fb2',
    l2BridgeAddress: '0x4200000000000000000000000000000000000010',
    databasePath: './indexer.db',
    pollInterval: 12000,
  });

  indexer.subscription.onDeposit((event) => {
    console.log('New deposit detected:', {
      txHash: event.transactionHash,
      from: event.from,
      to: event.to,
      amount: event.amount?.toString(),
    });
  });

  indexer.subscription.onWithdrawal((event) => {
    console.log('New withdrawal detected:', {
      txHash: event.transactionHash,
      from: event.from,
      to: event.to,
      amount: event.amount?.toString(),
    });
  });

  indexer.subscription.onSynced((chain, blockNumber) => {
    console.log(`${chain} synced to block ${blockNumber}`);
  });

  console.log('Starting indexer...');
  await indexer.start();

  const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8';
  const transactions = indexer.transactions.getTransactionsByUser(userAddress);
  console.log(`User has ${transactions.total} transactions`);

  const deposits = indexer.deposits.getUserDeposits(userAddress);
  console.log(`User has ${deposits.total} deposits`);

  const withdrawals = indexer.deposits.getUserWithdrawals(userAddress);
  console.log(`User has ${withdrawals.total} withdrawals`);

  const stats = await indexer.getStats();
  console.log('Indexer stats:', stats);

  process.on('SIGINT', () => {
    console.log('\nStopping indexer...');
    indexer.close();
    process.exit(0);
  });
}

main().catch(console.error);
