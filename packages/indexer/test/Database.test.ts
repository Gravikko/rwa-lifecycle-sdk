import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexerDatabase } from '../src/database/Database.js';
import { getTestDbPath, cleanupTestDb } from './setup.js';

describe('IndexerDatabase', () => {
  let db: IndexerDatabase;
  let dbPath: string;

  beforeEach(() => {
    dbPath = getTestDbPath('database-test');
    db = new IndexerDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  it('should create database with schema', () => {
    expect(db.isOpen).toBe(true);

    const stmt = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tables = stmt.all() as any[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('events');
    expect(tableNames).toContain('transactions');
    expect(tableNames).toContain('sync_state');
  });

  it('should initialize sync_state with l1 and l2', () => {
    const stmt = db.prepare('SELECT * FROM sync_state');
    const rows = stmt.all() as any[];

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.chain === 'l1')).toBeDefined();
    expect(rows.find((r) => r.chain === 'l2')).toBeDefined();
  });

  it('should execute transactions', () => {
    const result = db.transaction(() => {
      const stmt = db.prepare(
        'INSERT INTO events (id, chain, event_type, block_number, block_hash, transaction_hash, log_index, timestamp, from_address, to_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      stmt.run(
        'test-1',
        'l2',
        'DepositFinalized',
        1000,
        '0xblock',
        '0xtx',
        0,
        1700000000,
        '0xfrom',
        '0xto'
      );
      return 'success';
    });

    expect(result).toBe('success');

    const stmt = db.prepare('SELECT * FROM events WHERE id = ?');
    const row = stmt.get('test-1');
    expect(row).toBeDefined();
  });

  it('should rollback failed transactions', () => {
    expect(() => {
      db.transaction(() => {
        const stmt = db.prepare(
          'INSERT INTO events (id, chain, event_type, block_number, block_hash, transaction_hash, log_index, timestamp, from_address, to_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        stmt.run(
          'test-1',
          'l2',
          'DepositFinalized',
          1000,
          '0xblock',
          '0xtx',
          0,
          1700000000,
          '0xfrom',
          '0xto'
        );
        throw new Error('Intentional error');
      });
    }).toThrow();

    const stmt = db.prepare('SELECT * FROM events WHERE id = ?');
    const row = stmt.get('test-1');
    expect(row).toBeUndefined();
  });

  it('should handle prepared statements', () => {
    const insertStmt = db.prepare(
      'INSERT INTO events (id, chain, event_type, block_number, block_hash, transaction_hash, log_index, timestamp, from_address, to_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    insertStmt.run(
      'test-1',
      'l2',
      'DepositFinalized',
      1000,
      '0xblock',
      '0xtx1',
      0,
      1700000000,
      '0xfrom',
      '0xto'
    );
    insertStmt.run(
      'test-2',
      'l2',
      'DepositFinalized',
      1001,
      '0xblock',
      '0xtx2',
      0,
      1700000001,
      '0xfrom',
      '0xto'
    );

    const selectStmt = db.prepare('SELECT COUNT(*) as count FROM events');
    const result = selectStmt.get() as any;
    expect(result.count).toBe(2);
  });

  it('should close database', () => {
    db.close();
    expect(db.isOpen).toBe(false);
  });
});
