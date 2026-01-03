/**
 * Gas Module - Basic Usage Examples
 *
 * This file demonstrates how to use the Gas Module to estimate
 * transaction costs for Mantle L2 operations.
 */

import { createPublicClient, http, parseEther } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { GasModule } from '@rwa-lifecycle/gas';

// =============================================================================
// SETUP
// =============================================================================

// Create L1 public client (Ethereum)
const l1Client = createPublicClient({
  chain: sepolia, // Use mainnet for production
  transport: http(process.env.L1_RPC_URL || 'https://eth-sepolia.public.blastapi.io'),
});

// Create L2 public client (Mantle)
const l2Client = createPublicClient({
  chain: {
    id: 5003, // Mantle Sepolia Testnet (use 5000 for Mantle Mainnet)
    name: 'Mantle Sepolia',
    nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
    rpcUrls: {
      default: { http: [process.env.L2_RPC_URL || 'https://rpc.sepolia.mantle.xyz'] },
      public: { http: [process.env.L2_RPC_URL || 'https://rpc.sepolia.mantle.xyz'] },
    },
  },
  transport: http(process.env.L2_RPC_URL || 'https://rpc.sepolia.mantle.xyz'),
});

// Initialize Gas Module
const gasModule = new GasModule({
  l1PublicClient: l1Client,
  l2PublicClient: l2Client,
  network: 'testnet', // Use 'mainnet' for production
  bufferPercentage: 15, // Add 15% safety buffer (default is 10%)
});

// =============================================================================
// EXAMPLE 1: Estimate ERC20 Deposit Cost (L1 → L2)
// =============================================================================

async function estimateERC20Deposit() {
  console.log('\n=== Example 1: ERC20 Deposit (L1 → L2) ===\n');

  const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const l1TokenAddress = '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385'; // Sepolia USDT
  const l2TokenAddress = '0x...' // Corresponding L2 token address;
  const amount = parseEther('100'); // 100 tokens

  try {
    const estimate = await gasModule.estimateDepositERC20Cost({
      from: userAddress,
      l1TokenAddress,
      l2TokenAddress,
      amount,
      minGasLimit: 200000, // Optional: minimum gas limit for L2 execution
    });

    console.log('Deposit Cost Estimate:');
    console.log(`  Total Cost: ${estimate.formattedInETH} ETH`);
    console.log(`  L2 Execution: ${estimate.l2ExecutionFee} wei (minimal)`);
    console.log(`  L1 Gas: ${estimate.breakdown.l2GasEstimate} units`);

    // Format detailed breakdown
    console.log('\n' + gasModule.formatCostBreakdown(estimate));

    // Check if user has sufficient balance
    const balanceCheck = await gasModule.checkSufficientBalance(
      userAddress,
      estimate,
      true // Check L1 balance (deposit happens on L1)
    );

    if (!balanceCheck.hasSufficientBalance) {
      console.log(`\n⚠️  Insufficient balance!`);
      console.log(`  Required: ${estimate.formattedInETH} ETH`);
      console.log(`  Current: ${balanceCheck.currentBalance} wei`);
      console.log(`  Shortfall: ${balanceCheck.shortfall} wei`);
    } else {
      console.log(`\n✅ Sufficient balance for deposit`);
    }
  } catch (error) {
    console.error('Error estimating deposit cost:', error);
  }
}

// =============================================================================
// EXAMPLE 2: Estimate ERC721 (NFT) Deposit Cost
// =============================================================================

async function estimateNFTDeposit() {
  console.log('\n=== Example 2: NFT Deposit (L1 → L2) ===\n');

  const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const l1NFTAddress = '0x...'; // Your NFT contract on L1
  const l2NFTAddress = '0x...'; // Corresponding L2 NFT contract
  const tokenId = 42n; // Token ID to bridge

  try {
    const estimate = await gasModule.estimateDepositNFTCost({
      from: userAddress,
      l1TokenAddress: l1NFTAddress,
      l2TokenAddress: l2NFTAddress,
      tokenId,
    });

    console.log('NFT Deposit Cost:');
    console.log(`  Total: ${estimate.formattedInETH} ETH`);
    console.log(`  (NFT deposits typically cost more than ERC20 due to larger calldata)`);
  } catch (error) {
    console.error('Error estimating NFT deposit:', error);
  }
}

// =============================================================================
// EXAMPLE 3: Estimate Withdrawal Initiation Cost (L2 → L1)
// =============================================================================

async function estimateWithdrawal() {
  console.log('\n=== Example 3: Withdrawal Initiation (L2 → L1) ===\n');

  const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const l1TokenAddress = '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385';
  const l2TokenAddress = '0x...';
  const amount = parseEther('50');

  try {
    const estimate = await gasModule.estimateWithdrawERC20InitiateCost({
      from: userAddress,
      l1TokenAddress,
      l2TokenAddress,
      amount,
    });

    console.log('Withdrawal Initiation Cost:');
    console.log(`  Total: ${estimate.formattedInMNT} MNT`);
    console.log(`  L2 Execution: ${estimate.formattedInETH} ETH equivalent`);
    console.log(`  L1 Data Fee: ${estimate.l1DataFee} wei`);
    console.log('\nNote: This is only the FIRST step. You will also need:');
    console.log('  - Prove transaction (after 7-day challenge period)');
    console.log('  - Finalize transaction');
    console.log('\nSee Example 4 for complete withdrawal cost.');
  } catch (error) {
    console.error('Error estimating withdrawal:', error);
  }
}

