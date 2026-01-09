import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { SDKConfig } from './types.js';
import {
  mergeConfig,
  validateConfig,
  TESTNET_DEFAULTS,
  MAINNET_DEFAULTS,
  getBridgeContracts,
} from './config.js';

// Import modules
import { BridgeModule } from '@rwa-lifecycle/bridge';
import { GasModule } from '@rwa-lifecycle/gas';
import { IndexerModule } from '@rwa-lifecycle/indexer';
import { ComplianceModule } from '@rwa-lifecycle/compliance';

/**
 * Internal resolved configuration with all required fields
 */
interface ResolvedConfig extends SDKConfig {
  network: 'mainnet' | 'testnet';
  l1ChainId: number;
  l2ChainId: number;
}

/**
 * Mantle L2 chain definition
 */
function getMantleChain(network: 'mainnet' | 'testnet', chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: network === 'mainnet' ? 'Mantle' : 'Mantle Sepolia',
    nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  };
}

/**
 * Main RWA Lifecycle SDK class
 * Orchestrates all modules for managing tokenized real-world assets on Mantle
 *
 * @example
 * ```typescript
 * // Read-only mode (gas estimation, indexing, compliance checks)
 * const sdk = new RWALifecycleSDK({
 *   l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
 *   l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
 * });
 *
 * // With wallet for bridging
 * const sdk = new RWALifecycleSDK({
 *   l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
 *   l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
 *   privateKey: '0x...',
 * });
 *
 * // Estimate gas
 * const cost = await sdk.gas.estimateDepositERC20Cost({ ... });
 *
 * // Bridge tokens (requires wallet)
 * if (sdk.bridge) {
 *   await sdk.bridge.depositERC20({ ... });
 * }
 *
 * // Check compliance
 * const result = await sdk.compliance.checkCompliance('0x...', '0x...', '0x...', 100n);
 * ```
 */
export class RWALifecycleSDK {
  private config: ResolvedConfig;
  private l1Client: PublicClient;
  private l2Client: PublicClient;
  private l1WalletClient?: WalletClient;
  private l2WalletClient?: WalletClient;

  // Module instances
  /** Bridge module - only available when wallet is configured */
  public bridge?: BridgeModule;
  /** Gas estimation module */
  public gas: GasModule;
  /** Event indexer module */
  public indexer: IndexerModule;
  /** Compliance checking module */
  public compliance: ComplianceModule;

  /**
   * Initialize the RWA Lifecycle SDK
   * @param config SDK configuration (only RPC URLs required, everything else has defaults)
   * @throws Error if configuration is invalid
   */
  constructor(config: Partial<SDKConfig>) {
    // Merge with defaults
    const mergedConfig = mergeConfig(config);

    // Validate configuration
    const errors = validateConfig(mergedConfig);
    if (errors.length > 0) {
      throw new Error(`Invalid SDK configuration: ${errors.join(', ')}`);
    }

    // Resolve configuration with guaranteed values
    const defaults = mergedConfig.network === 'mainnet' ? MAINNET_DEFAULTS : TESTNET_DEFAULTS;
    this.config = {
      ...mergedConfig,
      network: mergedConfig.network ?? 'testnet',
      l1ChainId: mergedConfig.l1ChainId ?? defaults.l1ChainId,
      l2ChainId: mergedConfig.l2ChainId ?? defaults.l2ChainId,
    } as ResolvedConfig;

    // Get chain definitions
    const l1Chain = this.config.l1ChainId === 1 ? mainnet : sepolia;
    const l2Chain = getMantleChain(this.config.network, this.config.l2ChainId, this.config.l2RpcUrl);

    // Initialize L1 public client
    this.l1Client = createPublicClient({
      chain: l1Chain,
      transport: http(this.config.l1RpcUrl),
    });

    // Initialize L2 public client
    this.l2Client = createPublicClient({
      chain: l2Chain,
      transport: http(this.config.l2RpcUrl),
    });

    // Initialize wallet clients if private key provided
    if (this.config.privateKey) {
      const account: Account = privateKeyToAccount(this.config.privateKey);

      this.l1WalletClient = createWalletClient({
        account,
        chain: l1Chain,
        transport: http(this.config.l1RpcUrl),
      });

      this.l2WalletClient = createWalletClient({
        account,
        chain: l2Chain,
        transport: http(this.config.l2RpcUrl),
      });
    } else if (this.config.walletClient) {
      // Use provided wallet client (assume it's for L2)
      this.l2WalletClient = this.config.walletClient;
    }

    // Get bridge contract addresses
    const bridgeContracts = this.config.bridgeContracts ?? getBridgeContracts(this.config.network);

    // Initialize Gas Module
    this.gas = new GasModule({
      l1PublicClient: this.l1Client,
      l2PublicClient: this.l2Client,
      network: this.config.network,
    });

    // Initialize Bridge Module (only if wallet clients available)
    if (this.l1WalletClient && this.l2WalletClient) {
      this.bridge = new BridgeModule({
        l1PublicClient: this.l1Client,
        l2PublicClient: this.l2Client,
        l1WalletClient: this.l1WalletClient,
        l2WalletClient: this.l2WalletClient,
        network: this.config.network,
      });
    }

    // Initialize Indexer Module
    this.indexer = new IndexerModule({
      l1RpcUrl: this.config.l1RpcUrl,
      l2RpcUrl: this.config.l2RpcUrl,
      l1BridgeAddress: bridgeContracts.l1StandardBridge!,
      l2BridgeAddress: bridgeContracts.l2StandardBridge!,
      databasePath: this.config.indexerDbPath ?? defaults.indexerDbPath,
      pollInterval: this.config.indexerPollInterval ?? defaults.indexerPollInterval,
      startBlock: this.config.indexerStartBlock,
    });

    // Initialize Compliance Module
    this.compliance = new ComplianceModule({
      publicClient: this.l2Client,
      network: this.config.network,
    });

    // Auto-start indexer if configured
    if (this.config.indexerAutoStart) {
      this.indexer.start().catch((err: Error) => {
        console.error('Failed to auto-start indexer:', err);
      });
    }
  }

