import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexerDatabase } from '../src/database/Database.js';
import { TransactionQuery } from '../src/query/TransactionQuery.js';
import { EventProcessor } from '../src/sync/EventProcessor.js';
import { getTestDbPath, cleanupTestDb } from './setup.js';
import { createMockEvents } from './mocks.js';

describe('TransactionQuery', () => {
  let db: IndexerDatabase;
  let query: TransactionQuery;
  let processor: EventProcessor;
  let dbPath: string;

  beforeEach(() => {
    dbPath = getTestDbPath('transaction-query-test');
    db = new IndexerDatabase(dbPath);
    query = new TransactionQuery(db);
    processor = new EventProcessor(db);
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('getTransactions', () => {
    it('should return empty result when no events', () => {
      const result = query.getTransactions();

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return all transactions', () => {
      const events = createMockEvents(5);
      events.forEach((event) => {
        processor.processLogs(
          [{ data: '0x', topics: [] } as any],
          'l2',
          event.timestamp
        );
      });

      db.transaction(() => {
        events.forEach((event) => {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO events (
              id, chain, event_type, block_number, block_hash,
              transaction_hash, log_index, timestamp, from_address, to_address,
              token_address, amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            event.id,
            event.chain,
            event.eventType,
            Number(event.blockNumber),
            event.blockHash,
            event.transactionHash,
            event.logIndex,
            Number(event.timestamp),
            event.from,
            event.to,
            event.token || null,
            event.amount ? event.amount.toString() : null
          );
        });
      });

      const result = query.getTransactions();

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(false);
    });

    it('should paginate results', () => {
      const events = createMockEvents(10);
      db.transaction(() => {
        events.forEach((event) => {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO events (
              id, chain, event_type, block_number, block_hash,
              transaction_hash, log_index, timestamp, from_address, to_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            event.id,
            event.chain,
            event.eventType,
            Number(event.blockNumber),
            event.blockHash,
            event.transactionHash,
            event.logIndex,
            Number(event.timestamp),
            event.from,
            event.to
          );
        });
      });

      const page1 = query.getTransactions({ limit: 5, offset: 0 });
      expect(page1.items).toHaveLength(5);
      expect(page1.total).toBe(10);
      expect(page1.hasMore).toBe(true);

      const page2 = query.getTransactions({ limit: 5, offset: 5 });
      expect(page2.items).toHaveLength(5);
      expect(page2.total).toBe(10);
      expect(page2.hasMore).toBe(false);
    });

    it('should filter by user address', () => {
      const userAddress = '0x1234567890123456789012345678901234567890';
      const events = [
        ...createMockEvents(3).map((e) => ({ ...e, from: userAddress })),
        ...createMockEvents(2).map((e, i) => ({
          ...e,
          id: `other-${i}`,
          from: '0x9999999999999999999999999999999999999999',
        })),
      ];

      db.transaction(() => {
        events.forEach((event) => {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO events (
              id, chain, event_type, block_number, block_hash,
              transaction_hash, log_index, timestamp, from_address, to_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            event.id,
            event.chain,
            event.eventType,
            Number(event.blockNumber),
            event.blockHash,
            event.transactionHash,
            event.logIndex,
            Number(event.timestamp),
            event.from,
            event.to
          );
        });
      });

      const result = query.getTransactions({ user: userAddress as any });

      expect(result.total).toBe(3);
      result.items.forEach((item) => {
        expect(item.from.toLowerCase()).toBe(userAddress.toLowerCase());
      });
    });

    it('should filter by token address', () => {
      const tokenAddress = '0xtoken1234567890123456789012345678901234567890';
      const events = [
        ...createMockEvents(2).map((e) => ({ ...e, token: tokenAddress })),
        ...createMockEvents(3).map((e, i) => ({
          ...e,
          id: `other-${i}`,
          token: '0x9999999999999999999999999999999999999999',
        })),
      ];

      db.transaction(() => {
        events.forEach((event) => {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO events (
              id, chain, event_type, block_number, block_hash,
              transaction_hash, log_index, timestamp, from_address, to_address, token_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            event.id,
            event.chain,
            event.eventType,
            Number(event.blockNumber),
            event.blockHash,
            event.transactionHash,
            event.logIndex,
            Number(event.timestamp),
            event.from,
            event.to,
            event.token || null
          );
        });
      });

      const result = query.getTransactions({ token: tokenAddress as any });

      expect(result.total).toBe(2);
    });

    it('should filter by deposit type', () => {
      const events = [
        createMockEvents(2, 'l2').map((e) => ({
          ...e,
          eventType: 'DepositFinalized' as const,
        }))[0],
        createMockEvents(1, 'l2').map((e) => ({
          ...e,
          id: 'withdraw-1',
          eventType: 'WithdrawalInitiated' as const,
        }))[0],
      ];

      db.transaction(() => {
        events.forEach((event) => {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO events (
              id, chain, event_type, block_number, block_hash,
              transaction_hash, log_index, timestamp, from_address, to_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            event.id,
            event.chain,
            event.eventType,
            Number(event.blockNumber),
            event.blockHash,
            event.transactionHash,
            event.logIndex,
            Number(event.timestamp),
            event.from,
            event.to
          );
        });
      });

      const result = query.getTransactions({ type: 'deposit' });

      expect(result.total).toBe(1);
      expect(result.items[0].eventType).toBe('DepositFinalized');
    });
  });

  describe('getTransactionByHash', () => {
    it('should return transaction by hash', () => {
      const event = createMockEvents(1)[0];

      db.transaction(() => {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO events (
            id, chain, event_type, block_number, block_hash,
            transaction_hash, log_index, timestamp, from_address, to_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          event.id,
          event.chain,
          event.eventType,
          Number(event.blockNumber),
          event.blockHash,
          event.transactionHash,
          event.logIndex,
          Number(event.timestamp),
          event.from,
          event.to
        );
      });

      const result = query.getTransactionByHash(event.transactionHash);

      expect(result).not.toBeNull();
      expect(result?.transactionHash).toBe(event.transactionHash);
    });

    it('should return null when transaction not found', () => {
      const result = query.getTransactionByHash('0xnonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const events = [
        ...createMockEvents(3, 'l2').map((e) => ({
          ...e,
          eventType: 'DepositFinalized' as const,
        })),
        ...createMockEvents(2, 'l2').map((e, i) => ({
          ...e,
          id: `withdraw-${i}`,
          transactionHash: `0xwithdraw${i}`,
          eventType: 'WithdrawalInitiated' as const,
        })),
      ];

      db.transaction(() => {
        events.forEach((event) => {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO events (
              id, chain, event_type, block_number, block_hash,
              transaction_hash, log_index, timestamp, from_address, to_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            event.id,
            event.chain,
            event.eventType,
            Number(event.blockNumber),
            event.blockHash,
            event.transactionHash,
            event.logIndex,
            Number(event.timestamp),
            event.from,
            event.to
          );
        });
      });

      const stats = query.getStats();

      expect(stats.totalEvents).toBe(5);
      expect(stats.depositCount).toBe(3);
      expect(stats.withdrawalCount).toBe(2);
      expect(stats.uniqueUsers).toBeGreaterThan(0);
    });
  });
});
