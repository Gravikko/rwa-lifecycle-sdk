import type { Address, Hash, PublicClient } from 'viem';

export type ChainType = 'l1' | 'l2';

export type EventType =
  | 'DepositFinalized'
  | 'WithdrawalInitiated'
  | 'WithdrawalProven'
  | 'WithdrawalFinalized'
  | 'ERC20DepositInitiated'
  | 'ERC721DepositInitiated';

export type TransactionType = 'deposit' | 'withdrawal';

export type WithdrawalPhase = 'initiated' | 'proven' | 'finalized';

export interface IndexerConfig {
  l1RpcUrl: string;
  l2RpcUrl: string;
  l1BridgeAddress: Address;
  l2BridgeAddress: Address;
  databasePath?: string;
  pollInterval?: number;
  startBlock?: {
    l1?: bigint;
    l2?: bigint;
  };
}

export interface BridgeEvent {
  id: string;
  chain: ChainType;
  eventType: EventType;
  blockNumber: bigint;
  blockHash: Hash;
  transactionHash: Hash;
  logIndex: number;
  timestamp: bigint;
  from: Address;
  to: Address;
  token?: Address;
  tokenId?: bigint;
  amount?: bigint;
  data?: string;
}

export interface BridgeTransaction {
  id: string;
  type: TransactionType;
  user: Address;
  token: Address;
  tokenId?: bigint;
  amount?: bigint;
  l1TxHash?: Hash;
  l2TxHash?: Hash;
  initiatedAt: bigint;
  initiatedBlock: bigint;
  provenAt?: bigint;
  provenBlock?: bigint;
  provenTxHash?: Hash;
  finalizedAt?: bigint;
  finalizedBlock?: bigint;
  finalizedTxHash?: Hash;
  status: WithdrawalPhase | 'completed';
}

export interface SyncState {
  chain: ChainType;
  lastSyncedBlock: bigint;
  lastSyncedTimestamp: bigint;
  isIndexing: boolean;
}

export interface QueryFilter {
  user?: Address;
  token?: Address;
  type?: TransactionType;
  status?: WithdrawalPhase | 'completed';
  fromBlock?: bigint;
  toBlock?: bigint;
  fromTimestamp?: bigint;
  toTimestamp?: bigint;
  limit?: number;
  offset?: number;
}

export interface WithdrawalStatus {
  transactionId: string;
  phase: WithdrawalPhase;
  canProve: boolean;
  canFinalize: boolean;
  initiatedAt: bigint;
  initiatedTxHash: Hash;
  provenAt?: bigint;
  provenTxHash?: Hash;
  finalizedAt?: bigint;
  finalizedTxHash?: Hash;
  estimatedReadyToProve?: bigint;
  estimatedReadyToFinalize?: bigint;
}

export interface EventSubscriptionCallback {
  (event: BridgeEvent): void | Promise<void>;
}

export interface IndexerClients {
  l1: PublicClient;
  l2: PublicClient;
}

export interface DatabaseRow {
  [key: string]: string | number | bigint | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

export class IndexerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'IndexerError';
  }
}

export class DatabaseError extends IndexerError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'DatabaseError';
  }
}

export class SyncError extends IndexerError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'SyncError';
  }
}

export class RPCError extends IndexerError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'RPCError';
  }
}
