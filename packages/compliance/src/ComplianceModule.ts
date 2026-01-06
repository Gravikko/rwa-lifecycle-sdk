import type { Address, PublicClient } from 'viem';
import type { ComplianceConfig, ComplianceResult, ICompliancePlugin } from './types.js';
import { TokenStandard } from './types.js';
import { detectTokenStandard } from './detector/index.js';
import { checkERC3643Compliance } from './erc3643/checker.js';
import { PluginAdapter } from './plugins/adapter.js';
import { simulateTransfer } from './simulation/simulator.js';
import { ComplianceError } from './errors.js';

/**
 * Compliance Module - Main entry point for compliance verification
 *
 * This module provides comprehensive compliance checking for RWA tokens:
 * - Automatic standard detection (ERC3643, ERC20, ERC721)
 * - Native ERC3643 support with identity registry integration
 * - Custom plugin system for non-standard tokens
 * - Transfer simulation to prevent failed transactions
 *
 * @example
 * ```typescript
 * import { ComplianceModule } from '@rwa-lifecycle/compliance';
 * import { createPublicClient, http } from 'viem';
 * import { mainnet } from 'viem/chains';
 *
 * const compliance = new ComplianceModule({
 *   publicClient: createPublicClient({
 *     chain: mainnet,
 *     transport: http(),
 *   }),
 *   network: 'mainnet',
 * });
 *
 * // Check compliance for a transfer
 * const result = await compliance.checkCompliance(
 *   tokenAddress,
 *   fromAddress,
 *   toAddress,
 *   amount
 * );
 *
 * if (!result.compliant) {
 *   console.error(`Transfer blocked: ${result.reason}`);
 * }
 * ```
 */
export class ComplianceModule {
  /** Viem public client for blockchain reads */
  private readonly publicClient: PublicClient;

  /** Plugin adapter for custom compliance logic */
  private readonly pluginAdapter: PluginAdapter;

  /**
   * Create a new Compliance Module
   *
   * @param config - Configuration options
   */
  constructor(config: ComplianceConfig) {
    this.publicClient = config.publicClient;
    this.pluginAdapter = new PluginAdapter();
  }

