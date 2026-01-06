import { describe, it, expect, beforeEach } from 'vitest';
import type { Address } from 'viem';
import { detectTokenStandard } from '../detector/standardDetector.js';
import { TokenStandard } from '../types.js';
import {
  createMockPublicClient,
  TEST_ADDRESSES,
  setupERC3643Mock,
  setupERC20Mock,
  setupERC721Mock,
} from './mocks.js';

describe('Standard Detector', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockPublicClient();
  });

  it('detects ERC3643 tokens', async () => {
    setupERC3643Mock(mockClient, true);

    const result = await detectTokenStandard(
      mockClient,
      TEST_ADDRESSES.ERC3643_TOKEN as Address
    );
    expect(result).toBe(TokenStandard.ERC3643);
  });

  it('detects ERC20 tokens', async () => {
    setupERC20Mock(mockClient);

    const result = await detectTokenStandard(
      mockClient,
      TEST_ADDRESSES.ERC20_TOKEN as Address
    );
    expect(result).toBe(TokenStandard.ERC20);
  });

  it('detects ERC721 tokens', async () => {
    setupERC721Mock(mockClient);

    const result = await detectTokenStandard(
      mockClient,
      TEST_ADDRESSES.ERC721_TOKEN as Address
    );
    expect(result).toBe(TokenStandard.ERC721);
  });

  it('returns UNKNOWN for unsupported tokens', async () => {
    // Mock that fails all detection attempts
    mockClient.readContract.mockImplementation(async (args: any) => {
      const { functionName } = args;
      // ERC3643 detection fails
      if (functionName === 'supportsInterface' || functionName === 'identityRegistry' || functionName === 'canTransfer') {
        throw new Error('Not supported');
      }
      // ERC721 detection fails
      if (functionName === 'ownerOf') {
        throw new Error('Not supported');
      }
      // ERC20 detection fails
      if (functionName === 'totalSupply' || functionName === 'balanceOf') {
        throw new Error('Not supported');
      }
      throw new Error('Function not found');
    });

    const result = await detectTokenStandard(
      mockClient,
      '0xffffffffffffffffffffffffffffffffffffffff' as Address
    );
    expect(result).toBe(TokenStandard.UNKNOWN);
  });

  it('prioritizes ERC3643 over ERC20', async () => {
    // Token has both ERC3643 and ERC20 characteristics
    mockClient.readContract.mockImplementation(async (args: any) => {
      const { functionName } = args;
      if (functionName === 'supportsInterface') {
        return true; // ERC3643 supported
      }
      if (functionName === 'identityRegistry') {
        return TEST_ADDRESSES.IDENTITY_REGISTRY;
      }
      if (functionName === 'canTransfer') {
        return true;
      }
      if (functionName === 'totalSupply') {
        return BigInt('1000000');
      }
      return true;
    });

    const result = await detectTokenStandard(
      mockClient,
      TEST_ADDRESSES.ERC3643_TOKEN as Address
    );
    expect(result).toBe(TokenStandard.ERC3643);
  });

  it('prioritizes ERC721 over ERC20', async () => {
    // Mock that has ownerOf (ERC721 specific) but also ERC20 functions
    mockClient.readContract.mockImplementation(async (args: any) => {
      const { functionName } = args;
      // ERC3643 checks fail
      if (functionName === 'supportsInterface') {
        throw new Error('Not ERC165');
      }
      if (functionName === 'identityRegistry' || functionName === 'canTransfer') {
        throw new Error('Not ERC3643');
      }
      // ERC721 succeeds (ownerOf exists)
      if (functionName === 'ownerOf') {
        return TEST_ADDRESSES.USER_VERIFIED;
      }
      // ERC20 would also work (totalSupply, balanceOf)
      if (functionName === 'totalSupply') {
        return BigInt('100');
      }
      if (functionName === 'balanceOf') {
        return BigInt('10');
      }
      return true;
    });

    const result = await detectTokenStandard(
      mockClient,
      TEST_ADDRESSES.ERC721_TOKEN as Address
    );
    expect(result).toBe(TokenStandard.ERC721);
  });
});
