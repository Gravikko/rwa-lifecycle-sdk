import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexerModule } from '../src/IndexerModule.js';
import { getTestDbPath, cleanupTestDb } from './setup.js';

describe('IndexerModule Integration', () => {
  let indexer: IndexerModule;
  let dbPath: string;

  beforeEach(() => {
    dbPath = getTestDbPath('indexer-module-test');
  });

  afterEach(() => {
    if (indexer) {
      indexer.close();
    }
    cleanupTestDb(dbPath);
  });

  it('should initialize with all components', () => {
    indexer = new IndexerModule({
      l1RpcUrl: 'https://rpc.sepolia.eth.gateway.fm',
      l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      l1BridgeAddress: '0x21F308067241B2028503c07bd7cB3751FFab0Fb2',
      l2BridgeAddress: '0x4200000000000000000000000000000000000010',
      databasePath: dbPath,
    });

    expect(indexer.transactions).toBeDefined();
    expect(indexer.deposits).toBeDefined();
    expect(indexer.withdrawals).toBeDefined();
    expect(indexer.subscription).toBeDefined();
  });

  it('should access query methods', () => {
    indexer = new IndexerModule({
      l1RpcUrl: 'https://rpc.sepolia.eth.gateway.fm',
      l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      l1BridgeAddress: '0x21F308067241B2028503c07bd7cB3751FFab0Fb2',
      l2BridgeAddress: '0x4200000000000000000000000000000000000010',
      databasePath: dbPath,
    });

    const transactions = indexer.transactions.getTransactions();
    expect(transactions.items).toHaveLength(0);
    expect(transactions.total).toBe(0);

    const deposits = indexer.deposits.getDeposits();
    expect(deposits.items).toHaveLength(0);

    const stats = indexer.transactions.getStats();
    expect(stats.totalEvents).toBe(0);
  });

  it('should handle subscriptions', () => {
    indexer = new IndexerModule({
      l1RpcUrl: 'https://rpc.sepolia.eth.gateway.fm',
      l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      l1BridgeAddress: '0x21F308067241B2028503c07bd7cB3751FFab0Fb2',
      l2BridgeAddress: '0x4200000000000000000000000000000000000010',
      databasePath: dbPath,
    });

    const events: any[] = [];
    const unsubscribe = indexer.subscription.onEvent((event) => {
      events.push(event);
    });

    expect(typeof unsubscribe).toBe('function');

    unsubscribe();
    indexer.subscription.removeAllSubscriptions();
  });

  it('should close cleanly', () => {
    indexer = new IndexerModule({
      l1RpcUrl: 'https://rpc.sepolia.eth.gateway.fm',
      l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
      l1BridgeAddress: '0x21F308067241B2028503c07bd7cB3751FFab0Fb2',
      l2BridgeAddress: '0x4200000000000000000000000000000000000010',
      databasePath: dbPath,
    });

    expect(() => indexer.close()).not.toThrow();
  });
});
