/**
 * Example 2: Complete Withdrawal Workflow (L2 → L1)
 *
 * This example demonstrates the full 3-phase withdrawal process:
 * - Phase 1: Initiate withdrawal on L2 (burn tokens)
 * - Phase 2: Prove withdrawal on L1 (after challenge period ~12 hours)
 * - Phase 3: Finalize withdrawal on L1 (unlock tokens)
 *
 * NOTE: This is a long-running example. In production, you would
 * typically run each phase as a separate operation.
 *
 * Run: pnpm tsx 02-complete-withdrawal-workflow.ts
 */

import { RWALifecycleSDK } from '@rwa-lifecycle/core';
import { parseEther, formatEther } from 'viem';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// =============================================================================
// CONFIGURATION
// =============================================================================

const L1_TOKEN_ADDRESS = (process.env.L1_TOKEN_ADDRESS || '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385') as `0x${string}`;
const WITHDRAWAL_AMOUNT = parseEther('50'); // 50 tokens

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// MAIN WORKFLOW
// =============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     Complete Withdrawal Workflow (L2 → L1)               ║');
  console.log('║           3-Phase Process (~12+ hours)                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // ---------------------------------------------------------------------------
  // Initialize SDK
  // ---------------------------------------------------------------------------

  console.log('📦 Initializing SDK...\n');

  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;

  if (!privateKey) {
    console.error('❌ Error: PRIVATE_KEY not found in .env file\n');
    process.exit(1);
  }

  const sdk = new RWALifecycleSDK({
    l1RpcUrl: process.env.L1_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
    l2RpcUrl: process.env.L2_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
    privateKey,
    network: 'testnet',
  });

  const userAddress = sdk.getL2WalletClient()?.account?.address;

  if (!userAddress) {
    console.error('❌ Error: Could not get wallet address');
    process.exit(1);
  }

  console.log(`✅ SDK initialized`);
  console.log(`   User address: ${userAddress}\n`);

  // ---------------------------------------------------------------------------
  // Estimate Complete Withdrawal Cost
  // ---------------------------------------------------------------------------

  console.log('⛽ Estimating withdrawal initiation cost...\n');

  try {
    const estimate = await sdk.estimateAndBridge({
      tokenAddress: L1_TOKEN_ADDRESS,
      amount: WITHDRAWAL_AMOUNT,
      direction: 'withdrawal',
      dryRun: true,
    });

    console.log('💰 Initiation Cost Estimate:');
    console.log(`   Total: ${estimate.estimate.formattedInETH} ETH`);
    console.log(`   L2 Execution: ${formatEther(estimate.estimate.l2ExecutionFee)} ETH`);
    console.log(`   L1 Data Fee: ${formatEther(estimate.estimate.l1DataFee)} ETH\n`);

    console.log('⚠️  Important Notes:');
    console.log('   - Withdrawals take 12+ hours (testnet) or 7+ days (mainnet)');
    console.log('   - You need ETH on L1 for prove & finalize phases');
    console.log('   - Consider using the relayer service for automation\n');

  } catch (error) {
    const err = error as Error;
    console.error('❌ Failed to estimate withdrawal cost:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // PHASE 1: Initiate Withdrawal on L2
  // ---------------------------------------------------------------------------

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         PHASE 1: Initiate Withdrawal (L2)                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📝 Withdrawal Summary:');
  console.log(`   Token: ${L1_TOKEN_ADDRESS}`);
  console.log(`   Amount: ${formatEther(WITHDRAWAL_AMOUNT)} tokens`);
  console.log(`   From: L2 (Mantle)`);
  console.log(`   To: L1 (Ethereum)\n`);

  console.log('🚀 Initiating withdrawal on L2...\n');

  let initiateTxHash: `0x${string}` | undefined;

  try {
    const result = await sdk.estimateAndBridge({
      tokenAddress: L1_TOKEN_ADDRESS,
      amount: WITHDRAWAL_AMOUNT,
      direction: 'withdrawal',
      dryRun: false,
    });

    if (result.executed && result.txHash) {
      initiateTxHash = result.txHash;

      console.log('✅ Phase 1 complete! Withdrawal initiated on L2');
      console.log(`   Transaction Hash: ${initiateTxHash}`);
      console.log(`   Explorer: https://sepolia.mantlescan.xyz/tx/${initiateTxHash}\n`);
    } else {
      console.log('ℹ️  Transaction not executed');
      console.log(`   Reason: ${result.reason || 'Unknown'}\n`);
      sdk.shutdown();
      process.exit(0);
    }
  } catch (error) {
    const err = error as Error;
    console.error('❌ Failed to initiate withdrawal:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Wait for Challenge Period (Demo: just track status)
  // ---------------------------------------------------------------------------

  console.log('⏳ Tracking withdrawal status...');
  console.log('   (Testnet: ~12 hours, Mainnet: ~7 days)\n');

  console.log('💡 In production, you would:');
  console.log('   1. Save the transaction hash');
  console.log('   2. Check status periodically');
  console.log('   3. Run prove/finalize when ready\n');

  // Check initial status
  try {
    const status = await sdk.trackWithdrawal(initiateTxHash);

    if (status) {
      console.log('📊 Current Withdrawal Status:');
      console.log(`   Phase: ${status.phase}`);
      console.log(`   Can Prove: ${status.canProve}`);
      console.log(`   Can Finalize: ${status.canFinalize}`);

      if (status.estimatedReadyToProve) {
        const now = Date.now() / 1000;
        const timeLeft = Math.max(0, Number(status.estimatedReadyToProve) - now);
        console.log(`   Estimated ready to prove in: ${formatTime(Math.floor(timeLeft))}`);
      }
      console.log('');
    }
  } catch (error) {
    const err = error as Error;
    console.log(`⚠️  Could not track status: ${err.message}\n`);
  }

  // ---------------------------------------------------------------------------
  // Summary and Next Steps
  // ---------------------------------------------------------------------------

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              Phase 1 Complete! 🎉                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📋 Next Steps:\n');
  console.log('   PHASE 2 - Prove (after challenge period):');
  console.log('   ─────────────────────────────────────────');
  console.log('   Check if ready:');
  console.log(`     const status = await sdk.trackWithdrawal('${initiateTxHash}');`);
  console.log('     if (status.canProve) { ... }');
  console.log('');
  console.log('   Or use CLI:');
  console.log(`     rwa track-withdrawal ${initiateTxHash}`);
  console.log('');
  console.log('   PHASE 3 - Finalize (after proving):');
  console.log('   ───────────────────────────────────');
  console.log('   Check if ready:');
  console.log('     if (status.canFinalize) { ... }');
  console.log('');

  console.log('💡 Pro Tips:');
  console.log('   - Use sdk.getMyPendingWithdrawals() to list all pending');
  console.log('   - Use sdk.getWithdrawalsReadyToProve() to find actionable ones');
  console.log('   - Use sdk.getWithdrawalsReadyToFinalize() for final step\n');

  console.log('🤖 Automated Option:');
  console.log('   Use the relayer service to automatically prove & finalize:');
  console.log('   rwa-relayer start\n');

  sdk.shutdown();
}

// =============================================================================
// RUN
// =============================================================================

main()
  .then(() => {
    console.log('✅ Example completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
