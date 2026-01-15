/**
 * Bridge Module - Basic Usage Examples
 *
 * The Bridge Module handles token bridging between Ethereum L1 and Mantle L2:
 * - ERC20 deposits (L1 → L2)
 * - ERC721 NFT deposits (L1 → L2)
 * - 3-phase withdrawals (L2 → L1): initiate → prove → finalize
 *
 * For comprehensive examples using the full SDK, see /examples directory:
 * - 01-complete-deposit-workflow.ts
 * - 02-complete-withdrawal-workflow.ts
 *
 * This file shows direct BridgeModule usage (advanced).
 */

// =============================================================================
// BRIDGE MODULE API REFERENCE
// =============================================================================

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           Bridge Module - API Reference                     ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('DEPOSIT OPERATIONS (L1 → L2)\n');
console.log('  bridge.depositERC20(tokenAddress, amount, options?)');
console.log('    - Deposits ERC20 tokens from L1 to L2');
console.log('    - Requires token approval first');
console.log('    - Returns: { txHash, ... }');
console.log('');
console.log('  bridge.depositNFT(tokenAddress, tokenId, options?)');
console.log('    - Deposits ERC721 NFT from L1 to L2');
console.log('    - Requires NFT approval first');
console.log('    - Returns: { txHash, ... }');
console.log('');

console.log('WITHDRAWAL OPERATIONS (L2 → L1)\n');
console.log('  Phase 1: bridge.initiateERC20Withdrawal(tokenAddress, amount, options?)');
console.log('    - Initiates withdrawal on L2 (burns tokens)');
console.log('    - Returns: { txHash, ... }');
console.log('');
console.log('  Phase 2: bridge.proveWithdrawal(initiatedTxHash)');
console.log('    - Submits proof to L1 after challenge period');
console.log('    - Testnet: ~12 hours, Mainnet: ~7 days');
console.log('');
console.log('  Phase 3: bridge.finalizeWithdrawal(initiatedTxHash)');
console.log('    - Finalizes withdrawal on L1 (unlocks tokens)');
console.log('    - Called after proof is verified');
console.log('');

console.log('STATUS QUERIES\n');
console.log('  bridge.getWithdrawalStatus(txHash)');
console.log('    - Returns current phase and readiness');
console.log('');

console.log('EXAMPLE USAGE\n');
console.log(`
  import { RWALifecycleSDK } from '@rwa-lifecycle/core';

  const sdk = new RWALifecycleSDK({
    l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
    l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
    privateKey: '0x...',
    network: 'testnet',
  });

  // Deposit using SDK convenience method
  const result = await sdk.estimateAndBridge({
    tokenAddress: '0x...',
    amount: parseEther('100'),
    direction: 'deposit',
  });

  // Or use bridge module directly
  if (sdk.bridge) {
    const deposit = await sdk.bridge.depositERC20(
      '0x...', // token address
      parseEther('100'),
      { to: '0x...' } // optional recipient
    );
    console.log('TX Hash:', deposit.txHash);
  }
`);

console.log('\nFor full working examples, run:');
console.log('  cd /examples && pnpm tsx 01-complete-deposit-workflow.ts\n');
