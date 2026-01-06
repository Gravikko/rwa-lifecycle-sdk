import type { Address, PublicClient } from 'viem';
import { ERC165_ABI, ERC3643_TOKEN_ABI, ERC3643_INTERFACE_IDS } from './abi.js';
import { DetectionError } from '../errors.js';

/**
 * Detects if a token contract implements the ERC3643 standard
 *
 * Detection strategy:
 * 1. Try ERC165 supportsInterface() if available
 * 2. Fallback: Try calling ERC3643 functions directly
 * 3. If both fail, token is not ERC3643
 *
 * @param publicClient - Viem public client for reading blockchain data
 * @param tokenAddress - Address of the token contract
 * @returns true if token implements ERC3643, false otherwise
 */
export async function isERC3643Token(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<boolean> {
  try {
    // Strategy 1: Try ERC165 interface detection
    const supportsERC165 = await detectViaERC165(publicClient, tokenAddress);
    if (supportsERC165 !== null) {
      return supportsERC165;
    }

    // Strategy 2: Fallback - Try calling ERC3643 functions
    const supportsFunctions = await detectViaFunctionCalls(publicClient, tokenAddress);
    return supportsFunctions;
  } catch (error) {
    throw new DetectionError(
      tokenAddress,
      error instanceof Error ? error.message : 'Unknown error during detection'
    );
  }
}

/**
 * Detect ERC3643 support via ERC165 supportsInterface
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - Token contract address
 * @returns true if ERC3643, false if not, null if ERC165 not supported
 */
async function detectViaERC165(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<boolean | null> {
  try {
    // First check if contract supports ERC165 itself
    const supportsERC165 = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC165_ABI,
      functionName: 'supportsInterface',
      args: [ERC3643_INTERFACE_IDS.ERC165],
    });

    if (!supportsERC165) {
      // Contract doesn't support ERC165
      return null;
    }

    // Check if contract supports ERC3643 interface
    const supportsERC3643 = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC165_ABI,
      functionName: 'supportsInterface',
      args: [ERC3643_INTERFACE_IDS.ERC3643_TOKEN],
    });

    return supportsERC3643;
  } catch {
    // ERC165 not supported or call failed
    return null;
  }
}

/**
 * Detect ERC3643 support by trying to call its functions
 *
 * This is a fallback when ERC165 is not available.
 * We try calling key ERC3643 functions to see if they exist.
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - Token contract address
 * @returns true if functions are callable, false otherwise
 */
async function detectViaFunctionCalls(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<boolean> {
  try {
    // Try calling identityRegistry() - a key ERC3643 function
    await publicClient.readContract({
      address: tokenAddress,
      abi: ERC3643_TOKEN_ABI,
      functionName: 'identityRegistry',
    });

    // If we got here, identityRegistry() exists
    // Now verify canTransfer() also exists
    await publicClient.readContract({
      address: tokenAddress,
      abi: ERC3643_TOKEN_ABI,
      functionName: 'canTransfer',
      args: [
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        BigInt(0),
      ],
    });

    // Both key functions exist - likely ERC3643
    return true;
  } catch {
    // Functions don't exist or calls failed
    return false;
  }
}
