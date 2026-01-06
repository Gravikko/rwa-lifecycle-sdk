import type { Address, PublicClient } from 'viem';
import { ERC3643_TOKEN_ABI } from './abi.js';
import { ERC3643Error } from '../errors.js';
import type { ComplianceResult } from '../types.js';
import { TokenStandard } from '../types.js';

/**
 * Check if a transfer is compliant according to ERC3643 rules
 *
 * This function calls the token's canTransfer() function which encapsulates
 * all compliance logic including:
 * - Identity verification status
 * - Transfer restrictions
 * - Country-based rules
 * - Custom compliance modules
 *
 * @param publicClient - Viem public client for reading blockchain data
 * @param tokenAddress - ERC3643 token contract address
 * @param from - Sender address
 * @param to - Recipient address
 * @param amount - Transfer amount
 * @returns Compliance result with pass/fail and reason
 */
export async function checkERC3643Compliance(
  publicClient: PublicClient,
  tokenAddress: Address,
  from: Address,
  to: Address,
  amount: bigint
): Promise<ComplianceResult> {
  try {
    // Call canTransfer() to check if transfer is allowed
    const canTransfer = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC3643_TOKEN_ABI,
      functionName: 'canTransfer',
      args: [from, to, amount],
    });

    if (canTransfer) {
      return {
        compliant: true,
        tokenStandard: TokenStandard.ERC3643,
      };
    }

    // Transfer not allowed - try to determine why
    const reason = await determineFailureReason(publicClient, tokenAddress, from, to);

    return {
      compliant: false,
      reason,
      tokenStandard: TokenStandard.ERC3643,
    };
  } catch (error) {
    throw new ERC3643Error(
      `Failed to check ERC3643 compliance: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      tokenAddress
    );
  }
}

/**
 * Determine why a transfer failed by checking individual conditions
 *
 * This helps provide a specific error message to the user.
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - Token contract address
 * @param from - Sender address
 * @param to - Recipient address
 * @returns Human-readable failure reason
 */
async function determineFailureReason(
  publicClient: PublicClient,
  tokenAddress: Address,
  from: Address,
  to: Address
): Promise<string> {
  try {
    // Check sender verification
    const fromVerified = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC3643_TOKEN_ABI,
      functionName: 'isVerified',
      args: [from],
    });

    if (!fromVerified) {
      return `Sender ${from} is not verified`;
    }

    // Check recipient verification
    const toVerified = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC3643_TOKEN_ABI,
      functionName: 'isVerified',
      args: [to],
    });

    if (!toVerified) {
      return `Recipient ${to} is not verified`;
    }

    // Both are verified but transfer still blocked
    // Could be due to compliance modules, country restrictions, etc.
    return 'Transfer blocked by compliance rules';
  } catch {
    // If we can't determine specific reason, return generic message
    return 'Transfer not allowed';
  }
}

/**
 * Check if an address is verified in the ERC3643 token's identity registry
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - ERC3643 token contract address
 * @param userAddress - Address to check
 * @returns true if verified, false otherwise
 */
export async function isAddressVerified(
  publicClient: PublicClient,
  tokenAddress: Address,
  userAddress: Address
): Promise<boolean> {
  try {
    const verified = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC3643_TOKEN_ABI,
      functionName: 'isVerified',
      args: [userAddress],
    });

    return verified;
  } catch (error) {
    throw new ERC3643Error(
      `Failed to check verification status: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      tokenAddress
    );
  }
}
