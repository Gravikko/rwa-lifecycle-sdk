/**
 * Example 4: Batch Operations
 *
 * This example demonstrates efficient batch processing:
 * 1. Batch gas estimation for multiple tokens
 * 2. Parallel compliance checks
 * 3. Sequential deposit processing
 * 4. Error handling for partial failures
 *
 * Run: pnpm tsx 04-batch-operations.ts
 */

import { RWALifecycleSDK } from '@rwa-lifecycle/core';
import { parseEther, formatEther } from 'viem';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// =============================================================================
// CONFIGURATION
// =============================================================================

// Define batch of tokens to deposit
const tokensToDeposit: Array<{
  name: string;
  l1Address: `0x${string}`;
  amount: bigint;
}> = [
  {
    name: 'Token A',
    l1Address: '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385',
    amount: parseEther('100'),
  },
  // Add more tokens as needed
  // {
  //   name: 'Token B',
  //   l1Address: '0x...',
  //   amount: parseEther('50'),
  // },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// MAIN BATCH PROCESSING
// =============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              Batch Operations Example                     ║');
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

  const userAddress = sdk.getL1WalletClient()?.account?.address;

  if (!userAddress) {
    console.error('❌ Error: Could not get wallet address');
    process.exit(1);
  }

  console.log(`✅ SDK initialized`);
  console.log(`   User: ${userAddress}`);
  console.log(`   Batch size: ${tokensToDeposit.length} tokens\n`);

  // ---------------------------------------------------------------------------
  // Step 1: Batch Gas Estimation
  // ---------------------------------------------------------------------------

  console.log('⛽ Estimating gas costs for all tokens...\n');

  interface EstimateResult {
    token: typeof tokensToDeposit[0];
    estimate: { formattedInETH: string; totalFee: bigint } | null;
    success: boolean;
    error?: string;
  }

  const estimates: EstimateResult[] = [];
  let totalCost = 0n;

  console.log('┌─────────────┬───────────────────────┬──────────────┐');
  console.log('│ Token       │ Amount                │ Est. Cost    │');
  console.log('├─────────────┼───────────────────────┼──────────────┤');

  for (const token of tokensToDeposit) {
    try {
      const result = await sdk.estimateAndBridge({
        tokenAddress: token.l1Address,
        amount: token.amount,
        direction: 'deposit',
        dryRun: true,
      });

      estimates.push({
        token,
        estimate: result.estimate,
        success: true,
      });

      totalCost += result.estimate.totalFee;

      console.log(
        `│ ${token.name.padEnd(11)} │ ${formatEther(token.amount).padEnd(21)} │ ${result.estimate.formattedInETH.padEnd(12)} │`
      );
    } catch (error) {
      const err = error as Error;
      estimates.push({
        token,
        estimate: null,
        success: false,
        error: err.message,
      });

      console.log(
        `│ ${token.name.padEnd(11)} │ ${formatEther(token.amount).padEnd(21)} │ ERROR        │`
      );
    }
  }

  console.log('└─────────────┴───────────────────────┴──────────────┘');
  console.log(`                                Total: ${formatEther(totalCost)} ETH\n`);

  // Check for estimation failures
  const failedEstimates = estimates.filter((e) => !e.success);
  if (failedEstimates.length > 0) {
    console.log(`⚠️  ${failedEstimates.length} token(s) failed estimation:`);
    failedEstimates.forEach((f) => {
      console.log(`   - ${f.token.name}: ${f.error}`);
    });
    console.log('');
  }

  // ---------------------------------------------------------------------------
  // Step 2: Parallel Compliance Checks
  // ---------------------------------------------------------------------------

  console.log('🔒 Checking compliance for all tokens (parallel)...\n');

  const complianceResults = await Promise.allSettled(
    tokensToDeposit.map(async (token) => {
      const result = await sdk.compliance.checkCompliance(
        token.l1Address,
        userAddress,
        userAddress,
        token.amount
      );
      return { token, result };
    })
  );

  console.log('┌─────────────┬────────────────┬─────────────────────┐');
  console.log('│ Token       │ Token Type     │ Compliance Status   │');
  console.log('├─────────────┼────────────────┼─────────────────────┤');

  complianceResults.forEach((check, index) => {
    const token = tokensToDeposit[index];

    if (check.status === 'fulfilled') {
      const { result } = check.value;
      const status = result.compliant ? '✅ Compliant' : '❌ Not Compliant';
      const tokenType = result.tokenStandard || 'Unknown';
      console.log(
        `│ ${token.name.padEnd(11)} │ ${tokenType.padEnd(14)} │ ${status.padEnd(19)} │`
      );
    } else {
      console.log(`│ ${token.name.padEnd(11)} │ N/A            │ ⚠️  Check Failed     │`);
    }
  });

  console.log('└─────────────┴────────────────┴─────────────────────┘\n');

  // Filter to compliant tokens
  const compliantTokens = tokensToDeposit.filter((_, index) => {
    const check = complianceResults[index];
    return check.status === 'fulfilled' && check.value.result.compliant;
  });

  console.log(`✅ ${compliantTokens.length}/${tokensToDeposit.length} tokens passed compliance\n`);

  if (compliantTokens.length === 0) {
    console.log('❌ No compliant tokens to deposit\n');
    sdk.shutdown();
    process.exit(0);
  }

  // ---------------------------------------------------------------------------
  // Step 3: Confirm Batch Operation
  // ---------------------------------------------------------------------------

  console.log('📝 Batch Operation Summary:');
  console.log(`   Tokens to deposit: ${compliantTokens.length}`);
  console.log(`   Total estimated cost: ${formatEther(totalCost)} ETH`);
  console.log(`   Strategy: Sequential processing (avoids nonce conflicts)\n`);

  // ---------------------------------------------------------------------------
  // Step 4: Sequential Deposit Processing
  // ---------------------------------------------------------------------------

  console.log('🚀 Starting batch deposits...\n');

  interface DepositResult {
    token: typeof tokensToDeposit[0];
    success: boolean;
    txHash?: `0x${string}`;
    error?: string;
  }

  const results: DepositResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < compliantTokens.length; i++) {
    const token = compliantTokens[i];
    const progress = `[${i + 1}/${compliantTokens.length}]`;

    console.log(`${progress} Processing ${token.name}...`);
    console.log(`   Amount: ${formatEther(token.amount)} tokens`);

    try {
      const result = await sdk.estimateAndBridge({
        tokenAddress: token.l1Address,
        amount: token.amount,
        direction: 'deposit',
        dryRun: false,
      });

      if (result.executed && result.txHash) {
        console.log(`   ✅ Success! Hash: ${result.txHash}`);
        console.log(`   Explorer: https://sepolia.etherscan.io/tx/${result.txHash}\n`);

        results.push({
          token,
          success: true,
          txHash: result.txHash,
        });

        successCount++;
      } else {
        console.log(`   ⚠️  Not executed: ${result.reason || 'Unknown'}\n`);

        results.push({
          token,
          success: false,
          error: result.reason,
        });

        failureCount++;
      }

      // Wait between transactions to ensure proper nonce ordering
      if (i < compliantTokens.length - 1) {
        console.log('   ⏳ Waiting 15 seconds before next deposit...\n');
        await sleep(15000);
      }
    } catch (error) {
      const err = error as Error;
      console.log(`   ❌ Failed: ${err.message}\n`);

      results.push({
        token,
        success: false,
        error: err.message,
      });

      failureCount++;
      console.log('   ⚠️  Continuing with next token...\n');
    }
  }

  // ---------------------------------------------------------------------------
  // Step 5: Results Summary
  // ---------------------------------------------------------------------------

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              Batch Operation Complete                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📊 Results Summary:\n');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📝 Total: ${results.length}\n`);

  if (successCount > 0) {
    console.log('✅ Successful Deposits:\n');
    results
      .filter((r) => r.success)
      .forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.token.name}`);
        console.log(`      Hash: ${r.txHash}`);
        console.log(`      Amount: ${formatEther(r.token.amount)} tokens\n`);
      });
  }

  if (failureCount > 0) {
    console.log('❌ Failed Deposits:\n');
    results
      .filter((r) => !r.success)
      .forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.token.name}`);
        console.log(`      Error: ${r.error}\n`);
      });
  }

  // ---------------------------------------------------------------------------
  // Tips
  // ---------------------------------------------------------------------------

  console.log('💡 Tips:\n');
  console.log('   1. Batch estimation before execution saves failed transactions');
  console.log('   2. Parallel compliance checks reduce total time');
  console.log('   3. Sequential execution prevents nonce conflicts');
  console.log('   4. Consider depositing during low gas price periods');
  console.log('   5. Use the relayer for automated withdrawal finalization\n');

  sdk.shutdown();
}

// =============================================================================
// RUN
// =============================================================================

main()
  .then(() => {
    console.log('✅ Batch operations example completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