  /**
   * Get L1 public client
   */
  getL1Client(): PublicClient {
    return this.l1Client;
  }

  /**
   * Get L2 public client
   */
  getL2Client(): PublicClient {
    return this.l2Client;
  }

  /**
   * Get L1 wallet client
   */
  getL1WalletClient(): WalletClient | undefined {
    return this.l1WalletClient;
  }

  /**
   * Get L2 wallet client
   */
  getL2WalletClient(): WalletClient | undefined {
    return this.l2WalletClient;
  }

  /**
   * Get current configuration
   */
  getConfig(): SDKConfig {
    return this.config;
  }

  /**
   * Check if bridge operations are available
   */
  isBridgeEnabled(): boolean {
    return this.bridge !== undefined;
  }

  /**
   * Stop all background processes (indexer sync, etc.)
   */
  shutdown(): void {
    this.indexer.close();
  }

  // ============================================
  // CONVENIENCE METHODS (Phase 5.3)
  // ============================================

  /**
   * Bridge tokens with compliance check
   *
   * Performs compliance verification before executing the bridge operation.
   * This prevents failed transactions due to compliance restrictions.
   *
   * @param options - Bridge with compliance options
   * @returns Result containing compliance status and transaction hash (if successful)
   *
   * @example
   * ```typescript
   * const result = await sdk.bridgeWithCompliance({
   *   tokenAddress: '0x...',
   *   amount: 1000n,
   *   direction: 'deposit', // or 'withdrawal'
   *   to: '0x...', // optional recipient
   * });
   *
   * if (!result.compliant) {
   *   console.error(`Blocked: ${result.complianceReason}`);
   * } else {
   *   console.log(`Bridged! TX: ${result.txHash}`);
   * }
   * ```
   */
  async bridgeWithCompliance(options: {
    tokenAddress: `0x${string}`;
    amount: bigint;
    direction: 'deposit' | 'withdrawal';
    to?: `0x${string}`;
    tokenType?: 'ERC20' | 'ERC721';
    simulate?: boolean;
  }): Promise<{
    compliant: boolean;
    complianceReason?: string;
    txHash?: `0x${string}`;
    tokenStandard?: string;
  }> {
    if (!this.bridge) {
      throw new Error('Bridge not available. Initialize SDK with a wallet to enable bridging.');
    }

    const walletAddress = this.l2WalletClient?.account?.address ?? this.l1WalletClient?.account?.address;
    if (!walletAddress) {
      throw new Error('No wallet address available');
    }

    const recipient = options.to ?? walletAddress;
    const isDeposit = options.direction === 'deposit';

    // Step 1: Check compliance
    // For deposits: check L1 → L2 transfer compliance
    // For withdrawals: check L2 → L1 transfer compliance
    const complianceResult = await this.compliance.checkCompliance(
      options.tokenAddress,
      walletAddress,
      recipient,
      options.amount,
      { simulate: options.simulate }
    );

    if (!complianceResult.compliant) {
      return {
        compliant: false,
        complianceReason: complianceResult.reason,
        tokenStandard: complianceResult.tokenStandard,
      };
    }

    // Step 2: Execute bridge operation
    let txHash: `0x${string}`;

    if (isDeposit) {
      if (options.tokenType === 'ERC721') {
        const result = await this.bridge.depositNFT(
          options.tokenAddress,
          options.amount, // tokenId for NFT
          { to: recipient }
        );
        txHash = result.txHash;
      } else {
        const result = await this.bridge.depositERC20(
          options.tokenAddress,
          options.amount,
          { to: recipient }
        );
        txHash = result.txHash;
      }
    } else {
      // Withdrawal
      if (options.tokenType === 'ERC721') {
        const result = await this.bridge.initiateERC721Withdrawal(
          options.tokenAddress,
          options.amount, // tokenId for NFT
          { to: recipient }
        );
        txHash = result.txHash;
      } else {
        const result = await this.bridge.initiateERC20Withdrawal(
          options.tokenAddress,
          options.amount,
          { to: recipient }
        );
        txHash = result.txHash;
      }
    }

    return {
      compliant: true,
      txHash,
      tokenStandard: complianceResult.tokenStandard,
    };
  }

