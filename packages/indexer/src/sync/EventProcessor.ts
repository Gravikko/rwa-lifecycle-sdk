import type { Log } from 'viem';
import type { IndexerDatabase } from '../database/Database.js';
import type { BridgeEvent, ChainType } from '../types.js';
import { DatabaseError } from '../types.js';
import { EventParser } from '../parsers/EventParser.js';
import type { EventSubscription } from '../subscriptions/EventSubscription.js';

export class EventProcessor {
  private parser: EventParser;
  private subscription?: EventSubscription;

  constructor(private db: IndexerDatabase, subscription?: EventSubscription) {
    this.parser = new EventParser();
    this.subscription = subscription;
  }

  processLogs(logs: Log[], chain: ChainType, timestamp: bigint): number {
    let processedCount = 0;
    const events: BridgeEvent[] = [];

    try {
      this.db.transaction(() => {
        for (const log of logs) {
          const event = this.parser.parseLog(log, chain, timestamp);
          if (event) {
            this.saveEvent(event);
            events.push(event);
            processedCount++;
          }
        }
      });

      if (this.subscription) {
        for (const event of events) {
          this.subscription.emitEvent(event);
        }
      }

      return processedCount;
    } catch (error) {
      throw new DatabaseError('Failed to process logs', error);
    }
  }

  private saveEvent(event: BridgeEvent): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        id,
        chain,
        event_type,
        block_number,
        block_hash,
        transaction_hash,
        log_index,
        timestamp,
        from_address,
        to_address,
        token_address,
        token_id,
        amount,
        data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      event.from.toLowerCase(),
      event.to.toLowerCase(),
      event.token?.toLowerCase() || null,
      event.tokenId ? event.tokenId.toString() : null,
      event.amount ? event.amount.toString() : null,
      event.data || null
    );
  }

  getEventById(eventId: string): BridgeEvent | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM events WHERE id = ?');
      const row = stmt.get(eventId) as any;

      if (!row) {
        return null;
      }

      return this.rowToBridgeEvent(row);
    } catch (error) {
      throw new DatabaseError(`Failed to get event ${eventId}`, error);
    }
  }

  getEventsByTxHash(txHash: string): BridgeEvent[] {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM events WHERE transaction_hash = ? ORDER BY log_index ASC'
      );
      const rows = stmt.all(txHash.toLowerCase()) as any[];

      return rows.map((row) => this.rowToBridgeEvent(row));
    } catch (error) {
      throw new DatabaseError(
        `Failed to get events for tx ${txHash}`,
        error
      );
    }
  }

  getEventsByBlockRange(
    chain: ChainType,
    fromBlock: bigint,
    toBlock: bigint
  ): BridgeEvent[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM events
        WHERE chain = ?
        AND block_number >= ?
        AND block_number <= ?
        ORDER BY block_number ASC, log_index ASC
      `);

      const rows = stmt.all(
        chain,
        Number(fromBlock),
        Number(toBlock)
      ) as any[];

      return rows.map((row) => this.rowToBridgeEvent(row));
    } catch (error) {
      throw new DatabaseError(
        `Failed to get events for block range ${fromBlock}-${toBlock}`,
        error
      );
    }
  }

  private rowToBridgeEvent(row: any): BridgeEvent {
    return {
      id: row.id,
      chain: row.chain,
      eventType: row.event_type,
      blockNumber: BigInt(row.block_number),
      blockHash: row.block_hash,
      transactionHash: row.transaction_hash,
      logIndex: row.log_index,
      timestamp: BigInt(row.timestamp),
      from: row.from_address,
      to: row.to_address,
      token: row.token_address || undefined,
      tokenId: row.token_id ? BigInt(row.token_id) : undefined,
      amount: row.amount ? BigInt(row.amount) : undefined,
      data: row.data || undefined,
    };
  }

  getEventCount(chain?: ChainType): number {
    try {
      const stmt = chain
        ? this.db.prepare('SELECT COUNT(*) as count FROM events WHERE chain = ?')
        : this.db.prepare('SELECT COUNT(*) as count FROM events');

      const row = (chain ? stmt.get(chain) : stmt.get()) as any;
      return row.count;
    } catch (error) {
      throw new DatabaseError('Failed to get event count', error);
    }
  }
}
