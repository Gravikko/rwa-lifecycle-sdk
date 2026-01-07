import Database from 'better-sqlite3';
import type { Database as DatabaseType, Statement } from 'better-sqlite3';
import { ALL_SCHEMAS } from './schema.js';
import { DatabaseError } from '../types.js';

// Re-export Statement type for consumers
export type { Statement } from 'better-sqlite3';

export class IndexerDatabase {
  private db: DatabaseType;

  constructor(databasePath: string = './indexer.db') {
    try {
      this.db = new Database(databasePath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.initialize();
    } catch (error) {
      throw new DatabaseError('Failed to initialize database', error);
    }
  }

  private initialize(): void {
    try {
      this.db.exec('BEGIN');
      for (const schema of ALL_SCHEMAS) {
        this.db.exec(schema);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw new DatabaseError('Failed to create database schema', error);
    }
  }

  prepare(sql: string): Statement<unknown[]> {
    try {
      return this.db.prepare(sql);
    } catch (error) {
      throw new DatabaseError(`Failed to prepare statement: ${sql}`, error);
    }
  }

  exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      throw new DatabaseError(`Failed to execute SQL: ${sql}`, error);
    }
  }

  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    try {
      return txn();
    } catch (error) {
      throw new DatabaseError('Transaction failed', error);
    }
  }

  close(): void {
    try {
      this.db.close();
    } catch (error) {
      throw new DatabaseError('Failed to close database', error);
    }
  }

  get isOpen(): boolean {
    return this.db.open;
  }
}
