import type { Address } from 'viem';
import type { SDKConfig } from './types.js';

// ============================================
// BRIDGE CONTRACT ADDRESSES
// ============================================

/**
 * Mantle Sepolia Testnet bridge contract addresses
 */
export const TESTNET_BRIDGE_CONTRACTS = {
  // L2 (Mantle Sepolia) Contracts - Predeploys
  l2StandardBridge: '0x4200000000000000000000000000000000000010' as Address,
  l2ERC721Bridge: '0x4200000000000000000000000000000000000014' as Address,
  l2CrossDomainMessenger: '0x4200000000000000000000000000000000000007' as Address,
  l2ToL1MessagePasser: '0x4200000000000000000000000000000000000016' as Address,

  // L1 (Ethereum Sepolia) Contracts
  l1StandardBridge: '0x21F308067241B2028503c07bd7cB3751FFab0Fb2' as Address,
  l1ERC721Bridge: '0x94343BeF783Af58f46e23bEB859e4cb11B65C4eb' as Address,
  l1CrossDomainMessenger: '0x37dAC5312e31Adb8BB0802Fc72Ca84DA5cDfcb4c' as Address,
  l2OutputOracle: '0x4121dc8e48Bc6196795eb4867772A5e259fecE07' as Address,
  optimismPortal: '0xB3db4bd5bc225930eD674494F9A4F6a11B8EFBc8' as Address,
} as const;

/**
 * Mantle Mainnet bridge contract addresses
 */
export const MAINNET_BRIDGE_CONTRACTS = {
  // L2 (Mantle) Contracts - Predeploys
  l2StandardBridge: '0x4200000000000000000000000000000000000010' as Address,
  l2ERC721Bridge: '0x4200000000000000000000000000000000000014' as Address,
  l2CrossDomainMessenger: '0x4200000000000000000000000000000000000007' as Address,
  l2ToL1MessagePasser: '0x4200000000000000000000000000000000000016' as Address,

  // L1 (Ethereum Mainnet) Contracts
  l1StandardBridge: '0x95fc37a27a2f68e3a647cdc081f0a89bb47c3012' as Address,
  l1ERC721Bridge: '0x0000000000000000000000000000000000000000' as Address, // Not deployed yet
  l1CrossDomainMessenger: '0x676A795fe6E43C17c668de16730c3F690FEB7120' as Address,
  l2OutputOracle: '0x329664673A05952fE896328A252136c34863f6B9' as Address,
  optimismPortal: '0x291dc3819b863e1d14f44203006020586f1e8062' as Address,
} as const;

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================

/**
 * Default configuration for Mantle Sepolia Testnet
 */
export const TESTNET_DEFAULTS = {
  // Network
  network: 'testnet' as const,
  l1ChainId: 11155111, // Ethereum Sepolia
  l2ChainId: 5003, // Mantle Sepolia

  // RPC URLs (public endpoints - replace with your own for production)
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',

  // Gas Module
  gasOracleAddress: '0x420000000000000000000000000000000000000F' as Address,
  gasBufferPercentage: 10,

  // Indexer Module
  indexerDbPath: './.rwa-data/indexer.db',
  indexerPollInterval: 12000, // 12 seconds (Mantle block time)
  indexerAutoStart: false,

  // Bridge Contracts
  bridgeContracts: TESTNET_BRIDGE_CONTRACTS,
} as const;

/**
 * Default configuration for Mantle Mainnet
 */
export const MAINNET_DEFAULTS = {
  // Network
  network: 'mainnet' as const,
  l1ChainId: 1, // Ethereum Mainnet
  l2ChainId: 5000, // Mantle Mainnet

  // RPC URLs (public endpoints - replace with your own for production)
  l1RpcUrl: 'https://eth.public-rpc.com',
  l2RpcUrl: 'https://rpc.mantle.xyz',

  // Gas Module
  gasOracleAddress: '0x420000000000000000000000000000000000000F' as Address,
  gasBufferPercentage: 10,

  // Indexer Module
  indexerDbPath: './.rwa-data/indexer.db',
  indexerPollInterval: 12000,
  indexerAutoStart: false,

  // Bridge Contracts
  bridgeContracts: MAINNET_BRIDGE_CONTRACTS,
} as const;

/**
 * Default configuration (testnet by default for safety)
 */
