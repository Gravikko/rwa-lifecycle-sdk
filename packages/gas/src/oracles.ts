/**
 * Gas Oracle Contract Addresses
 *
 * The GasPriceOracle is a predeployed contract on Mantle that provides
 * gas pricing information including L1 data fees.
 *
 * Same address across all Mantle networks (mainnet and testnet).
 */

import type { Address } from 'viem';

/**
 * GasPriceOracle contract address (same on all Mantle networks)
 */
export const GAS_PRICE_ORACLE_ADDRESS: Address = '0x420000000000000000000000000000000000000F';

/**
 * Mantle Sepolia (Testnet) Gas Oracle Configuration
 */
export const MANTLE_SEPOLIA_GAS_ORACLE = {
  gasPriceOracle: GAS_PRICE_ORACLE_ADDRESS,
} as const;

/**
 * Mantle Mainnet Gas Oracle Configuration
 */
export const MANTLE_MAINNET_GAS_ORACLE = {
  gasPriceOracle: GAS_PRICE_ORACLE_ADDRESS,
} as const;

/**
 * Get gas oracle address for a specific network
 *
 * @param network - 'mainnet' or 'testnet'
 * @returns Gas oracle contract address
 */
export function getGasOracleAddress(network: 'mainnet' | 'testnet'): Address {
  // Same address on both networks
  return GAS_PRICE_ORACLE_ADDRESS;
}

/**
 * Get gas oracle configuration for a specific network
 *
 * @param network - 'mainnet' or 'testnet'
 * @returns Gas oracle configuration object
 */
export function getGasOracleConfig(network: 'mainnet' | 'testnet') {
  return network === 'mainnet'
    ? MANTLE_MAINNET_GAS_ORACLE
    : MANTLE_SEPOLIA_GAS_ORACLE;
}
