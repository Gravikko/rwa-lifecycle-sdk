/**
 * Integration Test - Tests Gas Module against real Mantle Sepolia
 *
 * This connects to actual RPC endpoints to verify real-world behavior.
 * No mocks - this tests actual gas estimation on the network.
 */

import { createPublicClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { GasModule } from './src/index.js';

// Test configuration
const TEST_CONFIG = {
  // Use public RPCs (no API key needed for testing)
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',

  // Test addresses (you can use any valid address)
  testAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',

  // Known testnet token addresses
  l1StandardBridge: '0x4200000000000000000000000000000000000010',
  // Add your test token addresses here
  l1TestToken: '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385', // Example: Sepolia USDT
  l2TestToken: '0x...' // Your L2 token address
};

async function runIntegrationTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Gas Module - Integration Tests (Real Network)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Create clients
  console.log('📡 Connecting to networks...');
  const l1Client = createPublicClient({
    chain: sepolia,
    transport: http(TEST_CONFIG.l1RpcUrl),
  });

  const l2Client = createPublicClient({
    chain: {
      id: 5003,
      name: 'Mantle Sepolia',
      nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
      rpcUrls: {
        default: { http: [TEST_CONFIG.l2RpcUrl] },
        public: { http: [TEST_CONFIG.l2RpcUrl] },
      },
    },
    transport: http(TEST_CONFIG.l2RpcUrl),
  });

  // Verify connections
  try {
    const [l1Block, l2Block] = await Promise.all([
      l1Client.getBlockNumber(),
      l2Client.getBlockNumber(),
    ]);
    console.log(`✅ L1 (Sepolia) connected - Block: ${l1Block}`);
    console.log(`✅ L2 (Mantle Sepolia) connected - Block: ${l2Block}\n`);
  } catch (error) {
    console.error('❌ Failed to connect to networks:', error);
    process.exit(1);
  }

  // Initialize Gas Module
  const gasModule = new GasModule({
    l1PublicClient: l1Client,
    l2PublicClient: l2Client,
    network: 'testnet',
    bufferPercentage: 10,
  });

  console.log('🔧 Gas Module initialized\n');

  // Run tests
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Simple L2 Transaction
  console.log('━━━ Test 1: Simple L2 Transaction ━━━');
  totalTests++;
  try {
    const estimate = await gasModule.estimateTotalCost({
      from: TEST_CONFIG.testAddress,
      to: TEST_CONFIG.testAddress,
      value: parseEther('0.01'),
    });

    console.log(`  L2 Execution Fee: ${estimate.l2ExecutionFee} wei`);
    console.log(`  L1 Data Fee: ${estimate.l1DataFee} wei`);
    console.log(`  Total: ${estimate.formattedInETH} ETH`);
    console.log(`  Total: ${estimate.formattedInMNT} MNT`);

    if (estimate.totalFee > 0n) {
      console.log('  ✅ PASSED\n');
      passedTests++;
    } else {
      console.log('  ❌ FAILED: Total fee is 0\n');
    }
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}\n`);
  }

  // Test 2: Gas Oracle Connection
  console.log('━━━ Test 2: Gas Oracle Connection ━━━');
  totalTests++;
  try {
    const oracleAddress = gasModule.getGasOracleAddress();
    console.log(`  Oracle Address: ${oracleAddress}`);

    // Try to read from oracle directly
    const gasPrice = await l2Client.getGasPrice();
    console.log(`  Current L2 Gas Price: ${gasPrice} wei`);

    if (oracleAddress === '0x420000000000000000000000000000000000000F') {
      console.log('  ✅ PASSED\n');
      passedTests++;
    } else {
      console.log('  ❌ FAILED: Unexpected oracle address\n');
    }
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}\n`);
  }

  // Test 3: ERC20 Deposit Estimation (if token addresses provided)
  if (TEST_CONFIG.l2TestToken && TEST_CONFIG.l2TestToken !== '0x...') {
    console.log('━━━ Test 3: ERC20 Deposit Cost ━━━');
    totalTests++;
    try {
      const estimate = await gasModule.estimateDepositERC20Cost({
        from: TEST_CONFIG.testAddress,
        l1TokenAddress: TEST_CONFIG.l1TestToken,
        l2TokenAddress: TEST_CONFIG.l2TestToken,
        amount: parseEther('100'),
      });

      console.log(`  Deposit Cost: ${estimate.formattedInETH} ETH`);
      console.log(`  L2 Fee: ${estimate.l2ExecutionFee} wei (should be 0 for deposits)`);

      if (estimate.totalFee > 0n && estimate.l2ExecutionFee === 0n) {
        console.log('  ✅ PASSED\n');
        passedTests++;
      } else {
        console.log('  ❌ FAILED: Unexpected fee structure\n');
      }
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}\n`);
    }
  } else {
    console.log('━━━ Test 3: ERC20 Deposit Cost ━━━');
    console.log('  ⏭️  SKIPPED: No L2 token address configured\n');
  }

  // Test 4: Withdrawal Estimation
  if (TEST_CONFIG.l2TestToken && TEST_CONFIG.l2TestToken !== '0x...') {
    console.log('━━━ Test 4: Complete Withdrawal Cost ━━━');
    totalTests++;
    try {
      const estimate = await gasModule.estimateCompleteWithdrawalCost({
        from: TEST_CONFIG.testAddress,
        tokenType: 'erc20',
        l1TokenAddress: TEST_CONFIG.l1TestToken,
        l2TokenAddress: TEST_CONFIG.l2TestToken,
        amount: parseEther('50'),
      });

      console.log(`  Phase 1 (Initiate): ${estimate.initiate.formattedInMNT} MNT`);
      console.log(`  Phase 2 (Prove): ${estimate.prove.formattedInETH} ETH`);
      console.log(`  Phase 3 (Finalize): ${estimate.finalize.formattedInETH} ETH`);
      console.log(`  Total: ${estimate.total.formattedInETH} ETH`);

      if (estimate.total.totalFee > 0n) {
        console.log('  ✅ PASSED\n');
        passedTests++;
      } else {
        console.log('  ❌ FAILED: Total fee is 0\n');
      }
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}\n`);
    }
  } else {
    console.log('━━━ Test 4: Complete Withdrawal Cost ━━━');
    console.log('  ⏭️  SKIPPED: No L2 token address configured\n');
  }

  // Test 5: Cost Breakdown Formatting
  console.log('━━━ Test 5: Cost Breakdown Formatting ━━━');
  totalTests++;
  try {
    const estimate = await gasModule.estimateTotalCost({
      from: TEST_CONFIG.testAddress,
      to: TEST_CONFIG.testAddress,
      value: parseEther('0.01'),
    });

    const formatted = gasModule.formatCostBreakdown(estimate);
    console.log(formatted);

    if (formatted.includes('L2 Execution Fee') && formatted.includes('L1 Data Fee')) {
      console.log('  ✅ PASSED\n');
      passedTests++;
    } else {
      console.log('  ❌ FAILED: Formatting incomplete\n');
    }
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}\n`);
  }

  // Test 6: Balance Check
  console.log('━━━ Test 6: Balance Check ━━━');
  totalTests++;
  try {
    const estimate = await gasModule.estimateTotalCost({
      from: TEST_CONFIG.testAddress,
      to: TEST_CONFIG.testAddress,
      value: parseEther('0.01'),
    });

    const balanceCheck = await gasModule.checkSufficientBalance(
      TEST_CONFIG.testAddress,
      estimate,
      false // Check L2 balance
    );

    console.log(`  Current Balance: ${balanceCheck.currentBalance} wei`);
    console.log(`  Required: ${balanceCheck.required} wei`);
    console.log(`  Sufficient: ${balanceCheck.hasSufficientBalance}`);

    if (typeof balanceCheck.hasSufficientBalance === 'boolean') {
      console.log('  ✅ PASSED\n');
      passedTests++;
    } else {
      console.log('  ❌ FAILED: Invalid balance check result\n');
    }
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}\n`);
  }

  // Summary
  console.log('═'.repeat(60));
  console.log(`Test Results: ${passedTests}/${totalTests} passed`);
  console.log('═'.repeat(60));

  if (passedTests === totalTests) {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } else {
    console.log(`❌ ${totalTests - passedTests} test(s) failed\n`);
    process.exit(1);
  }
}

// Run tests
runIntegrationTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
