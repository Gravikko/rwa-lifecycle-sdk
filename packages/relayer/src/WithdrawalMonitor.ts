/**
 * Withdrawal Monitor
 *
 * Monitors pending withdrawals and tracks their status.
 */

import type { RWALifecycleSDK } from '@rwa-lifecycle/core';
import type { Hash } from 'viem';
import type { TrackedWithdrawal, RelayerConfig } from './types.js';
import type { Logger } from './logger.js';

/**
 * Monitors pending withdrawals and tracks status changes
 */
export class WithdrawalMonitor {
  private sdk: RWALifecycleSDK;
  private logger: Logger;
  private filterByUser?: `0x${string}`;
  private trackedWithdrawals: Map<Hash, TrackedWithdrawal> = new Map();

  constructor(
    sdk: RWALifecycleSDK,
    logger: Logger,
    config: Pick<RelayerConfig, 'filterByUser'>
  ) {
    this.sdk = sdk;
    this.logger = logger.child({ module: 'WithdrawalMonitor' });
    this.filterByUser = config.filterByUser;
  }

  /**
   * Get all pending withdrawals
   */
  async getPendingWithdrawals(): Promise<TrackedWithdrawal[]> {
    this.logger.debug('Fetching pending withdrawals...');

    try {
      const pending = this.sdk.indexer.withdrawals.getAllPendingWithdrawals(
        this.filterByUser
      );

      const tracked: TrackedWithdrawal[] = pending.map((w) => ({
        initiatedTxHash: w.initiatedTxHash,
        phase: w.phase as 'initiated' | 'proven' | 'finalized',
        canProve: w.canProve,
        canFinalize: w.canFinalize,
        initiatedAt: w.initiatedAt,
        provenAt: w.provenAt,
        provenTxHash: w.provenTxHash,
        finalizedAt: w.finalizedAt,
        finalizedTxHash: w.finalizedTxHash,
        estimatedReadyToProve: w.estimatedReadyToProve,
        estimatedReadyToFinalize: w.estimatedReadyToFinalize,
      }));

      // Update tracked withdrawals
      for (const withdrawal of tracked) {
        this.trackedWithdrawals.set(withdrawal.initiatedTxHash, withdrawal);
      }

      this.logger.debug({ count: tracked.length }, 'Found pending withdrawals');
      return tracked;
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch pending withdrawals');
      throw error;
    }
  }

  /**
   * Get withdrawals ready to prove
   */
  async getReadyToProve(): Promise<TrackedWithdrawal[]> {
    const pending = await this.getPendingWithdrawals();
    const readyToProve = pending.filter(
      (w) => w.canProve && w.phase === 'initiated' && !w.provenAt
    );

    this.logger.debug(
      { count: readyToProve.length },
      'Withdrawals ready to prove'
    );
    return readyToProve;
  }

  /**
   * Get withdrawals ready to finalize
   */
  async getReadyToFinalize(): Promise<TrackedWithdrawal[]> {
    const pending = await this.getPendingWithdrawals();
    const readyToFinalize = pending.filter(
      (w) => w.canFinalize && w.phase === 'proven' && !w.finalizedAt
    );

    this.logger.debug(
      { count: readyToFinalize.length },
      'Withdrawals ready to finalize'
    );
    return readyToFinalize;
  }

  /**
   * Get withdrawal status by transaction hash
   */
  async getWithdrawalStatus(txHash: Hash): Promise<TrackedWithdrawal | null> {
    try {
      const status = await this.sdk.trackWithdrawal(txHash);
      if (!status) {
        return null;
      }

      const tracked: TrackedWithdrawal = {
        initiatedTxHash: status.initiatedTxHash,
        phase: status.phase as 'initiated' | 'proven' | 'finalized',
        canProve: status.canProve,
        canFinalize: status.canFinalize,
        initiatedAt: status.initiatedAt,
        provenAt: status.provenAt,
        provenTxHash: status.provenTxHash,
        finalizedAt: status.finalizedAt,
        finalizedTxHash: status.finalizedTxHash,
        estimatedReadyToProve: status.estimatedReadyToProve,
        estimatedReadyToFinalize: status.estimatedReadyToFinalize,
      };

      this.trackedWithdrawals.set(txHash, tracked);
      return tracked;
    } catch (error) {
      this.logger.error({ txHash, error }, 'Failed to get withdrawal status');
      return null;
    }
  }

  /**
   * Get all tracked withdrawals
   */
  getTrackedWithdrawals(): TrackedWithdrawal[] {
    return Array.from(this.trackedWithdrawals.values());
  }

  /**
   * Update a tracked withdrawal
   */
  updateTrackedWithdrawal(
    txHash: Hash,
    updates: Partial<TrackedWithdrawal>
  ): void {
    const existing = this.trackedWithdrawals.get(txHash);
    if (existing) {
      this.trackedWithdrawals.set(txHash, { ...existing, ...updates });
    }
  }

  /**
   * Check if withdrawal is being tracked
   */
  isTracked(txHash: Hash): boolean {
    return this.trackedWithdrawals.has(txHash);
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    initiated: number;
    proven: number;
    finalized: number;
    readyToProve: number;
    readyToFinalize: number;
  } {
    const withdrawals = this.getTrackedWithdrawals();
    return {
      total: withdrawals.length,
      initiated: withdrawals.filter((w) => w.phase === 'initiated').length,
      proven: withdrawals.filter((w) => w.phase === 'proven').length,
      finalized: withdrawals.filter((w) => w.phase === 'finalized').length,
      readyToProve: withdrawals.filter((w) => w.canProve && !w.provenAt).length,
      readyToFinalize: withdrawals.filter((w) => w.canFinalize && !w.finalizedAt)
        .length,
    };
  }

  /**
   * Sync with indexer
   */
  async sync(): Promise<{ l1Events: number; l2Events: number }> {
    this.logger.debug('Syncing indexer...');
    try {
      const result = await this.sdk.indexer.syncNow();
      this.logger.debug(
        { l1Events: result.l1Events, l2Events: result.l2Events },
        'Indexer synced'
      );
      return result;
    } catch (error) {
      this.logger.error({ error }, 'Failed to sync indexer');
      throw error;
    }
  }

  /**
   * Clear tracked withdrawals
   */
  clear(): void {
    this.trackedWithdrawals.clear();
  }
}
