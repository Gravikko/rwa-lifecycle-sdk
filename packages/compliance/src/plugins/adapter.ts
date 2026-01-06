import type { Address, PublicClient } from 'viem';
import type {
  ICompliancePlugin,
  PluginCheckConfig,
  ComplianceResult,
} from '../types.js';
import { TokenStandard } from '../types.js';
import { PluginError } from '../errors.js';

/**
 * Plugin Adapter - Manages registration and execution of custom compliance plugins
 *
 * This adapter allows users to register custom compliance logic for tokens
 * that don't implement ERC3643 or have custom compliance requirements.
 *
 * @example
 * ```typescript
 * const adapter = new PluginAdapter();
 *
 * // Register a plugin for a specific token
 * adapter.registerPlugin('0x123...', myCustomPlugin);
 *
 * // Check compliance using the plugin
 * const result = await adapter.checkWithPlugin(publicClient, '0x123...', from, to, amount);
 * ```
 */
export class PluginAdapter {
  /** Map of token address to registered plugin */
  private plugins: Map<Address, ICompliancePlugin> = new Map();

  /** Map of plugin name to plugin instance (for named plugins) */
  private namedPlugins: Map<string, ICompliancePlugin> = new Map();

  /**
   * Register a compliance plugin for a specific token address
   *
   * @param tokenAddress - Token contract address
   * @param plugin - Compliance plugin implementation
   */
  registerPlugin(tokenAddress: Address, plugin: ICompliancePlugin): void {
    this.plugins.set(tokenAddress.toLowerCase() as Address, plugin);
  }

  /**
   * Register a named compliance plugin that can be reused
   *
   * Named plugins can be applied to multiple tokens without re-registering.
   *
   * @param name - Plugin identifier (e.g., 'blacklist-checker', 'whitelist-only')
   * @param plugin - Compliance plugin implementation
   */
  registerNamedPlugin(name: string, plugin: ICompliancePlugin): void {
    this.namedPlugins.set(name, plugin);
  }

  /**
   * Get a registered plugin by token address
   *
   * @param tokenAddress - Token contract address
   * @returns Plugin if registered, undefined otherwise
   */
  getPlugin(tokenAddress: Address): ICompliancePlugin | undefined {
    return this.plugins.get(tokenAddress.toLowerCase() as Address);
  }

  /**
   * Get a named plugin by name
   *
   * @param name - Plugin identifier
   * @returns Plugin if registered, undefined otherwise
   */
  getNamedPlugin(name: string): ICompliancePlugin | undefined {
    return this.namedPlugins.get(name);
  }

  /**
   * Check if a plugin is registered for a token
   *
   * @param tokenAddress - Token contract address
   * @returns true if plugin exists, false otherwise
   */
  hasPlugin(tokenAddress: Address): boolean {
    return this.plugins.has(tokenAddress.toLowerCase() as Address);
  }

  /**
   * Unregister a plugin for a token
   *
   * @param tokenAddress - Token contract address
   */
  unregisterPlugin(tokenAddress: Address): void {
    this.plugins.delete(tokenAddress.toLowerCase() as Address);
  }

  /**
   * Unregister a named plugin
   *
   * @param name - Plugin identifier
   */
  unregisterNamedPlugin(name: string): void {
    this.namedPlugins.delete(name);
  }

  /**
   * Check compliance using a registered plugin
   *
   * @param publicClient - Viem public client for blockchain reads
   * @param tokenAddress - Token contract address
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Transfer amount (ERC20) or token ID (ERC721)
   * @param tokenStandard - Token standard (defaults to UNKNOWN for custom tokens)
   * @returns Compliance result with pass/fail and reason
   * @throws PluginError if no plugin is registered for this token
   */
  async checkWithPlugin(
    publicClient: PublicClient,
    tokenAddress: Address,
    from: Address,
    to: Address,
    amount: bigint,
    tokenStandard: TokenStandard = TokenStandard.UNKNOWN
  ): Promise<ComplianceResult> {
    const plugin = this.getPlugin(tokenAddress);

    if (!plugin) {
      throw new PluginError(
        'default',
        `No plugin registered for token ${tokenAddress}`,
      );
    }

    try {
      const config: PluginCheckConfig = {
        publicClient,
        tokenAddress,
        from,
        to,
        amount,
      };

      const result = await plugin.check(config);

      return {
        compliant: result.compliant,
        reason: result.reason,
        tokenStandard,
      };
    } catch (error) {
      throw new PluginError(
        'default',
        `Plugin execution failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check compliance using a named plugin
   *
   * This allows using a plugin by name without pre-registering it for a specific token.
   *
   * @param pluginName - Name of the registered plugin
   * @param publicClient - Viem public client for blockchain reads
   * @param tokenAddress - Token contract address
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Transfer amount (ERC20) or token ID (ERC721)
   * @param tokenStandard - Token standard (defaults to UNKNOWN for custom tokens)
   * @returns Compliance result with pass/fail and reason
   * @throws PluginError if named plugin doesn't exist
   */
  async checkWithNamedPlugin(
    pluginName: string,
    publicClient: PublicClient,
    tokenAddress: Address,
    from: Address,
    to: Address,
    amount: bigint,
    tokenStandard: TokenStandard = TokenStandard.UNKNOWN
  ): Promise<ComplianceResult> {
    const plugin = this.getNamedPlugin(pluginName);

    if (!plugin) {
      throw new PluginError(
        pluginName,
        `Named plugin '${pluginName}' not found`,
      );
    }

    try {
      const config: PluginCheckConfig = {
        publicClient,
        tokenAddress,
        from,
        to,
        amount,
      };

      const result = await plugin.check(config);

      return {
        compliant: result.compliant,
        reason: result.reason,
        tokenStandard,
      };
    } catch (error) {
      throw new PluginError(
        pluginName,
        `Plugin execution failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get list of all registered token addresses
   *
   * @returns Array of token addresses with registered plugins
   */
  getRegisteredTokens(): Address[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get list of all named plugins
   *
   * @returns Array of plugin names
   */
  getNamedPluginList(): string[] {
    return Array.from(this.namedPlugins.keys());
  }

  /**
   * Clear all registered plugins
   */
  clearAll(): void {
    this.plugins.clear();
    this.namedPlugins.clear();
  }
}
