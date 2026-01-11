/**
 * Withdrawal Processor
 *
 * Handles proving and finalizing withdrawals.
 */

import type { RWALifecycleSDK } from '@rwa-lifecycle/core';
import type { Hash } from 'viem';
import type { TrackedWithdrawal, ProcessingResult, RelayerConfig } from './types.js';
import type { Logger } from './logger.js';

/**
 * Processes withdrawals (prove and finalize)
 */
export class WithdrawalProcessor {
  private sdk: RWALifecycleSDK;
  private logger: Logger;
  private maxConcurrent: number;
  private processingSet: Set<Hash> = new Set();
  private processedProofs: Set<Hash> = new Set();
  private processedFinalizations: Set<Hash> = new Set();

  constructor(
    sdk: RWALifecycleSDK,
    logger: Logger,
    config: Pick<RelayerConfig, 'maxConcurrent'>
  ) {
    this.sdk = sdk;
    this.logger = logger.child({ module: 'WithdrawalProcessor' });
    this.maxConcurrent = config.maxConcurrent ?? 5;
  }

  /**
   * Check if withdrawal is currently being processed
   */
  isProcessing(txHash: Hash): boolean {
    return this.processingSet.has(txHash);
  }

  /**
   * Check if proof was already submitted for this withdrawal
   */
  hasProofBeenProcessed(txHash: Hash): boolean {
    return this.processedProofs.has(txHash);
  }

  /**
   * Check if finalization was already submitted for this withdrawal
   */
  hasFinalizationBeenProcessed(txHash: Hash): boolean {
    return this.processedFinalizations.has(txHash);
  }

  /**
   * Get current processing count
   */
  getProcessingCount(): number {
    return this.processingSet.size;
  }

  /**
   * Check if can process more (under concurrency limit)
   */
  canProcessMore(): boolean {
    return this.processingSet.size < this.maxConcurrent;
  }

  /**
   * Prove a withdrawal (Phase 2)
   */
  async proveWithdrawal(withdrawal: TrackedWithdrawal): Promise<ProcessingResult> {
    const txHash = withdrawal.initiatedTxHash;

    // Check if already processing or processed
    if (this.isProcessing(txHash)) {
      this.logger.debug({ txHash }, 'Withdrawal already being processed');
      return {
        success: false,
        error: 'Already processing',
        withdrawal,
      };
    }

    if (this.hasProofBeenProcessed(txHash)) {
      this.logger.debug({ txHash }, 'Withdrawal already proven by relayer');
      return {
        success: false,
        error: 'Already processed',
        withdrawal,
      };
    }

    // Check concurrency limit
    if (!this.canProcessMore()) {
      this.logger.debug({ txHash }, 'Concurrency limit reached, skipping');
      return {
        success: false,
        error: 'Concurrency limit reached',
        withdrawal,
      };
    }

    this.logger.info({ txHash }, 'Starting proof submission...');
    this.processingSet.add(txHash);

    try {
      // Check if bridge is available
      if (!this.sdk.bridge) {
        throw new Error('Bridge not available - wallet not configured');
      }

      // Submit proof
      const result = await this.sdk.bridge.proveWithdrawal(txHash);

      this.logger.info(
        { txHash, proveTxHash: result.txHash },
        'Withdrawal proven successfully'
      );

      // Mark as processed
      this.processedProofs.add(txHash);

      return {
        success: true,
        txHash: result.txHash,
        withdrawal: {
          ...withdrawal,
          phase: 'proven',
          provenTxHash: result.txHash,
          provenAt: BigInt(Math.floor(Date.now() / 1000)),
          canProve: false,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ txHash, error: errorMessage }, 'Failed to prove withdrawal');

      return {
        success: false,
        error: errorMessage,
        withdrawal,
      };
    } finally {
      this.processingSet.delete(txHash);
    }
  }

  /**
   * Finalize a withdrawal (Phase 3)
   */
  async finalizeWithdrawal(withdrawal: TrackedWithdrawal): Promise<ProcessingResult> {
    const txHash = withdrawal.initiatedTxHash;

    // Check if already processing or processed
    if (this.isProcessing(txHash)) {
      this.logger.debug({ txHash }, 'Withdrawal already being processed');
      return {
        success: false,
        error: 'Already processing',
        withdrawal,
      };
    }

    if (this.hasFinalizationBeenProcessed(txHash)) {
      this.logger.debug({ txHash }, 'Withdrawal already finalized by relayer');
      return {
        success: false,
        error: 'Already processed',
        withdrawal,
      };
    }

    // Check concurrency limit
    if (!this.canProcessMore()) {
      this.logger.debug({ txHash }, 'Concurrency limit reached, skipping');
      return {
        success: false,
        error: 'Concurrency limit reached',
        withdrawal,
      };
    }

    this.logger.info({ txHash }, 'Starting finalization...');
    this.processingSet.add(txHash);

    try {
      // Check if bridge is available
      if (!this.sdk.bridge) {
        throw new Error('Bridge not available - wallet not configured');
      }

      // Submit finalization
      const result = await this.sdk.bridge.finalizeWithdrawal(txHash);

      this.logger.info(
        { txHash, finalizeTxHash: result.txHash },
        'Withdrawal finalized successfully'
      );

      // Mark as processed
      this.processedFinalizations.add(txHash);

      return {
        success: true,
        txHash: result.txHash,
        withdrawal: {
          ...withdrawal,
          phase: 'finalized',
          finalizedTxHash: result.txHash,
          finalizedAt: BigInt(Math.floor(Date.now() / 1000)),
          canFinalize: false,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ txHash, error: errorMessage }, 'Failed to finalize withdrawal');

      return {
        success: false,
        error: errorMessage,
        withdrawal,
      };
    } finally {
      this.processingSet.delete(txHash);
    }
  }

  /**
   * Process multiple proofs
   */
  async proveWithdrawals(
    withdrawals: TrackedWithdrawal[]
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    for (const withdrawal of withdrawals) {
      if (!this.canProcessMore()) {
        this.logger.debug('Concurrency limit reached, stopping batch');
        break;
      }

      const result = await this.proveWithdrawal(withdrawal);
      results.push(result);

      // Small delay between transactions to avoid nonce issues
      if (result.success) {
        await this.delay(1000);
      }
    }

    return results;
  }

  /**
   * Process multiple finalizations
   */
  async finalizeWithdrawals(
    withdrawals: TrackedWithdrawal[]
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    for (const withdrawal of withdrawals) {
      if (!this.canProcessMore()) {
        this.logger.debug('Concurrency limit reached, stopping batch');
        break;
      }

      const result = await this.finalizeWithdrawal(withdrawal);
      results.push(result);

      // Small delay between transactions to avoid nonce issues
      if (result.success) {
        await this.delay(1000);
      }
    }

    return results;
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    currentlyProcessing: number;
    totalProofsProcessed: number;
    totalFinalizationsProcessed: number;
    maxConcurrent: number;
  } {
    return {
      currentlyProcessing: this.processingSet.size,
      totalProofsProcessed: this.processedProofs.size,
      totalFinalizationsProcessed: this.processedFinalizations.size,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Clear processed sets (for testing or restart)
   */
  clearProcessedSets(): void {
    this.processedProofs.clear();
    this.processedFinalizations.clear();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
