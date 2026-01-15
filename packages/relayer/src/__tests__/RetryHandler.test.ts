/**
 * RetryHandler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryHandler } from '../RetryHandler.js';
import type { Logger } from '../logger.js';

// Mock logger
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    retryHandler = new RetryHandler(
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        jitterPercentage: 0, // Disable jitter for predictable tests
      },
      mockLogger
    );
  });

  describe('initialization', () => {
    it('should use default values if not provided', () => {
      const handler = new RetryHandler({}, mockLogger);
      const stats = handler.getStats();

      expect(stats.pendingProveRetries).toBe(0);
      expect(stats.pendingFinalizeRetries).toBe(0);
    });

    it('should create child logger', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ module: 'RetryHandler' });
    });
  });

  describe('canRetryProve', () => {
    it('should return true for unknown hash', () => {
      const txHash = '0xunknown' as `0x${string}`;
      expect(retryHandler.canRetryProve(txHash)).toBe(true);
    });

    it('should return false when max retries exceeded', () => {
      const txHash = '0xfailed' as `0x${string}`;

      // Fail 3 times (maxRetries)
      retryHandler.recordProveFailure(txHash, 'Error 1');
      retryHandler.recordProveFailure(txHash, 'Error 2');
      retryHandler.recordProveFailure(txHash, 'Error 3');

      expect(retryHandler.canRetryProve(txHash)).toBe(false);
    });

    it('should return false when not enough time has passed', () => {
      const txHash = '0xrecent' as `0x${string}`;

      retryHandler.recordProveFailure(txHash, 'Error');

      // Immediately after failure, should wait for delay
      expect(retryHandler.canRetryProve(txHash)).toBe(false);
    });

    it('should return true after delay has passed', async () => {
      // Use short delays for this test
      const fastHandler = new RetryHandler(
        {
          maxRetries: 3,
          initialDelayMs: 10, // 10ms delay
          jitterPercentage: 0,
        },
        mockLogger
      );

      const txHash = '0xwait' as `0x${string}`;
      fastHandler.recordProveFailure(txHash, 'Error');

      // Wait for delay
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fastHandler.canRetryProve(txHash)).toBe(true);
    });
  });

  describe('canRetryFinalize', () => {
    it('should return true for unknown hash', () => {
      const txHash = '0xunknown' as `0x${string}`;
      expect(retryHandler.canRetryFinalize(txHash)).toBe(true);
    });

    it('should return false when max retries exceeded', () => {
      const txHash = '0xfailed' as `0x${string}`;

      retryHandler.recordFinalizeFailure(txHash, 'Error 1');
      retryHandler.recordFinalizeFailure(txHash, 'Error 2');
      retryHandler.recordFinalizeFailure(txHash, 'Error 3');

      expect(retryHandler.canRetryFinalize(txHash)).toBe(false);
    });
  });

  describe('recordProveFailure', () => {
    it('should increment attempt count', () => {
      const txHash = '0xfail' as `0x${string}`;

      retryHandler.recordProveFailure(txHash, 'Error 1');
      const state1 = retryHandler.getProveState(txHash);
      expect(state1?.attempts).toBe(1);

      retryHandler.recordProveFailure(txHash, 'Error 2');
      const state2 = retryHandler.getProveState(txHash);
      expect(state2?.attempts).toBe(2);
    });

    it('should record last error', () => {
      const txHash = '0xfail' as `0x${string}`;

      retryHandler.recordProveFailure(txHash, 'First error');
      expect(retryHandler.getProveState(txHash)?.lastError).toBe('First error');

      retryHandler.recordProveFailure(txHash, 'Second error');
      expect(retryHandler.getProveState(txHash)?.lastError).toBe('Second error');
    });

    it('should set nextRetryAt with exponential backoff', () => {
      const txHash = '0xbackoff' as `0x${string}`;

      retryHandler.recordProveFailure(txHash, 'Error 1');
      const state1 = retryHandler.getProveState(txHash);
      const delay1 = state1!.nextRetryAt.getTime() - state1!.lastAttempt.getTime();

      retryHandler.recordProveFailure(txHash, 'Error 2');
      const state2 = retryHandler.getProveState(txHash);
      const delay2 = state2!.nextRetryAt.getTime() - state2!.lastAttempt.getTime();

      // Second delay should be roughly 2x the first (exponential backoff)
      // With multiplier=2: 1000*2^1=2000, 1000*2^2=4000
      expect(delay2).toBeGreaterThan(delay1);
    });
  });

  describe('recordFinalizeFailure', () => {
    it('should increment attempt count', () => {
      const txHash = '0xfail' as `0x${string}`;

      retryHandler.recordFinalizeFailure(txHash, 'Error 1');
      const state = retryHandler.getFinalizeState(txHash);
      expect(state?.attempts).toBe(1);
    });
  });

  describe('recordProveSuccess', () => {
    it('should clear retry state', () => {
      const txHash = '0xsuccess' as `0x${string}`;

      retryHandler.recordProveFailure(txHash, 'Error');
      expect(retryHandler.getProveState(txHash)).toBeDefined();

      retryHandler.recordProveSuccess(txHash);
      expect(retryHandler.getProveState(txHash)).toBeUndefined();
    });
  });

  describe('recordFinalizeSuccess', () => {
    it('should clear retry state', () => {
      const txHash = '0xsuccess' as `0x${string}`;

      retryHandler.recordFinalizeFailure(txHash, 'Error');
      expect(retryHandler.getFinalizeState(txHash)).toBeDefined();

      retryHandler.recordFinalizeSuccess(txHash);
      expect(retryHandler.getFinalizeState(txHash)).toBeUndefined();
    });
  });

  describe('isProveExhausted', () => {
    it('should return false for unknown hash', () => {
      expect(retryHandler.isProveExhausted('0xunknown' as `0x${string}`)).toBe(false);
    });

    it('should return false if retries remain', () => {
      const txHash = '0xretries' as `0x${string}`;
      retryHandler.recordProveFailure(txHash, 'Error 1');
      retryHandler.recordProveFailure(txHash, 'Error 2');

      expect(retryHandler.isProveExhausted(txHash)).toBe(false);
    });

    it('should return true when all retries exhausted', () => {
      const txHash = '0xexhausted' as `0x${string}`;
      retryHandler.recordProveFailure(txHash, 'Error 1');
      retryHandler.recordProveFailure(txHash, 'Error 2');
      retryHandler.recordProveFailure(txHash, 'Error 3');

      expect(retryHandler.isProveExhausted(txHash)).toBe(true);
    });
  });

  describe('isFinalizeExhausted', () => {
    it('should return true when all retries exhausted', () => {
      const txHash = '0xexhausted' as `0x${string}`;
      retryHandler.recordFinalizeFailure(txHash, 'Error 1');
      retryHandler.recordFinalizeFailure(txHash, 'Error 2');
      retryHandler.recordFinalizeFailure(txHash, 'Error 3');

      expect(retryHandler.isFinalizeExhausted(txHash)).toBe(true);
    });
  });

  describe('getExhaustedProves', () => {
    it('should return empty array initially', () => {
      expect(retryHandler.getExhaustedProves()).toEqual([]);
    });

    it('should return exhausted hashes', () => {
      const tx1 = '0x1' as `0x${string}`;
      const tx2 = '0x2' as `0x${string}`;

      // Exhaust tx1
      retryHandler.recordProveFailure(tx1, 'Error');
      retryHandler.recordProveFailure(tx1, 'Error');
      retryHandler.recordProveFailure(tx1, 'Error');

      // Partial failure on tx2
      retryHandler.recordProveFailure(tx2, 'Error');

      const exhausted = retryHandler.getExhaustedProves();
      expect(exhausted).toContain(tx1);
      expect(exhausted).not.toContain(tx2);
    });
  });

  describe('getExhaustedFinalizes', () => {
    it('should return exhausted finalize hashes', () => {
      const txHash = '0xexhausted' as `0x${string}`;

      retryHandler.recordFinalizeFailure(txHash, 'Error');
      retryHandler.recordFinalizeFailure(txHash, 'Error');
      retryHandler.recordFinalizeFailure(txHash, 'Error');

      expect(retryHandler.getExhaustedFinalizes()).toContain(txHash);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const tx1 = '0x1' as `0x${string}`;
      const tx2 = '0x2' as `0x${string}`;
      const tx3 = '0x3' as `0x${string}`;

      // Exhaust tx1 prove
      retryHandler.recordProveFailure(tx1, 'Error');
      retryHandler.recordProveFailure(tx1, 'Error');
      retryHandler.recordProveFailure(tx1, 'Error');

      // Partial failure on tx2 prove
      retryHandler.recordProveFailure(tx2, 'Error');

      // Exhaust tx3 finalize
      retryHandler.recordFinalizeFailure(tx3, 'Error');
      retryHandler.recordFinalizeFailure(tx3, 'Error');
      retryHandler.recordFinalizeFailure(tx3, 'Error');

      const stats = retryHandler.getStats();
      expect(stats.pendingProveRetries).toBe(1); // tx2
      expect(stats.exhaustedProves).toBe(1); // tx1
      expect(stats.pendingFinalizeRetries).toBe(0);
      expect(stats.exhaustedFinalizes).toBe(1); // tx3
    });
  });

  describe('clear', () => {
    it('should clear all retry state', () => {
      retryHandler.recordProveFailure('0x1' as `0x${string}`, 'Error');
      retryHandler.recordFinalizeFailure('0x2' as `0x${string}`, 'Error');

      retryHandler.clear();

      const stats = retryHandler.getStats();
      expect(stats.pendingProveRetries).toBe(0);
      expect(stats.pendingFinalizeRetries).toBe(0);
      expect(stats.exhaustedProves).toBe(0);
      expect(stats.exhaustedFinalizes).toBe(0);
    });
  });

  describe('exponential backoff with jitter', () => {
    it('should apply jitter when configured', () => {
      const handlerWithJitter = new RetryHandler(
        {
          maxRetries: 5,
          initialDelayMs: 1000,
          jitterPercentage: 0.1, // 10%
        },
        mockLogger
      );

      const txHash = '0xjitter' as `0x${string}`;
      const delays: number[] = [];

      // Record multiple failures and collect delays
      for (let i = 0; i < 3; i++) {
        handlerWithJitter.recordProveFailure(txHash, `Error ${i}`);
        const state = handlerWithJitter.getProveState(txHash);
        delays.push(state!.nextRetryAt.getTime() - state!.lastAttempt.getTime());
      }

      // Delays should be increasing (exponential)
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
    });

    it('should cap delay at maxDelayMs', () => {
      const handlerWithCap = new RetryHandler(
        {
          maxRetries: 10,
          initialDelayMs: 1000,
          maxDelayMs: 5000, // Cap at 5 seconds
          backoffMultiplier: 10, // Aggressive multiplier
          jitterPercentage: 0,
        },
        mockLogger
      );

      const txHash = '0xcap' as `0x${string}`;

      // Record many failures to exceed max
      for (let i = 0; i < 5; i++) {
        handlerWithCap.recordProveFailure(txHash, `Error ${i}`);
      }

      const state = handlerWithCap.getProveState(txHash);
      const delay = state!.nextRetryAt.getTime() - state!.lastAttempt.getTime();

      // Should be capped at maxDelayMs
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });
});
