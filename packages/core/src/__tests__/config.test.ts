import { describe, it, expect } from 'vitest';
import {
  mergeConfig,
  validateConfig,
  detectNetwork,
  getBridgeContracts,
  DEFAULT_CONFIG,
  MAINNET_CONFIG,
  TESTNET_DEFAULTS,
  MAINNET_DEFAULTS,
  TESTNET_BRIDGE_CONTRACTS,
  MAINNET_BRIDGE_CONTRACTS,
} from '../config.js';

describe('Configuration', () => {
  describe('DEFAULT_CONFIG', () => {
    it('has testnet defaults', () => {
      expect(DEFAULT_CONFIG.network).toBe('testnet');
      expect(DEFAULT_CONFIG.l1ChainId).toBe(11155111);
      expect(DEFAULT_CONFIG.l2ChainId).toBe(5003);
    });
  });

  describe('MAINNET_CONFIG', () => {
    it('has mainnet defaults', () => {
      expect(MAINNET_CONFIG.network).toBe('mainnet');
      expect(MAINNET_CONFIG.l1ChainId).toBe(1);
      expect(MAINNET_CONFIG.l2ChainId).toBe(5000);
    });
  });

  describe('mergeConfig', () => {
    it('merges user config with defaults', () => {
      const result = mergeConfig({
        l1RpcUrl: 'https://custom-l1.rpc',
        l2RpcUrl: 'https://custom-l2.rpc',
      });

      expect(result.l1RpcUrl).toBe('https://custom-l1.rpc');
      expect(result.l2RpcUrl).toBe('https://custom-l2.rpc');
      expect(result.network).toBe('testnet');
    });

    it('respects user network preference', () => {
      const result = mergeConfig({
        l1RpcUrl: 'https://l1.rpc',
        l2RpcUrl: 'https://l2.rpc',
        network: 'mainnet',
      });

      expect(result.network).toBe('mainnet');
      expect(result.l1ChainId).toBe(1);
      expect(result.l2ChainId).toBe(5000);
    });

    it('preserves custom chain IDs', () => {
      const result = mergeConfig({
        l1RpcUrl: 'https://l1.rpc',
        l2RpcUrl: 'https://l2.rpc',
        l1ChainId: 999,
        l2ChainId: 888,
      });

      expect(result.l1ChainId).toBe(999);
      expect(result.l2ChainId).toBe(888);
    });

    it('includes indexer defaults', () => {
      const result = mergeConfig({
        l1RpcUrl: 'https://l1.rpc',
        l2RpcUrl: 'https://l2.rpc',
      });

      expect(result.indexerPollInterval).toBe(TESTNET_DEFAULTS.indexerPollInterval);
      expect(result.indexerDbPath).toBe(TESTNET_DEFAULTS.indexerDbPath);
    });
  });

  describe('validateConfig', () => {
    it('returns no errors for valid config', () => {
      const errors = validateConfig({
        l1RpcUrl: 'https://l1.rpc',
        l2RpcUrl: 'https://l2.rpc',
      } as any);

      expect(errors).toEqual([]);
    });

    it('returns error for missing L1 RPC URL', () => {
      const errors = validateConfig({
        l1RpcUrl: '',
        l2RpcUrl: 'https://l2.rpc',
      } as any);

      expect(errors).toContain('l1RpcUrl is required');
    });

    it('returns error for missing L2 RPC URL', () => {
      const errors = validateConfig({
        l1RpcUrl: 'https://l1.rpc',
        l2RpcUrl: '',
      } as any);

      expect(errors).toContain('l2RpcUrl is required');
    });

    it('returns error for invalid L1 RPC URL format', () => {
      const errors = validateConfig({
        l1RpcUrl: 'not-a-url',
        l2RpcUrl: 'https://l2.rpc',
      } as any);

      expect(errors).toContain('l1RpcUrl must be a valid URL');
    });

    it('returns error for invalid L2 RPC URL format', () => {
      const errors = validateConfig({
        l1RpcUrl: 'https://l1.rpc',
        l2RpcUrl: 'not-a-url',
      } as any);

      expect(errors).toContain('l2RpcUrl must be a valid URL');
    });

    it('returns error for invalid gas buffer percentage', () => {
      const errors = validateConfig({
        l1RpcUrl: 'https://l1.rpc',
        l2RpcUrl: 'https://l2.rpc',
        gasBufferPercentage: 150,
      } as any);

      expect(errors).toContain('gasBufferPercentage must be between 0 and 100');
    });

    it('returns error for invalid poll interval', () => {
      const errors = validateConfig({
        l1RpcUrl: 'https://l1.rpc',
        l2RpcUrl: 'https://l2.rpc',
        indexerPollInterval: 500,
      } as any);

      expect(errors).toContain('indexerPollInterval must be at least 1000ms');
    });
  });

  describe('detectNetwork', () => {
    it('detects testnet from L2 chain ID', () => {
      const network = detectNetwork(5003);
      expect(network).toBe('testnet');
    });

    it('detects mainnet from L2 chain ID', () => {
      const network = detectNetwork(5000);
      expect(network).toBe('mainnet');
    });

    it('detects testnet from L1 chain ID', () => {
      const network = detectNetwork(undefined, 11155111);
      expect(network).toBe('testnet');
    });

    it('detects mainnet from L1 chain ID', () => {
      const network = detectNetwork(undefined, 1);
      expect(network).toBe('mainnet');
    });

    it('defaults to testnet when unknown', () => {
      const network = detectNetwork(undefined, 999);
      expect(network).toBe('testnet');
    });
  });

  describe('getBridgeContracts', () => {
    it('returns testnet contracts for testnet', () => {
      const contracts = getBridgeContracts('testnet');

      expect(contracts.l1StandardBridge).toBe(TESTNET_BRIDGE_CONTRACTS.l1StandardBridge);
      expect(contracts.l2StandardBridge).toBe(TESTNET_BRIDGE_CONTRACTS.l2StandardBridge);
    });

    it('returns mainnet contracts for mainnet', () => {
      const contracts = getBridgeContracts('mainnet');

      expect(contracts.l1StandardBridge).toBe(MAINNET_BRIDGE_CONTRACTS.l1StandardBridge);
      expect(contracts.l2StandardBridge).toBe(MAINNET_BRIDGE_CONTRACTS.l2StandardBridge);
    });
  });

  describe('Bridge Contract Addresses', () => {
    it('testnet contracts are valid addresses', () => {
      expect(TESTNET_BRIDGE_CONTRACTS.l1StandardBridge).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(TESTNET_BRIDGE_CONTRACTS.l2StandardBridge).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('mainnet contracts are valid addresses', () => {
      expect(MAINNET_BRIDGE_CONTRACTS.l1StandardBridge).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(MAINNET_BRIDGE_CONTRACTS.l2StandardBridge).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });
});