  /**
   * Estimate gas, check compliance, and optionally bridge
   *
   * Comprehensive method that:
   * 1. Estimates gas cost for the bridge operation
   * 2. Optionally checks compliance
   * 3. Optionally executes the bridge if user confirms
   *
   * @param options - Estimate and bridge options
   * @returns Result with estimate, compliance status, and transaction hash
   *
   * @example
   * ```typescript
   * // Estimate only (dryRun: true)
   * const estimate = await sdk.estimateAndBridge({
   *   tokenAddress: '0x...',
   *   amount: 1000n,
   *   direction: 'deposit',
   *   dryRun: true,
   * });
   * console.log(`Cost: ${estimate.estimate.formattedInETH} ETH`);
   *
   * // Estimate and execute
   * const result = await sdk.estimateAndBridge({
   *   tokenAddress: '0x...',
   *   amount: 1000n,
   *   direction: 'deposit',
   *   checkCompliance: true,
   * });
   * if (result.executed) {
   *   console.log(`TX: ${result.txHash}`);
   * }
   * ```
   */
  async estimateAndBridge(options: {
    tokenAddress: `0x${string}`;
    amount: bigint;
    direction: 'deposit' | 'withdrawal';
    to?: `0x${string}`;
    tokenType?: 'ERC20' | 'ERC721';
    checkCompliance?: boolean;
    dryRun?: boolean;
  }): Promise<{
    estimate: {
      totalFee: bigint;
      l2ExecutionFee: bigint;
      l1DataFee: bigint;
      formattedInETH: string;
    };
    compliant?: boolean;
    complianceReason?: string;
    executed: boolean;
    txHash?: `0x${string}`;
    reason?: string;
  }> {
    const walletAddress = this.l2WalletClient?.account?.address ?? this.l1WalletClient?.account?.address;
    if (!walletAddress) {
      throw new Error('No wallet address available for gas estimation');
    }

    const recipient = options.to ?? walletAddress;
    const isDeposit = options.direction === 'deposit';

    // Step 1: Estimate gas cost
    let gasEstimate;

    if (isDeposit) {
      if (options.tokenType === 'ERC721') {
        gasEstimate = await this.gas.estimateDepositNFTCost({
          from: walletAddress,
          l1TokenAddress: options.tokenAddress,
          l2TokenAddress: options.tokenAddress,
          tokenId: options.amount,
        });
      } else {
        gasEstimate = await this.gas.estimateDepositERC20Cost({
          from: walletAddress,
          l1TokenAddress: options.tokenAddress,
          l2TokenAddress: options.tokenAddress,
          amount: options.amount,
        });
      }
    } else {
      // Withdrawal - estimate initiation cost
      if (options.tokenType === 'ERC721') {
        gasEstimate = await this.gas.estimateWithdrawNFTInitiateCost({
          from: walletAddress,
          l1TokenAddress: options.tokenAddress, // Same address for standard tokens
          l2TokenAddress: options.tokenAddress,
          tokenId: options.amount,
        });
      } else {
        gasEstimate = await this.gas.estimateWithdrawERC20InitiateCost({
          from: walletAddress,
          l1TokenAddress: options.tokenAddress, // Same address for standard tokens
          l2TokenAddress: options.tokenAddress,
          amount: options.amount,
        });
      }
    }

    const estimate = {
      totalFee: gasEstimate.totalFee,
      l2ExecutionFee: gasEstimate.l2ExecutionFee,
      l1DataFee: gasEstimate.l1DataFee,
      formattedInETH: gasEstimate.formattedInETH,
    };

    // Step 2: Check compliance if requested
    let complianceResult;
    if (options.checkCompliance) {
      complianceResult = await this.compliance.checkCompliance(
        options.tokenAddress,
        walletAddress,
        recipient,
        options.amount
      );

      if (!complianceResult.compliant) {
        return {
          estimate,
          compliant: false,
          complianceReason: complianceResult.reason,
          executed: false,
          reason: `Compliance check failed: ${complianceResult.reason}`,
        };
      }
    }

    // Step 3: Return estimate only if dry run
    if (options.dryRun || !this.bridge) {
      return {
        estimate,
        compliant: complianceResult?.compliant,
        executed: false,
        reason: options.dryRun ? 'Dry run - no execution' : 'Bridge not available',
      };
    }

    // Step 4: Execute bridge operation
    let txHash: `0x${string}`;

    if (isDeposit) {
      if (options.tokenType === 'ERC721') {
        const result = await this.bridge.depositNFT(
          options.tokenAddress,
          options.amount,
          { to: recipient }
        );
        txHash = result.txHash;
      } else {
        const result = await this.bridge.depositERC20(
          options.tokenAddress,
          options.amount,
          { to: recipient }
        );
        txHash = result.txHash;
      }
    } else {
      if (options.tokenType === 'ERC721') {
        const result = await this.bridge.initiateERC721Withdrawal(
          options.tokenAddress,
          options.amount,
          { to: recipient }
        );
        txHash = result.txHash;
      } else {
        const result = await this.bridge.initiateERC20Withdrawal(
          options.tokenAddress,
          options.amount,
          { to: recipient }
        );
        txHash = result.txHash;
      }
    }

    return {
      estimate,
      compliant: complianceResult?.compliant ?? true,
      executed: true,
      txHash,
    };
  }