// =============================================================================
// EXAMPLE 4: Complete Withdrawal Cost (All 3 Phases)
// =============================================================================

async function estimateCompleteWithdrawal() {
  console.log('\n=== Example 4: Complete Withdrawal Cost (3 Phases) ===\n');

  const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const l1TokenAddress = '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385';
  const l2TokenAddress = '0x...';
  const amount = parseEther('50');

  try {
    const estimate = await gasModule.estimateCompleteWithdrawalCost({
      from: userAddress,
      tokenType: 'erc20',
      l1TokenAddress,
      l2TokenAddress,
      amount,
    });

    console.log('Complete Withdrawal Cost Breakdown:\n');

    console.log('Phase 1 - Initiate (L2):');
    console.log(`  Cost: ${estimate.initiate.formattedInMNT} MNT`);
    console.log(`  Timing: Immediate\n`);

    console.log('Phase 2 - Prove (L1):');
    console.log(`  Cost: ${estimate.prove.formattedInETH} ETH`);
    console.log(`  Timing: After 7-day challenge period\n`);

    console.log('Phase 3 - Finalize (L1):');
    console.log(`  Cost: ${estimate.finalize.formattedInETH} ETH`);
    console.log(`  Timing: After proving\n`);

    console.log('─'.repeat(50));
    console.log('TOTAL WITHDRAWAL COST:');
    console.log(`  ${estimate.total.formattedInETH} ETH`);
    console.log(`  (${estimate.total.formattedInMNT} MNT equivalent)`);
    console.log('─'.repeat(50));

    console.log('\n💡 Pro Tip: Withdrawals take 7+ days and cost ~3 transactions.');
    console.log('   Consider batching multiple withdrawals if possible!');
  } catch (error) {
    console.error('Error estimating complete withdrawal:', error);
  }
}

// =============================================================================
// EXAMPLE 5: Generic Transaction Cost Estimation
// =============================================================================

async function estimateCustomTransaction() {
  console.log('\n=== Example 5: Custom Transaction Estimation ===\n');

  const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const contractAddress = '0x...'; // Your contract address
  const calldata = '0x...'; // Encoded function call

  try {
    const estimate = await gasModule.estimateTotalCost({
      from: userAddress,
      to: contractAddress,
      data: calldata,
      value: 0n, // No ETH being sent
    });

    console.log('Custom Transaction Cost:');
    console.log(gasModule.formatCostBreakdown(estimate));
  } catch (error) {
    console.error('Error estimating transaction:', error);
  }
}

// =============================================================================
// EXAMPLE 6: Compare Costs Across Different Operations
// =============================================================================

async function compareCosts() {
  console.log('\n=== Example 6: Cost Comparison ===\n');

  const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const l1Token = '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385';
  const l2Token = '0x...';

  try {
    // Estimate deposit
    const depositEstimate = await gasModule.estimateDepositERC20Cost({
      from: userAddress,
      l1TokenAddress: l1Token,
      l2TokenAddress: l2Token,
      amount: parseEther('100'),
    });

    // Estimate withdrawal
    const withdrawalEstimate = await gasModule.estimateCompleteWithdrawalCost({
      from: userAddress,
      tokenType: 'erc20',
      l1TokenAddress: l1Token,
      l2TokenAddress: l2Token,
      amount: parseEther('100'),
    });

    console.log('Cost Comparison for 100 tokens:\n');
    console.log(`Deposit (L1 → L2):  ${depositEstimate.formattedInETH} ETH`);
    console.log(`Withdrawal (L2 → L1): ${withdrawalEstimate.total.formattedInETH} ETH`);
    console.log(`\nDifference: ${
      (Number(withdrawalEstimate.total.formattedInETH) - Number(depositEstimate.formattedInETH)).toFixed(6)
    } ETH`);
    console.log('\n💰 Withdrawals are significantly more expensive due to proof verification!');
  } catch (error) {
    console.error('Error comparing costs:', error);
  }
}

// =============================================================================
// EXAMPLE 7: Error Handling
// =============================================================================

async function handleErrors() {
  console.log('\n=== Example 7: Error Handling ===\n');

  try {
    await gasModule.estimateDepositERC20Cost({
      from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      l1TokenAddress: '0xinvalid', // Invalid address
      l2TokenAddress: '0x...',
      amount: parseEther('100'),
    });
  } catch (error) {
    if (error.name === 'RPCError') {
      console.log('❌ RPC Error:', error.message);
      console.log('   Check your RPC endpoints and network connectivity');
    } else if (error.name === 'GasOracleError') {
      console.log('❌ Gas Oracle Error:', error.message);
      console.log('   The gas oracle contract may be unavailable');
    } else {
      console.log('❌ Unknown Error:', error);
    }
  }
}

// =============================================================================
// RUN ALL EXAMPLES
// =============================================================================

async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Mantle Gas Module - Usage Examples                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await estimateERC20Deposit();
  await estimateNFTDeposit();
  await estimateWithdrawal();
  await estimateCompleteWithdrawal();
  await estimateCustomTransaction();
  await compareCosts();
  await handleErrors();

  console.log('\n✅ All examples completed!\n');
}

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  estimateERC20Deposit,
  estimateNFTDeposit,
  estimateWithdrawal,
  estimateCompleteWithdrawal,
  estimateCustomTransaction,
  compareCosts,
  handleErrors,
};