export const DEFAULT_CONFIG = TESTNET_DEFAULTS;

// Legacy export for backwards compatibility
export const MAINNET_CONFIG = MAINNET_DEFAULTS;

// ============================================
// CONFIGURATION HELPERS
// ============================================

/**
 * Detect network from chain IDs
 */
export function detectNetwork(
  l2ChainId?: number,
  l1ChainId?: number
): 'mainnet' | 'testnet' {
  if (l2ChainId === 5000 || l1ChainId === 1) {
    return 'mainnet';
  }
  return 'testnet';
}

/**
 * Get bridge contracts for network
 */
export function getBridgeContracts(network: 'mainnet' | 'testnet') {
  return network === 'mainnet' ? MAINNET_BRIDGE_CONTRACTS : TESTNET_BRIDGE_CONTRACTS;
}

/**
 * Merge user config with defaults
 *
 * @param userConfig - Partial user configuration
 * @returns Complete SDK configuration with defaults applied
 */
export function mergeConfig(userConfig: Partial<SDKConfig>): SDKConfig {
  // Detect network from user config or default to testnet
  const network = userConfig.network ?? detectNetwork(userConfig.l2ChainId, userConfig.l1ChainId);
  const defaults = network === 'mainnet' ? MAINNET_DEFAULTS : TESTNET_DEFAULTS;

  // Get bridge contracts (user overrides or defaults)
  const bridgeContracts = {
    ...getBridgeContracts(network),
    ...userConfig.bridgeContracts,
  };

  return {
    // Network
    network,
    l1ChainId: userConfig.l1ChainId ?? defaults.l1ChainId,
    l2ChainId: userConfig.l2ChainId ?? defaults.l2ChainId,

    // RPC URLs (required - no defaults if not provided)
    l1RpcUrl: userConfig.l1RpcUrl ?? defaults.l1RpcUrl,
    l2RpcUrl: userConfig.l2RpcUrl ?? defaults.l2RpcUrl,

    // Wallet
    walletClient: userConfig.walletClient,
    privateKey: userConfig.privateKey,

    // Gas Module
    gasOracleAddress: userConfig.gasOracleAddress ?? defaults.gasOracleAddress,
    gasBufferPercentage: userConfig.gasBufferPercentage ?? defaults.gasBufferPercentage,

    // Indexer Module
    indexerDbPath: userConfig.indexerDbPath ?? defaults.indexerDbPath,
    indexerPollInterval: userConfig.indexerPollInterval ?? defaults.indexerPollInterval,
    indexerAutoStart: userConfig.indexerAutoStart ?? defaults.indexerAutoStart,
    indexerStartBlock: userConfig.indexerStartBlock,

    // Bridge Contracts
    bridgeContracts,
  } as SDKConfig;
}

/**
 * Validate configuration
 *
 * @param config - Configuration to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateConfig(config: SDKConfig): string[] {
  const errors: string[] = [];

  // Required fields
  if (!config.l1RpcUrl) {
    errors.push('l1RpcUrl is required');
  }
  if (!config.l2RpcUrl) {
    errors.push('l2RpcUrl is required');
  }

  // Validate RPC URL format
  if (config.l1RpcUrl && !isValidUrl(config.l1RpcUrl)) {
    errors.push('l1RpcUrl must be a valid URL');
  }
  if (config.l2RpcUrl && !isValidUrl(config.l2RpcUrl)) {
    errors.push('l2RpcUrl must be a valid URL');
  }

  // Validate chain IDs
  if (config.l1ChainId && !Number.isInteger(config.l1ChainId)) {
    errors.push('l1ChainId must be an integer');
  }
  if (config.l2ChainId && !Number.isInteger(config.l2ChainId)) {
    errors.push('l2ChainId must be an integer');
  }

  // Validate buffer percentage
  if (config.gasBufferPercentage !== undefined) {
    if (config.gasBufferPercentage < 0 || config.gasBufferPercentage > 100) {
      errors.push('gasBufferPercentage must be between 0 and 100');
    }
  }

  // Validate poll interval
  if (config.indexerPollInterval !== undefined) {
    if (config.indexerPollInterval < 1000) {
      errors.push('indexerPollInterval must be at least 1000ms');
    }
  }

  return errors;
}

/**
 * Check if string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}
