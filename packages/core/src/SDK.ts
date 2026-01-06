import { createPublicClient, http, type PublicClient, type WalletClient } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type { SDKConfig } from './types.js';
import { mergeConfig, validateConfig, TESTNET_DEFAULTS, MAINNET_DEFAULTS } from './config.js';

// Import modules
// import { BridgeModule } from '@rwa-lifecycle/bridge';
import { GasModule } from '@rwa-lifecycle/gas';
// import { IndexerModule } from '@rwa-lifecycle/indexer';
// import { ComplianceModule } from '@rwa-lifecycle/compliance';

/**
 * Internal resolved configuration with all required fields
 */
interface ResolvedConfig extends SDKConfig {
  network: 'mainnet' | 'testnet';
  l1ChainId: number;
  l2ChainId: number;
}

/**
 * Main RWA Lifecycle SDK class
 * Orchestrates all modules for managing tokenized real-world assets on Mantle
 *
 * @example
 * ```typescript
 * const sdk = new RWALifecycleSDK({
 *   l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
 *   l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
 * });
 *
 * // Estimate gas for deposit
 * const cost = await sdk.gas.estimateDepositERC20Cost({
 *   from: '0x...',
 *   l1TokenAddress: '0x...',
 *   l2TokenAddress: '0x...',
 *   amount: BigInt(100e18),
 * });
 * ```
 */
export class RWALifecycleSDK {
  private config: ResolvedConfig;
  private l1Client: PublicClient;
  private l2Client: PublicClient;
  private walletClient?: WalletClient;

  // Module instances
  // public bridge: BridgeModule;
  public gas: GasModule;
  // public indexer: IndexerModule;
  // public compliance: ComplianceModule;

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

    // Initialize L1 public client
    this.l1Client = createPublicClient({
      chain: this.config.l1ChainId === 1 ? mainnet : sepolia,
      transport: http(this.config.l1RpcUrl),
    });

    // Initialize L2 public client (custom chain definition for Mantle)
    this.l2Client = createPublicClient({
      chain: {
        id: this.config.l2ChainId,
        name: this.config.network === 'mainnet' ? 'Mantle' : 'Mantle Sepolia',
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

    // Initialize Gas Module
    this.gas = new GasModule({
      l1PublicClient: this.l1Client,
      l2PublicClient: this.l2Client,
      network: this.config.network,
    });

    // TODO: Phase 5.2 - Initialize other modules
    // this.bridge = new BridgeModule({ ... });
    // this.indexer = new IndexerModule({ ... });
    // this.compliance = new ComplianceModule({ ... });
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
