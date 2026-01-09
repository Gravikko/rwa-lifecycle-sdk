import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RWALifecycleSDK } from '../SDK.js';
import {
  TEST_ADDRESSES,
  TEST_TX_HASHES,
  createMockL1Client,
  createMockL2Client,
  setupGasEstimationMock,
  setupCompliantTransferMock,
  setupNonCompliantTransferMock,
} from './mocks.js';

// Mock the module imports
vi.mock('@rwa-lifecycle/bridge', () => ({
  BridgeModule: vi.fn().mockImplementation(() => ({
    depositERC20: vi.fn().mockResolvedValue({
      txHash: TEST_TX_HASHES.DEPOSIT,
      tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
      tokenId: BigInt(1000),
      from: TEST_ADDRESSES.WALLET,
      to: TEST_ADDRESSES.WALLET,
      depositedAt: BigInt(1700000000),
    }),
    depositNFT: vi.fn().mockResolvedValue({
      txHash: TEST_TX_HASHES.DEPOSIT,
      tokenAddress: TEST_ADDRESSES.TOKEN_ERC721,
      tokenId: BigInt(1),
      from: TEST_ADDRESSES.WALLET,
      to: TEST_ADDRESSES.WALLET,
      depositedAt: BigInt(1700000000),
    }),
    initiateERC20Withdrawal: vi.fn().mockResolvedValue({
      txHash: TEST_TX_HASHES.WITHDRAWAL,
      tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
      tokenId: BigInt(500),
      from: TEST_ADDRESSES.WALLET,
      to: TEST_ADDRESSES.WALLET,
      status: 'INITIATED',
      initiatedAt: BigInt(1700000000),
    }),
    initiateERC721Withdrawal: vi.fn().mockResolvedValue({
      txHash: TEST_TX_HASHES.WITHDRAWAL,
      tokenAddress: TEST_ADDRESSES.TOKEN_ERC721,
      tokenId: BigInt(1),
      from: TEST_ADDRESSES.WALLET,
      to: TEST_ADDRESSES.WALLET,
      status: 'INITIATED',
      initiatedAt: BigInt(1700000000),
    }),
    getWithdrawalStatus: vi.fn().mockResolvedValue('waiting-to-prove'),
  })),
}));

vi.mock('@rwa-lifecycle/gas', () => ({
  GasModule: vi.fn().mockImplementation(() => ({
    estimateDepositERC20Cost: vi.fn().mockResolvedValue({
      l2ExecutionFee: BigInt(0),
      l1DataFee: BigInt(4500000000000000),
      totalFee: BigInt(4950000000000000),
      formattedInETH: '0.00495',
      formattedInMNT: '0.00495',
      breakdown: { l2GasEstimate: BigInt(150000), l2GasPrice: BigInt(30000000000) },
    }),
    estimateDepositNFTCost: vi.fn().mockResolvedValue({
      l2ExecutionFee: BigInt(0),
      l1DataFee: BigInt(5000000000000000),
      totalFee: BigInt(5500000000000000),
      formattedInETH: '0.0055',
      formattedInMNT: '0.0055',
      breakdown: { l2GasEstimate: BigInt(200000), l2GasPrice: BigInt(30000000000) },
    }),
    estimateWithdrawERC20InitiateCost: vi.fn().mockResolvedValue({
      l2ExecutionFee: BigInt(200000000000000),
      l1DataFee: BigInt(100000000000000),
      totalFee: BigInt(330000000000000),
      formattedInETH: '0.00033',
      formattedInMNT: '0.00033',
      breakdown: { l2GasEstimate: BigInt(200000), l2GasPrice: BigInt(1000000000) },
    }),
    estimateWithdrawNFTInitiateCost: vi.fn().mockResolvedValue({
      l2ExecutionFee: BigInt(250000000000000),
      l1DataFee: BigInt(120000000000000),
      totalFee: BigInt(407000000000000),
      formattedInETH: '0.000407',
      formattedInMNT: '0.000407',
      breakdown: { l2GasEstimate: BigInt(250000), l2GasPrice: BigInt(1000000000) },
    }),
    getConfig: vi.fn().mockReturnValue({ network: 'testnet', bufferPercentage: 10 }),
  })),
}));

