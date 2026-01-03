/**
 * Quick test script for Gas Module
 * Run from project root: npx tsx test-gas-module.ts
 */

import { RWALifecycleSDK } from './packages/core/src/index.js';
import { parseEther } from 'viem';

async function testGasModule() {
  console.log('Testing Gas Module via Core SDK...\n');

  // Initialize SDK
  const sdk = new RWALifecycleSDK({
    l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
    l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
    l1ChainId: 11155111, // Sepolia
    l2ChainId: 5003,     // Mantle Sepolia
  });

  const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

  // Test 1: Simple transaction
  console.log('Test 1: Estimating simple transfer cost...');
  const simpleEstimate = await sdk.gas.estimateTotalCost({
    from: testAddress,
    to: testAddress,
    value: parseEther('0.1'),
  });

  console.log(`  Cost: ${simpleEstimate.formattedInETH} ETH`);
  console.log(`  Cost: ${simpleEstimate.formattedInMNT} MNT`);
  console.log(sdk.gas.formatCostBreakdown(simpleEstimate));

  // Test 2: Check balance
  console.log('\nTest 2: Checking balance...');
  const balanceCheck = await sdk.gas.checkSufficientBalance(
    testAddress,
    simpleEstimate,
    false // L2 balance
  );

  console.log(`  Current: ${balanceCheck.currentBalance} wei`);
  console.log(`  Required: ${balanceCheck.required} wei`);
  console.log(`  Sufficient: ${balanceCheck.hasSufficientBalance ? '✅' : '❌'}`);

  console.log('\n✅ Tests completed successfully!');
}

testGasModule().catch(console.error);
