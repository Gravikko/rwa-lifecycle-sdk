/**
 * Relayer Service
 *
 * Main service that orchestrates withdrawal monitoring, proving, and finalizing.
 * Includes state persistence, retry logic, and health monitoring.
 */

import { RWALifecycleSDK } from '@rwa-lifecycle/core';
import type { Hash } from 'viem';
import type {
  RelayerConfig,
  ResolvedRelayerConfig,
  RelayerStats,
  RelayerEvent,
  RelayerEventListener,
  TrackedWithdrawal,
  ProcessingResult,
} from './types.js';
import { WithdrawalMonitor } from './WithdrawalMonitor.js';
import { WithdrawalProcessor } from './WithdrawalProcessor.js';
import { StateManager } from './StateManager.js';
import { RetryHandler } from './RetryHandler.js';
import { HealthMonitor, type HealthCheckResult } from './HealthMonitor.js';
import { createLogger, type Logger } from './logger.js';

/**
 * Extended relayer configuration with new options
 */
export interface ExtendedRelayerConfig extends RelayerConfig {
  /** State file path (default: ./relayer-state.json) */
  stateFilePath?: string;
  /** Enable state persistence (default: true) */
  enableStatePersistence?: boolean;
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 5000) */
  retryDelayMs?: number;
}

/**
 * Main relayer service
 */
export class RelayerService {
  private config: ResolvedRelayerConfig & {
    stateFilePath: string;
    enableStatePersistence: boolean;
    maxRetries: number;
    retryDelayMs: number;
  };
  private sdk: RWALifecycleSDK;
  private logger: Logger;
  private monitor: WithdrawalMonitor;
  private processor: WithdrawalProcessor;
  private stateManager: StateManager;
  private retryHandler: RetryHandler;
  private healthMonitor: HealthMonitor;
  private isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private startTime: Date | null = null;
  private eventListeners: Set<RelayerEventListener> = new Set();

  constructor(config: ExtendedRelayerConfig) {
    // Merge with defaults
    this.config = {
      l1RpcUrl: config.l1RpcUrl,
      l2RpcUrl: config.l2RpcUrl,
      privateKey: config.privateKey,
      network: config.network ?? 'testnet',
      pollInterval: config.pollInterval ?? 60000, // 1 minute
      maxConcurrent: config.maxConcurrent ?? 5,
      gasBufferPercentage: config.gasBufferPercentage ?? 10,
      enableAutoProve: config.enableAutoProve ?? true,
      enableAutoFinalize: config.enableAutoFinalize ?? true,
      filterByUser: config.filterByUser as `0x${string}` | undefined,
      logLevel: config.logLevel ?? 'info',
      logFile: config.logFile ?? '',
      stateFilePath: config.stateFilePath ?? './relayer-state.json',
      enableStatePersistence: config.enableStatePersistence ?? true,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 5000,
    };

    // Create logger
    this.logger = createLogger({
      logLevel: this.config.logLevel,
      logFile: this.config.logFile,
    });

    // Initialize SDK
    this.sdk = new RWALifecycleSDK({
      l1RpcUrl: this.config.l1RpcUrl,
      l2RpcUrl: this.config.l2RpcUrl,
      privateKey: this.config.privateKey,
      network: this.config.network,
      gasBufferPercentage: this.config.gasBufferPercentage,
    });

    // Create monitor and processor
    this.monitor = new WithdrawalMonitor(this.sdk, this.logger, {
      filterByUser: this.config.filterByUser,
    });

    this.processor = new WithdrawalProcessor(this.sdk, this.logger, {
      maxConcurrent: this.config.maxConcurrent,
    });

    // Create state manager
    this.stateManager = new StateManager(this.config.stateFilePath, this.logger);

    // Create retry handler
    this.retryHandler = new RetryHandler(
      {
        maxRetries: this.config.maxRetries,
        initialDelayMs: this.config.retryDelayMs,
      },
      this.logger
    );

    // Create health monitor
    this.healthMonitor = new HealthMonitor(
      { maxPollAge: this.config.pollInterval * 2 },
      this.logger
    );

    this.logger.info({ network: this.config.network }, 'RelayerService initialized');
  }

