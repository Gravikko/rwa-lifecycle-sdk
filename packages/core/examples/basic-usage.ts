/**
 * Core SDK - Basic Usage Examples
 *
 * The Core SDK provides high-level convenience methods that combine
 * multiple modules (bridge, gas, indexer, compliance) for common workflows.
 *
 * For comprehensive examples, see the root /examples directory:
 * - 01-complete-deposit-workflow.ts
 * - 02-complete-withdrawal-workflow.ts
 * - 03-monitor-transactions.ts
 * - 04-batch-operations.ts
 *
 * Run: pnpm tsx basic-usage.ts
 */

import { RWALifecycleSDK } from '../src/SDK.js';
import { parseEther, formatEther } from 'viem';

// =============================================================================
// SETUP
// =============================================================================

// Initialize SDK (read-only mode - no private key)
const sdk = new RWALifecycleSDK({
  l1RpcUrl: process.env.L1_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: process.env.L2_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
  network: 'testnet',
});

// =============================================================================
// EXAMPLE 1: Gas Estimation (Read-Only)
// =============================================================================

async function estimateGas() {
  console.log('=== Example 1: Gas Estimation ===\n');

  const tokenAddress = '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385' as `0x${string}`;
  const amount = parseEther('100');

  try {
    // Use the gas module directly for estimation
    const estimate = await sdk.gas.estimateDepositERC20Cost({
      from: '0x742d35Cc6634C0532925a3b844Bc9e7595f72f42' as `0x${string}`,
      l1TokenAddress: tokenAddress,
      l2TokenAddress: tokenAddress,
      amount,
    });

    console.log('Deposit Gas Estimate:');
    console.log(`  Total Fee: ${estimate.formattedInETH} ETH`);
    console.log(`  L2 Execution: ${formatEther(estimate.l2ExecutionFee)} ETH`);
    console.log(`  L1 Data Fee: ${formatEther(estimate.l1DataFee)} ETH`);
    console.log('');
  } catch (error) {
    const err = error as Error;
    console.error('Error:', err.message, '\n');
  }
}

// =============================================================================
// EXAMPLE 2: Compliance Check (Read-Only)
// =============================================================================

async function checkCompliance() {
  console.log('=== Example 2: Compliance Check ===\n');

  const tokenAddress = '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385' as `0x${string}`;
  const fromAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f72f42' as `0x${string}`;
  const toAddress = '0x8ba1f109551bD432803012645Hc136E7aaaaaa' as `0x${string}`;
  const amount = parseEther('100');

  try {
    const result = await sdk.compliance.checkCompliance(
      tokenAddress,
      fromAddress,
      toAddress,
      amount
    );

    console.log('Compliance Result:');
    console.log(`  Compliant: ${result.compliant}`);
    console.log(`  Token Standard: ${result.tokenStandard || 'Unknown'}`);
    if (!result.compliant) {
      console.log(`  Reason: ${result.reason}`);
    }
    console.log('');
  } catch (error) {
    const err = error as Error;
    console.error('Error:', err.message, '\n');
  }
}

// =============================================================================
// EXAMPLE 3: Access Module APIs
// =============================================================================

function showModuleAccess() {
  console.log('=== Example 3: Available Modules ===\n');

  console.log('SDK provides access to these modules:\n');

  console.log('  sdk.gas - Gas estimation module');
  console.log('    - estimateDepositERC20Cost()');
  console.log('    - estimateWithdrawERC20InitiateCost()');
  console.log('    - estimateDepositNFTCost()');
  console.log('');

  console.log('  sdk.compliance - ERC3643 compliance module');
  console.log('    - checkCompliance()');
  console.log('    - isERC3643Token()');
  console.log('');

  console.log('  sdk.indexer - Transaction indexer module');
  console.log('    - transactions.getTransactionsByUser()');
  console.log('    - withdrawals.getWithdrawalStatus()');
  console.log('    - start() / stop()');
  console.log('');

  console.log('  sdk.bridge - Bridge operations (requires wallet)');
  console.log('    - depositERC20()');
  console.log('    - depositNFT()');
  console.log('    - initiateERC20Withdrawal()');
  console.log('');

  console.log('Convenience methods on SDK:');
  console.log('  - estimateAndBridge() - Estimate + optional execute');
  console.log('  - bridgeWithCompliance() - Compliance check + bridge');
  console.log('  - getMyTransactions() - Query user transactions');
  console.log('  - trackWithdrawal() - Track withdrawal status');
  console.log('  - getMyPendingWithdrawals() - List pending');
  console.log('  - getWithdrawalsReadyToProve()');
  console.log('  - getWithdrawalsReadyToFinalize()');
  console.log('');
}

// =============================================================================
// RUN EXAMPLES
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Core SDK - Basic Usage Examples                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  await estimateGas();
  await checkCompliance();
  showModuleAccess();

  console.log('For full examples with bridging, see /examples directory.\n');

  sdk.shutdown();
}

main().catch(console.error);