  // ============================================
  // INDEXER CONVENIENCE METHODS
  // ============================================

  /**
   * Get all transactions for the current wallet
   *
   * Convenience method that queries the indexer for all bridge transactions
   * associated with the connected wallet address.
   *
   * @param options - Query options (type, pagination)
   * @returns Paginated list of bridge transactions
   *
   * @example
   * ```typescript
   * // Get all my transactions
   * const result = await sdk.getMyTransactions();
   * console.log(`Found ${result.total} transactions`);
   *
   * // Get only my deposits
   * const deposits = await sdk.getMyTransactions({ type: 'deposit' });
   *
   * // Get with pagination
   * const page2 = await sdk.getMyTransactions({ limit: 10, offset: 10 });
   * ```
   */
  getMyTransactions(options?: {
    type?: 'deposit' | 'withdrawal';
    limit?: number;
    offset?: number;
    fromBlock?: bigint;
    toBlock?: bigint;
  }) {
    const walletAddress = this.l2WalletClient?.account?.address ?? this.l1WalletClient?.account?.address;
    if (!walletAddress) {
      throw new Error('No wallet address available. Initialize SDK with a wallet.');
    }

    return this.indexer.transactions.getTransactionsByUser(walletAddress, {
      type: options?.type,
      limit: options?.limit,
      offset: options?.offset,
      fromBlock: options?.fromBlock,
      toBlock: options?.toBlock,
    });
  }

  /**
   * Track a withdrawal's progress through the 3-phase process
   *
   * Retrieves the current status of a withdrawal including:
   * - Current phase (initiated, proven, finalized)
   * - Whether it's ready to prove or finalize
   * - Estimated completion times
   *
   * @param initiatedTxHash - Transaction hash from withdrawal initiation
   * @returns Withdrawal status or null if not found
   *
   * @example
   * ```typescript
   * const status = await sdk.trackWithdrawal('0x...');
   *
   * if (status) {
   *   console.log(`Phase: ${status.phase}`);
   *   console.log(`Can prove: ${status.canProve}`);
   *   console.log(`Can finalize: ${status.canFinalize}`);
   *
   *   if (status.estimatedReadyToFinalize) {
   *     const readyTime = new Date(Number(status.estimatedReadyToFinalize) * 1000);
   *     console.log(`Ready to finalize at: ${readyTime}`);
   *   }
   * }
   * ```
   */
  trackWithdrawal(initiatedTxHash: `0x${string}`) {
    return this.indexer.withdrawals.getWithdrawalStatus(initiatedTxHash);
  }

