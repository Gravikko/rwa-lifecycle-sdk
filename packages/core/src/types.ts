import type { Address, Hash, PublicClient, WalletClient } from 'viem';

// ============================================
// RE-EXPORTS FROM MODULES
// ============================================

// Re-export types from modules to avoid duplication
// Users can import from @rwa-lifecycle/core or directly from modules

export type { GasCostEstimate, GasConfig, GasEstimateOptions } from '@rwa-lifecycle/gas';
export type {
  ComplianceResult,
  ComplianceConfig,
  ICompliancePlugin,
  PluginCheckConfig,
  PluginCheckResult,
  TokenStandard as ComplianceTokenStandard,
} from '@rwa-lifecycle/compliance';
export type {
  BridgeConfig,
  WithdrawalOptions,
  DepositOptions,
  WithdrawalInfo,
  DepositInfo,
  WithdrawalStatus as BridgeWithdrawalStatus,
  BridgeDirection,
  TokenStandard as BridgeTokenStandard,
} from '@rwa-lifecycle/bridge';
export type {
  IndexerConfig,
  BridgeEvent,
  BridgeTransaction,
  QueryFilter,
  WithdrawalStatus as IndexerWithdrawalStatus,
  SyncState,
  PaginatedResult,
} from '@rwa-lifecycle/indexer';

// ============================================
// CORE SDK CONFIGURATION
// ============================================

/**
 * Main SDK configuration
 *
 * Combines configuration for all modules with sensible defaults.
 * Only RPC URLs are required - everything else has defaults.
 *
 * @example
 * ```typescript
 * const sdk = new RWALifecycleSDK({
 *   l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
 *   l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
 *   walletClient: myWalletClient, // optional, for transactions
 * });
 * ```
 */
export interface SDKConfig {
  // ============================================
  // NETWORK CONFIGURATION (Required)
  // ============================================

  /** L1 (Ethereum) RPC URL */
  l1RpcUrl: string;

  /** L2 (Mantle) RPC URL */
  l2RpcUrl: string;

  // ============================================
  // NETWORK CONFIGURATION (Optional - auto-detected from chainId)
  // ============================================

  /** Network mode: 'mainnet' or 'testnet' (auto-detected if not provided) */
  network?: 'mainnet' | 'testnet';

  /** L1 (Ethereum) chain ID (default: 11155111 for Sepolia, 1 for Mainnet) */
  l1ChainId?: number;

  /** L2 (Mantle) chain ID (default: 5003 for Sepolia, 5000 for Mainnet) */
  l2ChainId?: number;

  // ============================================
  // WALLET CONFIGURATION (Optional - needed for transactions)
  // ============================================

  /**
   * Wallet client for signing transactions
   * If provided, enables bridge deposit/withdrawal operations
   */
  walletClient?: WalletClient;

  /**
   * Private key for signing (alternative to walletClient)
   * If provided, SDK creates wallet clients automatically
   * Format: '0x...' (64 hex chars)
   */
  privateKey?: `0x${string}`;

  // ============================================
  // GAS MODULE CONFIGURATION
  // ============================================

  /** Custom gas oracle address (default: 0x420...00F) */
  gasOracleAddress?: Address;

  /** Safety buffer percentage for gas estimates (default: 10) */
  gasBufferPercentage?: number;

  // ============================================
  // INDEXER MODULE CONFIGURATION
  // ============================================

  /** Path to SQLite database file (default: ./.rwa-data/indexer.db) */
  indexerDbPath?: string;

  /** Polling interval in milliseconds (default: 12000 - Mantle block time) */
  indexerPollInterval?: number;

  /** Auto-start indexer on SDK initialization (default: false) */
  indexerAutoStart?: boolean;

  /** Starting block for historical sync (optional) */
  indexerStartBlock?: {
    l1?: bigint;
    l2?: bigint;
  };

  // ============================================
  // BRIDGE CONTRACT OVERRIDES (Optional)
  // ============================================

  /**
   * Custom bridge contract addresses
   * Only needed if using non-standard deployments
   * Defaults are loaded based on network (testnet/mainnet)
   */
  bridgeContracts?: {
    l1StandardBridge?: Address;
    l2StandardBridge?: Address;
    l1ERC721Bridge?: Address;
    l2ERC721Bridge?: Address;
    optimismPortal?: Address;
    l2OutputOracle?: Address;
  };
}

// ============================================
// CORE SDK TYPES
// ============================================

/**
 * Simplified withdrawal status enum for Core SDK
 * Use BridgeWithdrawalStatus or IndexerWithdrawalStatus for module-specific types
 */
export enum WithdrawalStatus {
  INITIATED = 'INITIATED',
  PROVEN = 'PROVEN',
  READY_FOR_FINALIZATION = 'READY_FOR_FINALIZATION',
  FINALIZED = 'FINALIZED',
}

/**
 * RWA token metadata structure
 */
export interface RWAMetadata {
  /** Legal document hash (IPFS, Arweave, etc.) */
  legalDocumentHash: string;

  /** Asset issuance date (Unix timestamp) */
  issuanceDate: number;

  /** Asset issuer address */
  issuer: Address;

  /** Jurisdiction code (ISO 3166-1 alpha-2) */
  jurisdiction?: string;

  /** Whether KYC is required for transfers */
  kycRequired: boolean;

  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * Asset information (for indexer queries)
 */
export interface Asset {
  /** Token ID */
  id: string;

  /** Current owner address */
  currentOwner: Address;

  /** Minted timestamp (Unix) */
  mintedAt: bigint;

  /** Number of transfers */
  transferCount: number;

  /** Transfer history (optional) */
  transfers?: TransferEvent[];

  /** Metadata (optional) */
  metadata?: RWAMetadata;
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

// ============================================
// CONVENIENCE TYPES
// ============================================

/**
 * Result of bridgeWithCompliance operation
 */
export interface BridgeWithComplianceResult {
  /** Whether compliance check passed */
  compliant: boolean;

  /** Compliance failure reason (if not compliant) */
  complianceReason?: string;

  /** Transaction hash (if bridged successfully) */
  txHash?: Hash;

  /** Detected token standard */
  tokenStandard?: string;
}

/**
 * Result of estimateAndBridge operation
 */
export interface EstimateAndBridgeResult {
  /** Gas cost estimate */
  estimate: {
    totalFee: bigint;
    l2ExecutionFee: bigint;
    l1DataFee: bigint;
    formattedInETH: string;
  };

  /** Whether bridge was executed */
  executed: boolean;

  /** Transaction hash (if executed) */
  txHash?: Hash;

  /** Reason if not executed */
  reason?: string;
}

/**
 * Options for SDK initialization with module selection
 */
export interface SDKInitOptions {
  /** Enable Bridge module (default: true if walletClient provided) */
  enableBridge?: boolean;

  /** Enable Indexer module (default: true) */
  enableIndexer?: boolean;

  /** Enable Compliance module (default: true) */
  enableCompliance?: boolean;

  /** Enable Gas module (default: true) */
  enableGas?: boolean;
}
