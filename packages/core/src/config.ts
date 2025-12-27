import type { Address } from 'viem';
import type { SDKConfig } from './types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  // Mantle Sepolia Testnet
  l2ChainId: 5003,
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',

  // Ethereum Sepolia
  l1ChainId: 11155111,
  l1RpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',

  // Gas Oracle (Mantle predeploy)
  gasOracleAddress: '0x420000000000000000000000000000000000000F' as Address,

  // EigenDA
  eigenDABatcherUrl: 'https://disperser.eigenda.xyz',
} as const;

/**
 * Mainnet configuration
 */
export const MAINNET_CONFIG = {
  l2ChainId: 5000,
  l2RpcUrl: 'https://rpc.mantle.xyz',
  l1ChainId: 1,
  l1RpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
  gasOracleAddress: '0x420000000000000000000000000000000000000F' as Address,
  eigenDABatcherUrl: 'https://disperser.eigenda.xyz',
} as const;

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: Partial<SDKConfig>): SDKConfig {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
  } as SDKConfig;
}
