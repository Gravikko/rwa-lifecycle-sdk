import { vi } from 'vitest';
import type { PublicClient } from 'viem';

/**
 * Create a mock PublicClient for testing
 */
export function createMockPublicClient(overrides?: Partial<PublicClient>): PublicClient {
  return {
    readContract: vi.fn(),
    simulateContract: vi.fn(),
    call: vi.fn(),
    ...overrides,
  } as any;
}

/**
 * Mock addresses for testing
 */
export const TEST_ADDRESSES = {
  ERC3643_TOKEN: '0x1111111111111111111111111111111111111111',
  ERC20_TOKEN: '0x2222222222222222222222222222222222222222',
  ERC721_TOKEN: '0x3333333333333333333333333333333333333333',
  IDENTITY_REGISTRY: '0x4444444444444444444444444444444444444444',
  USER_VERIFIED: '0x5555555555555555555555555555555555555555',
  USER_NOT_VERIFIED: '0x6666666666666666666666666666666666666666',
  USER_BLACKLISTED: '0x7777777777777777777777777777777777777777',
  USER_WHITELISTED: '0x8888888888888888888888888888888888888888',
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
};

/**
 * Setup mock for ERC3643 token detection
 */
export function setupERC3643Mock(publicClient: any, isERC3643: boolean = true) {
  publicClient.readContract.mockImplementation(async (args: any) => {
    const { functionName } = args;

    if (!isERC3643) {
      // Not ERC3643 - only ERC165 succeeds but returns false
      if (functionName === 'supportsInterface') {
        return false;
      }
      // Other functions throw
      throw new Error('Function not found');
    }

    // isERC3643 === true
    // ERC165 check
    if (functionName === 'supportsInterface') {
      return true;
    }

    // identityRegistry
    if (functionName === 'identityRegistry') {
      return TEST_ADDRESSES.IDENTITY_REGISTRY;
    }

    // canTransfer
    if (functionName === 'canTransfer') {
      return true;
    }

    // isVerified
    if (functionName === 'isVerified') {
      return true;
    }

    return true;
  });
}

/**
 * Setup mock for ERC20 token detection
 */
export function setupERC20Mock(publicClient: any) {
  publicClient.readContract.mockImplementation(async (args: any) => {
    const { functionName } = args;

    if (functionName === 'supportsInterface') {
      throw new Error('ERC165 not supported');
    }

    if (functionName === 'totalSupply') {
      return BigInt('1000000000000000000000000');
    }

    if (functionName === 'balanceOf') {
      return BigInt('100000000000000000000');
    }

    throw new Error('Unknown function');
  });
}

/**
 * Setup mock for ERC721 token detection
 */
export function setupERC721Mock(publicClient: any) {
  publicClient.readContract.mockImplementation(async (args: any) => {
    const { functionName } = args;

    if (functionName === 'supportsInterface') {
      throw new Error('ERC165 not supported');
    }

    if (functionName === 'ownerOf') {
      return TEST_ADDRESSES.USER_VERIFIED;
    }

    if (functionName === 'totalSupply') {
      throw new Error('Not ERC20');
    }

    throw new Error('Unknown function');
  });
}

/**
 * Setup mock for compliant transfer
 */
export function setupCompliantTransferMock(publicClient: any) {
  publicClient.simulateContract.mockResolvedValue({
    request: {
      gas: BigInt('100000'),
    },
  });
}

/**
 * Setup mock for non-compliant transfer (blacklist)
 */
export function setupBlacklistTransferMock(publicClient: any) {
  publicClient.simulateContract.mockRejectedValue(
    new Error('reverted with reason: "Address is blacklisted"')
  );
}

/**
 * Setup mock for blacklist plugin
 */
export function setupBlacklistPluginMock(publicClient: any, isBlacklisted: boolean = false) {
  publicClient.readContract.mockImplementation(async (args: any) => {
    const { functionName } = args;

    if (functionName === 'blacklist') {
      return isBlacklisted;
    }

    return false;
  });
}

/**
 * Setup mock for whitelist plugin
 */
export function setupWhitelistPluginMock(publicClient: any, isWhitelisted: boolean = true) {
  publicClient.readContract.mockImplementation(async (args: any) => {
    const { functionName } = args;

    if (functionName === 'whitelist') {
      return isWhitelisted;
    }

    return true;
  });
}