  /**
   * Start the relayer service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn({}, 'Relayer service is already running');
      return;
    }

    this.logger.info({}, 'Starting relayer service...');
    this.isRunning = true;
    this.startTime = new Date();

    // Load persisted state
    if (this.config.enableStatePersistence) {
      await this.stateManager.load();
    }

    // Update health monitor
    this.healthMonitor.serviceStarted();
    this.healthMonitor.setWalletConnected(true);
    this.healthMonitor.setIndexerConnected(true);

    // Emit started event
    this.emit({ type: 'started', timestamp: new Date() });

    // Initial sync
    try {
      await this.monitor.sync();
    } catch (error) {
      this.logger.warn({ error }, 'Initial sync failed, continuing anyway');
    }

    // Run first poll immediately
    await this.poll();

    // Start polling loop
    this.pollTimer = setInterval(async () => {
      await this.poll();
    }, this.config.pollInterval);

    this.logger.info(
      { pollInterval: this.config.pollInterval },
      'Relayer service started'
    );
  }

  /**
   * Stop the relayer service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn({}, 'Relayer service is not running');
      return;
    }

    this.logger.info({}, 'Stopping relayer service...');

    // Clear poll timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.isRunning = false;

    // Save state before shutdown
    if (this.config.enableStatePersistence) {
      await this.stateManager.flush();
    }

    // Update health monitor
    this.healthMonitor.serviceStopped();

    // Shutdown SDK
    this.sdk.shutdown();

    // Emit stopped event
    this.emit({ type: 'stopped', timestamp: new Date() });

    this.logger.info({}, 'Relayer service stopped');
  }

  /**
   * Poll for withdrawals and process them
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const pollStart = this.healthMonitor.pollStarted();
    this.logger.debug({}, 'Polling for withdrawals...');
    this.emit({ type: 'poll', timestamp: new Date() });

    let success = true;

    try {
      // Sync indexer first
      await this.monitor.sync();

      // Update pending count
      const monitorStats = this.monitor.getStats();
      this.healthMonitor.updatePendingCount(monitorStats.total);

      // Process proofs if enabled
      if (this.config.enableAutoProve) {
        await this.processProofs();
      }

      // Process finalizations if enabled
      if (this.config.enableAutoFinalize) {
        await this.processFinalizations();
      }

      this.logger.debug(
        {
          pending: monitorStats.total,
          readyToProve: monitorStats.readyToProve,
          readyToFinalize: monitorStats.readyToFinalize,
        },
        'Poll complete'
      );
    } catch (error) {
      success = false;
      this.logger.error({ error }, 'Error during poll');
      this.emit({
        type: 'error',
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    this.healthMonitor.pollCompleted(pollStart, success);
  }

  /**
   * Process withdrawals ready to prove
   */
  private async processProofs(): Promise<void> {
    const readyToProve = await this.monitor.getReadyToProve();

    if (readyToProve.length === 0) {
      this.logger.debug({}, 'No withdrawals ready to prove');
      return;
    }

    this.logger.info(
      { count: readyToProve.length },
      'Processing withdrawals ready to prove'
    );

    for (const withdrawal of readyToProve) {
      const txHash = withdrawal.initiatedTxHash;

      // Skip if already processed (in-memory or persisted)
      if (
        this.processor.isProcessing(txHash) ||
        this.processor.hasProofBeenProcessed(txHash) ||
        this.stateManager.hasBeenProven(txHash)
      ) {
        continue;
      }

      // Check retry eligibility
      if (!this.retryHandler.canRetryProve(txHash)) {
        if (this.retryHandler.isProveExhausted(txHash)) {
          this.logger.warn({ txHash }, 'Prove retries exhausted, skipping');
        }
        continue;
      }

      // Emit detected event
      this.emit({
        type: 'withdrawal:detected',
        timestamp: new Date(),
        data: { txHash },
      });

      // Emit proving event
      this.emit({
        type: 'withdrawal:proving',
        timestamp: new Date(),
        data: { txHash },
      });

      // Process
      const result = await this.processor.proveWithdrawal(withdrawal);

      if (result.success) {
        this.stateManager.markProven(txHash);
        this.healthMonitor.recordProven();
        this.retryHandler.recordProveSuccess(txHash);

        this.emit({
          type: 'withdrawal:proved',
          timestamp: new Date(),
          data: {
            initiatedTxHash: txHash,
            proveTxHash: result.txHash,
          },
        });
      } else {
        this.retryHandler.recordProveFailure(txHash, result.error || 'Unknown error');
        this.healthMonitor.recordFailed();
        this.stateManager.incrementFailed();

        this.emit({
          type: 'withdrawal:failed',
          timestamp: new Date(),
          data: {
            txHash,
            phase: 'prove',
            error: result.error,
          },
        });
      }
    }
  }

