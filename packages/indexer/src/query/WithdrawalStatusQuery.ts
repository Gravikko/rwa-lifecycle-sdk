import type { Hash } from 'viem';
import type { IndexerDatabase } from '../database/Database.js';
import type { WithdrawalStatus, WithdrawalPhase } from '../types.js';
import { DatabaseError } from '../types.js';

// Mantle uses OP Succinct (ZK proofs) - finalization is ~12 hours, not 7 days
const CHALLENGE_PERIOD_SECONDS = 12n * 60n * 60n; // 12 hours (43200 seconds)
const PROOF_MATURITY_DELAY_SECONDS = 12n; // 12 seconds after initiation

export class WithdrawalStatusQuery {
  constructor(private db: IndexerDatabase) {}

  getWithdrawalStatus(initiatedTxHash: string): WithdrawalStatus | null {
    try {
      const initiated = this.getWithdrawalInitiated(initiatedTxHash);
      if (!initiated) {
        return null;
      }

      const proven = this.getWithdrawalProven(initiated.from, initiated.to);
      const finalized = proven
        ? this.getWithdrawalFinalized(proven.withdrawalHash)
        : null;

      const phase = this.determinePhase(initiated, proven, finalized);
      const canProve = this.canProveWithdrawal(initiated, proven);
      const canFinalize = this.canFinalizeWithdrawal(proven, finalized);

      return {
        transactionId: initiated.id,
        phase,
        canProve,
        canFinalize,
        initiatedAt: initiated.timestamp,
        initiatedTxHash: initiated.txHash as Hash,
        provenAt: proven?.timestamp,
        provenTxHash: proven?.txHash as Hash | undefined,
        finalizedAt: finalized?.timestamp,
        finalizedTxHash: finalized?.txHash as Hash | undefined,
        estimatedReadyToProve: this.estimateReadyToProve(initiated),
        estimatedReadyToFinalize: proven
          ? this.estimateReadyToFinalize(proven)
          : undefined,
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to get withdrawal status for ${initiatedTxHash}`,
        error
      );
    }
  }

  getAllPendingWithdrawals(userAddress?: string): WithdrawalStatus[] {
    try {
      const userFilter = userAddress
        ? 'AND (from_address = ? OR to_address = ?)'
        : '';
      const userParams = userAddress
        ? [userAddress.toLowerCase(), userAddress.toLowerCase()]
        : [];

      const stmt = this.db.prepare(`
        SELECT * FROM events
        WHERE event_type = 'WithdrawalInitiated'
        ${userFilter}
        ORDER BY block_number DESC
      `);

      const rows = stmt.all(...userParams) as any[];
      const statuses: WithdrawalStatus[] = [];

      for (const row of rows) {
        const status = this.getWithdrawalStatus(row.transaction_hash);
        if (status && status.phase !== 'finalized') {
          statuses.push(status);
        }
      }

      return statuses;
    } catch (error) {
      throw new DatabaseError('Failed to get pending withdrawals', error);
    }
  }

  getReadyToProve(userAddress?: string): WithdrawalStatus[] {
    const pending = this.getAllPendingWithdrawals(userAddress);
    return pending.filter((status) => status.canProve && !status.provenAt);
  }

  getReadyToFinalize(userAddress?: string): WithdrawalStatus[] {
    const pending = this.getAllPendingWithdrawals(userAddress);
    return pending.filter(
      (status) => status.canFinalize && !status.finalizedAt
    );
  }

  private getWithdrawalInitiated(txHash: string): {
    id: string;
    txHash: string;
    from: string;
    to: string;
    timestamp: bigint;
    blockNumber: bigint;
  } | null {
    const stmt = this.db.prepare(`
      SELECT * FROM events
      WHERE transaction_hash = ?
      AND event_type = 'WithdrawalInitiated'
      LIMIT 1
    `);

    const row = stmt.get(txHash.toLowerCase()) as any;
    if (!row) return null;

    return {
      id: row.id,
      txHash: row.transaction_hash,
      from: row.from_address,
      to: row.to_address,
      timestamp: BigInt(row.timestamp),
      blockNumber: BigInt(row.block_number),
    };
  }

  private getWithdrawalProven(
    fromAddress: string,
    toAddress: string
  ): {
    withdrawalHash: string;
    txHash: string;
    timestamp: bigint;
    blockNumber: bigint;
  } | null {
    const stmt = this.db.prepare(`
      SELECT * FROM events
      WHERE event_type = 'WithdrawalProven'
      AND from_address = ?
      AND to_address = ?
      ORDER BY block_number DESC
      LIMIT 1
    `);

    const row = stmt.get(
      fromAddress.toLowerCase(),
      toAddress.toLowerCase()
    ) as any;
    if (!row) return null;

    return {
      withdrawalHash: row.id,
      txHash: row.transaction_hash,
      timestamp: BigInt(row.timestamp),
      blockNumber: BigInt(row.block_number),
    };
  }

  private getWithdrawalFinalized(withdrawalHash: string): {
    txHash: string;
    timestamp: bigint;
    success: boolean;
  } | null {
    const stmt = this.db.prepare(`
      SELECT * FROM events
      WHERE event_type = 'WithdrawalFinalized'
      AND id LIKE ?
      ORDER BY block_number DESC
      LIMIT 1
    `);

    const row = stmt.get(`${withdrawalHash}%`) as any;
    if (!row) return null;

    return {
      txHash: row.transaction_hash,
      timestamp: BigInt(row.timestamp),
      success: true,
    };
  }

  private determinePhase(
    _initiated: any,
    proven: any,
    finalized: any
  ): WithdrawalPhase {
    if (finalized) {
      return 'finalized' as any;
    }
    if (proven) {
      return 'proven';
    }
    return 'initiated';
  }

  private canProveWithdrawal(initiated: any, proven: any): boolean {
    if (proven) return false;

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const readyTime = initiated.timestamp + PROOF_MATURITY_DELAY_SECONDS;

    return currentTime >= readyTime;
  }

  private canFinalizeWithdrawal(proven: any, finalized: any): boolean {
    if (!proven || finalized) return false;

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const readyTime = proven.timestamp + CHALLENGE_PERIOD_SECONDS;

    return currentTime >= readyTime;
  }

  private estimateReadyToProve(initiated: any): bigint {
    return initiated.timestamp + PROOF_MATURITY_DELAY_SECONDS;
  }

  private estimateReadyToFinalize(proven: any): bigint {
    return proven.timestamp + CHALLENGE_PERIOD_SECONDS;
  }

  getWithdrawalTimeline(initiatedTxHash: string): {
    initiated?: { timestamp: bigint; blockNumber: bigint; txHash: string };
    proven?: { timestamp: bigint; blockNumber: bigint; txHash: string };
    finalized?: { timestamp: bigint; txHash: string };
    estimatedCompletion?: bigint;
  } {
    const status = this.getWithdrawalStatus(initiatedTxHash);
    if (!status) {
      return {};
    }

    const timeline: any = {
      initiated: {
        timestamp: status.initiatedAt,
        blockNumber: 0n,
        txHash: status.initiatedTxHash,
      },
    };

    if (status.provenAt && status.provenTxHash) {
      timeline.proven = {
        timestamp: status.provenAt,
        blockNumber: 0n,
        txHash: status.provenTxHash,
      };
    }

    if (status.finalizedAt && status.finalizedTxHash) {
      timeline.finalized = {
        timestamp: status.finalizedAt,
        txHash: status.finalizedTxHash,
      };
    } else if (status.estimatedReadyToFinalize) {
      timeline.estimatedCompletion = status.estimatedReadyToFinalize;
    }

    return timeline;
  }
}