  /**
   * Check if a transfer is compliant
   *
   * This is the main function that handles all compliance checking:
   * 1. Auto-detect token standard
   * 2. Use ERC3643 checker if applicable
   * 3. Use custom plugin if registered
   * 4. Optionally simulate transfer
   *
   * @param tokenAddress - Token contract address
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Transfer amount (ERC20) or token ID (ERC721)
   * @param options - Additional options
   * @returns Compliance result with pass/fail and reason
   */
  async checkCompliance(
    tokenAddress: Address,
    from: Address,
    to: Address,
    amount: bigint,
    options?: {
      /** Skip standard detection if you already know the type */
      tokenStandard?: TokenStandard;
      /** Simulate transfer before returning result */
      simulate?: boolean;
    }
  ): Promise<ComplianceResult> {
    try {
      // Step 1: Detect token standard (or use provided)
      const tokenStandard =
        options?.tokenStandard ?? (await detectTokenStandard(this.publicClient, tokenAddress));

      // Step 2: Check if custom plugin is registered
      if (this.pluginAdapter.hasPlugin(tokenAddress)) {
        const result = await this.pluginAdapter.checkWithPlugin(
          this.publicClient,
          tokenAddress,
          from,
          to,
          amount,
          tokenStandard
        );

        // Optionally simulate transfer
        if (options?.simulate && result.compliant) {
          const simulation = await simulateTransfer(
            this.publicClient,
            tokenAddress,
            from,
            to,
            amount,
            tokenStandard
          );

          if (!simulation.success) {
            return {
              compliant: false,
              reason: simulation.revertReason || 'Transfer simulation failed',
              tokenStandard,
            };
          }
        }

        return result;
      }

      // Step 3: Use native ERC3643 checker if applicable
      if (tokenStandard === TokenStandard.ERC3643) {
        const result = await checkERC3643Compliance(
          this.publicClient,
          tokenAddress,
          from,
          to,
          amount
        );

        // Optionally simulate transfer
        if (options?.simulate && result.compliant) {
          const simulation = await simulateTransfer(
            this.publicClient,
            tokenAddress,
            from,
            to,
            amount,
            tokenStandard
          );

          if (!simulation.success) {
            return {
              compliant: false,
              reason: simulation.revertReason || 'Transfer simulation failed',
              tokenStandard,
            };
          }
        }

        return result;
      }

      // Step 4: For plain ERC20/ERC721 without plugins, simulate or assume compliant
      if (options?.simulate) {
        const simulation = await simulateTransfer(
          this.publicClient,
          tokenAddress,
          from,
          to,
          amount,
          tokenStandard
        );

        return {
          compliant: simulation.success,
          reason: simulation.revertReason,
          tokenStandard,
        };
      }

      // No compliance checks available - assume compliant
      return {
        compliant: true,
        tokenStandard,
      };
    } catch (error) {
      throw new ComplianceError(
        `Compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Register a custom compliance plugin for a token
   *
   * Use this when your token has custom compliance logic that isn't ERC3643.
   *
   * @param tokenAddress - Token contract address
   * @param plugin - Compliance plugin implementation
   *
   * @example
   * ```typescript
   * import { BlacklistPlugin } from '@rwa-lifecycle/compliance';
   *
   * compliance.registerPlugin(
   *   '0x46cc7ec70746f4cbd56ce5fa9bb7d648398eaa5c', // RealT token
   *   new BlacklistPlugin()
   * );
   * ```
   */
  registerPlugin(tokenAddress: Address, plugin: ICompliancePlugin): void {
    this.pluginAdapter.registerPlugin(tokenAddress, plugin);
  }

  /**
   * Register a named plugin that can be reused across multiple tokens
   *
   * @param name - Plugin identifier
   * @param plugin - Compliance plugin implementation
   *
   * @example
   * ```typescript
   * import { WhitelistPlugin } from '@rwa-lifecycle/compliance';
   *
   * compliance.registerNamedPlugin('whitelist-only', new WhitelistPlugin());
   *
   * // Use for multiple tokens
   * await compliance.checkWithNamedPlugin('whitelist-only', token1, from, to, amount);
   * await compliance.checkWithNamedPlugin('whitelist-only', token2, from, to, amount);
   * ```
   */
  registerNamedPlugin(name: string, plugin: ICompliancePlugin): void {
    this.pluginAdapter.registerNamedPlugin(name, plugin);
  }

  /**
   * Check compliance using a named plugin
   *
   * @param pluginName - Name of the registered plugin
   * @param tokenAddress - Token contract address
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Transfer amount
   * @returns Compliance result
   */
  async checkWithNamedPlugin(
    pluginName: string,
    tokenAddress: Address,
    from: Address,
    to: Address,
    amount: bigint
  ): Promise<ComplianceResult> {
    return this.pluginAdapter.checkWithNamedPlugin(
      pluginName,
      this.publicClient,
      tokenAddress,
      from,
      to,
      amount
    );
  }

  /**
   * Unregister a plugin for a token
   *
   * @param tokenAddress - Token contract address
   */
  unregisterPlugin(tokenAddress: Address): void {
    this.pluginAdapter.unregisterPlugin(tokenAddress);
  }

  /**
   * Detect the standard of a token
   *
   * @param tokenAddress - Token contract address
   * @returns Detected token standard
   */
  async detectStandard(tokenAddress: Address): Promise<TokenStandard> {
    return detectTokenStandard(this.publicClient, tokenAddress);
  }

  /**
   * Simulate a transfer to check if it would succeed
   *
   * @param tokenAddress - Token contract address
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Transfer amount
   * @param tokenStandard - Token standard (optional, will auto-detect)
   * @returns Simulation result
   */
  async simulateTransfer(
    tokenAddress: Address,
    from: Address,
    to: Address,
    amount: bigint,
    tokenStandard?: TokenStandard
  ) {
    const standard =
      tokenStandard ?? (await detectTokenStandard(this.publicClient, tokenAddress));

    return simulateTransfer(this.publicClient, tokenAddress, from, to, amount, standard);
  }

  /**
   * Get list of all tokens with registered plugins
   *
   * @returns Array of token addresses
   */
  getRegisteredTokens(): Address[] {
    return this.pluginAdapter.getRegisteredTokens();
  }

  /**
   * Get list of all named plugins
   *
   * @returns Array of plugin names
   */
  getNamedPlugins(): string[] {
    return this.pluginAdapter.getNamedPluginList();
  }
}