  /**
   * Process withdrawals ready to finalize
   */
  private async processFinalizations(): Promise<void> {
    const readyToFinalize = await this.monitor.getReadyToFinalize();

    if (readyToFinalize.length === 0) {
      this.logger.debug({}, 'No withdrawals ready to finalize');
      return;
    }

    this.logger.info(
      { count: readyToFinalize.length },
      'Processing withdrawals ready to finalize'
    );

    for (const withdrawal of readyToFinalize) {
      const txHash = withdrawal.initiatedTxHash;

      // Skip if already processed (in-memory or persisted)
      if (
        this.processor.isProcessing(txHash) ||
        this.processor.hasFinalizationBeenProcessed(txHash) ||
        this.stateManager.hasBeenFinalized(txHash)
      ) {
        continue;
      }

      // Check retry eligibility
      if (!this.retryHandler.canRetryFinalize(txHash)) {
        if (this.retryHandler.isFinalizeExhausted(txHash)) {
          this.logger.warn({ txHash }, 'Finalize retries exhausted, skipping');
        }
        continue;
      }

      // Emit finalizing event
      this.emit({
        type: 'withdrawal:finalizing',
        timestamp: new Date(),
        data: { txHash },
      });

      // Process
      const result = await this.processor.finalizeWithdrawal(withdrawal);

      if (result.success) {
        this.stateManager.markFinalized(txHash);
        this.healthMonitor.recordFinalized();
        this.retryHandler.recordFinalizeSuccess(txHash);

        this.emit({
          type: 'withdrawal:finalized',
          timestamp: new Date(),
          data: {
            initiatedTxHash: txHash,
            finalizeTxHash: result.txHash,
          },
        });
      } else {
        this.retryHandler.recordFinalizeFailure(txHash, result.error || 'Unknown error');
        this.healthMonitor.recordFailed();
        this.stateManager.incrementFailed();

        this.emit({
          type: 'withdrawal:failed',
          timestamp: new Date(),
          data: {
            txHash,
            phase: 'finalize',
            error: result.error,
          },
        });
      }
    }
  }

  /**
   * Manually prove a specific withdrawal
   */
  async proveWithdrawal(txHash: Hash): Promise<ProcessingResult> {
    const withdrawal = await this.monitor.getWithdrawalStatus(txHash);
    if (!withdrawal) {
      return {
        success: false,
        error: 'Withdrawal not found',
        withdrawal: {
          initiatedTxHash: txHash,
          phase: 'initiated',
          canProve: false,
          canFinalize: false,
          initiatedAt: 0n,
        },
      };
    }

    const result = await this.processor.proveWithdrawal(withdrawal);
    if (result.success) {
      this.stateManager.markProven(txHash);
      this.healthMonitor.recordProven();
    }
    return result;
  }

  /**
   * Manually finalize a specific withdrawal
   */
  async finalizeWithdrawal(txHash: Hash): Promise<ProcessingResult> {
    const withdrawal = await this.monitor.getWithdrawalStatus(txHash);
    if (!withdrawal) {
      return {
        success: false,
        error: 'Withdrawal not found',
        withdrawal: {
          initiatedTxHash: txHash,
          phase: 'initiated',
          canProve: false,
          canFinalize: false,
          initiatedAt: 0n,
        },
      };
    }

    const result = await this.processor.finalizeWithdrawal(withdrawal);
    if (result.success) {
      this.stateManager.markFinalized(txHash);
      this.healthMonitor.recordFinalized();
    }
    return result;
  }

  /**
   * Get service statistics
   */
  getStats(): RelayerStats {
    const monitorStats = this.monitor.getStats();
    const stateStats = this.stateManager.getStats();

    return {
      totalProcessed: stateStats.totalProven + stateStats.totalFinalized,
      totalProven: stateStats.totalProven,
      totalFinalized: stateStats.totalFinalized,
      totalFailed: stateStats.totalFailed,
      currentPending: monitorStats.total,
      lastPollTime: new Date(),
      uptimeMs: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      startTime: this.startTime ?? new Date(),
    };
  }

  /**
   * Get health check result
   */
  getHealth(): HealthCheckResult {
    return this.healthMonitor.check();
  }

  /**
   * Get health status string
   */
  getHealthStatus(): string {
    return this.healthMonitor.getStatusString();
  }

  /**
   * Get retry statistics
   */
  getRetryStats() {
    return this.retryHandler.getStats();
  }

  /**
   * Get monitor statistics
   */
  getMonitorStats() {
    return this.monitor.getStats();
  }

  /**
   * Get processor statistics
   */
  getProcessorStats() {
    return this.processor.getStats();
  }

  /**
   * Check if service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<ResolvedRelayerConfig> {
    return { ...this.config };
  }

  /**
   * Add event listener
   */
  on(listener: RelayerEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Remove event listener
   */
  off(listener: RelayerEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: RelayerEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.error({ error }, 'Error in event listener');
      }
    }
  }

  /**
   * Force a poll cycle (for testing)
   */
  async forcePoll(): Promise<void> {
    await this.poll();
  }

  /**
   * Get pending withdrawals
   */
  async getPendingWithdrawals(): Promise<TrackedWithdrawal[]> {
    return this.monitor.getPendingWithdrawals();
  }

  /**
   * Get SDK instance (for advanced use)
   */
  getSDK(): RWALifecycleSDK {
    return this.sdk;
  }
}
