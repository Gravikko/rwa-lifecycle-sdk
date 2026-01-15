/**
 * WithdrawalMonitor Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WithdrawalMonitor } from '../WithdrawalMonitor.js';
import type { Logger } from '../logger.js';
import type { RWALifecycleSDK } from '@rwa-lifecycle/core';

// Mock logger
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

// Mock withdrawal data
const createMockWithdrawal = (overrides = {}) => ({
  initiatedTxHash: '0xabc123' as `0x${string}`,
  phase: 'initiated' as const,
  canProve: false,
  canFinalize: false,
  initiatedAt: BigInt(Date.now()),
  provenAt: undefined,
  provenTxHash: undefined,
  finalizedAt: undefined,
  finalizedTxHash: undefined,
  estimatedReadyToProve: new Date(Date.now() + 3600000),
  estimatedReadyToFinalize: undefined,
  ...overrides,
});

// Mock SDK
const createMockSDK = () => {
  const mockWithdrawals = [
    createMockWithdrawal({ initiatedTxHash: '0x1', phase: 'initiated', canProve: true }),
    createMockWithdrawal({ initiatedTxHash: '0x2', phase: 'initiated', canProve: false }),
    createMockWithdrawal({ initiatedTxHash: '0x3', phase: 'proven', canFinalize: true }),
  ];

  return {
    indexer: {
      withdrawals: {
        getAllPendingWithdrawals: vi.fn().mockReturnValue(mockWithdrawals),
      },
      syncNow: vi.fn().mockResolvedValue({ l1Events: 5, l2Events: 10 }),
    },
    trackWithdrawal: vi.fn().mockImplementation((txHash: string) => {
      const found = mockWithdrawals.find((w) => w.initiatedTxHash === txHash);
      return Promise.resolve(found || null);
    }),
  } as unknown as RWALifecycleSDK;
};

describe('WithdrawalMonitor', () => {
  let withdrawalMonitor: WithdrawalMonitor;
  let mockSDK: RWALifecycleSDK;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSDK = createMockSDK();
    mockLogger = createMockLogger();
    withdrawalMonitor = new WithdrawalMonitor(mockSDK, mockLogger, {});
  });

  describe('initialization', () => {
    it('should create child logger', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ module: 'WithdrawalMonitor' });
    });

    it('should accept filterByUser config', () => {
      const monitorWithFilter = new WithdrawalMonitor(mockSDK, mockLogger, {
        filterByUser: '0xuser123' as `0x${string}`,
      });

      expect(monitorWithFilter).toBeDefined();
    });
  });

  describe('getPendingWithdrawals', () => {
    it('should fetch and return pending withdrawals', async () => {
      const pending = await withdrawalMonitor.getPendingWithdrawals();

      expect(pending).toHaveLength(3);
      expect(mockSDK.indexer.withdrawals.getAllPendingWithdrawals).toHaveBeenCalled();
    });

    it('should track fetched withdrawals', async () => {
      await withdrawalMonitor.getPendingWithdrawals();

      expect(withdrawalMonitor.isTracked('0x1' as `0x${string}`)).toBe(true);
      expect(withdrawalMonitor.isTracked('0x2' as `0x${string}`)).toBe(true);
      expect(withdrawalMonitor.isTracked('0x3' as `0x${string}`)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      (mockSDK.indexer.withdrawals.getAllPendingWithdrawals as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Indexer error');
      });

      await expect(withdrawalMonitor.getPendingWithdrawals()).rejects.toThrow('Indexer error');
    });
  });

  describe('getReadyToProve', () => {
    it('should return only withdrawals ready to prove', async () => {
      const readyToProve = await withdrawalMonitor.getReadyToProve();

      expect(readyToProve).toHaveLength(1);
      expect(readyToProve[0].initiatedTxHash).toBe('0x1');
    });

    it('should not include already proven withdrawals', async () => {
      const readyToProve = await withdrawalMonitor.getReadyToProve();

      // 0x3 is in 'proven' phase, should not be included
      const hashes = readyToProve.map((w) => w.initiatedTxHash);
      expect(hashes).not.toContain('0x3');
    });
  });

  describe('getReadyToFinalize', () => {
    it('should return only withdrawals ready to finalize', async () => {
      const readyToFinalize = await withdrawalMonitor.getReadyToFinalize();

      expect(readyToFinalize).toHaveLength(1);
      expect(readyToFinalize[0].initiatedTxHash).toBe('0x3');
    });

    it('should not include withdrawals not in proven phase', async () => {
      const readyToFinalize = await withdrawalMonitor.getReadyToFinalize();

      const hashes = readyToFinalize.map((w) => w.initiatedTxHash);
      expect(hashes).not.toContain('0x1');
      expect(hashes).not.toContain('0x2');
    });
  });

  describe('getWithdrawalStatus', () => {
    it('should fetch and return withdrawal status', async () => {
      const status = await withdrawalMonitor.getWithdrawalStatus('0x1' as `0x${string}`);

      expect(status).not.toBeNull();
      expect(status?.initiatedTxHash).toBe('0x1');
    });

    it('should return null for unknown withdrawal', async () => {
      const status = await withdrawalMonitor.getWithdrawalStatus('0xunknown' as `0x${string}`);

      expect(status).toBeNull();
    });

    it('should track fetched withdrawal', async () => {
      await withdrawalMonitor.getWithdrawalStatus('0x1' as `0x${string}`);

      expect(withdrawalMonitor.isTracked('0x1' as `0x${string}`)).toBe(true);
    });

    it('should handle errors and return null', async () => {
      (mockSDK.trackWithdrawal as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const status = await withdrawalMonitor.getWithdrawalStatus('0x1' as `0x${string}`);

      expect(status).toBeNull();
    });
  });

  describe('getTrackedWithdrawals', () => {
    it('should return empty array initially', () => {
      const tracked = withdrawalMonitor.getTrackedWithdrawals();
      expect(tracked).toEqual([]);
    });

    it('should return tracked withdrawals after fetch', async () => {
      await withdrawalMonitor.getPendingWithdrawals();

      const tracked = withdrawalMonitor.getTrackedWithdrawals();
      expect(tracked).toHaveLength(3);
    });
  });

  describe('updateTrackedWithdrawal', () => {
    it('should update existing tracked withdrawal', async () => {
      await withdrawalMonitor.getPendingWithdrawals();

      withdrawalMonitor.updateTrackedWithdrawal('0x1' as `0x${string}`, {
        phase: 'proven',
        canProve: false,
      });

      const tracked = withdrawalMonitor.getTrackedWithdrawals();
      const updated = tracked.find((w) => w.initiatedTxHash === '0x1');
      expect(updated?.phase).toBe('proven');
      expect(updated?.canProve).toBe(false);
    });

    it('should not crash for unknown withdrawal', () => {
      expect(() => {
        withdrawalMonitor.updateTrackedWithdrawal('0xunknown' as `0x${string}`, {
          phase: 'proven',
        });
      }).not.toThrow();
    });
  });

  describe('isTracked', () => {
    it('should return false for untracked withdrawal', () => {
      expect(withdrawalMonitor.isTracked('0xunknown' as `0x${string}`)).toBe(false);
    });

    it('should return true for tracked withdrawal', async () => {
      await withdrawalMonitor.getPendingWithdrawals();
      expect(withdrawalMonitor.isTracked('0x1' as `0x${string}`)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return zeros initially', () => {
      const stats = withdrawalMonitor.getStats();

      expect(stats.total).toBe(0);
      expect(stats.initiated).toBe(0);
      expect(stats.proven).toBe(0);
      expect(stats.finalized).toBe(0);
      expect(stats.readyToProve).toBe(0);
      expect(stats.readyToFinalize).toBe(0);
    });

    it('should return correct stats after fetch', async () => {
      await withdrawalMonitor.getPendingWithdrawals();

      const stats = withdrawalMonitor.getStats();

      expect(stats.total).toBe(3);
      expect(stats.initiated).toBe(2); // 0x1, 0x2
      expect(stats.proven).toBe(1); // 0x3
      expect(stats.finalized).toBe(0);
      expect(stats.readyToProve).toBe(1); // 0x1
      expect(stats.readyToFinalize).toBe(1); // 0x3
    });
  });

  describe('sync', () => {
    it('should call indexer syncNow', async () => {
      const result = await withdrawalMonitor.sync();

      expect(mockSDK.indexer.syncNow).toHaveBeenCalled();
      expect(result.l1Events).toBe(5);
      expect(result.l2Events).toBe(10);
    });

    it('should handle sync errors', async () => {
      (mockSDK.indexer.syncNow as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Sync failed'));

      await expect(withdrawalMonitor.sync()).rejects.toThrow('Sync failed');
    });
  });

  describe('clear', () => {
    it('should clear all tracked withdrawals', async () => {
      await withdrawalMonitor.getPendingWithdrawals();
      expect(withdrawalMonitor.getTrackedWithdrawals()).toHaveLength(3);

      withdrawalMonitor.clear();

      expect(withdrawalMonitor.getTrackedWithdrawals()).toHaveLength(0);
    });
  });
});
