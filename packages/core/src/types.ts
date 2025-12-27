import type { Address, Hash, PublicClient, WalletClient } from 'viem';

/**
 * Main SDK configuration
 */
export interface SDKConfig {
  /** L1 (Ethereum) chain ID */
  l1ChainId: number;
  /** L2 (Mantle) chain ID */
  l2ChainId: number;
  /** L1 RPC URL */
  l1RpcUrl: string;
  /** L2 RPC URL */
  l2RpcUrl: string;
  /** Wallet client for signing transactions */
  walletClient?: WalletClient;
  /** SubQuery/GraphQL endpoint for indexer */
  indexerEndpoint?: string;
  /** EigenDA batcher URL */
  eigenDABatcherUrl?: string;
  /** Mantle gas oracle contract address */
  gasOracleAddress?: Address;
}

/**
 * Withdrawal status enum
 */
export enum WithdrawalStatus {
  INITIATED = 'INITIATED',
  PROVEN = 'PROVEN',
  READY_FOR_FINALIZATION = 'READY_FOR_FINALIZATION',
  FINALIZED = 'FINALIZED',
}

/**
 * Gas cost breakdown
 */
export interface GasCostEstimate {
  /** L2 execution cost in wei */
  l2ExecutionCost: bigint;
  /** L1 data fee in wei */
  l1DataFee: bigint;
  /** Data availability fee in wei */
  daFee: bigint;
  /** Total cost in wei */
  total: bigint;
  /** Detailed breakdown */
  breakdown: {
    l2Gas: bigint;
    l2GasPrice: bigint;
    l1GasUsed?: bigint;
    l1GasPrice?: bigint;
  };
}

/**
 * RWA metadata structure
 */
export interface RWAMetadata {
  /** Legal document hash (IPFS, EigenDA, etc.) */
  legalDocumentHash: string;
  /** Asset issuance date */
  issuanceDate: number;
  /** Asset issuer address */
  issuer: Address;
  /** Jurisdiction code */
  jurisdiction?: string;
  /** KYC required for transfers */
  kycRequired: boolean;
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Compliance check result
 */
export interface ComplianceResult {
  /** Whether the address is approved */
  approved: boolean;
  /** Reason if not approved */
  reason?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Asset transfer event
 */
export interface TransferEvent {
  /** Event ID */
  id: string;
  /** Token ID */
  tokenId: string;
  /** From address */
  from: Address;
  /** To address */
  to: Address;
  /** Block number */
  blockNumber: bigint;
  /** Timestamp */
  timestamp: bigint;
  /** Transaction hash */
  transactionHash: Hash;
}

/**
 * Asset information
 */
export interface Asset {
  /** Token ID */
  id: string;
  /** Current owner */
  currentOwner: Address;
  /** Minted timestamp */
  mintedAt: bigint;
  /** Number of transfers */
  transferCount: number;
  /** Transfer history */
  transfers?: TransferEvent[];
  /** Metadata */
  metadata?: RWAMetadata;
}
