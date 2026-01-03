import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type { SDKConfig } from './types.js';
import { mergeConfig } from './config.js';

// Import modules
// import { BridgeModule } from '@rwa-lifecycle/bridge';
import { GasModule } from '@rwa-lifecycle/gas';
// import { IndexerModule } from '@rwa-lifecycle/indexer';
// import { ComplianceModule } from '@rwa-lifecycle/compliance';
// import { StorageModule } from '@rwa-lifecycle/storage';

/**
 * Main RWA Lifecycle SDK class
 * Orchestrates all modules for managing tokenized real-world assets on Mantle
 */
export class RWALifecycleSDK {
  private config: SDKConfig;
  private l1Client: PublicClient;
  private l2Client: PublicClient;
  private walletClient?: WalletClient;

  // Module instances
  // public bridge: BridgeModule;
  public gas: GasModule;
  // public indexer: IndexerModule;
  // public compliance: ComplianceModule;
  // public storage: StorageModule;

  /**
   * Initialize the RWA Lifecycle SDK
   * @param config SDK configuration
   */
  constructor(config: Partial<SDKConfig>) {
    this.config = mergeConfig(config);

    // Initialize L1 public client
    this.l1Client = createPublicClient({
      chain: this.config.l1ChainId === 1 ? mainnet : sepolia,
      transport: http(this.config.l1RpcUrl),
    });

    // Initialize L2 public client
    this.l2Client = createPublicClient({
      chain: {
        id: this.config.l2ChainId,
        name: this.config.l2ChainId === 5000 ? 'Mantle' : 'Mantle Sepolia',
        nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
        rpcUrls: {
          default: { http: [this.config.l2RpcUrl] },
          public: { http: [this.config.l2RpcUrl] },
        },
      },
      transport: http(this.config.l2RpcUrl),
    });

    // Store wallet client if provided
    this.walletClient = this.config.walletClient;

    // Initialize modules
    // this.bridge = new BridgeModule(this.l1Client, this.l2Client, this.config);

    // Initialize Gas Module
    this.gas = new GasModule({
      l1PublicClient: this.l1Client,
      l2PublicClient: this.l2Client,
      network: this.config.l2ChainId === 5000 ? 'mainnet' : 'testnet',
    });

    // this.indexer = new IndexerModule(this.config.indexerEndpoint);
    // this.compliance = new ComplianceModule();
    // this.storage = new StorageModule(this.config.eigenDABatcherUrl);
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
   * Get wallet client
   */
  getWalletClient(): WalletClient | undefined {
    return this.walletClient;
  }

  /**
   * Get current configuration
   */
  getConfig(): SDKConfig {
    return this.config;
  }
}
