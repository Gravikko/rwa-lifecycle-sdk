import type { IndexerDatabase } from '../database/Database.js';
import type { BridgeEvent, QueryFilter, PaginatedResult } from '../types.js';
import { DatabaseError } from '../types.js';

export class DepositWithdrawalQuery {
  constructor(private db: IndexerDatabase) {}

  getDeposits(filter: QueryFilter = {}): PaginatedResult<BridgeEvent> {
    return this.queryByType('deposit', filter);
  }

  getWithdrawals(filter: QueryFilter = {}): PaginatedResult<BridgeEvent> {
    return this.queryByType('withdrawal', filter);
  }

  getUserDeposits(
    userAddress: string,
    filter: Omit<QueryFilter, 'user'> = {}
  ): PaginatedResult<BridgeEvent> {
    return this.getDeposits({
      ...filter,
      user: userAddress.toLowerCase() as any,
    });
  }

  getUserWithdrawals(
    userAddress: string,
    filter: Omit<QueryFilter, 'user'> = {}
  ): PaginatedResult<BridgeEvent> {
    return this.getWithdrawals({
      ...filter,
      user: userAddress.toLowerCase() as any,
    });
  }

  getDepositByTxHash(txHash: string): BridgeEvent | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM events
        WHERE transaction_hash = ?
        AND event_type IN ('ERC20DepositInitiated', 'ERC721DepositInitiated', 'DepositFinalized')
        ORDER BY log_index ASC
        LIMIT 1
      `);

      const row = stmt.get(txHash.toLowerCase()) as any;
      return row ? this.rowToBridgeEvent(row) : null;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get deposit for tx ${txHash}`,
        error
      );
    }
  }

  getWithdrawalByTxHash(txHash: string): BridgeEvent | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM events
        WHERE transaction_hash = ?
        AND event_type IN ('WithdrawalInitiated', 'WithdrawalProven', 'WithdrawalFinalized')
        ORDER BY log_index ASC
        LIMIT 1
      `);

      const row = stmt.get(txHash.toLowerCase()) as any;
      return row ? this.rowToBridgeEvent(row) : null;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get withdrawal for tx ${txHash}`,
        error
      );
    }
  }

  private queryByType(
    type: 'deposit' | 'withdrawal',
    filter: QueryFilter
  ): PaginatedResult<BridgeEvent> {
    try {
      const { whereClause, params } = this.buildWhereClause(type, filter);
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
      throw new DatabaseError(`Failed to query ${type}s`, error);
    }
  }

  private buildWhereClause(
    type: 'deposit' | 'withdrawal',
    filter: QueryFilter
  ): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (type === 'deposit') {
      conditions.push(
        "(event_type IN ('ERC20DepositInitiated', 'ERC721DepositInitiated', 'DepositFinalized'))"
      );
    } else {
      conditions.push(
        "(event_type IN ('WithdrawalInitiated', 'WithdrawalProven', 'WithdrawalFinalized'))"
      );
    }

    if (filter.user) {
      conditions.push('(from_address = ? OR to_address = ?)');
      const userLower = filter.user.toLowerCase();
      params.push(userLower, userLower);
    }

    if (filter.token) {
      conditions.push('token_address = ?');
      params.push(filter.token.toLowerCase());
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

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

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

  getDepositStats(userAddress?: string): {
    totalDeposits: number;
    erc20Deposits: number;
    erc721Deposits: number;
    totalValue: bigint;
  } {
    try {
      const userFilter = userAddress
        ? 'AND (from_address = ? OR to_address = ?)'
        : '';
      const userParams = userAddress
        ? [userAddress.toLowerCase(), userAddress.toLowerCase()]
        : [];

      const totalStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE event_type IN ('ERC20DepositInitiated', 'ERC721DepositInitiated', 'DepositFinalized')
        ${userFilter}
      `);
      const total = (totalStmt.get(...userParams) as any).count;

      const erc20Stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE event_type IN ('ERC20DepositInitiated', 'DepositFinalized')
        AND amount IS NOT NULL
        ${userFilter}
      `);
      const erc20Count = (erc20Stmt.get(...userParams) as any).count;

      const erc721Stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE event_type = 'ERC721DepositInitiated'
        ${userFilter}
      `);
      const erc721Count = (erc721Stmt.get(...userParams) as any).count;

      return {
        totalDeposits: total,
        erc20Deposits: erc20Count,
        erc721Deposits: erc721Count,
        totalValue: 0n,
      };
    } catch (error) {
      throw new DatabaseError('Failed to get deposit stats', error);
    }
  }

  getWithdrawalStats(userAddress?: string): {
    totalWithdrawals: number;
    initiatedCount: number;
    provenCount: number;
    finalizedCount: number;
  } {
    try {
      const userFilter = userAddress
        ? 'AND (from_address = ? OR to_address = ?)'
        : '';
      const userParams = userAddress
        ? [userAddress.toLowerCase(), userAddress.toLowerCase()]
        : [];

      const totalStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE event_type IN ('WithdrawalInitiated', 'WithdrawalProven', 'WithdrawalFinalized')
        ${userFilter}
      `);
      const total = (totalStmt.get(...userParams) as any).count;

      const initiatedStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE event_type = 'WithdrawalInitiated'
        ${userFilter}
      `);
      const initiated = (initiatedStmt.get(...userParams) as any).count;

      const provenStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE event_type = 'WithdrawalProven'
        ${userFilter}
      `);
      const proven = (provenStmt.get(...userParams) as any).count;

      const finalizedStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE event_type = 'WithdrawalFinalized'
        ${userFilter}
      `);
      const finalized = (finalizedStmt.get(...userParams) as any).count;

      return {
        totalWithdrawals: total,
        initiatedCount: initiated,
        provenCount: proven,
        finalizedCount: finalized,
      };
    } catch (error) {
      throw new DatabaseError('Failed to get withdrawal stats', error);
    }
  }
}