vi.mock('@rwa-lifecycle/indexer', () => ({
  IndexerModule: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    close: vi.fn(),
    transactions: {
      getTransactionsByUser: vi.fn().mockReturnValue({
        items: [
          {
            id: '1',
            eventType: 'ERC20DepositInitiated',
            transactionHash: TEST_TX_HASHES.DEPOSIT,
            from: TEST_ADDRESSES.WALLET,
            to: TEST_ADDRESSES.WALLET,
            token: TEST_ADDRESSES.TOKEN_ERC20,
            amount: BigInt(1000),
            timestamp: BigInt(1700000000),
          },
        ],
        total: 1,
        hasMore: false,
        offset: 0,
        limit: 50,
      }),
    },
    withdrawals: {
      getWithdrawalStatus: vi.fn().mockReturnValue({
        transactionId: '1',
        phase: 'initiated',
        canProve: true,
        canFinalize: false,
        initiatedAt: BigInt(1699996400),
        initiatedTxHash: TEST_TX_HASHES.WITHDRAWAL,
        estimatedReadyToProve: BigInt(1699996412),
      }),
      getAllPendingWithdrawals: vi.fn().mockReturnValue([
        {
          transactionId: '1',
          phase: 'initiated',
          canProve: true,
          canFinalize: false,
          initiatedTxHash: TEST_TX_HASHES.WITHDRAWAL,
        },
      ]),
      getReadyToProve: vi.fn().mockReturnValue([
        {
          transactionId: '1',
          phase: 'initiated',
          canProve: true,
          canFinalize: false,
          initiatedTxHash: TEST_TX_HASHES.WITHDRAWAL,
        },
      ]),
      getReadyToFinalize: vi.fn().mockReturnValue([]),
      getWithdrawalTimeline: vi.fn().mockReturnValue({
        initiated: {
          timestamp: BigInt(1699996400),
          blockNumber: BigInt(1000),
          txHash: TEST_TX_HASHES.WITHDRAWAL,
        },
        estimatedCompletion: BigInt(1700043200),
      }),
    },
    subscription: {
      removeAllSubscriptions: vi.fn(),
    },
  })),
}));

