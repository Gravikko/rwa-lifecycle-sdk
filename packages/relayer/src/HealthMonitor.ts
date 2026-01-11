/**
 * Health Monitor
 *
 * Monitors relayer health and provides status endpoints.
 */

import type { Logger } from './logger.js';

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  checks: {
    service: { status: HealthStatus; message: string };
    indexer: { status: HealthStatus; message: string };
    wallet: { status: HealthStatus; message: string };
    lastPoll: { status: HealthStatus; message: string };
  };
  stats: {
    totalProven: number;
    totalFinalized: number;
    totalFailed: number;
    pendingWithdrawals: number;
    lastPollTime?: Date;
    pollsCount: number;
    averagePollDuration?: number;
  };
}

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  /** Max time since last poll before degraded (ms, default: 120000 = 2 min) */
  maxPollAge?: number;
  /** Max consecutive failures before unhealthy (default: 5) */
  maxConsecutiveFailures?: number;
}

/**
 * Monitors relayer health
 */
export class HealthMonitor {
  private logger: Logger;
  private startTime: Date;
  private lastPollTime?: Date;
  private lastPollDuration?: number;
  private pollDurations: number[] = [];
  private pollsCount: number = 0;
  private consecutiveFailures: number = 0;
  private isServiceRunning: boolean = false;
  private isIndexerConnected: boolean = false;
  private isWalletConnected: boolean = false;
  private config: Required<HealthMonitorConfig>;

  // Stats
  private totalProven: number = 0;
  private totalFinalized: number = 0;
  private totalFailed: number = 0;
  private pendingWithdrawals: number = 0;

  constructor(config: HealthMonitorConfig, logger: Logger) {
    this.config = {
      maxPollAge: config.maxPollAge ?? 120000,
      maxConsecutiveFailures: config.maxConsecutiveFailures ?? 5,
    };
    this.logger = logger.child({ module: 'HealthMonitor' });
    this.startTime = new Date();
  }

  /**
   * Record service started
   */
  serviceStarted(): void {
    this.isServiceRunning = true;
    this.startTime = new Date();
    this.logger.debug({}, 'Service started recorded');
  }

  /**
   * Record service stopped
   */
  serviceStopped(): void {
    this.isServiceRunning = false;
    this.logger.debug({}, 'Service stopped recorded');
  }

  /**
   * Record indexer connection status
   */
  setIndexerConnected(connected: boolean): void {
    this.isIndexerConnected = connected;
  }

  /**
   * Record wallet connection status
   */
  setWalletConnected(connected: boolean): void {
    this.isWalletConnected = connected;
  }

  /**
   * Record poll started
   */
  pollStarted(): Date {
    return new Date();
  }

  /**
   * Record poll completed
   */
  pollCompleted(startTime: Date, success: boolean): void {
    const duration = Date.now() - startTime.getTime();
    this.lastPollTime = new Date();
    this.lastPollDuration = duration;
    this.pollsCount++;

    // Keep last 100 poll durations for average
    this.pollDurations.push(duration);
    if (this.pollDurations.length > 100) {
      this.pollDurations.shift();
    }

    if (success) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }

