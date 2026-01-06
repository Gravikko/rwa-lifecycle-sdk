import type { Address, PublicClient } from 'viem';
import { TokenStandard } from '../types.js';
import { isERC3643Token } from '../erc3643/detector.js';
import { DetectionError } from '../errors.js';

/**
 * ERC20 ABI for detecting standard ERC20 tokens
 */
const ERC20_ABI = [
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/**
 * ERC721 ABI for detecting NFT tokens
 */
const ERC721_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/**
 * Auto-detect the token standard of a contract
 *
 * Detection priority:
 * 1. Check for ERC3643 (most specific)
 * 2. Check for ERC721 (NFT)
 * 3. Check for ERC20 (fungible token)
 * 4. Return UNKNOWN if none match
 *
 * @param publicClient - Viem public client for reading blockchain data
 * @param tokenAddress - Token contract address to detect
 * @returns Detected token standard
 */
export async function detectTokenStandard(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<TokenStandard> {
  try {
    // 1. Check for ERC3643 first (most specific)
    const isERC3643 = await isERC3643Token(publicClient, tokenAddress);
    if (isERC3643) {
      return TokenStandard.ERC3643;
    }

    // 2. Check for ERC721 (has ownerOf function unique to NFTs)
    const isERC721 = await detectERC721(publicClient, tokenAddress);
    if (isERC721) {
      return TokenStandard.ERC721;
    }

    // 3. Check for ERC20 (has totalSupply and balanceOf)
    const isERC20 = await detectERC20(publicClient, tokenAddress);
    if (isERC20) {
      return TokenStandard.ERC20;
    }

    // 4. Unknown standard
    return TokenStandard.UNKNOWN;
  } catch (error) {
    throw new DetectionError(
      tokenAddress,
      error instanceof Error ? error.message : 'Unknown error during standard detection'
    );
  }
}

/**
 * Detect if a token implements ERC20 standard
 *
 * Checks for presence of totalSupply() and balanceOf() functions
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - Token contract address
 * @returns true if ERC20, false otherwise
 */
async function detectERC20(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<boolean> {
  try {
    // Try calling totalSupply()
    await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'totalSupply',
    });

    // Try calling balanceOf() with zero address
    await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: ['0x0000000000000000000000000000000000000000'],
    });

    // Both functions exist - likely ERC20
    return true;
  } catch {
    // Functions don't exist or calls failed
    return false;
  }
}

/**
 * Detect if a token implements ERC721 standard
 *
 * Checks for presence of ownerOf() function which is unique to ERC721
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - Token contract address
 * @returns true if ERC721, false otherwise
 */
async function detectERC721(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<boolean> {
  try {
    // Try calling ownerOf() with token ID 0
    // This will revert if token 0 doesn't exist, but the function exists
    await publicClient.readContract({
      address: tokenAddress,
      abi: ERC721_ABI,
      functionName: 'ownerOf',
      args: [BigInt(0)],
    });

    // Function exists and token 0 exists - definitely ERC721
    return true;
  } catch (error) {
    // Check if error is due to token not existing vs function not existing
    // If the error message contains "ERC721" or "token", function likely exists
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';

    // These error patterns indicate the function exists but token doesn't
    const functionExistsPatterns = [
      'erc721',
      'token',
      'nonexistent',
      'invalid',
      'does not exist',
      'not found',
    ];

    const functionExists = functionExistsPatterns.some(pattern =>
      errorMessage.includes(pattern)
    );

    if (functionExists) {
      return true;
    }

    // Function doesn't exist - not ERC721
    return false;
  }
}

/**
 * Check if token is compliant (ERC3643 or has custom compliance)
 *
 * This is a helper to quickly check if a token has any compliance mechanism.
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - Token contract address
 * @returns true if token has compliance features
 */
export async function hasComplianceFeatures(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<boolean> {
  try {
    const standard = await detectTokenStandard(publicClient, tokenAddress);
    return standard === TokenStandard.ERC3643;
  } catch {
    return false;
  }
}
