/**
 * Relayer Service Types
 */

import type { Hash } from 'viem';

/**
 * Relayer configuration
 */
export interface RelayerConfig {
  /** L1 RPC URL (Ethereum) */
  l1RpcUrl: string;
  /** L2 RPC URL (Mantle) */
  l2RpcUrl: string;
  /** Private key for signing transactions */
  privateKey: `0x${string}`;
  /** Network ('mainnet' or 'testnet') */
  network?: 'mainnet' | 'testnet';
  /** Poll interval for checking withdrawals (ms, default: 60000) */
  pollInterval?: number;
  /** Maximum number of concurrent transactions (default: 5) */
  maxConcurrent?: number;
  /** Gas buffer percentage (default: 10) */
  gasBufferPercentage?: number;
  /** Enable auto-prove (default: true) */
  enableAutoProve?: boolean;
  /** Enable auto-finalize (default: true) */
  enableAutoFinalize?: boolean;
  /** Filter by user address (optional - only process this user's withdrawals) */
  filterByUser?: `0x${string}`;
  /** Log level (default: 'info') */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Log file path (optional, empty string for no file) */
  logFile?: string;
}

/**
 * Resolved relayer configuration (all fields have values)
 */
export interface ResolvedRelayerConfig {
  l1RpcUrl: string;
  l2RpcUrl: string;
  privateKey: `0x${string}`;
  network: 'mainnet' | 'testnet';
  pollInterval: number;
  maxConcurrent: number;
  gasBufferPercentage: number;
  enableAutoProve: boolean;
  enableAutoFinalize: boolean;
  filterByUser?: `0x${string}`;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFile: string;
}

/**
 * Withdrawal status for relayer tracking
 */
export interface TrackedWithdrawal {
  /** Initiated transaction hash */
  initiatedTxHash: Hash;
  /** Current phase */
  phase: 'initiated' | 'proven' | 'finalized';
  /** Whether can prove now */
  canProve: boolean;
  /** Whether can finalize now */
  canFinalize: boolean;
  /** Initiated timestamp */
  initiatedAt: bigint;
  /** Proven timestamp (if proven) */
  provenAt?: bigint;
  /** Proven transaction hash (if proven) */
  provenTxHash?: Hash;
  /** Finalized timestamp (if finalized) */
  finalizedAt?: bigint;
  /** Finalized transaction hash (if finalized) */
  finalizedTxHash?: Hash;
  /** Estimated time ready to prove */
  estimatedReadyToProve?: bigint;
  /** Estimated time ready to finalize */
  estimatedReadyToFinalize?: bigint;
}

/**
 * Processing result
 */
export interface ProcessingResult {
  success: boolean;
  txHash?: Hash;
  error?: string;
  withdrawal: TrackedWithdrawal;
}

/**
 * Relayer statistics
 */
export interface RelayerStats {
  /** Total withdrawals processed */
  totalProcessed: number;
  /** Successfully proven */
  totalProven: number;
  /** Successfully finalized */
  totalFinalized: number;
  /** Failed operations */
  totalFailed: number;
  /** Currently pending */
  currentPending: number;
  /** Last poll time */
  lastPollTime?: Date;
  /** Uptime in milliseconds */
  uptimeMs: number;
  /** Service start time */
  startTime: Date;
}

/**
 * Relayer events
 */
export type RelayerEventType =
  | 'started'
  | 'stopped'
  | 'poll'
  | 'withdrawal:detected'
  | 'withdrawal:proving'
  | 'withdrawal:proved'
  | 'withdrawal:finalizing'
  | 'withdrawal:finalized'
  | 'withdrawal:failed'
  | 'error';

export interface RelayerEvent {
  type: RelayerEventType;
  timestamp: Date;
  data?: unknown;
}

/**
 * Event listener type
 */
export type RelayerEventListener = (event: RelayerEvent) => void;
