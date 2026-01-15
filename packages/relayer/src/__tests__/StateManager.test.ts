/**
 * StateManager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { StateManager } from '../StateManager.js';
import type { Logger } from '../logger.js';

// Mock logger
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

describe('StateManager', () => {
  let stateManager: StateManager;
  let mockLogger: Logger;
  const testStateFile = '/tmp/test-relayer-state.json';

  beforeEach(() => {
    mockLogger = createMockLogger();
    stateManager = new StateManager(testStateFile, mockLogger);
    // Clean up test file
    if (fs.existsSync(testStateFile)) {
      fs.unlinkSync(testStateFile);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testStateFile)) {
      fs.unlinkSync(testStateFile);
    }
    if (fs.existsSync(`${testStateFile}.tmp`)) {
      fs.unlinkSync(`${testStateFile}.tmp`);
    }
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should start with empty state', () => {
      const state = stateManager.getState();
      expect(state.version).toBe(1);
      expect(state.provenWithdrawals).toEqual([]);
      expect(state.finalizedWithdrawals).toEqual([]);
      expect(state.stats.totalProven).toBe(0);
      expect(state.stats.totalFinalized).toBe(0);
      expect(state.stats.totalFailed).toBe(0);
    });

    it('should create child logger', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ module: 'StateManager' });
    });
  });

  describe('load', () => {
    it('should load state from file', async () => {
      // Create a state file
      const savedState = {
        version: 1,
        provenWithdrawals: ['0xabc123'],
        finalizedWithdrawals: ['0xdef456'],
        stats: { totalProven: 5, totalFinalized: 3, totalFailed: 1 },
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(testStateFile, JSON.stringify(savedState));

      await stateManager.load();

      expect(stateManager.hasBeenProven('0xabc123' as `0x${string}`)).toBe(true);
      expect(stateManager.hasBeenFinalized('0xdef456' as `0x${string}`)).toBe(true);
      expect(stateManager.getStats().totalProven).toBe(5);
      expect(stateManager.getStats().totalFinalized).toBe(3);
      expect(stateManager.getStats().totalFailed).toBe(1);
    });

    it('should start fresh if file does not exist', async () => {
      await stateManager.load();

      const state = stateManager.getState();
      expect(state.provenWithdrawals).toEqual([]);
      expect(state.finalizedWithdrawals).toEqual([]);
    });

    it('should start fresh if version is unknown', async () => {
      const savedState = {
        version: 999,
        provenWithdrawals: ['0xabc'],
        finalizedWithdrawals: [],
        stats: { totalProven: 10, totalFinalized: 0, totalFailed: 0 },
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(testStateFile, JSON.stringify(savedState));

      await stateManager.load();

      // Should have empty state, not the loaded one
      expect(stateManager.getStats().totalProven).toBe(0);
    });

    it('should start fresh if file is corrupted', async () => {
      fs.writeFileSync(testStateFile, 'not valid json {{{');

      await stateManager.load();

      const state = stateManager.getState();
      expect(state.provenWithdrawals).toEqual([]);
    });
  });

  describe('save', () => {
    it('should save state to file', async () => {
      stateManager.markProven('0xabc123' as `0x${string}`);
      stateManager.markFinalized('0xdef456' as `0x${string}`);

      await stateManager.save();

      const savedData = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(savedData.provenWithdrawals).toContain('0xabc123');
      expect(savedData.finalizedWithdrawals).toContain('0xdef456');
      expect(savedData.stats.totalProven).toBe(1);
      expect(savedData.stats.totalFinalized).toBe(1);
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = '/tmp/test-relayer-nested/subdir/state.json';
      const nestedManager = new StateManager(nestedPath, mockLogger);

      nestedManager.markProven('0x123' as `0x${string}`);
      await nestedManager.save();

      expect(fs.existsSync(nestedPath)).toBe(true);

      // Cleanup
      fs.unlinkSync(nestedPath);
      fs.rmdirSync(path.dirname(nestedPath));
      fs.rmdirSync(path.dirname(path.dirname(nestedPath)));
    });
  });

  describe('markProven', () => {
    it('should mark withdrawal as proven', () => {
      const txHash = '0xabc123' as `0x${string}`;

      stateManager.markProven(txHash);

      expect(stateManager.hasBeenProven(txHash)).toBe(true);
      expect(stateManager.getStats().totalProven).toBe(1);
    });

    it('should not increment count for duplicate', () => {
      const txHash = '0xabc123' as `0x${string}`;

      stateManager.markProven(txHash);
      stateManager.markProven(txHash);

      expect(stateManager.getStats().totalProven).toBe(1);
    });
  });

  describe('markFinalized', () => {
    it('should mark withdrawal as finalized', () => {
      const txHash = '0xdef456' as `0x${string}`;

      stateManager.markFinalized(txHash);

      expect(stateManager.hasBeenFinalized(txHash)).toBe(true);
      expect(stateManager.getStats().totalFinalized).toBe(1);
    });

    it('should not increment count for duplicate', () => {
      const txHash = '0xdef456' as `0x${string}`;

      stateManager.markFinalized(txHash);
      stateManager.markFinalized(txHash);

      expect(stateManager.getStats().totalFinalized).toBe(1);
    });
  });

  describe('incrementFailed', () => {
    it('should increment failed count', () => {
      stateManager.incrementFailed();
      stateManager.incrementFailed();
      stateManager.incrementFailed();

      expect(stateManager.getStats().totalFailed).toBe(3);
    });
  });

  describe('hasBeenProven / hasBeenFinalized', () => {
    it('should return false for unknown hash', () => {
      const txHash = '0xunknown' as `0x${string}`;

      expect(stateManager.hasBeenProven(txHash)).toBe(false);
      expect(stateManager.hasBeenFinalized(txHash)).toBe(false);
    });

    it('should return true after marking', () => {
      const txHash = '0xknown' as `0x${string}`;

      stateManager.markProven(txHash);
      expect(stateManager.hasBeenProven(txHash)).toBe(true);

      stateManager.markFinalized(txHash);
      expect(stateManager.hasBeenFinalized(txHash)).toBe(true);
    });
  });

  describe('getState', () => {
    it('should return full state object', () => {
      stateManager.markProven('0x1' as `0x${string}`);
      stateManager.markProven('0x2' as `0x${string}`);
      stateManager.markFinalized('0x3' as `0x${string}`);

      const state = stateManager.getState();

      expect(state.version).toBe(1);
      expect(state.provenWithdrawals).toContain('0x1');
      expect(state.provenWithdrawals).toContain('0x2');
      expect(state.finalizedWithdrawals).toContain('0x3');
      expect(state.stats.totalProven).toBe(2);
      expect(state.stats.totalFinalized).toBe(1);
    });
  });

  describe('flush', () => {
    it('should save immediately', async () => {
      stateManager.markProven('0xflush' as `0x${string}`);

      await stateManager.flush();

      expect(fs.existsSync(testStateFile)).toBe(true);
      const savedData = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(savedData.provenWithdrawals).toContain('0xflush');
    });
  });

  describe('clear', () => {
    it('should clear all state', () => {
      stateManager.markProven('0x1' as `0x${string}`);
      stateManager.markFinalized('0x2' as `0x${string}`);
      stateManager.incrementFailed();

      stateManager.clear();

      const state = stateManager.getState();
      expect(state.provenWithdrawals).toEqual([]);
      expect(state.finalizedWithdrawals).toEqual([]);
      expect(state.stats.totalProven).toBe(0);
      expect(state.stats.totalFinalized).toBe(0);
      expect(state.stats.totalFailed).toBe(0);
    });
  });
});
