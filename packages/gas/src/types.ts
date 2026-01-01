import type { Address, PublicClient } from 'viem';

/**
 * Gas cost estimate breakdown for Mantle L2 transactions
 *
 * Mantle transactions have two fee components:
 * - L2 Execution Fee: Cost to execute transaction on Mantle L2 (cheap)
 * - L1 Data Fee: Cost to post transaction data to Ethereum L1 (expensive)
 */
export interface GasCostEstimate {
  /** L2 execution fee in wei (Mantle gas cost) */
  l2ExecutionFee: bigint;

  /** L1 data availability fee in wei (Ethereum posting cost) */
  l1DataFee: bigint;

  /** Total fee in wei (l2ExecutionFee + l1DataFee) */
  totalFee: bigint;

  /** Human-readable cost formatted in ETH */
  formattedInETH: string;

  /** Human-readable cost formatted in MNT */
  formattedInMNT: string;

  /** Detailed breakdown of fee components */
  breakdown: {
    /** Estimated gas units for L2 execution */
    l2GasEstimate: bigint;

    /** Current L2 gas price in wei */
    l2GasPrice: bigint;

    /** L1 gas used for data posting (if available) */
    l1GasUsed?: bigint;

    /** Current L1 base fee in wei (if available) */
    l1BaseFee?: bigint;

    /** Gas oracle overhead constant (if available) */
    overhead?: bigint;

    /** Gas oracle scalar multiplier (if available) */
    scalar?: bigint;
  };
}

/**
 * Configuration for the Gas Module
 */
export interface GasConfig {
  /** Viem public client for L1 (Ethereum) */
  l1PublicClient: PublicClient;

  /** Viem public client for L2 (Mantle) */
  l2PublicClient: PublicClient;

  /** Network type - determines which contract addresses to use */
  network: 'mainnet' | 'testnet';

  /** Optional: Custom gas oracle address (defaults to 0x420...00F) */
  gasOracleAddress?: Address;

  /** Optional: Add safety buffer percentage (default: 10%) */
  bufferPercentage?: number;
}

/**
 * Type of bridge transaction for gas estimation
 */
export type TransactionType =
  | 'deposit'              // L1 → L2 deposit (ERC20 or ERC721)
  | 'withdraw_initiate'    // L2 → L1 withdrawal initiation
  | 'withdraw_prove'       // L1 prove withdrawal (after challenge period)
  | 'withdraw_finalize';   // L1 finalize withdrawal

/**
 * Options for gas estimation
 */
export interface GasEstimateOptions {
  /** Sender address */
  from: Address;

  /** Recipient address (optional) */
  to?: Address;

  /** Token address for ERC20/ERC721 operations */
  tokenAddress?: Address;

  /** Amount for ERC20 (in wei) or token ID for ERC721 */
  amount?: bigint;

  /** Gas limit override (optional) */
  gasLimit?: bigint;

  /** Include detailed breakdown in result */
  includeBreakdown?: boolean;
}

