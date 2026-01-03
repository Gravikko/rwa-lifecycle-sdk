import type { IndexerDatabase } from '../database/Database.js';
import type { BridgeEvent, QueryFilter, PaginatedResult } from '../types.js';
import { DatabaseError } from '../types.js';

export class TransactionQuery {
  constructor(private db: IndexerDatabase) {}

  getTransactions(filter: QueryFilter = {}): PaginatedResult<BridgeEvent> {
    try {
      const { whereClause, params } = this.buildWhereClause(filter);
      const limit = filter.limit || 50;
      const offset = filter.offset || 0;

      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        ${whereClause}
      `);
      const countResult = countStmt.get(...params) as any;
      const total = countResult.count;

      const dataStmt = this.db.prepare(`
        SELECT * FROM events
        ${whereClause}
        ORDER BY block_number DESC, log_index DESC
        LIMIT ? OFFSET ?
      `);

      const rows = dataStmt.all(...params, limit, offset) as any[];
      const items = rows.map((row) => this.rowToBridgeEvent(row));

      return {
        items,
        total,
        hasMore: offset + items.length < total,
        offset,
        limit,
      };
    } catch (error) {
      throw new DatabaseError('Failed to query transactions', error);
    }
  }

  getTransactionsByUser(
    userAddress: string,
    filter: Omit<QueryFilter, 'user'> = {}
  ): PaginatedResult<BridgeEvent> {
    return this.getTransactions({
      ...filter,
      user: userAddress.toLowerCase() as any,
    });
  }

  getTransactionsByToken(
    tokenAddress: string,
    filter: Omit<QueryFilter, 'token'> = {}
  ): PaginatedResult<BridgeEvent> {
    return this.getTransactions({
      ...filter,
      token: tokenAddress.toLowerCase() as any,
    });
  }

  getTransactionByHash(txHash: string): BridgeEvent | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM events
        WHERE transaction_hash = ?
        ORDER BY log_index ASC
        LIMIT 1
      `);

      const row = stmt.get(txHash.toLowerCase()) as any;
      return row ? this.rowToBridgeEvent(row) : null;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get transaction ${txHash}`,
        error
      );
    }
  }

  private buildWhereClause(filter: QueryFilter): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.user) {
      conditions.push('(from_address = ? OR to_address = ?)');
      const userLower = filter.user.toLowerCase();
      params.push(userLower, userLower);
    }

    if (filter.token) {
      conditions.push('token_address = ?');
      params.push(filter.token.toLowerCase());
    }

    if (filter.type) {
      if (filter.type === 'deposit') {
        conditions.push(
          "(event_type IN ('ERC20DepositInitiated', 'ERC721DepositInitiated', 'DepositFinalized'))"
        );
      } else if (filter.type === 'withdrawal') {
        conditions.push(
          "(event_type IN ('WithdrawalInitiated', 'WithdrawalProven', 'WithdrawalFinalized'))"
        );
      }
    }

    if (filter.fromBlock !== undefined) {
      conditions.push('block_number >= ?');
      params.push(Number(filter.fromBlock));
    }

    if (filter.toBlock !== undefined) {
      conditions.push('block_number <= ?');
      params.push(Number(filter.toBlock));
    }

    if (filter.fromTimestamp !== undefined) {
      conditions.push('timestamp >= ?');
      params.push(Number(filter.fromTimestamp));
    }

    if (filter.toTimestamp !== undefined) {
      conditions.push('timestamp <= ?');
      params.push(Number(filter.toTimestamp));
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, params };
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

  getStats(): {
    totalEvents: number;
    depositCount: number;
    withdrawalCount: number;
    uniqueUsers: number;
  } {
    try {
      const totalStmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM events'
      );
      const total = (totalStmt.get() as any).count;

      const depositStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE event_type IN ('ERC20DepositInitiated', 'ERC721DepositInitiated', 'DepositFinalized')
      `);
      const depositCount = (depositStmt.get() as any).count;

      const withdrawalStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE event_type IN ('WithdrawalInitiated', 'WithdrawalProven', 'WithdrawalFinalized')
      `);
      const withdrawalCount = (withdrawalStmt.get() as any).count;

      const usersStmt = this.db.prepare(`
        SELECT COUNT(DISTINCT address) as count FROM (
          SELECT from_address as address FROM events
          UNION
          SELECT to_address as address FROM events
        )
      `);
      const uniqueUsers = (usersStmt.get() as any).count;

      return {
        totalEvents: total,
        depositCount,
        withdrawalCount,
        uniqueUsers,
      };
    } catch (error) {
      throw new DatabaseError('Failed to get stats', error);
    }
  }
}
