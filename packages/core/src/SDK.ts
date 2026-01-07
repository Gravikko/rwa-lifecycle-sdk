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
}
