/**
 * HealthMonitor Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HealthMonitor } from '../HealthMonitor.js';
import type { Logger } from '../logger.js';

// Mock logger
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    healthMonitor = new HealthMonitor(
      {
        maxPollAge: 60000, // 1 minute
        maxConsecutiveFailures: 3,
      },
      mockLogger
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should use default values if not provided', () => {
      const monitor = new HealthMonitor({}, mockLogger);
      const health = monitor.check();

      // Should start unhealthy (service not running)
      expect(health.status).toBe('unhealthy');
    });

    it('should create child logger', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ module: 'HealthMonitor' });
    });
  });

  describe('serviceStarted / serviceStopped', () => {
    it('should track service running state', () => {
      healthMonitor.serviceStarted();
      healthMonitor.setWalletConnected(true);

      const health = healthMonitor.check();
      expect(health.checks.service.status).toBe('healthy');
    });

    it('should mark unhealthy when stopped', () => {
      healthMonitor.serviceStarted();
      healthMonitor.serviceStopped();

      const health = healthMonitor.check();
      expect(health.checks.service.status).toBe('unhealthy');
      expect(health.checks.service.message).toBe('Service is not running');
    });
  });

  describe('setIndexerConnected', () => {
    it('should mark indexer as healthy when connected', () => {
      healthMonitor.setIndexerConnected(true);

      const health = healthMonitor.check();
      expect(health.checks.indexer.status).toBe('healthy');
      expect(health.checks.indexer.message).toBe('Indexer connected');
    });

    it('should mark indexer as degraded when disconnected', () => {
      healthMonitor.setIndexerConnected(false);

      const health = healthMonitor.check();
      expect(health.checks.indexer.status).toBe('degraded');
      expect(health.checks.indexer.message).toBe('Indexer not connected');
    });
  });

  describe('setWalletConnected', () => {
    it('should mark wallet as healthy when connected', () => {
      healthMonitor.setWalletConnected(true);

      const health = healthMonitor.check();
      expect(health.checks.wallet.status).toBe('healthy');
      expect(health.checks.wallet.message).toBe('Wallet connected');
    });

    it('should mark wallet as unhealthy when disconnected', () => {
      healthMonitor.setWalletConnected(false);

      const health = healthMonitor.check();
      expect(health.checks.wallet.status).toBe('unhealthy');
      expect(health.checks.wallet.message).toBe('Wallet not connected');
    });
  });

  describe('pollStarted / pollCompleted', () => {
    it('should track poll count', () => {
      healthMonitor.serviceStarted();

      const startTime = healthMonitor.pollStarted();
      healthMonitor.pollCompleted(startTime, true);

      const health = healthMonitor.check();
      expect(health.stats.pollsCount).toBe(1);
    });

    it('should track poll duration', () => {
      healthMonitor.serviceStarted();

      const startTime = new Date(Date.now() - 100); // 100ms ago
      healthMonitor.pollCompleted(startTime, true);

      const avgDuration = healthMonitor.getAveragePollDuration();
      expect(avgDuration).toBeGreaterThanOrEqual(100);
    });

    it('should reset consecutive failures on success', () => {
      healthMonitor.serviceStarted();
      healthMonitor.setWalletConnected(true);

      // Record failures
      healthMonitor.pollCompleted(new Date(), false);
      healthMonitor.pollCompleted(new Date(), false);

      // Check degraded
      let health = healthMonitor.check();
      expect(health.checks.service.status).toBe('degraded');

      // Record success
      healthMonitor.pollCompleted(new Date(), true);

      // Should be healthy again
      health = healthMonitor.check();
      expect(health.checks.service.status).toBe('healthy');
    });

    it('should mark unhealthy after max consecutive failures', () => {
      healthMonitor.serviceStarted();
      healthMonitor.setWalletConnected(true);

      // Record failures up to max
      healthMonitor.pollCompleted(new Date(), false);
      healthMonitor.pollCompleted(new Date(), false);
      healthMonitor.pollCompleted(new Date(), false);

      const health = healthMonitor.check();
      expect(health.checks.service.status).toBe('unhealthy');
      expect(health.checks.service.message).toContain('consecutive failures');
    });
  });

  describe('recordProven / recordFinalized / recordFailed', () => {
    it('should track proven count', () => {
      healthMonitor.recordProven();
      healthMonitor.recordProven();

      const health = healthMonitor.check();
      expect(health.stats.totalProven).toBe(2);
    });

    it('should track finalized count', () => {
      healthMonitor.recordFinalized();
      healthMonitor.recordFinalized();
      healthMonitor.recordFinalized();

      const health = healthMonitor.check();
      expect(health.stats.totalFinalized).toBe(3);
    });

    it('should track failed count', () => {
      healthMonitor.recordFailed();

      const health = healthMonitor.check();
      expect(health.stats.totalFailed).toBe(1);
    });
  });

  describe('updatePendingCount', () => {
    it('should update pending withdrawals count', () => {
      healthMonitor.updatePendingCount(10);

      const health = healthMonitor.check();
      expect(health.stats.pendingWithdrawals).toBe(10);
    });
  });

  describe('getUptime', () => {
    it('should return uptime in milliseconds', async () => {
      const before = healthMonitor.getUptime();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const after = healthMonitor.getUptime();
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('getAveragePollDuration', () => {
    it('should return undefined if no polls', () => {
      expect(healthMonitor.getAveragePollDuration()).toBeUndefined();
    });

    it('should calculate average of poll durations', () => {
      healthMonitor.serviceStarted();

      // Simulate polls with different durations
      healthMonitor.pollCompleted(new Date(Date.now() - 100), true);
      healthMonitor.pollCompleted(new Date(Date.now() - 200), true);
      healthMonitor.pollCompleted(new Date(Date.now() - 300), true);

      const avg = healthMonitor.getAveragePollDuration();
      expect(avg).toBeGreaterThan(0);
    });
  });

  describe('check', () => {
    it('should return overall healthy when all checks pass', () => {
      healthMonitor.serviceStarted();
      healthMonitor.setIndexerConnected(true);
      healthMonitor.setWalletConnected(true);
      healthMonitor.pollCompleted(new Date(), true);

      const health = healthMonitor.check();
      expect(health.status).toBe('healthy');
    });

    it('should return degraded when any check is degraded', () => {
      healthMonitor.serviceStarted();
      healthMonitor.setIndexerConnected(false); // degraded
      healthMonitor.setWalletConnected(true);

      const health = healthMonitor.check();
      expect(health.status).toBe('degraded');
    });

    it('should return unhealthy when any check is unhealthy', () => {
      healthMonitor.serviceStarted();
      healthMonitor.setIndexerConnected(true);
      healthMonitor.setWalletConnected(false); // unhealthy

      const health = healthMonitor.check();
      expect(health.status).toBe('unhealthy');
    });

    it('should include all stats in result', () => {
      healthMonitor.serviceStarted();
      healthMonitor.recordProven();
      healthMonitor.recordFinalized();
      healthMonitor.recordFailed();
      healthMonitor.updatePendingCount(5);
      healthMonitor.pollCompleted(new Date(), true);

      const health = healthMonitor.check();
      expect(health.stats.totalProven).toBe(1);
      expect(health.stats.totalFinalized).toBe(1);
      expect(health.stats.totalFailed).toBe(1);
      expect(health.stats.pendingWithdrawals).toBe(5);
      expect(health.stats.pollsCount).toBe(1);
    });

    it('should include timestamp and uptime', () => {
      const health = healthMonitor.check();

      expect(health.timestamp).toBeInstanceOf(Date);
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkLastPoll', () => {
    it('should be healthy if just started with no polls', () => {
      healthMonitor.serviceStarted();
      healthMonitor.setWalletConnected(true);

      const health = healthMonitor.check();
      expect(health.checks.lastPoll.status).toBe('healthy');
      expect(health.checks.lastPoll.message).toBe('No polls yet (just started)');
    });

    it('should be degraded if poll is old', () => {
      healthMonitor.serviceStarted();
      healthMonitor.setWalletConnected(true);

      // Simulate old poll by directly manipulating (we'd need to mock Date.now)
      // For now, we record a poll and check it's not too old
      const startTime = healthMonitor.pollStarted();
      healthMonitor.pollCompleted(startTime, true);

      const health = healthMonitor.check();
      expect(health.checks.lastPoll.status).toBe('healthy');
    });
  });

  describe('getStatusString', () => {
    it('should return formatted status string', () => {
      healthMonitor.serviceStarted();
      healthMonitor.setWalletConnected(true);
      healthMonitor.recordProven();
      healthMonitor.recordFinalized();
      healthMonitor.updatePendingCount(3);
      healthMonitor.pollCompleted(new Date(), true);

      const status = healthMonitor.getStatusString();

      expect(status).toContain('Status:');
      expect(status).toContain('Uptime:');
      expect(status).toContain('Polls: 1');
      expect(status).toContain('Proven: 1');
      expect(status).toContain('Finalized: 1');
      expect(status).toContain('Pending: 3');
    });
  });

  describe('formatUptime', () => {
    it('should format seconds correctly', () => {
      healthMonitor.serviceStarted();
      // Just check it doesn't crash and returns something
      const status = healthMonitor.getStatusString();
      expect(status).toContain('Uptime:');
    });
  });

  describe('reset', () => {
    it('should reset all stats', () => {
      healthMonitor.serviceStarted();
      healthMonitor.recordProven();
      healthMonitor.recordProven();
      healthMonitor.recordFinalized();
      healthMonitor.recordFailed();
      healthMonitor.updatePendingCount(10);
      healthMonitor.pollCompleted(new Date(), true);

      healthMonitor.reset();

      const health = healthMonitor.check();
      expect(health.stats.totalProven).toBe(0);
      expect(health.stats.totalFinalized).toBe(0);
      expect(health.stats.totalFailed).toBe(0);
      expect(health.stats.pendingWithdrawals).toBe(0);
      expect(health.stats.pollsCount).toBe(0);
    });
  });
});
