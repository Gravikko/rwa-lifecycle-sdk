import type { IndexerDatabase } from '../database/Database.js';
import type { ChainType, SyncState } from '../types.js';
import { DatabaseError } from '../types.js';
import type { SyncStateRow } from '../database/schema.js';

export class BlockTracker {
  constructor(private db: IndexerDatabase) {}

  getSyncState(chain: ChainType): SyncState {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM sync_state WHERE chain = ?'
      );
      const row = stmt.get(chain) as SyncStateRow | undefined;

      if (!row) {
        return {
          chain,
          lastSyncedBlock: 0n,
          lastSyncedTimestamp: 0n,
          isIndexing: false,
        };
      }

      return {
        chain: row.chain as ChainType,
        lastSyncedBlock: BigInt(row.last_synced_block),
        lastSyncedTimestamp: BigInt(row.last_synced_timestamp),
        isIndexing: row.is_indexing === 1,
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get sync state for ${chain}`, error);
    }
  }

  updateSyncState(
    chain: ChainType,
    blockNumber: bigint,
    timestamp: bigint
  ): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE sync_state
        SET last_synced_block = ?,
            last_synced_timestamp = ?,
            updated_at = strftime('%s', 'now')
        WHERE chain = ?
      `);

      stmt.run(Number(blockNumber), Number(timestamp), chain);
    } catch (error) {
      throw new DatabaseError(
        `Failed to update sync state for ${chain}`,
        error
      );
    }
  }

  setIndexingStatus(chain: ChainType, isIndexing: boolean): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE sync_state
        SET is_indexing = ?,
            updated_at = strftime('%s', 'now')
        WHERE chain = ?
      `);

      stmt.run(isIndexing ? 1 : 0, chain);
    } catch (error) {
      throw new DatabaseError(
        `Failed to set indexing status for ${chain}`,
        error
      );
    }
  }

  getAllSyncStates(): { l1: SyncState; l2: SyncState } {
    return {
      l1: this.getSyncState('l1'),
      l2: this.getSyncState('l2'),
    };
  }

  resetSyncState(chain: ChainType): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE sync_state
        SET last_synced_block = 0,
            last_synced_timestamp = 0,
            is_indexing = 0,
            updated_at = strftime('%s', 'now')
        WHERE chain = ?
      `);

      stmt.run(chain);
    } catch (error) {
      throw new DatabaseError(`Failed to reset sync state for ${chain}`, error);
    }
  }

  handleReorg(chain: ChainType, newBlockNumber: bigint): void {
    try {
      this.db.transaction(() => {
        const deleteEventsStmt = this.db.prepare(
          'DELETE FROM events WHERE chain = ? AND block_number > ?'
        );
        deleteEventsStmt.run(chain, Number(newBlockNumber));

        const deleteTransactionsStmt = this.db.prepare(`
          DELETE FROM transactions
          WHERE id IN (
            SELECT DISTINCT id FROM transactions t
            WHERE (t.type = 'deposit' AND EXISTS (
              SELECT 1 FROM events e
              WHERE e.chain = ?
              AND e.block_number > ?
              AND e.transaction_hash = t.l2_tx_hash
            ))
            OR (t.type = 'withdrawal' AND EXISTS (
              SELECT 1 FROM events e
              WHERE e.chain = ?
              AND e.block_number > ?
              AND (e.transaction_hash = t.l2_tx_hash
                   OR e.transaction_hash = t.l1_tx_hash
                   OR e.transaction_hash = t.proven_tx_hash
                   OR e.transaction_hash = t.finalized_tx_hash)
            ))
          )
        `);
        deleteTransactionsStmt.run(
          chain,
          Number(newBlockNumber),
          chain,
          Number(newBlockNumber)
        );

        const currentState = this.getSyncState(chain);
        const blockToRevert = newBlockNumber - 1n;

        this.updateSyncState(
          chain,
          blockToRevert,
          currentState.lastSyncedTimestamp
        );
      })();
    } catch (error) {
      throw new DatabaseError(`Failed to handle reorg for ${chain}`, error);
    }
  }
}
