import { describe, it, expect, beforeEach } from 'vitest';
import type { Address } from 'viem';
import { ComplianceModule } from '../ComplianceModule.js';
import { TokenStandard } from '../types.js';
import { BlacklistPlugin } from '../plugins/examples/index.js';
import {
  createMockPublicClient,
  TEST_ADDRESSES,
  setupERC3643Mock,
  setupERC20Mock,
  setupBlacklistPluginMock,
} from './mocks.js';

describe('ComplianceModule', () => {
  let compliance: ComplianceModule;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockPublicClient();
    compliance = new ComplianceModule({
      publicClient: mockClient,
      network: 'testnet',
    });
  });

  describe('ERC3643 Compliance', () => {
    it('checks compliance for ERC3643 tokens', async () => {
      setupERC3643Mock(mockClient, true);

      const result = await compliance.checkCompliance(
        TEST_ADDRESSES.ERC3643_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(true);
      expect(result.tokenStandard).toBe(TokenStandard.ERC3643);
    });

    it('detects when ERC3643 transfer not allowed', async () => {
      mockClient.readContract.mockImplementation(async (args: any) => {
        const { functionName } = args;
        if (functionName === 'supportsInterface') {
          return true;
        }
        if (functionName === 'canTransfer') {
          return false; // Transfer blocked
        }
        if (functionName === 'isVerified') {
          return true;
        }
        if (functionName === 'identityRegistry') {
          return TEST_ADDRESSES.IDENTITY_REGISTRY;
        }
        return true;
      });

      const result = await compliance.checkCompliance(
        TEST_ADDRESSES.ERC3643_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_NOT_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('Plugin Integration', () => {
    it('uses registered plugin for custom tokens', async () => {
      setupBlacklistPluginMock(mockClient, false);

      const plugin = new BlacklistPlugin();
      compliance.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin);

      const result = await compliance.checkCompliance(
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_WHITELISTED as Address,
        BigInt('100'),
        { tokenStandard: TokenStandard.ERC20 } // Provide standard to skip detection
      );

      expect(result.compliant).toBe(true);
      expect(result.tokenStandard).toBe(TokenStandard.ERC20);
    });

    it('blocks transfer when plugin fails', async () => {
      setupBlacklistPluginMock(mockClient, true);

      const plugin = new BlacklistPlugin();
      compliance.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin);

      const result = await compliance.checkCompliance(
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_BLACKLISTED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(false);
      expect(result.reason).toContain('blacklisted');
    });

    it('uses named plugin when called explicitly', async () => {
      setupBlacklistPluginMock(mockClient, false);

      const plugin = new BlacklistPlugin();
      compliance.registerNamedPlugin('blacklist-checker', plugin);

      const result = await compliance.checkWithNamedPlugin(
        'blacklist-checker',
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(true);
    });

    it('can unregister plugin', async () => {
      setupBlacklistPluginMock(mockClient, false);

      const plugin = new BlacklistPlugin();
      compliance.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin);

      // With plugin, should use plugin
      let result = await compliance.checkCompliance(
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100'),
        { tokenStandard: TokenStandard.ERC20 }
      );
      expect(result.compliant).toBe(true);

      // Unregister
      compliance.unregisterPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address);

      // Verify plugin is gone
      expect(compliance.getRegisteredTokens().length).toBe(0);
    });
  });

  describe('Token Standard Detection', () => {
    it('detects ERC3643 tokens', async () => {
      setupERC3643Mock(mockClient, true);

      const standard = await compliance.detectStandard(
        TEST_ADDRESSES.ERC3643_TOKEN as Address
      );
      expect(standard).toBe(TokenStandard.ERC3643);
    });

    it('detects ERC20 tokens', async () => {
      setupERC20Mock(mockClient);

      const standard = await compliance.detectStandard(
        TEST_ADDRESSES.ERC20_TOKEN as Address
      );
      expect(standard).toBe(TokenStandard.ERC20);
    });

    it('allows pre-detected standard to skip detection', async () => {
      const result = await compliance.checkCompliance(
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100'),
        { tokenStandard: TokenStandard.ERC20 }
      );

      // Should not call readContract for detection
      expect(result.tokenStandard).toBe(TokenStandard.ERC20);
    });
  });

  describe('Plain Tokens (No Compliance)', () => {
    it('assumes plain ERC20 is compliant', async () => {
      setupERC20Mock(mockClient);

      const result = await compliance.checkCompliance(
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_WHITELISTED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(true);
      expect(result.tokenStandard).toBe(TokenStandard.ERC20);
    });
  });

  describe('Plugin Management', () => {
    it('lists registered tokens', () => {
      const plugin1 = new BlacklistPlugin();
      const plugin2 = new BlacklistPlugin();

      compliance.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin1);
      compliance.registerPlugin(TEST_ADDRESSES.ERC721_TOKEN as Address, plugin2);

      const tokens = compliance.getRegisteredTokens();
      expect(tokens.length).toBe(2);
    });

    it('lists named plugins', () => {
      const plugin1 = new BlacklistPlugin();
      const plugin2 = new BlacklistPlugin();

      compliance.registerNamedPlugin('plugin1', plugin1);
      compliance.registerNamedPlugin('plugin2', plugin2);

      const names = compliance.getNamedPlugins();
      expect(names.length).toBe(2);
      expect(names).toContain('plugin1');
      expect(names).toContain('plugin2');
    });
  });

  describe('Error Handling', () => {
    it('returns UNKNOWN when standard detection fails', async () => {
      mockClient.readContract.mockRejectedValue(new Error('RPC error'));

      const standard = await compliance.detectStandard(
        TEST_ADDRESSES.ERC20_TOKEN as Address
      );
      expect(standard).toBe(TokenStandard.UNKNOWN);
    });

    it('returns compliant when checks fail gracefully', async () => {
      mockClient.readContract.mockRejectedValue(new Error('RPC error'));

      const result = await compliance.checkCompliance(
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );
      // When we can't detect the standard, we get UNKNOWN, and assume compliant
      expect(result.compliant).toBe(true);
      expect(result.tokenStandard).toBe(TokenStandard.UNKNOWN);
    });
  });

  describe('Configuration', () => {
    it('initializes with testnet config', () => {
      const testnetCompliance = new ComplianceModule({
        publicClient: mockClient,
        network: 'testnet',
      });

      expect(testnetCompliance).toBeDefined();
    });

    it('initializes with mainnet config', () => {
      const mainnetCompliance = new ComplianceModule({
        publicClient: mockClient,
        network: 'mainnet',
      });

      expect(mainnetCompliance).toBeDefined();
    });
  });
});
