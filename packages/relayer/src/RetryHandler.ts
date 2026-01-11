/**
 * Retry Handler
 *
 * Handles retries with exponential backoff for failed operations.
 */

import type { Hash } from 'viem';
import type { Logger } from './logger.js';

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms (default: 60000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Jitter percentage (default: 0.1 = 10%) */
  jitterPercentage?: number;
}

/**
 * Retry state for a single withdrawal
 */
interface RetryState {
  attempts: number;
  lastAttempt: Date;
  nextRetryAt: Date;
  lastError?: string;
}

/**
 * Resolved retry configuration
 */
interface ResolvedRetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterPercentage: number;
}

/**
 * Handles retry logic with exponential backoff
 */
export class RetryHandler {
  private config: ResolvedRetryConfig;
  private logger: Logger;
  private proveRetries: Map<Hash, RetryState> = new Map();
  private finalizeRetries: Map<Hash, RetryState> = new Map();

  constructor(config: RetryConfig, logger: Logger) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialDelayMs: config.initialDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 60000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      jitterPercentage: config.jitterPercentage ?? 0.1,
    };
    this.logger = logger.child({ module: 'RetryHandler' });
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempts: number): number {
    // Exponential backoff: initialDelay * multiplier^attempts
    const exponentialDelay =
      this.config.initialDelayMs *
      Math.pow(this.config.backoffMultiplier, attempts);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Add jitter (±jitterPercentage)
    const jitter = cappedDelay * this.config.jitterPercentage;
    const randomJitter = (Math.random() * 2 - 1) * jitter;

    return Math.floor(cappedDelay + randomJitter);
  }

  /**
   * Record a failed prove attempt
   */
  recordProveFailure(txHash: Hash, error: string): void {
    const existing = this.proveRetries.get(txHash);
    const attempts = (existing?.attempts ?? 0) + 1;
    const delay = this.calculateDelay(attempts);
    const nextRetryAt = new Date(Date.now() + delay);

    this.proveRetries.set(txHash, {
      attempts,
      lastAttempt: new Date(),
      nextRetryAt,
      lastError: error,
    });

    this.logger.debug(
      { txHash, attempts, nextRetryMs: delay },
      'Recorded prove failure'
    );
  }

  /**
   * Record a failed finalize attempt
   */
  recordFinalizeFailure(txHash: Hash, error: string): void {
    const existing = this.finalizeRetries.get(txHash);
    const attempts = (existing?.attempts ?? 0) + 1;
    const delay = this.calculateDelay(attempts);
    const nextRetryAt = new Date(Date.now() + delay);

    this.finalizeRetries.set(txHash, {
      attempts,
      lastAttempt: new Date(),
      nextRetryAt,
      lastError: error,
    });

    this.logger.debug(
      { txHash, attempts, nextRetryMs: delay },
      'Recorded finalize failure'
    );
  }

  /**
   * Record a successful prove (clear retry state)
   */
  recordProveSuccess(txHash: Hash): void {
    this.proveRetries.delete(txHash);
  }

  /**
   * Record a successful finalize (clear retry state)
   */
  recordFinalizeSuccess(txHash: Hash): void {
    this.finalizeRetries.delete(txHash);
  }

  /**
   * Check if prove can be retried
   */
  canRetryProve(txHash: Hash): boolean {
    const state = this.proveRetries.get(txHash);

    // No previous failures - can try
    if (!state) {
      return true;
    }

    // Max retries exceeded
    if (state.attempts >= this.config.maxRetries) {
      return false;
    }

    // Check if enough time has passed
    return Date.now() >= state.nextRetryAt.getTime();
  }

  /**
   * Check if finalize can be retried
   */
  canRetryFinalize(txHash: Hash): boolean {
    const state = this.finalizeRetries.get(txHash);

    // No previous failures - can try
    if (!state) {
      return true;
    }

    // Max retries exceeded
    if (state.attempts >= this.config.maxRetries) {
      return false;
    }

    // Check if enough time has passed
    return Date.now() >= state.nextRetryAt.getTime();
  }

  /**
   * Check if prove has exhausted all retries
   */
  isProveExhausted(txHash: Hash): boolean {
    const state = this.proveRetries.get(txHash);
    return state !== undefined && state.attempts >= this.config.maxRetries;
  }

  /**
   * Check if finalize has exhausted all retries
   */
  isFinalizeExhausted(txHash: Hash): boolean {
    const state = this.finalizeRetries.get(txHash);
    return state !== undefined && state.attempts >= this.config.maxRetries;
  }

  /**
   * Get prove retry state
   */
  getProveState(txHash: Hash): RetryState | undefined {
    return this.proveRetries.get(txHash);
  }

  /**
   * Get finalize retry state
   */
  getFinalizeState(txHash: Hash): RetryState | undefined {
    return this.finalizeRetries.get(txHash);
  }

  /**
   * Get all exhausted prove hashes
   */
  getExhaustedProves(): Hash[] {
    const exhausted: Hash[] = [];
    for (const [hash, state] of this.proveRetries) {
      if (state.attempts >= this.config.maxRetries) {
        exhausted.push(hash);
      }
    }
    return exhausted;
  }

  /**
   * Get all exhausted finalize hashes
   */
  getExhaustedFinalizes(): Hash[] {
    const exhausted: Hash[] = [];
    for (const [hash, state] of this.finalizeRetries) {
      if (state.attempts >= this.config.maxRetries) {
        exhausted.push(hash);
      }
    }
    return exhausted;
  }

  /**
   * Get statistics
   */
  getStats(): {
    pendingProveRetries: number;
    pendingFinalizeRetries: number;
    exhaustedProves: number;
    exhaustedFinalizes: number;
  } {
    return {
      pendingProveRetries: Array.from(this.proveRetries.values()).filter(
        (s) => s.attempts < this.config.maxRetries
      ).length,
      pendingFinalizeRetries: Array.from(this.finalizeRetries.values()).filter(
        (s) => s.attempts < this.config.maxRetries
      ).length,
      exhaustedProves: this.getExhaustedProves().length,
      exhaustedFinalizes: this.getExhaustedFinalizes().length,
    };
  }

  /**
   * Clear all retry state
   */
  clear(): void {
    this.proveRetries.clear();
    this.finalizeRetries.clear();
  }
}
