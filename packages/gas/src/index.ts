/**
 * Gas Module - Estimates gas costs for Mantle L2 transactions
 *
 * This module provides accurate gas cost estimation including:
 * - L2 Execution Fee (Mantle gas cost)
 * - L1 Data Fee (Ethereum posting cost)
 * - Complete withdrawal cost estimation (all 3 phases)
 *
 * @example
 * ```typescript
 * import { GasModule } from '@rwa-lifecycle/gas';
 *
 * const gasModule = new GasModule({
 *   l1PublicClient,
 *   l2PublicClient,
 *   network: 'testnet',
 * });
 *
 * const estimate = await gasModule.estimateDepositERC20Cost({
 *   from: userAddress,
 *   l1TokenAddress,
 *   l2TokenAddress,
 *   amount: parseEther('100'),
 * });
 *
 * console.log(`Total cost: ${estimate.formattedInETH} ETH`);
 * ```
 */

// ============================================
// MAIN CLASS
// ============================================

export { GasModule } from './GasModule.js';

// ============================================
// TYPES
// ============================================

export type {
  GasConfig,
  GasCostEstimate,
  TransactionType,
  GasEstimateOptions,
} from './types.js';

// ============================================
// ERRORS
// ============================================

export {
  GasEstimationError,
  RPCError,
  GasOracleError,
} from './GasModule.js';

// ============================================
// CONSTANTS
// ============================================

export {
  GAS_PRICE_ORACLE_ADDRESS,
  MANTLE_SEPOLIA_GAS_ORACLE,
  MANTLE_MAINNET_GAS_ORACLE,
  getGasOracleAddress,
  getGasOracleConfig,
} from './oracles.js';

export { GAS_PRICE_ORACLE_ABI } from './abi/GasOracle.js';
