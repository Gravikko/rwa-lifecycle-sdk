/**
 * WithdrawalProcessor Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WithdrawalProcessor } from '../WithdrawalProcessor.js';
import type { Logger } from '../logger.js';
import type { RWALifecycleSDK } from '@rwa-lifecycle/core';
import type { TrackedWithdrawal } from '../types.js';

// Mock logger
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

// Create mock withdrawal
const createMockWithdrawal = (overrides: Partial<TrackedWithdrawal> = {}): TrackedWithdrawal => ({
  initiatedTxHash: '0xabc123' as `0x${string}`,
  phase: 'initiated',
  canProve: true,
  canFinalize: false,
  initiatedAt: BigInt(Date.now()),
  provenAt: undefined,
  provenTxHash: undefined,
  finalizedAt: undefined,
  finalizedTxHash: undefined,
  estimatedReadyToProve: new Date(),
  estimatedReadyToFinalize: undefined,
  ...overrides,
});

// Mock SDK
const createMockSDK = (options: { bridgeAvailable?: boolean; shouldFail?: boolean } = {}) => {
  const { bridgeAvailable = true, shouldFail = false } = options;

  return {
    bridge: bridgeAvailable
      ? {
          proveWithdrawal: vi.fn().mockImplementation(async () => {
            if (shouldFail) throw new Error('Prove failed');
            return { txHash: '0xprove123' };
          }),
          finalizeWithdrawal: vi.fn().mockImplementation(async () => {
            if (shouldFail) throw new Error('Finalize failed');
            return { txHash: '0xfinalize123' };
          }),
        }
      : null,
  } as unknown as RWALifecycleSDK;
};

describe('WithdrawalProcessor', () => {
  let processor: WithdrawalProcessor;
  let mockSDK: RWALifecycleSDK;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSDK = createMockSDK();
    mockLogger = createMockLogger();
    processor = new WithdrawalProcessor(mockSDK, mockLogger, { maxConcurrent: 3 });
  });

  describe('initialization', () => {
    it('should create child logger', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ module: 'WithdrawalProcessor' });
    });

    it('should use default maxConcurrent if not provided', () => {
      const defaultProcessor = new WithdrawalProcessor(mockSDK, mockLogger, {});
      const stats = defaultProcessor.getStats();
      expect(stats.maxConcurrent).toBe(5);
    });
  });

  describe('isProcessing', () => {
    it('should return false for unprocessed withdrawal', () => {
      expect(processor.isProcessing('0xunknown' as `0x${string}`)).toBe(false);
    });
  });

  describe('hasProofBeenProcessed', () => {
    it('should return false initially', () => {
      expect(processor.hasProofBeenProcessed('0xunknown' as `0x${string}`)).toBe(false);
    });

    it('should return true after successful proof', async () => {
      const withdrawal = createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}` });

      await processor.proveWithdrawal(withdrawal);

      expect(processor.hasProofBeenProcessed('0x1' as `0x${string}`)).toBe(true);
    });
  });

  describe('hasFinalizationBeenProcessed', () => {
    it('should return false initially', () => {
      expect(processor.hasFinalizationBeenProcessed('0xunknown' as `0x${string}`)).toBe(false);
    });

    it('should return true after successful finalization', async () => {
      const withdrawal = createMockWithdrawal({
        initiatedTxHash: '0x1' as `0x${string}`,
        phase: 'proven',
        canFinalize: true,
      });

      await processor.finalizeWithdrawal(withdrawal);

      expect(processor.hasFinalizationBeenProcessed('0x1' as `0x${string}`)).toBe(true);
    });
  });

  describe('getProcessingCount', () => {
    it('should return 0 initially', () => {
      expect(processor.getProcessingCount()).toBe(0);
    });
  });

  describe('canProcessMore', () => {
    it('should return true when under limit', () => {
      expect(processor.canProcessMore()).toBe(true);
    });
  });

  describe('proveWithdrawal', () => {
    it('should successfully prove withdrawal', async () => {
      const withdrawal = createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}` });

      const result = await processor.proveWithdrawal(withdrawal);

      expect(result.success).toBe(true);
      expect(result.txHash).toBe('0xprove123');
      expect(result.withdrawal?.phase).toBe('proven');
    });

    it('should fail if already processing', async () => {
      const withdrawal = createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}` });

      // Start processing (we need to access internal state)
      const firstProve = processor.proveWithdrawal(withdrawal);

      // Try to prove again immediately
      const secondResult = await processor.proveWithdrawal(withdrawal);

      // Wait for first to complete
      await firstProve;

      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toBe('Already processing');
    });

    it('should fail if already processed', async () => {
      const withdrawal = createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}` });

      // First prove
      await processor.proveWithdrawal(withdrawal);

      // Try again
      const result = await processor.proveWithdrawal(withdrawal);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Already processed');
    });

    it('should fail if bridge not available', async () => {
      const noBridgeSDK = createMockSDK({ bridgeAvailable: false });
      const noBridgeProcessor = new WithdrawalProcessor(noBridgeSDK, mockLogger, {});

      const withdrawal = createMockWithdrawal();
      const result = await noBridgeProcessor.proveWithdrawal(withdrawal);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Bridge not available');
    });

    it('should handle proof failure', async () => {
      const failingSDK = createMockSDK({ shouldFail: true });
      const failingProcessor = new WithdrawalProcessor(failingSDK, mockLogger, {});

      const withdrawal = createMockWithdrawal();
      const result = await failingProcessor.proveWithdrawal(withdrawal);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Prove failed');
    });

    it('should respect concurrency limit', async () => {
      // Processor with maxConcurrent: 1
      const limitedProcessor = new WithdrawalProcessor(mockSDK, mockLogger, { maxConcurrent: 1 });

      // Make the bridge slow
      (mockSDK.bridge!.proveWithdrawal as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { txHash: '0xprove' };
      });

      const w1 = createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}` });
      const w2 = createMockWithdrawal({ initiatedTxHash: '0x2' as `0x${string}` });

      // Start first
      const firstProve = limitedProcessor.proveWithdrawal(w1);

      // Try second while first is processing
      const secondResult = await limitedProcessor.proveWithdrawal(w2);

      await firstProve;

      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toBe('Concurrency limit reached');
    });
  });

  describe('finalizeWithdrawal', () => {
    it('should successfully finalize withdrawal', async () => {
      const withdrawal = createMockWithdrawal({
        initiatedTxHash: '0x1' as `0x${string}`,
        phase: 'proven',
        canFinalize: true,
      });

      const result = await processor.finalizeWithdrawal(withdrawal);

      expect(result.success).toBe(true);
      expect(result.txHash).toBe('0xfinalize123');
      expect(result.withdrawal?.phase).toBe('finalized');
    });

    it('should fail if already processed', async () => {
      const withdrawal = createMockWithdrawal({
        initiatedTxHash: '0x1' as `0x${string}`,
        phase: 'proven',
      });

      // First finalize
      await processor.finalizeWithdrawal(withdrawal);

      // Try again
      const result = await processor.finalizeWithdrawal(withdrawal);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Already processed');
    });

    it('should handle finalization failure', async () => {
      const failingSDK = createMockSDK({ shouldFail: true });
      const failingProcessor = new WithdrawalProcessor(failingSDK, mockLogger, {});

      const withdrawal = createMockWithdrawal({ phase: 'proven' });
      const result = await failingProcessor.finalizeWithdrawal(withdrawal);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Finalize failed');
    });
  });

  describe('proveWithdrawals', () => {
    it('should process multiple withdrawals', async () => {
      const withdrawals = [
        createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}` }),
        createMockWithdrawal({ initiatedTxHash: '0x2' as `0x${string}` }),
        createMockWithdrawal({ initiatedTxHash: '0x3' as `0x${string}` }),
      ];

      const results = await processor.proveWithdrawals(withdrawals);

      expect(results).toHaveLength(3);
      expect(results.filter((r) => r.success)).toHaveLength(3);
    });

    it('should stop at concurrency limit', async () => {
      const limitedProcessor = new WithdrawalProcessor(mockSDK, mockLogger, { maxConcurrent: 2 });

      // Mock slow processing
      (mockSDK.bridge!.proveWithdrawal as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { txHash: '0xprove' };
      });

      const withdrawals = [
        createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}` }),
        createMockWithdrawal({ initiatedTxHash: '0x2' as `0x${string}` }),
        createMockWithdrawal({ initiatedTxHash: '0x3' as `0x${string}` }),
        createMockWithdrawal({ initiatedTxHash: '0x4' as `0x${string}` }),
      ];

      const results = await limitedProcessor.proveWithdrawals(withdrawals);

      // Should process at most maxConcurrent at a time
      expect(results.length).toBeLessThanOrEqual(4);
    });
  });

  describe('finalizeWithdrawals', () => {
    it('should process multiple finalizations', async () => {
      const withdrawals = [
        createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}`, phase: 'proven' }),
        createMockWithdrawal({ initiatedTxHash: '0x2' as `0x${string}`, phase: 'proven' }),
      ];

      const results = await processor.finalizeWithdrawals(withdrawals);

      expect(results).toHaveLength(2);
      expect(results.filter((r) => r.success)).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const w1 = createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}` });
      const w2 = createMockWithdrawal({ initiatedTxHash: '0x2' as `0x${string}`, phase: 'proven' });

      await processor.proveWithdrawal(w1);
      await processor.finalizeWithdrawal(w2);

      const stats = processor.getStats();

      expect(stats.currentlyProcessing).toBe(0);
      expect(stats.totalProofsProcessed).toBe(1);
      expect(stats.totalFinalizationsProcessed).toBe(1);
      expect(stats.maxConcurrent).toBe(3);
    });
  });

  describe('clearProcessedSets', () => {
    it('should clear all processed sets', async () => {
      const w1 = createMockWithdrawal({ initiatedTxHash: '0x1' as `0x${string}` });
      await processor.proveWithdrawal(w1);

      processor.clearProcessedSets();

      expect(processor.hasProofBeenProcessed('0x1' as `0x${string}`)).toBe(false);
    });
  });
});
