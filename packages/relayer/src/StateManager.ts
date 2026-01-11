/**
 * State Manager
 *
 * Persists relayer state to a JSON file for restart recovery.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Hash } from 'viem';
import type { Logger } from './logger.js';

/**
 * Persisted state structure
 */
export interface RelayerState {
  /** Version for future migrations */
  version: number;
  /** Set of proven withdrawal hashes */
  provenWithdrawals: string[];
  /** Set of finalized withdrawal hashes */
  finalizedWithdrawals: string[];
  /** Statistics */
  stats: {
    totalProven: number;
    totalFinalized: number;
    totalFailed: number;
  };
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Default empty state
 */
const DEFAULT_STATE: RelayerState = {
  version: 1,
  provenWithdrawals: [],
  finalizedWithdrawals: [],
  stats: {
    totalProven: 0,
    totalFinalized: 0,
    totalFailed: 0,
  },
  lastUpdated: new Date().toISOString(),
};

/**
 * State manager for persisting relayer state
 */
export class StateManager {
  private filePath: string;
  private logger: Logger;
  private state: RelayerState;
  private provenSet: Set<Hash>;
  private finalizedSet: Set<Hash>;
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private saveDebounceMs: number = 5000; // Save at most every 5 seconds

  constructor(stateFilePath: string, logger: Logger) {
    this.filePath = stateFilePath;
    this.logger = logger.child({ module: 'StateManager' });
    this.state = { ...DEFAULT_STATE };
    this.provenSet = new Set();
    this.finalizedSet = new Set();
  }

  /**
   * Load state from file
   */
  async load(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const loaded = JSON.parse(data) as RelayerState;

        // Validate version
        if (loaded.version !== 1) {
          this.logger.warn(
            { version: loaded.version },
            'Unknown state version, starting fresh'
          );
          return;
        }

        this.state = loaded;
        this.provenSet = new Set(loaded.provenWithdrawals as Hash[]);
        this.finalizedSet = new Set(loaded.finalizedWithdrawals as Hash[]);

        this.logger.info(
          {
            provenCount: this.provenSet.size,
            finalizedCount: this.finalizedSet.size,
          },
          'Loaded state from file'
        );
      } else {
        this.logger.info({}, 'No existing state file, starting fresh');
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to load state, starting fresh');
      this.state = { ...DEFAULT_STATE };
      this.provenSet = new Set();
      this.finalizedSet = new Set();
    }
  }

  /**
   * Save state to file
   */
  async save(): Promise<void> {
    try {
      // Update state object
      this.state.provenWithdrawals = Array.from(this.provenSet);
      this.state.finalizedWithdrawals = Array.from(this.finalizedSet);
      this.state.lastUpdated = new Date().toISOString();

      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write atomically (write to temp file, then rename)
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2));
      fs.renameSync(tempPath, this.filePath);

      this.logger.debug({}, 'State saved to file');
    } catch (error) {
      this.logger.error({ error }, 'Failed to save state');
    }
  }

  /**
   * Schedule a debounced save
   */
  private scheduleSave(): void {
    if (this.saveDebounceTimer) {
      return; // Already scheduled
    }

    this.saveDebounceTimer = setTimeout(async () => {
      this.saveDebounceTimer = null;
      await this.save();
    }, this.saveDebounceMs);
  }

  /**
   * Mark withdrawal as proven
   */
  markProven(txHash: Hash): void {
    if (!this.provenSet.has(txHash)) {
      this.provenSet.add(txHash);
      this.state.stats.totalProven++;
      this.scheduleSave();
    }
  }

  /**
   * Mark withdrawal as finalized
   */
  markFinalized(txHash: Hash): void {
    if (!this.finalizedSet.has(txHash)) {
      this.finalizedSet.add(txHash);
      this.state.stats.totalFinalized++;
      this.scheduleSave();
    }
  }

  /**
   * Increment failed count
   */
  incrementFailed(): void {
    this.state.stats.totalFailed++;
    this.scheduleSave();
  }

  /**
   * Check if withdrawal has been proven
   */
  hasBeenProven(txHash: Hash): boolean {
    return this.provenSet.has(txHash);
  }

  /**
   * Check if withdrawal has been finalized
   */
  hasBeenFinalized(txHash: Hash): boolean {
    return this.finalizedSet.has(txHash);
  }

  /**
   * Get statistics
   */
  getStats(): RelayerState['stats'] {
    return { ...this.state.stats };
  }

  /**
   * Get full state (for debugging)
   */
  getState(): RelayerState {
    return {
      ...this.state,
      provenWithdrawals: Array.from(this.provenSet),
      finalizedWithdrawals: Array.from(this.finalizedSet),
    };
  }

  /**
   * Force immediate save
   */
  async flush(): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    await this.save();
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.state = { ...DEFAULT_STATE };
    this.provenSet.clear();
    this.finalizedSet.clear();
  }
}
