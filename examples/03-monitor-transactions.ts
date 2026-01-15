/**
 * Example 3: Real-Time Transaction Monitoring
 *
 * This example demonstrates how to:
 * 1. Initialize the SDK and indexer
 * 2. Query transaction history with filters
 * 3. Track pending withdrawals
 * 4. Find withdrawals ready for prove/finalize
 *
 * Run: pnpm tsx 03-monitor-transactions.ts
 */

import { RWALifecycleSDK } from '@rwa-lifecycle/core';
import { formatEther } from 'viem';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// =============================================================================
// MAIN MONITORING PROGRAM
// =============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          Transaction Monitor Example                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // ---------------------------------------------------------------------------
  // Initialize SDK
  // ---------------------------------------------------------------------------

  console.log('📦 Initializing SDK...\n');

  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;

  const sdk = new RWALifecycleSDK({
    l1RpcUrl: process.env.L1_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
    l2RpcUrl: process.env.L2_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
    privateKey,
    network: 'testnet',
    indexerAutoStart: true,
  });

  const userAddress = sdk.getL1WalletClient()?.account?.address || sdk.getL2WalletClient()?.account?.address;

  console.log('✅ SDK initialized');
  if (userAddress) {
    console.log(`   User address: ${userAddress}`);
  } else {
    console.log('   Running in read-only mode (no wallet)');
  }
  console.log('');

  // Wait for indexer to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // ---------------------------------------------------------------------------
  // Query Recent Transactions (if wallet available)
  // ---------------------------------------------------------------------------

  if (userAddress) {
    console.log('📜 Recent Transactions:\n');

    try {
      const recent = await sdk.getMyTransactions({
        limit: 10,
      });

      if (recent.items.length === 0) {
        console.log('   No transactions found for this wallet\n');
      } else {
        console.log(`   Found ${recent.total} total transactions\n`);

        recent.items.forEach((tx, index) => {
          console.log(`${index + 1}. ${tx.eventType}`);
          console.log(`   Hash: ${truncateAddress(tx.transactionHash)}`);
          console.log(`   Time: ${formatTimestamp(tx.timestamp)}`);
          console.log(`   Block: ${tx.blockNumber}`);
          console.log(`   Chain: ${tx.chain.toUpperCase()}`);
          if (tx.amount) {
            console.log(`   Amount: ${formatEther(tx.amount)} tokens`);
          }
          console.log('');
        });
      }
    } catch (error) {
      const err = error as Error;
      console.error('⚠️  Could not query transactions:', err.message, '\n');
    }

    // ---------------------------------------------------------------------------
    // Check Pending Withdrawals
    // ---------------------------------------------------------------------------

    console.log('⏳ Pending Withdrawals:\n');

    try {
      const pending = await sdk.getMyPendingWithdrawals();

      if (pending.length === 0) {
        console.log('   No pending withdrawals\n');
      } else {
        console.log(`   Found ${pending.length} pending withdrawal(s)\n`);

        pending.forEach((withdrawal, index) => {
          console.log(`${index + 1}. ${truncateAddress(withdrawal.initiatedTxHash)}`);
          console.log(`   Phase: ${withdrawal.phase}`);
          console.log(`   Can Prove: ${withdrawal.canProve}`);
          console.log(`   Can Finalize: ${withdrawal.canFinalize}`);

          if (withdrawal.estimatedReadyToProve) {
            const now = Date.now() / 1000;
            const timeLeft = Math.max(0, Number(withdrawal.estimatedReadyToProve) - now);
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            console.log(`   Ready to prove in: ${hours}h ${minutes}m`);
          }

          console.log('');
        });
      }
    } catch (error) {
      const err = error as Error;
      console.error('⚠️  Could not query pending withdrawals:', err.message, '\n');
    }

    // ---------------------------------------------------------------------------
    // Check Actionable Withdrawals
    // ---------------------------------------------------------------------------

    console.log('🚀 Actionable Withdrawals:\n');

    try {
      // Check withdrawals ready to prove
      const readyToProve = await sdk.getWithdrawalsReadyToProve();

      if (readyToProve.length > 0) {
        console.log(`   ✅ ${readyToProve.length} withdrawal(s) ready to PROVE:`);
        readyToProve.forEach((w) => {
          console.log(`      - ${truncateAddress(w.initiatedTxHash)}`);
        });
        console.log('');
      }

      // Check withdrawals ready to finalize
      const readyToFinalize = await sdk.getWithdrawalsReadyToFinalize();

      if (readyToFinalize.length > 0) {
        console.log(`   ✅ ${readyToFinalize.length} withdrawal(s) ready to FINALIZE:`);
        readyToFinalize.forEach((w) => {
          console.log(`      - ${truncateAddress(w.initiatedTxHash)}`);
        });
        console.log('');
      }

      if (readyToProve.length === 0 && readyToFinalize.length === 0) {
        console.log('   No withdrawals need action right now\n');
      }

    } catch (error) {
      const err = error as Error;
      console.error('⚠️  Could not check actionable withdrawals:', err.message, '\n');
    }

    // ---------------------------------------------------------------------------
    // Query by Type
    // ---------------------------------------------------------------------------

    console.log('🔍 Transaction Statistics:\n');

    try {
      const deposits = await sdk.getMyTransactions({ type: 'deposit' });
      console.log(`   Total Deposits: ${deposits.total}`);

      const withdrawals = await sdk.getMyTransactions({ type: 'withdrawal' });
      console.log(`   Total Withdrawals: ${withdrawals.total}`);
      console.log('');
    } catch (error) {
      const err = error as Error;
      console.error('   Could not get statistics:', err.message, '\n');
    }
  }

  // ---------------------------------------------------------------------------
  // SDK API Reference
  // ---------------------------------------------------------------------------

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                   SDK API Reference                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📊 Query Methods:\n');
  console.log('   sdk.getMyTransactions(options?)');
  console.log('     - Get all transactions for connected wallet');
  console.log('     - Options: { type?, limit?, offset?, fromBlock?, toBlock? }');
  console.log('');
  console.log('   sdk.trackWithdrawal(txHash)');
  console.log('     - Get status of a specific withdrawal');
  console.log('     - Returns: phase, canProve, canFinalize, timestamps');
  console.log('');
  console.log('   sdk.getMyPendingWithdrawals()');
  console.log('     - Get all non-finalized withdrawals');
  console.log('');
  console.log('   sdk.getWithdrawalsReadyToProve()');
  console.log('     - Get withdrawals ready for prove phase');
  console.log('');
  console.log('   sdk.getWithdrawalsReadyToFinalize()');
  console.log('     - Get withdrawals ready for finalize phase');
  console.log('');
  console.log('   sdk.getWithdrawalTimeline(txHash)');
  console.log('     - Get detailed timeline of withdrawal phases');
  console.log('');

  console.log('🔧 Indexer Module (sdk.indexer):\n');
  console.log('   sdk.indexer.start() / sdk.indexer.stop()');
  console.log('     - Start/stop background sync');
  console.log('');
  console.log('   sdk.indexer.transactions.getTransactionsByUser(address, options)');
  console.log('     - Query transactions for any address');
  console.log('');
  console.log('   sdk.indexer.withdrawals.getWithdrawalStatus(txHash)');
  console.log('     - Get withdrawal status');
  console.log('');

  // Cleanup
  sdk.shutdown();
  console.log('✅ Example completed\n');
}

// =============================================================================
// RUN
// =============================================================================

main().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
