/**
 * SDK Initialization Helper
 *
 * Creates and manages an SDK instance from CLI configuration.
 */

import { RWALifecycleSDK } from '@rwa-lifecycle/core';
import { loadConfig, validateConfig, type CLIConfig } from './config.js';
import { logger } from './logger.js';
import { CLIError } from './utils/errorHandler.js';

let sdkInstance: RWALifecycleSDK | null = null;

/**
 * Convert CLI config to SDK config
 */
function cliToSdkConfig(cliConfig: CLIConfig) {
  return {
    l1RpcUrl: cliConfig.l1RpcUrl!,
    l2RpcUrl: cliConfig.l2RpcUrl!,
    network: cliConfig.network,
    privateKey: cliConfig.privateKey as `0x${string}` | undefined,
    gasBufferPercentage: cliConfig.gasBufferPercentage,
    indexerDbPath: cliConfig.indexerDbPath,
    indexerPollInterval: cliConfig.indexerPollInterval,
  };
}

/**
 * Initialize SDK from CLI configuration
 *
 * @param options - Override options
 * @returns Initialized SDK instance
 * @throws CLIError if configuration is invalid
 */
export function initSDK(options?: {
  requireWallet?: boolean;
  overrides?: Partial<CLIConfig>;
}): RWALifecycleSDK {
  // Load and validate configuration
  const config = loadConfig(options?.overrides);
  const errors = validateConfig(config);

  if (errors.length > 0) {
    throw new CLIError(
      `Invalid configuration: ${errors.join(', ')}`,
      [
        'Run: rwa init (to create configuration files)',
        'Run: rwa config validate (to see all issues)',
      ]
    );
  }

  // Check wallet requirement
  if (options?.requireWallet && !config.privateKey) {
    throw new CLIError(
      'This command requires a wallet',
      [
        'Set RWA_PRIVATE_KEY in your .env file',
        'Or pass --private-key <key> flag',
      ]
    );
  }

  // Create SDK instance
  try {
    const sdkConfig = cliToSdkConfig(config);
    sdkInstance = new RWALifecycleSDK(sdkConfig);
    logger.debug('SDK initialized successfully');
    return sdkInstance;
  } catch (error) {
    throw new CLIError(
      `Failed to initialize SDK: ${(error as Error).message}`,
      [
        'Check your RPC URLs are correct',
        'Run: rwa config validate',
      ]
    );
  }
}

/**
 * Get existing SDK instance or create new one
 */
export function getSDK(options?: {
  requireWallet?: boolean;
  overrides?: Partial<CLIConfig>;
}): RWALifecycleSDK {
  if (!sdkInstance) {
    return initSDK(options);
  }
  return sdkInstance;
}

/**
 * Shutdown SDK and clean up resources
 */
export function shutdownSDK(): void {
  if (sdkInstance) {
    sdkInstance.shutdown();
    sdkInstance = null;
    logger.debug('SDK shutdown complete');
  }
}

/**
 * Get wallet address from SDK
 */
export function getWalletAddress(): string | undefined {
  if (!sdkInstance) {
    return undefined;
  }
  const l1Wallet = sdkInstance.getL1WalletClient();
  const l2Wallet = sdkInstance.getL2WalletClient();
  return l2Wallet?.account?.address ?? l1Wallet?.account?.address;
}

/**
 * Check if SDK has wallet configured
 */
export function hasWallet(): boolean {
  return !!getWalletAddress();
}
