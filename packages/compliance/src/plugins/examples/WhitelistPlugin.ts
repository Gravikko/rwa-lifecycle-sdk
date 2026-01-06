import type { ICompliancePlugin, PluginCheckConfig, PluginCheckResult } from '../../types.js';

/**
 * Whitelist Plugin - Example implementation for tokens with whitelist-only transfers
 *
 * This plugin checks if both sender and recipient are whitelisted in the token contract.
 * Some RWA tokens only allow transfers between pre-approved addresses.
 *
 * **Common whitelist function signatures:**
 * - `whitelist(address) returns (bool)` - Most common
 * - `isWhitelisted(address) returns (bool)` - Alternative naming
 * - `whitelisted(address) returns (bool)` - Past tense variant
 * - `isApproved(address) returns (bool)` - Approval-based variant
 *
 * @example
 * ```typescript
 * import { WhitelistPlugin } from '@rwa-lifecycle/compliance';
 *
 * // Use with default function name 'whitelist'
 * const plugin = new WhitelistPlugin();
 *
 * // Or specify custom function name
 * const customPlugin = new WhitelistPlugin('isWhitelisted');
 *
 * // Register with adapter
 * adapter.registerPlugin(tokenAddress, plugin);
 * ```
 */
export class WhitelistPlugin implements ICompliancePlugin {
  /** Name of the whitelist function (defaults to 'whitelist') */
  private readonly functionName: string;

  /** Whether to require both sender and recipient to be whitelisted (default: true) */
  private readonly requireBoth: boolean;

  /**
   * Create a new WhitelistPlugin
   *
   * @param functionName - Name of the whitelist function (default: 'whitelist')
   * @param requireBoth - Require both sender and recipient whitelisted (default: true)
   */
  constructor(functionName: string = 'whitelist', requireBoth: boolean = true) {
    this.functionName = functionName;
    this.requireBoth = requireBoth;
  }

  /**
   * Check if transfer is compliant (sender/recipient are whitelisted)
   */
  async check(config: PluginCheckConfig): Promise<PluginCheckResult> {
    const { publicClient, tokenAddress, from, to } = config;

    // ABI for whitelist function
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
      // Check sender whitelist status
      const senderWhitelisted = await publicClient.readContract({
        address: tokenAddress,
        abi,
        functionName: this.functionName,
        args: [from],
      });

      if (!senderWhitelisted) {
        return {
          compliant: false,
          reason: `Sender ${from} is not whitelisted`,
        };
      }

      // Check recipient whitelist status (if required)
      if (this.requireBoth) {
        const recipientWhitelisted = await publicClient.readContract({
          address: tokenAddress,
          abi,
          functionName: this.functionName,
          args: [to],
        });

        if (!recipientWhitelisted) {
          return {
            compliant: false,
            reason: `Recipient ${to} is not whitelisted`,
          };
        }
      }

      // Both are whitelisted (or only sender if requireBoth=false)
      return {
        compliant: true,
      };
    } catch (error) {
      // Function doesn't exist or call failed
      return {
        compliant: false,
        reason: `Failed to check whitelist: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }
}

/**
 * Pre-configured whitelist plugin for 'isWhitelisted' function
 */
export class IsWhitelistedPlugin extends WhitelistPlugin {
  constructor(requireBoth: boolean = true) {
    super('isWhitelisted', requireBoth);
  }
}

/**
 * Pre-configured whitelist plugin for 'whitelisted' function
 */
export class WhitelistedPlugin extends WhitelistPlugin {
  constructor(requireBoth: boolean = true) {
    super('whitelisted', requireBoth);
  }
}

/**
 * Pre-configured whitelist plugin for 'isApproved' function
 */
export class IsApprovedPlugin extends WhitelistPlugin {
  constructor(requireBoth: boolean = true) {
    super('isApproved', requireBoth);
  }
}
