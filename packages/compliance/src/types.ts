import type { Address, PublicClient } from 'viem';

/**
 * Supported token standards for compliance checking
 */
export enum TokenStandard {
  /** ERC3643 (T-REX) - Standard for compliant security tokens */
  ERC3643 = 'ERC3643',

  /** Plain ERC20 token (via custom plugins) */
  ERC20 = 'ERC20',

  /** Plain ERC721 NFT (via custom plugins) */
  ERC721 = 'ERC721',

  /** Unknown or unsupported standard */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Result of a compliance check
 */
export interface ComplianceResult {
  /** Whether the transfer is allowed */
  compliant: boolean;

  /** Reason for denial if not compliant */
  reason?: string;

  /** Detected token standard */
  tokenStandard: TokenStandard;
}

/**
 * Configuration for the Compliance Module
 */
export interface ComplianceConfig {
  /** Viem public client for reading on-chain data */
  publicClient: PublicClient;

  /** Network type - determines chain-specific behavior */
  network: 'mainnet' | 'testnet';
}

/**
 * Interface for custom compliance plugins
 *
 * Allows users to provide custom compliance logic for non-standard tokens
 *
 * @example
 * ```typescript
 * const blacklistPlugin: ICompliancePlugin = {
 *   async check(config) {
 *     const isBlacklisted = await config.publicClient.readContract({
 *       address: config.tokenAddress,
 *       abi: [{ name: 'blacklist', type: 'function', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] }],
 *       functionName: 'blacklist',
 *       args: [config.from],
 *     });
 *     return {
 *       compliant: !isBlacklisted,
 *       reason: isBlacklisted ? 'Address is blacklisted' : undefined,
 *     };
 *   }
 * };
 * ```
 */
export interface ICompliancePlugin {
  /**
   * Check if a transfer is compliant
   * @param config - Plugin configuration including token address, from/to addresses, and amount
   * @returns Partial compliance result (compliant boolean and optional reason)
   */
  check(config: PluginCheckConfig): Promise<PluginCheckResult>;
}

/**
 * Configuration passed to plugin check function
 */
export interface PluginCheckConfig {
  /** Public client for reading blockchain data */
  publicClient: PublicClient;

  /** Token contract address */
  tokenAddress: Address;

  /** Sender address */
  from: Address;

  /** Recipient address */
  to: Address;

  /** Transfer amount (ERC20) or token ID (ERC721) */
  amount: bigint;
}

/**
 * Result returned by plugin check function
 */
export interface PluginCheckResult {
  /** Whether the transfer is allowed */
  compliant: boolean;

  /** Optional reason for denial */
  reason?: string;
}
