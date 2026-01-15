/**
 * Bridge Module Tests
 *
 * These tests validate the bridge module functionality.
 * Most bridge operations require actual blockchain interaction,
 * so integration tests are recommended for full coverage.
 */

import { describe, it, expect } from 'vitest';

describe('BridgeModule', () => {
  describe('initialization', () => {
    it('should export BridgeModule class', async () => {
      const { BridgeModule } = await import('../BridgeModule.js');
      expect(BridgeModule).toBeDefined();
      expect(typeof BridgeModule).toBe('function');
    });
  });

  describe('types', () => {
    it('should export WithdrawalStatus enum', async () => {
      const { WithdrawalStatus } = await import('../types.js');
      expect(WithdrawalStatus).toBeDefined();
      expect(WithdrawalStatus.INITIATED).toBeDefined();
      expect(WithdrawalStatus.PROVEN).toBeDefined();
      expect(WithdrawalStatus.FINALIZED).toBeDefined();
    });
  });
});
