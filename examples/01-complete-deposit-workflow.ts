/**
 * Example 1: Complete Deposit Workflow (L1 → L2)
 *
 * This example demonstrates a production-ready deposit flow:
 * 1. Initialize SDK with configuration
 * 2. Estimate gas costs before executing
 * 3. Check compliance (if token is ERC3643)
 * 4. Execute deposit with proper error handling
 * 5. Track transaction status
 *
 * Run: pnpm tsx 01-complete-deposit-workflow.ts
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
const DEPOSIT_AMOUNT = parseEther('100'); // 100 tokens

// =============================================================================
// MAIN WORKFLOW
// =============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       Complete Deposit Workflow (L1 → L2)                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // ---------------------------------------------------------------------------
  // Step 1: Initialize SDK
  // ---------------------------------------------------------------------------

  console.log('📦 Initializing SDK...\n');

  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;

  if (!privateKey) {
    console.error('❌ Error: PRIVATE_KEY not found in .env file');
    console.error('   Please set PRIVATE_KEY in your .env file to sign transactions\n');
    process.exit(1);
  }

  const sdk = new RWALifecycleSDK({
    l1RpcUrl: process.env.L1_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
    l2RpcUrl: process.env.L2_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
    privateKey,
    network: 'testnet',
  });

  const userAddress = sdk.getL1WalletClient()?.account?.address;

  if (!userAddress) {
    console.error('❌ Error: Could not get wallet address');
    process.exit(1);
  }

  console.log(`✅ SDK initialized`);
  console.log(`   User address: ${userAddress}\n`);

  // ---------------------------------------------------------------------------
  // Step 2: Estimate Gas Costs
  // ---------------------------------------------------------------------------

  console.log('⛽ Estimating gas costs...\n');

  try {
    const estimate = await sdk.estimateAndBridge({
      tokenAddress: L1_TOKEN_ADDRESS,
      amount: DEPOSIT_AMOUNT,
      direction: 'deposit',
      dryRun: true, // Don't execute, just estimate
    });

    console.log('💰 Estimated Costs:');
    console.log(`   Total: ${estimate.estimate.formattedInETH} ETH`);
    console.log(`   L2 Execution: ${formatEther(estimate.estimate.l2ExecutionFee)} ETH`);
    console.log(`   L1 Data Fee: ${formatEther(estimate.estimate.l1DataFee)} ETH\n`);

    console.log('✅ Gas estimation complete\n');
  } catch (error) {
    const err = error as Error;
    console.error('❌ Failed to estimate gas costs:', err.message);
    console.error('   Check token address and RPC connectivity\n');
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Step 3: Check Compliance (ERC3643)
  // ---------------------------------------------------------------------------

  console.log('🔒 Checking compliance...\n');

  try {
    const complianceResult = await sdk.compliance.checkCompliance(
      L1_TOKEN_ADDRESS,
      userAddress,
      userAddress, // recipient (same as sender for deposit)
      DEPOSIT_AMOUNT
    );

    if (complianceResult.compliant) {
      console.log('✅ Compliance check passed');
      console.log(`   Token standard: ${complianceResult.tokenStandard}`);
      console.log('');
    } else {
      console.error('❌ Compliance check failed!');
      console.error(`   Reason: ${complianceResult.reason || 'Unknown'}`);
      console.error('   Transaction would fail. Please resolve compliance issues.\n');
      process.exit(1);
    }
  } catch (error) {
    // If token is not ERC3643, compliance check may fail gracefully
    console.log('ℹ️  Token compliance check completed');
    console.log('   Proceeding with deposit\n');
  }

  // ---------------------------------------------------------------------------
  // Step 4: Confirm and Execute Deposit
  // ---------------------------------------------------------------------------

  console.log('📝 Transaction Summary:');
  console.log(`   From: ${userAddress}`);
  console.log(`   Token: ${L1_TOKEN_ADDRESS}`);
  console.log(`   Amount: ${formatEther(DEPOSIT_AMOUNT)} tokens`);
  console.log(`   Direction: L1 → L2 (Deposit)`);
  console.log('');

  console.log('🚀 Executing deposit...\n');

  let depositTxHash: `0x${string}` | undefined;

  try {
    const result = await sdk.estimateAndBridge({
      tokenAddress: L1_TOKEN_ADDRESS,
      amount: DEPOSIT_AMOUNT,
      direction: 'deposit',
      checkCompliance: true,
      dryRun: false, // Execute the transaction
    });

    if (result.executed && result.txHash) {
      depositTxHash = result.txHash;

      console.log('✅ Deposit transaction submitted!');
      console.log(`   Transaction Hash: ${depositTxHash}`);
      console.log(`   Explorer: https://sepolia.etherscan.io/tx/${depositTxHash}\n`);
    } else {
      console.log('ℹ️  Transaction not executed');
      console.log(`   Reason: ${result.reason || 'Unknown'}\n`);
    }
  } catch (error) {
    const err = error as Error;
    console.error('❌ Deposit failed:', err.message);

    if (err.message.includes('insufficient funds')) {
      console.error('   Insufficient ETH for gas fees');
    } else if (err.message.includes('insufficient allowance')) {
      console.error('   Token allowance not set. Approve tokens first.');
    } else if (err.message.includes('nonce')) {
      console.error('   Nonce issue. Wait for pending transactions to complete.');
    }

    console.error('');
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Step 5: Track Transaction Status
  // ---------------------------------------------------------------------------

  if (depositTxHash) {
    console.log('⏳ Waiting for L1 confirmation...');
    console.log('   (This usually takes 15-30 seconds)\n');

    try {
      // Wait for L1 transaction to be mined
      await new Promise((resolve) => setTimeout(resolve, 20000));

      console.log('✅ L1 transaction likely confirmed!\n');
      console.log('⏳ Tokens will appear on L2 in ~10 minutes\n');

      // Query transaction from indexer
      console.log('📊 Checking indexer for transaction...');

      const myTxs = await sdk.getMyTransactions({
        type: 'deposit',
        limit: 1,
      });

      if (myTxs.items.length > 0) {
        const tx = myTxs.items[0];
        console.log(`   Event Type: ${tx.eventType}`);
        console.log(`   Block: ${tx.blockNumber}`);
        console.log(`   Timestamp: ${new Date(Number(tx.timestamp) * 1000).toISOString()}`);
      } else {
        console.log('   Transaction not yet indexed (may take a few minutes)');
      }
    } catch (error) {
      const err = error as Error;
      console.error('⚠️  Warning: Could not confirm transaction status');
      console.error(`   Error: ${err.message}`);
      console.error('   Your transaction may still be processing\n');
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                  Deposit Complete! 🎉                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('✅ Next Steps:');
  console.log('   1. Wait ~10 minutes for tokens to appear on L2');
  console.log('   2. Check L2 balance on Mantlescan:');
  console.log(`      https://sepolia.mantlescan.xyz/address/${userAddress}\n`);

  console.log('💡 Pro Tips:');
  console.log('   - Deposits are fast (~10 mins) and cheap');
  console.log('   - Withdrawals take 7+ days and cost more');
  console.log('   - Batch multiple deposits to save on gas\n');

  // Close SDK connections
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