    this.logger.debug(
      { duration, success, consecutiveFailures: this.consecutiveFailures },
      'Poll completed'
    );
  }

  /**
   * Record proven withdrawal
   */
  recordProven(): void {
    this.totalProven++;
  }

  /**
   * Record finalized withdrawal
   */
  recordFinalized(): void {
    this.totalFinalized++;
  }

  /**
   * Record failed operation
   */
  recordFailed(): void {
    this.totalFailed++;
  }

  /**
   * Update pending withdrawals count
   */
  updatePendingCount(count: number): void {
    this.pendingWithdrawals = count;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Get average poll duration
   */
  getAveragePollDuration(): number | undefined {
    if (this.pollDurations.length === 0) {
      return undefined;
    }
    const sum = this.pollDurations.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.pollDurations.length);
  }

  /**
   * Perform health check
   */
  check(): HealthCheckResult {
    const now = new Date();

    // Check service status
    const serviceCheck = this.checkService();

    // Check indexer status
    const indexerCheck = this.checkIndexer();

    // Check wallet status
    const walletCheck = this.checkWallet();

    // Check last poll time
    const lastPollCheck = this.checkLastPoll(now);

    // Determine overall status
    const checks = [serviceCheck, indexerCheck, walletCheck, lastPollCheck];
    let overallStatus: HealthStatus = 'healthy';

    if (checks.some((c) => c.status === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (checks.some((c) => c.status === 'degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: now,
      uptime: this.getUptime(),
      checks: {
        service: serviceCheck,
        indexer: indexerCheck,
        wallet: walletCheck,
        lastPoll: lastPollCheck,
      },
      stats: {
        totalProven: this.totalProven,
        totalFinalized: this.totalFinalized,
        totalFailed: this.totalFailed,
        pendingWithdrawals: this.pendingWithdrawals,
        lastPollTime: this.lastPollTime,
        pollsCount: this.pollsCount,
        averagePollDuration: this.getAveragePollDuration(),
      },
    };
  }

  /**
   * Check service status
   */
  private checkService(): { status: HealthStatus; message: string } {
    if (!this.isServiceRunning) {
      return { status: 'unhealthy', message: 'Service is not running' };
    }

    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return {
        status: 'unhealthy',
        message: `${this.consecutiveFailures} consecutive failures`,
      };
    }

    if (this.consecutiveFailures > 0) {
      return {
        status: 'degraded',
        message: `${this.consecutiveFailures} recent failure(s)`,
      };
    }

    return { status: 'healthy', message: 'Service running normally' };
  }

  /**
   * Check indexer status
   */
  private checkIndexer(): { status: HealthStatus; message: string } {
    if (!this.isIndexerConnected) {
      return { status: 'degraded', message: 'Indexer not connected' };
    }
    return { status: 'healthy', message: 'Indexer connected' };
  }

  /**
   * Check wallet status
   */
  private checkWallet(): { status: HealthStatus; message: string } {
    if (!this.isWalletConnected) {
      return { status: 'unhealthy', message: 'Wallet not connected' };
    }
    return { status: 'healthy', message: 'Wallet connected' };
  }

  /**
   * Check last poll time
   */
  private checkLastPoll(now: Date): { status: HealthStatus; message: string } {
    if (!this.lastPollTime) {
      if (this.pollsCount === 0) {
        return { status: 'healthy', message: 'No polls yet (just started)' };
      }
      return { status: 'degraded', message: 'No polls recorded' };
    }

    const age = now.getTime() - this.lastPollTime.getTime();

    if (age > this.config.maxPollAge * 2) {
      return {
        status: 'unhealthy',
        message: `Last poll ${Math.round(age / 1000)}s ago`,
      };
    }

    if (age > this.config.maxPollAge) {
      return {
        status: 'degraded',
        message: `Last poll ${Math.round(age / 1000)}s ago`,
      };
    }

    return {
      status: 'healthy',
      message: `Last poll ${Math.round(age / 1000)}s ago`,
    };
  }

  /**
   * Get simple status string
   */
  getStatusString(): string {
    const health = this.check();
    const uptime = this.formatUptime(health.uptime);

    return [
      `Status: ${health.status.toUpperCase()}`,
      `Uptime: ${uptime}`,
      `Polls: ${health.stats.pollsCount}`,
      `Proven: ${health.stats.totalProven}`,
      `Finalized: ${health.stats.totalFinalized}`,
      `Failed: ${health.stats.totalFailed}`,
      `Pending: ${health.stats.pendingWithdrawals}`,
    ].join(' | ');
  }

  /**
   * Format uptime as human-readable string
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Reset all stats (for testing)
   */
  reset(): void {
    this.startTime = new Date();
    this.lastPollTime = undefined;
    this.lastPollDuration = undefined;
    this.pollDurations = [];
    this.pollsCount = 0;
    this.consecutiveFailures = 0;
    this.totalProven = 0;
    this.totalFinalized = 0;
    this.totalFailed = 0;
    this.pendingWithdrawals = 0;
  }
}
