import { describe, it, expect, beforeEach } from 'vitest';
import type { Address } from 'viem';
import { PluginAdapter } from '../plugins/adapter.js';
import { BlacklistPlugin, WhitelistPlugin } from '../plugins/examples/index.js';
import {
  createMockPublicClient,
  TEST_ADDRESSES,
  setupBlacklistPluginMock,
  setupWhitelistPluginMock,
} from './mocks.js';

describe('Plugin Adapter', () => {
  let adapter: PluginAdapter;
  let mockClient: any;

  beforeEach(() => {
    adapter = new PluginAdapter();
    mockClient = createMockPublicClient();
  });

  describe('Plugin Registration', () => {
    it('registers plugin for token address', () => {
      const plugin = new BlacklistPlugin();
      adapter.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin);

      expect(adapter.hasPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address)).toBe(true);
    });

    it('registers named plugin', () => {
      const plugin = new WhitelistPlugin();
      adapter.registerNamedPlugin('whitelist-checker', plugin);

      expect(adapter.getNamedPlugin('whitelist-checker')).toBeDefined();
    });

    it('unregisters plugin for token', () => {
      const plugin = new BlacklistPlugin();
      adapter.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin);
      adapter.unregisterPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address);

      expect(adapter.hasPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address)).toBe(false);
    });

    it('unregisters named plugin', () => {
      const plugin = new WhitelistPlugin();
      adapter.registerNamedPlugin('my-plugin', plugin);
      adapter.unregisterNamedPlugin('my-plugin');

      expect(adapter.getNamedPlugin('my-plugin')).toBeUndefined();
    });

    it('returns list of registered tokens', () => {
      const plugin1 = new BlacklistPlugin();
      const plugin2 = new WhitelistPlugin();

      adapter.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin1);
      adapter.registerPlugin(TEST_ADDRESSES.ERC721_TOKEN as Address, plugin2);

      const tokens = adapter.getRegisteredTokens();
      expect(tokens.length).toBe(2);
      expect(tokens).toContain(TEST_ADDRESSES.ERC20_TOKEN as unknown as Address);
    });

    it('returns list of named plugins', () => {
      adapter.registerNamedPlugin('blacklist', new BlacklistPlugin());
      adapter.registerNamedPlugin('whitelist', new WhitelistPlugin());

      const names = adapter.getNamedPluginList();
      expect(names.length).toBe(2);
      expect(names).toContain('blacklist');
      expect(names).toContain('whitelist');
    });
  });

  describe('Blacklist Plugin', () => {
    it('allows non-blacklisted addresses', async () => {
      setupBlacklistPluginMock(mockClient, false);
      const plugin = new BlacklistPlugin();

      adapter.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin);

      const result = await adapter.checkWithPlugin(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_WHITELISTED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(true);
    });

    it('blocks blacklisted sender', async () => {
      setupBlacklistPluginMock(mockClient, true);
      const plugin = new BlacklistPlugin();

      adapter.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin);

      const result = await adapter.checkWithPlugin(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_BLACKLISTED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(false);
      expect(result.reason).toContain('blacklisted');
    });
  });

  describe('Whitelist Plugin', () => {
    it('allows whitelisted addresses', async () => {
      setupWhitelistPluginMock(mockClient, true);
      const plugin = new WhitelistPlugin();

      adapter.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin);

      const result = await adapter.checkWithPlugin(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_WHITELISTED as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(true);
    });

    it('blocks non-whitelisted sender', async () => {
      setupWhitelistPluginMock(mockClient, false);
      const plugin = new WhitelistPlugin();

      adapter.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, plugin);

      const result = await adapter.checkWithPlugin(
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_WHITELISTED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });
  });

  describe('Named Plugins', () => {
    it('checks with named plugin', async () => {
      setupBlacklistPluginMock(mockClient, false);
      const plugin = new BlacklistPlugin();

      adapter.registerNamedPlugin('blacklist-checker', plugin);

      const result = await adapter.checkWithNamedPlugin(
        'blacklist-checker',
        mockClient,
        TEST_ADDRESSES.ERC20_TOKEN as Address,
        TEST_ADDRESSES.USER_VERIFIED as Address,
        TEST_ADDRESSES.USER_WHITELISTED as Address,
        BigInt('100')
      );

      expect(result.compliant).toBe(true);
    });

    it('throws error when named plugin not found', async () => {
      await expect(
        adapter.checkWithNamedPlugin(
          'nonexistent',
          mockClient,
          TEST_ADDRESSES.ERC20_TOKEN as Address,
          TEST_ADDRESSES.USER_VERIFIED as Address,
          TEST_ADDRESSES.USER_WHITELISTED as Address,
          BigInt('100')
        )
      ).rejects.toThrow();
    });
  });

  describe('Plugin Management', () => {
    it('clears all plugins', () => {
      adapter.registerPlugin(TEST_ADDRESSES.ERC20_TOKEN as Address, new BlacklistPlugin());
      adapter.registerNamedPlugin('my-plugin', new WhitelistPlugin());

      adapter.clearAll();

      expect(adapter.getRegisteredTokens().length).toBe(0);
      expect(adapter.getNamedPluginList().length).toBe(0);
    });
  });
});
