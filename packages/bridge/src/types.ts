import type { Address, Hash, PublicClient, WalletClient } from 'viem';

// ============================================
// ENUMS
// ============================================

export enum WithdrawalStatus {
  INITIATED = 'INITIATED',
  PROVEN = 'PROVEN',
  READY_FOR_FINALIZATION = 'READY_FOR_FINALIZATION',
  FINALIZED = 'FINALIZED',
}

export enum BridgeDirection {
  L1_TO_L2 = 'L1_TO_L2', // Deposit
  L2_TO_L1 = 'L2_TO_L1', // Withdrawal
}

export enum TokenStandard {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
}

// ============================================
// CONFIGURATION INTERFACES
// ============================================

/**
 * Configuration for initializing the BridgeModule
 */
export interface BridgeConfig {
  /** Viem public client for L1 (Ethereum) - for reading blockchain state */
  l1PublicClient: PublicClient;

  /** Viem public client for L2 (Mantle) - for reading blockchain state */
  l2PublicClient: PublicClient;

  /** Viem wallet client for L1 - for signing transactions */
  l1WalletClient: WalletClient;

  /** Viem wallet client for L2 - for signing transactions */
  l2WalletClient: WalletClient;

  /** Network mode: 'testnet' or 'mainnet' */
  network?: 'testnet' | 'mainnet';
}

/**
 * Options for withdrawal operations
 */
export interface WithdrawalOptions {
  /** Recipient address on L1 (defaults to sender) */
  to?: Address;

  /** Minimum gas limit for the L1 transaction */
  minGasLimit?: number;

  /** Callback for progress updates */
  onProgress?: (status: WithdrawalStatus, data?: any) => void;

  /** Maximum time to wait for each phase (in milliseconds) */
  timeout?: number;
}

/**
 * Options for deposit operations
 */
export interface DepositOptions {
  /** Recipient address on L2 (defaults to sender) */
  to?: Address;

  /** Minimum gas limit for the L2 transaction */
  minGasLimit?: number;

  /** Callback for progress updates */
  onProgress?: (txHash: Hash) => void;
}

// ============================================
// DATA INTERFACES
// ============================================

/**
 * Information about a withdrawal transaction
 */
export interface WithdrawalInfo {
  /** Transaction hash of the initiate withdrawal on L2 */
  txHash: Hash;

  /** Address of the token contract */
  tokenAddress: Address;

  /** Token ID (for ERC721) or amount (for ERC20) */
  tokenId: bigint;

  /** Address initiating the withdrawal */
  from: Address;

  /** Address receiving on L1 */
  to: Address;

  /** Current status of the withdrawal */
  status: WithdrawalStatus;

  /** Timestamp when withdrawal was initiated */
  initiatedAt?: bigint;

  /** Timestamp when withdrawal was proven */
  provenAt?: bigint;

  /** Timestamp when withdrawal was finalized */
  finalizedAt?: bigint;

  /** Hash of the proven withdrawal (used for finalization) */
  withdrawalHash?: Hash;
}

/**
 * Information about a deposit transaction
 */
export interface DepositInfo {
  /** Transaction hash of the deposit on L1 */
  txHash: Hash;

  /** Address of the token contract */
  tokenAddress: Address;

  /** Token ID (for ERC721) or amount (for ERC20) */
  tokenId: bigint;

  /** Address initiating the deposit */
  from: Address;

  /** Address receiving on L2 */
  to: Address;

  /** Timestamp when deposit was made */
  depositedAt: bigint;
}
