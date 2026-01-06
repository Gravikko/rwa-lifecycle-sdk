/**
 * RWA Lifecycle SDK - Core Package
 * Main entry point for the SDK
 *
 * @example
 * ```typescript
 * import { RWALifecycleSDK } from '@rwa-lifecycle/core';
 *
 * const sdk = new RWALifecycleSDK({
 *   l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
 *   l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
 * });
 *
 * // Use modules
 * const gasEstimate = await sdk.gas.estimateDepositERC20Cost(...);
 * const complianceResult = await sdk.compliance.checkCompliance(...);
 * ```
 */

// ============================================
// MAIN SDK
// ============================================

export { RWALifecycleSDK } from './SDK.js';

// ============================================
// CONFIGURATION
// ============================================

export {
  // Default configurations
  DEFAULT_CONFIG,
  MAINNET_CONFIG,
  TESTNET_DEFAULTS,
  MAINNET_DEFAULTS,

  // Bridge contract addresses
  TESTNET_BRIDGE_CONTRACTS,
  MAINNET_BRIDGE_CONTRACTS,

  // Configuration utilities
  mergeConfig,
  validateConfig,
  detectNetwork,
  getBridgeContracts,
} from './config.js';

// ============================================
// TYPES
// ============================================

// Export all types (including re-exports from modules)
export * from './types.js';

// Also export the WithdrawalStatus enum directly (most common use case)
export { WithdrawalStatus } from './types.js';
