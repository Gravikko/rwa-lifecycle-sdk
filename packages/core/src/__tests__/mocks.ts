import { vi } from 'vitest';
import type { PublicClient, WalletClient, Account } from 'viem';

/**
 * Test addresses for mocking
 */
export const TEST_ADDRESSES = {
  WALLET: '0x1234567890123456789012345678901234567890' as const,
  TOKEN_ERC20: '0x2222222222222222222222222222222222222222' as const,
  TOKEN_ERC721: '0x3333333333333333333333333333333333333333' as const,
  RECIPIENT: '0x4444444444444444444444444444444444444444' as const,
  L1_BRIDGE: '0x21F308067241B2028503c07bd7cB3751FFab0Fb2' as const,
  L2_BRIDGE: '0x4200000000000000000000000000000000000010' as const,
  GAS_ORACLE: '0x420000000000000000000000000000000000000F' as const,
};

/**
 * Test transaction hashes
 */
export const TEST_TX_HASHES = {
  DEPOSIT: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const,
  WITHDRAWAL: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const,
  PROVE: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as const,
  FINALIZE: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' as const,
};

/**
 * Create a mock L1 PublicClient
 */
export function createMockL1Client(): PublicClient {
  return {
    chain: { id: 11155111, name: 'Sepolia' },
    getGasPrice: vi.fn().mockResolvedValue(BigInt(30000000000)), // 30 gwei
    estimateGas: vi.fn().mockResolvedValue(BigInt(100000)),
    readContract: vi.fn(),
    getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH
    getBlockNumber: vi.fn().mockResolvedValue(BigInt(1000000)),
    getTransactionReceipt: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
  } as any;
}

/**
 * Create a mock L2 PublicClient
 */
export function createMockL2Client(): PublicClient {
  return {
    chain: { id: 5003, name: 'Mantle Sepolia' },
    getGasPrice: vi.fn().mockResolvedValue(BigInt(1000000000)), // 1 gwei
    estimateGas: vi.fn().mockResolvedValue(BigInt(21000)),
    readContract: vi.fn().mockImplementation(async (args: any) => {
      // Gas oracle mock
      if (args.functionName === 'getL1Fee') {
        return BigInt(50000000000000); // L1 data fee
      }
      return BigInt(0);
    }),
    getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 MNT
    getBlockNumber: vi.fn().mockResolvedValue(BigInt(2000000)),
    getTransactionReceipt: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    simulateContract: vi.fn(),
  } as any;
}

/**
 * Create a mock WalletClient
 */
export function createMockWalletClient(address: `0x${string}` = TEST_ADDRESSES.WALLET): WalletClient {
  const account: Account = {
    address,
    type: 'local',
  } as Account;

  return {
    account,
    chain: { id: 5003, name: 'Mantle Sepolia' },
    writeContract: vi.fn().mockResolvedValue(TEST_TX_HASHES.DEPOSIT),
    sendTransaction: vi.fn().mockResolvedValue(TEST_TX_HASHES.DEPOSIT),
  } as any;
}

/**
 * Create mock wallet clients for both L1 and L2
 */
export function createMockWalletClients(address: `0x${string}` = TEST_ADDRESSES.WALLET) {
  return {
    l1: createMockWalletClient(address),
    l2: createMockWalletClient(address),
  };
}

/**
 * Setup mock for compliant transfer
 */
export function setupCompliantTransferMock(l2Client: any) {
  l2Client.readContract.mockImplementation(async (args: any) => {
    const { functionName } = args;

    // Gas oracle
    if (functionName === 'getL1Fee') {
      return BigInt(50000000000000);
    }

    // ERC3643 support check - return false (plain token)
    if (functionName === 'supportsInterface') {
      return false;
    }

    // Balance check
    if (functionName === 'balanceOf') {
      return BigInt('1000000000000000000000'); // 1000 tokens
    }

    return BigInt(0);
  });

  l2Client.simulateContract.mockResolvedValue({
    request: { gas: BigInt(100000) },
  });
}

/**
 * Setup mock for non-compliant transfer
 */
export function setupNonCompliantTransferMock(l2Client: any) {
  l2Client.readContract.mockImplementation(async (args: any) => {
    const { functionName } = args;

    if (functionName === 'getL1Fee') {
      return BigInt(50000000000000);
    }

    // ERC3643 compliant token
    if (functionName === 'supportsInterface') {
      return true;
    }

    if (functionName === 'canTransfer') {
      return false; // Transfer blocked
    }

    return BigInt(0);
  });
}

/**
 * Setup mock for gas estimation
 */
export function setupGasEstimationMock(l1Client: any, l2Client: any) {
  l1Client.getGasPrice.mockResolvedValue(BigInt(30000000000)); // 30 gwei
  l1Client.estimateGas.mockResolvedValue(BigInt(150000));

  l2Client.getGasPrice.mockResolvedValue(BigInt(1000000000)); // 1 gwei
  l2Client.estimateGas.mockResolvedValue(BigInt(200000));
  l2Client.readContract.mockImplementation(async (args: any) => {
    if (args.functionName === 'getL1Fee') {
      return BigInt(100000000000000); // 0.0001 ETH
    }
    return BigInt(0);
  });
}

/**
 * Create mock IndexerModule data
 */
export function createMockIndexerData() {
  return {
    transactions: [
      {
        id: '1',
        chain: 'l2',
        eventType: 'ERC20DepositInitiated',
        blockNumber: BigInt(1000),
        blockHash: '0xabcd',
        transactionHash: TEST_TX_HASHES.DEPOSIT,
        logIndex: 0,
        timestamp: BigInt(Date.now() / 1000 - 3600),
        from: TEST_ADDRESSES.WALLET,
        to: TEST_ADDRESSES.WALLET,
        token: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt('1000000000000000000'),
      },
      {
        id: '2',
        chain: 'l2',
        eventType: 'WithdrawalInitiated',
        blockNumber: BigInt(2000),
        blockHash: '0xefgh',
        transactionHash: TEST_TX_HASHES.WITHDRAWAL,
        logIndex: 0,
        timestamp: BigInt(Date.now() / 1000 - 1800),
        from: TEST_ADDRESSES.WALLET,
        to: TEST_ADDRESSES.WALLET,
        token: TEST_ADDRESSES.TOKEN_ERC20,
        amount: BigInt('500000000000000000'),
      },
    ],
    withdrawalStatus: {
      transactionId: '2',
      phase: 'initiated' as const,
      canProve: true,
      canFinalize: false,
      initiatedAt: BigInt(Date.now() / 1000 - 1800),
      initiatedTxHash: TEST_TX_HASHES.WITHDRAWAL,
      estimatedReadyToProve: BigInt(Date.now() / 1000 - 1788),
    },
  };
}
