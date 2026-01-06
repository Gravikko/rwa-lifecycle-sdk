import type { ICompliancePlugin, PluginCheckConfig, PluginCheckResult } from '../../types.js';

/**
 * Blacklist Plugin - Example implementation for tokens with blacklist modifiers
 *
 * This plugin checks if the sender or recipient is blacklisted in the token contract.
 * Many custom RWA tokens (like RealT) use blacklist patterns to block specific addresses.
 *
 * **Common blacklist function signatures:**
 * - `blacklist(address) returns (bool)` - Most common
 * - `isBlacklisted(address) returns (bool)` - Alternative naming
 * - `blacklisted(address) returns (bool)` - Past tense variant
 *
 * @example
 * ```typescript
 * import { BlacklistPlugin } from '@rwa-lifecycle/compliance';
 *
 * // Use with default function name 'blacklist'
 * const plugin = new BlacklistPlugin();
 *
 * // Or specify custom function name
 * const customPlugin = new BlacklistPlugin('isBlacklisted');
 *
 * // Register with adapter
 * adapter.registerPlugin(tokenAddress, plugin);
 * ```
 */
export class BlacklistPlugin implements ICompliancePlugin {
  /** Name of the blacklist function (defaults to 'blacklist') */
  private readonly functionName: string;

  /** Whether to check both sender and recipient (default: true) */
  private readonly checkBoth: boolean;

  /**
   * Create a new BlacklistPlugin
   *
   * @param functionName - Name of the blacklist function (default: 'blacklist')
   * @param checkBoth - Check both sender and recipient (default: true)
   */
  constructor(functionName: string = 'blacklist', checkBoth: boolean = true) {
    this.functionName = functionName;
    this.checkBoth = checkBoth;
  }

  /**
   * Check if transfer is compliant (sender/recipient not blacklisted)
   */
  async check(config: PluginCheckConfig): Promise<PluginCheckResult> {
    const { publicClient, tokenAddress, from, to } = config;

    // ABI for blacklist function
    const abi = [
      {
        name: this.functionName,
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'bool' }],
      },
    ] as const;

    try {
      // Check sender blacklist status
      const senderBlacklisted = await publicClient.readContract({
        address: tokenAddress,
        abi,
        functionName: this.functionName,
        args: [from],
      });

      if (senderBlacklisted) {
        return {
          compliant: false,
          reason: `Sender ${from} is blacklisted`,
        };
      }

      // Check recipient blacklist status (if enabled)
      if (this.checkBoth) {
        const recipientBlacklisted = await publicClient.readContract({
          address: tokenAddress,
          abi,
          functionName: this.functionName,
          args: [to],
        });

        if (recipientBlacklisted) {
          return {
            compliant: false,
            reason: `Recipient ${to} is blacklisted`,
          };
        }
      }

      // Neither is blacklisted
      return {
        compliant: true,
      };
    } catch (error) {
      // Function doesn't exist or call failed
      return {
        compliant: false,
        reason: `Failed to check blacklist: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }
}

/**
 * Pre-configured blacklist plugin for 'isBlacklisted' function
 */
export class IsBlacklistedPlugin extends BlacklistPlugin {
  constructor(checkBoth: boolean = true) {
    super('isBlacklisted', checkBoth);
  }
}

/**
 * Pre-configured blacklist plugin for 'blacklisted' function
 */
export class BlacklistedPlugin extends BlacklistPlugin {
  constructor(checkBoth: boolean = true) {
    super('blacklisted', checkBoth);
  }
}