  /**
   * Get all pending withdrawals for the current wallet
   *
   * Returns all withdrawals that haven't been finalized yet,
   * useful for displaying a "pending withdrawals" list in UI.
   *
   * @returns Array of pending withdrawal statuses
   *
   * @example
   * ```typescript
   * const pending = await sdk.getMyPendingWithdrawals();
   *
   * for (const withdrawal of pending) {
   *   console.log(`TX: ${withdrawal.initiatedTxHash}`);
   *   console.log(`Phase: ${withdrawal.phase}`);
   *
   *   if (withdrawal.canProve) {
   *     console.log('Ready to prove!');
   *   } else if (withdrawal.canFinalize) {
   *     console.log('Ready to finalize!');
   *   }
   * }
   * ```
   */
  getMyPendingWithdrawals() {
    const walletAddress = this.l2WalletClient?.account?.address ?? this.l1WalletClient?.account?.address;
    if (!walletAddress) {
      throw new Error('No wallet address available. Initialize SDK with a wallet.');
    }

    return this.indexer.withdrawals.getAllPendingWithdrawals(walletAddress);
  }

  /**
   * Get withdrawals that are ready to prove
   *
   * Filters pending withdrawals to only those that have passed
   * the proof maturity delay and can be proven on L1.
   *
   * @returns Array of withdrawal statuses ready for proving
   *
   * @example
   * ```typescript
   * const readyToProve = await sdk.getWithdrawalsReadyToProve();
   *
   * for (const withdrawal of readyToProve) {
   *   console.log(`Can prove: ${withdrawal.initiatedTxHash}`);
   *   // Call bridge.proveWithdrawal(withdrawal.initiatedTxHash)
   * }
   * ```
   */
  getWithdrawalsReadyToProve() {
    const walletAddress = this.l2WalletClient?.account?.address ?? this.l1WalletClient?.account?.address;
    return this.indexer.withdrawals.getReadyToProve(walletAddress);
  }

  /**
   * Get withdrawals that are ready to finalize
   *
   * Filters pending withdrawals to only those that have been proven
   * and passed the challenge period, ready for finalization on L1.
   *
   * @returns Array of withdrawal statuses ready for finalization
   *
   * @example
   * ```typescript
   * const readyToFinalize = await sdk.getWithdrawalsReadyToFinalize();
   *
   * for (const withdrawal of readyToFinalize) {
   *   console.log(`Can finalize: ${withdrawal.initiatedTxHash}`);
   *   // Call bridge.finalizeWithdrawal(withdrawal.initiatedTxHash)
   * }
   * ```
   */
  getWithdrawalsReadyToFinalize() {
    const walletAddress = this.l2WalletClient?.account?.address ?? this.l1WalletClient?.account?.address;
    return this.indexer.withdrawals.getReadyToFinalize(walletAddress);
  }

  /**
   * Get detailed timeline for a withdrawal
   *
   * Returns timestamps for each phase of the withdrawal process,
   * useful for displaying progress in a UI.
   *
   * @param initiatedTxHash - Transaction hash from withdrawal initiation
   * @returns Timeline with initiated, proven, finalized timestamps
   *
   * @example
   * ```typescript
   * const timeline = await sdk.getWithdrawalTimeline('0x...');
   *
   * if (timeline.initiated) {
   *   console.log(`Initiated: ${new Date(Number(timeline.initiated.timestamp) * 1000)}`);
   * }
   * if (timeline.proven) {
   *   console.log(`Proven: ${new Date(Number(timeline.proven.timestamp) * 1000)}`);
   * }
   * if (timeline.finalized) {
   *   console.log(`Finalized: ${new Date(Number(timeline.finalized.timestamp) * 1000)}`);
   * }
   * if (timeline.estimatedCompletion) {
   *   console.log(`ETA: ${new Date(Number(timeline.estimatedCompletion) * 1000)}`);
   * }
   * ```
   */
  getWithdrawalTimeline(initiatedTxHash: `0x${string}`) {
    return this.indexer.withdrawals.getWithdrawalTimeline(initiatedTxHash);
  }
}
