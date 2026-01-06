import type { Address, PublicClient } from 'viem';
import { TokenStandard } from '../types.js';
import { SimulationError } from '../errors.js';

/**
 * Result of a transfer simulation
 */
export interface SimulationResult {
  /** Whether the simulated transfer would succeed */
  success: boolean;

  /** Revert reason if simulation failed */
  revertReason?: string;

  /** Estimated gas for the transfer */
  estimatedGas?: bigint;
}

/**
 * ERC20 transfer function ABI
 */
const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

/**
 * ERC721 transferFrom function ABI
 */
const ERC721_TRANSFER_ABI = [
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

/**
 * Simulate an ERC20 transfer using staticCall
 *
 * This tests if a transfer would succeed without actually executing it.
 * Useful for detecting compliance failures before spending gas.
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - ERC20 token contract address
 * @param from - Sender address
 * @param to - Recipient address
 * @param amount - Transfer amount
 * @returns Simulation result with success status and revert reason
 */
export async function simulateERC20Transfer(
  publicClient: PublicClient,
  tokenAddress: Address,
  from: Address,
  to: Address,
  amount: bigint
): Promise<SimulationResult> {
  try {
    // Simulate the transfer call
    const result = await publicClient.simulateContract({
      address: tokenAddress,
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [to, amount],
      account: from,
    });

    // If we got here, simulation succeeded
    return {
      success: true,
      estimatedGas: result.request.gas,
    };
  } catch (error) {
    // Simulation failed - extract revert reason
    const revertReason = extractRevertReason(error);

    return {
      success: false,
      revertReason,
    };
  }
}

/**
 * Simulate an ERC721 transfer using staticCall
 *
 * This tests if an NFT transfer would succeed without actually executing it.
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - ERC721 token contract address
 * @param from - Sender address
 * @param to - Recipient address
 * @param tokenId - Token ID to transfer
 * @returns Simulation result with success status and revert reason
 */
export async function simulateERC721Transfer(
  publicClient: PublicClient,
  tokenAddress: Address,
  from: Address,
  to: Address,
  tokenId: bigint
): Promise<SimulationResult> {
  try {
    // Simulate the transferFrom call
    const result = await publicClient.simulateContract({
      address: tokenAddress,
      abi: ERC721_TRANSFER_ABI,
      functionName: 'transferFrom',
      args: [from, to, tokenId],
      account: from,
    });

    // If we got here, simulation succeeded
    return {
      success: true,
      estimatedGas: result.request.gas,
    };
  } catch (error) {
    // Simulation failed - extract revert reason
    const revertReason = extractRevertReason(error);

    return {
      success: false,
      revertReason,
    };
  }
}

/**
 * Simulate a transfer based on token standard
 *
 * Automatically selects the correct simulation method based on token type.
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - Token contract address
 * @param from - Sender address
 * @param to - Recipient address
 * @param amountOrTokenId - Transfer amount (ERC20) or token ID (ERC721)
 * @param tokenStandard - Token standard (ERC20, ERC721, or ERC3643)
 * @returns Simulation result
 * @throws SimulationError if token standard is not supported
 */
export async function simulateTransfer(
  publicClient: PublicClient,
  tokenAddress: Address,
  from: Address,
  to: Address,
  amountOrTokenId: bigint,
  tokenStandard: TokenStandard
): Promise<SimulationResult> {
  switch (tokenStandard) {
    case TokenStandard.ERC20:
    case TokenStandard.ERC3643:
      // ERC3643 tokens are also ERC20 compatible
      return simulateERC20Transfer(publicClient, tokenAddress, from, to, amountOrTokenId);

    case TokenStandard.ERC721:
      return simulateERC721Transfer(publicClient, tokenAddress, from, to, amountOrTokenId);

    case TokenStandard.UNKNOWN:
      // Try ERC20 as default for unknown tokens
      return simulateERC20Transfer(publicClient, tokenAddress, from, to, amountOrTokenId);

    default:
      throw new SimulationError(
        `Unsupported token standard for simulation: ${tokenStandard}`
      );
  }
}

/**
 * Extract human-readable revert reason from error
 *
 * Handles multiple error formats:
 * - String reverts: "Transfer failed"
 * - Custom errors: "InsufficientBalance(uint256)"
 * - Raw bytes: 0x...
 *
 * @param error - Error object from failed call
 * @returns Human-readable revert reason
 */
function extractRevertReason(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error';
  }

  const errorMessage = error.message;

  // Pattern 1: Look for revert reason in error message
  const revertMatch = errorMessage.match(/reverted with reason: "(.+?)"/);
  if (revertMatch) {
    return revertMatch[1];
  }

  // Pattern 2: Look for custom error name
  const customErrorMatch = errorMessage.match(/reverted with custom error '(.+?)'/);
  if (customErrorMatch) {
    return customErrorMatch[1];
  }

  // Pattern 3: Look for execution reverted message
  const executionRevertMatch = errorMessage.match(/execution reverted: (.+)/);
  if (executionRevertMatch) {
    return executionRevertMatch[1];
  }

  // Pattern 4: Check if error contains specific compliance keywords
  const complianceKeywords = [
    'blacklist',
    'whitelist',
    'not verified',
    'not allowed',
    'compliance',
    'restricted',
    'insufficient balance',
    'transfer amount exceeds',
  ];

  for (const keyword of complianceKeywords) {
    if (errorMessage.toLowerCase().includes(keyword)) {
      // Found a keyword, extract the relevant part
      const sentences = errorMessage.split(/[.!]/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) {
          return sentence.trim();
        }
      }
    }
  }

  // Default: Return generic message
  return 'Transfer simulation failed';
}

/**
 * Check if simulation indicates a compliance issue
 *
 * Analyzes the revert reason to determine if failure is due to compliance.
 *
 * @param result - Simulation result
 * @returns true if failure is compliance-related
 */
export function isComplianceFailure(result: SimulationResult): boolean {
  if (result.success) {
    return false;
  }

  if (!result.revertReason) {
    return false;
  }

  const reason = result.revertReason.toLowerCase();
  const complianceIndicators = [
    'blacklist',
    'whitelist',
    'verified',
    'compliance',
    'restricted',
    'not allowed',
    'forbidden',
    'unauthorized',
    'kyc',
    'aml',
  ];

  return complianceIndicators.some(indicator => reason.includes(indicator));
}
