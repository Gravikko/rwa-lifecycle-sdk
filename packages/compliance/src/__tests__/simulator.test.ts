import { describe, it, expect, beforeEach } from 'vitest';
import type { Address } from 'viem';
import { simulateERC20Transfer, simulateERC721Transfer, isComplianceFailure } from '../simulation/simulator.js';
import {
  createMockPublicClient,
  TEST_ADDRESSES,
  setupCompliantTransferMock,
  setupBlacklistTransferMock,
} from './mocks.js';

describe('Transfer Simulator', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockPublicClient();
  });

  describe('ERC20 Simulation', () => {
    it('simulates successful ERC20 transfer', async () => {
      setupCompliantTransferMock(mockClient);

      const result = await simulateERC20Transfer(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_WHITELISTED as Address,
        BigInt('100')
      );

      expect(result.success).toBe(true);
      expect(result.estimatedGas).toBeDefined();
    });

    it('detects failed ERC20 transfer due to blacklist', async () => {
      setupBlacklistTransferMock(mockClient);

      const result = await simulateERC20Transfer(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_BLACKLISTED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.success).toBe(false);
      expect(result.revertReason).toBeDefined();
      expect(result.revertReason).toContain('blacklisted');
    });

    it('handles generic revert message', async () => {
      mockClient.simulateContract.mockRejectedValue(
        new Error('execution reverted')
      );

      const result = await simulateERC20Transfer(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.success).toBe(false);
      expect(result.revertReason).toBeDefined();
    });
  });

  describe('ERC721 Simulation', () => {
    it('simulates successful ERC721 transfer', async () => {
      setupCompliantTransferMock(mockClient);

      const result = await simulateERC721Transfer(
        mockClient,
        TEST_ADDRESSES.ERC721_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_WHITELISTED as Address,
        BigInt('1')
      );

      expect(result.success).toBe(true);
      expect(result.estimatedGas).toBeDefined();
    });

    it('detects failed ERC721 transfer', async () => {
      mockClient.simulateContract.mockRejectedValue(
        new Error('reverted with reason: "Not authorized"')
      );

      const result = await simulateERC721Transfer(
        mockClient,
        TEST_ADDRESSES.ERC721_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_WHITELISTED as Address,
        BigInt('999')
      );

      expect(result.success).toBe(false);
      expect(result.revertReason).toContain('Not authorized');
    });
  });

  describe('Compliance Failure Detection', () => {
    it('detects compliance failure from blacklist error', () => {
      const result = {
        success: false,
        revertReason: 'Address is blacklisted',
      };

      expect(isComplianceFailure(result)).toBe(true);
    });

    it('detects compliance failure from whitelist error', () => {
      const result = {
        success: false,
        revertReason: 'Not whitelisted',
      };

      expect(isComplianceFailure(result)).toBe(true);
    });

    it('detects compliance failure from verification error', () => {
      const result = {
        success: false,
        revertReason: 'User not verified',
      };

      expect(isComplianceFailure(result)).toBe(true);
    });

    it('does not flag generic error as compliance failure', () => {
      const result = {
        success: false,
        revertReason: 'Insufficient balance',
      };

      expect(isComplianceFailure(result)).toBe(false);
    });

    it('does not flag successful transfer as compliance failure', () => {
      const result = {
        success: true,
      };

      expect(isComplianceFailure(result)).toBe(false);
    });

    it('handles missing revert reason', () => {
      const result = {
        success: false,
      };

      expect(isComplianceFailure(result)).toBe(false);
    });
  });

  describe('Revert Reason Parsing', () => {
    it('extracts reason from string format', async () => {
      mockClient.simulateContract.mockRejectedValue(
        new Error('reverted with reason: "Custom transfer failure"')
      );

      const result = await simulateERC20Transfer(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.revertReason).toContain('Custom transfer failure');
    });

    it('extracts reason from custom error', async () => {
      mockClient.simulateContract.mockRejectedValue(
        new Error("reverted with custom error 'TransferBlocked'")
      );

      const result = await simulateERC20Transfer(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.revertReason).toContain('TransferBlocked');
    });

    it('handles unknown error format gracefully', async () => {
      mockClient.simulateContract.mockRejectedValue(
        new Error('Something went wrong')
      );

      const result = await simulateERC20Transfer(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.success).toBe(false);
      expect(result.revertReason).toBeDefined();
    });
  });
});
