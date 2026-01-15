/**
 * Compliance Module - Basic Usage Examples
 *
 * The Compliance Module handles ERC3643 security token compliance:
 * - Token standard detection (ERC3643 vs standard ERC20)
 * - Transfer eligibility checks
 * - Identity verification status
 *
 * For comprehensive examples using the full SDK, see /examples directory.
 */

import { RWALifecycleSDK } from '@rwa-lifecycle/core';
import { parseEther } from 'viem';

// =============================================================================
// SETUP
// =============================================================================

const sdk = new RWALifecycleSDK({
  l1RpcUrl: process.env.L1_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: process.env.L2_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
  network: 'testnet',
});

// =============================================================================
// EXAMPLE 1: Check Compliance
// =============================================================================

async function checkCompliance() {
  console.log('=== Example 1: Check Transfer Compliance ===\n');

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

    console.log('Compliance Check Result:');
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
// EXAMPLE 2: Check if Token is ERC3643
// =============================================================================

async function checkTokenStandard() {
  console.log('=== Example 2: Check Token Standard ===\n');

  const tokenAddress = '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385' as `0x${string}`;

  try {
    const isERC3643 = await sdk.compliance.isERC3643Token(tokenAddress);

    console.log(`Token: ${tokenAddress}`);
    console.log(`Is ERC3643: ${isERC3643}`);

    if (isERC3643) {
      console.log('\nThis is a security token with:');
      console.log('  - Identity verification requirements');
      console.log('  - Transfer restrictions');
      console.log('  - Compliance rules');
    } else {
      console.log('\nThis is a standard ERC20 token');
      console.log('  - No identity verification required');
      console.log('  - Standard transfer mechanics');
    }
    console.log('');
  } catch (error) {
    const err = error as Error;
    console.error('Error:', err.message, '\n');
  }
}

// =============================================================================
// API REFERENCE
// =============================================================================

function showApiReference() {
  console.log('=== Compliance Module API Reference ===\n');

  console.log('sdk.compliance.checkCompliance(tokenAddress, from, to, amount, options?)');
  console.log('  - Checks if a transfer is compliant');
  console.log('  - Returns: { compliant, tokenStandard, reason? }');
  console.log('');

  console.log('sdk.compliance.isERC3643Token(tokenAddress)');
  console.log('  - Checks if token implements ERC3643');
  console.log('  - Returns: boolean');
  console.log('');

  console.log('Options for checkCompliance:');
  console.log('  { simulate?: boolean } - Simulate the transfer on-chain');
  console.log('');
}

// =============================================================================
// RUN
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Compliance Module - Basic Usage                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  await checkCompliance();
  await checkTokenStandard();
  showApiReference();

  sdk.shutdown();
}

main().catch(console.error);