vi.mock('@rwa-lifecycle/compliance', () => ({
  ComplianceModule: vi.fn().mockImplementation(() => ({
    checkCompliance: vi.fn().mockResolvedValue({
      compliant: true,
      tokenStandard: 'ERC20',
    }),
    detectStandard: vi.fn().mockResolvedValue('ERC20'),
    registerPlugin: vi.fn(),
    simulateTransfer: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

describe('RWALifecycleSDK', () => {
  let sdk: RWALifecycleSDK;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (sdk) {
      sdk.shutdown();
    }
  });

  describe('Initialization', () => {
    it('initializes with minimal config (RPC URLs only)', () => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      });

      expect(sdk).toBeDefined();
      expect(sdk.gas).toBeDefined();
      expect(sdk.indexer).toBeDefined();
      expect(sdk.compliance).toBeDefined();
      expect(sdk.bridge).toBeUndefined(); // No wallet = no bridge
    });

    it('initializes with private key and enables bridge', () => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });

      expect(sdk.bridge).toBeDefined();
      expect(sdk.isBridgeEnabled()).toBe(true);
    });

    it('detects testnet network by default', () => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      });

      const config = sdk.getConfig();
      expect(config.network).toBe('testnet');
    });

    it('accepts mainnet configuration', () => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-mainnet.public.blastapi.io',
        l2RpcUrl: 'https://rpc.mantle.xyz',
        network: 'mainnet',
      });

      const config = sdk.getConfig();
      expect(config.network).toBe('mainnet');
    });

    it('throws on invalid configuration', () => {
      expect(() => {
        new RWALifecycleSDK({
          l1RpcUrl: '',
          l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
        });
      }).toThrow();
    });

    it('provides client accessors', () => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      });

      expect(sdk.getL1Client()).toBeDefined();
      expect(sdk.getL2Client()).toBeDefined();
      expect(sdk.getL1WalletClient()).toBeUndefined();
      expect(sdk.getL2WalletClient()).toBeUndefined();
    });

    it('provides wallet clients when private key is set', () => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });

      expect(sdk.getL1WalletClient()).toBeDefined();
      expect(sdk.getL2WalletClient()).toBeDefined();
    });
  });

  describe('Module Access', () => {
    beforeEach(() => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });
    });

    it('provides access to GasModule', () => {
      expect(sdk.gas).toBeDefined();
      expect(typeof sdk.gas.estimateDepositERC20Cost).toBe('function');
    });

    it('provides access to BridgeModule', () => {
      expect(sdk.bridge).toBeDefined();
      expect(typeof sdk.bridge!.depositERC20).toBe('function');
    });

    it('provides access to IndexerModule', () => {
      expect(sdk.indexer).toBeDefined();
      expect(sdk.indexer.transactions).toBeDefined();
      expect(sdk.indexer.withdrawals).toBeDefined();
    });

    it('provides access to ComplianceModule', () => {
      expect(sdk.compliance).toBeDefined();
      expect(typeof sdk.compliance.checkCompliance).toBe('function');
    });
  });

  describe('bridgeWithCompliance', () => {
    beforeEach(() => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });
    });

    it('checks compliance before depositing ERC20', async () => {
      const result = await sdk.bridgeWithCompliance({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt(1000),
        direction: 'deposit',
      });

      expect(result.compliant).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(sdk.compliance.checkCompliance).toHaveBeenCalled();
      expect(sdk.bridge!.depositERC20).toHaveBeenCalled();
    });

    it('checks compliance before withdrawing ERC20', async () => {
      const result = await sdk.bridgeWithCompliance({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt(500),
        direction: 'withdrawal',
      });

      expect(result.compliant).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(sdk.bridge!.initiateERC20Withdrawal).toHaveBeenCalled();
    });

    it('handles ERC721 deposits', async () => {
      const result = await sdk.bridgeWithCompliance({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC721,
        amount: BigInt(1), // tokenId
        direction: 'deposit',
        tokenType: 'ERC721',
      });

      expect(result.compliant).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(sdk.bridge!.depositNFT).toHaveBeenCalled();
    });

    it('handles ERC721 withdrawals', async () => {
      const result = await sdk.bridgeWithCompliance({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC721,
        amount: BigInt(1), // tokenId
        direction: 'withdrawal',
        tokenType: 'ERC721',
      });

      expect(result.compliant).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(sdk.bridge!.initiateERC721Withdrawal).toHaveBeenCalled();
    });

    it('blocks bridge when compliance fails', async () => {
      vi.mocked(sdk.compliance.checkCompliance).mockResolvedValueOnce({
        compliant: false,
        reason: 'Sender not verified',
        tokenStandard: 'ERC3643',
      });

      const result = await sdk.bridgeWithCompliance({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt(1000),
        direction: 'deposit',
      });

      expect(result.compliant).toBe(false);
      expect(result.complianceReason).toBe('Sender not verified');
      expect(result.txHash).toBeUndefined();
      expect(sdk.bridge!.depositERC20).not.toHaveBeenCalled();
    });

    it('throws when bridge not available', async () => {
      const readOnlySDK = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      });

      await expect(
        readOnlySDK.bridgeWithCompliance({
          tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
          amount: BigInt(1000),
          direction: 'deposit',
        })
      ).rejects.toThrow('Bridge not available');

      readOnlySDK.shutdown();
    });
  });

  describe('estimateAndBridge', () => {
    beforeEach(() => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });
    });

    it('estimates gas for ERC20 deposit', async () => {
      const result = await sdk.estimateAndBridge({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt(1000),
        direction: 'deposit',
        dryRun: true,
      });

      expect(result.estimate).toBeDefined();
      expect(result.estimate.totalFee).toBeDefined();
      expect(result.estimate.formattedInETH).toBeDefined();
      expect(result.executed).toBe(false);
      expect(result.reason).toBe('Dry run - no execution');
    });

    it('estimates gas for ERC721 deposit', async () => {
      const result = await sdk.estimateAndBridge({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC721,
        amount: BigInt(1),
        direction: 'deposit',
        tokenType: 'ERC721',
        dryRun: true,
      });

      expect(result.estimate).toBeDefined();
      expect(sdk.gas.estimateDepositNFTCost).toHaveBeenCalled();
    });

    it('estimates gas for ERC20 withdrawal', async () => {
      const result = await sdk.estimateAndBridge({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt(500),
        direction: 'withdrawal',
        dryRun: true,
      });

      expect(result.estimate).toBeDefined();
      expect(sdk.gas.estimateWithdrawERC20InitiateCost).toHaveBeenCalled();
    });

    it('estimates and executes bridge operation', async () => {
      const result = await sdk.estimateAndBridge({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt(1000),
        direction: 'deposit',
        dryRun: false,
      });

      expect(result.estimate).toBeDefined();
      expect(result.executed).toBe(true);
      expect(result.txHash).toBeDefined();
    });

    it('checks compliance before execution when requested', async () => {
      const result = await sdk.estimateAndBridge({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt(1000),
        direction: 'deposit',
        checkCompliance: true,
        dryRun: false,
      });

      expect(sdk.compliance.checkCompliance).toHaveBeenCalled();
      expect(result.compliant).toBe(true);
      expect(result.executed).toBe(true);
    });

    it('blocks execution when compliance fails', async () => {
      vi.mocked(sdk.compliance.checkCompliance).mockResolvedValueOnce({
        compliant: false,
        reason: 'Transfer blocked',
        tokenStandard: 'ERC3643',
      });

      const result = await sdk.estimateAndBridge({
        tokenAddress: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt(1000),
        direction: 'deposit',
        checkCompliance: true,
      });

      expect(result.compliant).toBe(false);
      expect(result.executed).toBe(false);
      expect(result.reason).toContain('Compliance check failed');
    });
  });

  describe('Indexer Convenience Methods', () => {
    beforeEach(() => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });
    });

    it('gets transactions for current wallet', () => {
      const result = sdk.getMyTransactions();

      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
      expect(sdk.indexer.transactions.getTransactionsByUser).toHaveBeenCalled();
    });

    it('gets transactions with filter options', () => {
      sdk.getMyTransactions({
        type: 'deposit',
        limit: 10,
        offset: 5,
      });

      expect(sdk.indexer.transactions.getTransactionsByUser).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'deposit',
          limit: 10,
          offset: 5,
        })
      );
    });

    it('tracks withdrawal status', () => {
      const status = sdk.trackWithdrawal(TEST_TX_HASHES.WITHDRAWAL);

      expect(status).toBeDefined();
      expect(status!.phase).toBe('initiated');
      expect(status!.canProve).toBe(true);
    });

    it('gets pending withdrawals', () => {
      const pending = sdk.getMyPendingWithdrawals();

      expect(pending).toBeInstanceOf(Array);
      expect(sdk.indexer.withdrawals.getAllPendingWithdrawals).toHaveBeenCalled();
    });

    it('gets withdrawals ready to prove', () => {
      const readyToProve = sdk.getWithdrawalsReadyToProve();

      expect(readyToProve).toBeInstanceOf(Array);
      expect(sdk.indexer.withdrawals.getReadyToProve).toHaveBeenCalled();
    });

    it('gets withdrawals ready to finalize', () => {
      const readyToFinalize = sdk.getWithdrawalsReadyToFinalize();

      expect(readyToFinalize).toBeInstanceOf(Array);
      expect(sdk.indexer.withdrawals.getReadyToFinalize).toHaveBeenCalled();
    });

    it('gets withdrawal timeline', () => {
      const timeline = sdk.getWithdrawalTimeline(TEST_TX_HASHES.WITHDRAWAL);

      expect(timeline).toBeDefined();
      expect(timeline.initiated).toBeDefined();
      expect(sdk.indexer.withdrawals.getWithdrawalTimeline).toHaveBeenCalled();
    });

    it('throws when getting transactions without wallet', () => {
      const readOnlySDK = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      });

      expect(() => readOnlySDK.getMyTransactions()).toThrow('No wallet address available');
      readOnlySDK.shutdown();
    });
  });

  describe('Shutdown', () => {
    it('properly shuts down all modules', () => {
      sdk = new RWALifecycleSDK({
        l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
        l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      });

      sdk.shutdown();

      expect(sdk.indexer.close).toHaveBeenCalled();
    });
  });
});
