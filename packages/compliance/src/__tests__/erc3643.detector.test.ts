import { describe, it, expect, beforeEach } from 'vitest';
import type { Address } from 'viem';
import { isERC3643Token } from '../erc3643/detector.js';
import { createMockPublicClient, TEST_ADDRESSES, setupERC3643Mock } from './mocks.js';

describe('ERC3643 Detector', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockPublicClient();
  });

  it('detects ERC3643 token via ERC165', async () => {
    setupERC3643Mock(mockClient, true);

    const result = await isERC3643Token(mockClient, TEST_ADDRESSES.ERC3643_TOKEN as Address);
    expect(result).toBe(true);
  });

  it('detects non-ERC3643 token via ERC165', async () => {
    setupERC3643Mock(mockClient, false);

    const result = await isERC3643Token(mockClient, TEST_ADDRESSES.ERC20_TOKEN as Address);
    expect(result).toBe(false);
  });

  it('falls back to function call detection when ERC165 not supported', async () => {
    mockClient.readContract.mockImplementation(async (args: any) => {
      const { functionName } = args;

      // ERC165 fails
      if (functionName === 'supportsInterface') {
        throw new Error('ERC165 not supported');
      }

      // But ERC3643 functions exist
      if (functionName === 'identityRegistry') {
        return TEST_ADDRESSES.IDENTITY_REGISTRY;
      }

      if (functionName === 'canTransfer') {
        return true;
      }

      return true;
    });

    const result = await isERC3643Token(mockClient, TEST_ADDRESSES.ERC3643_TOKEN as Address);
    expect(result).toBe(true);
  });

  it('returns false when ERC3643 functions do not exist', async () => {
    mockClient.readContract.mockRejectedValue(new Error('Function not found'));

    const result = await isERC3643Token(mockClient, TEST_ADDRESSES.ERC20_TOKEN as Address);
    expect(result).toBe(false);
  });
});
