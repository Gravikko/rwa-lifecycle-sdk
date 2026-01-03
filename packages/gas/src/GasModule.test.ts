import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GasModule, GasEstimationError, RPCError, GasOracleError } from './GasModule.js';
import type { PublicClient } from 'viem';
import { parseEther } from 'viem';

// Test addresses (valid 40-character hex)
const TEST_ADDRESS_1 = '0x1234567890123456789012345678901234567890' as const;
const TEST_ADDRESS_2 = '0x0987654321098765432109876543210987654321' as const;
const TEST_TOKEN_L1 = '0x1111111111111111111111111111111111111111' as const;
const TEST_TOKEN_L2 = '0x2222222222222222222222222222222222222222' as const;
const TEST_NFT_L1 = '0x3333333333333333333333333333333333333333' as const;
const TEST_NFT_L2 = '0x4444444444444444444444444444444444444444' as const;

// Mock clients
const createMockL1Client = (): PublicClient => ({
  getGasPrice: vi.fn(),
  estimateGas: vi.fn(),
  readContract: vi.fn(),
  getBalance: vi.fn(),
} as any);

const createMockL2Client = (): PublicClient => ({
  getGasPrice: vi.fn(),
  estimateGas: vi.fn(),
  readContract: vi.fn(),
  getBalance: vi.fn(),
} as any);

describe('GasModule', () => {
  let gasModule: GasModule;
  let mockL1Client: PublicClient;
  let mockL2Client: PublicClient;

  beforeEach(() => {
    mockL1Client = createMockL1Client();
    mockL2Client = createMockL2Client();

    gasModule = new GasModule({
      l1PublicClient: mockL1Client,
      l2PublicClient: mockL2Client,
      network: 'testnet',
      bufferPercentage: 10,
    });
  });

  describe('Constructor', () => {
    it('should initialize with correct config', () => {
      expect(gasModule).toBeDefined();
      expect(gasModule.getConfig()).toMatchObject({
        network: 'testnet',
        bufferPercentage: 10,
      });
    });

    it('should use default buffer percentage if not provided', () => {
      const module = new GasModule({
        l1PublicClient: mockL1Client,
        l2PublicClient: mockL2Client,
        network: 'mainnet',
      });
      expect(module.getConfig().bufferPercentage).toBe(10);
    });

    it('should use correct gas oracle address for testnet', () => {
      const config = gasModule.getConfig();
      expect(config.gasOracleAddress).toBe('0x420000000000000000000000000000000000000F');
    });

    it('should use correct gas oracle address for mainnet', () => {
      const mainnetModule = new GasModule({
        l1PublicClient: mockL1Client,
        l2PublicClient: mockL2Client,
        network: 'mainnet',
      });
      const config = mainnetModule.getConfig();
      expect(config.gasOracleAddress).toBe('0x420000000000000000000000000000000000000F');
    });
  });

  describe('estimateTotalCost', () => {
    beforeEach(() => {
      vi.mocked(mockL2Client.getGasPrice).mockResolvedValue(BigInt(1000000000)); // 1 gwei
      vi.mocked(mockL2Client.estimateGas).mockResolvedValue(BigInt(21000));
      vi.mocked(mockL2Client.readContract).mockResolvedValue(BigInt(50000000000000)); // L1 fee
    });

    it('should estimate total cost with breakdown', async () => {
      const estimate = await gasModule.estimateTotalCost({
        from: TEST_ADDRESS_1,
        to: TEST_ADDRESS_2,
        value: parseEther('1'),
      });

      expect(estimate).toHaveProperty('l2ExecutionFee');
      expect(estimate).toHaveProperty('l1DataFee');
      expect(estimate).toHaveProperty('totalFee');
      expect(estimate).toHaveProperty('formattedInETH');
      expect(estimate).toHaveProperty('formattedInMNT');
      expect(estimate).toHaveProperty('breakdown');

      expect(estimate.l2ExecutionFee).toBe(BigInt(21000000000000)); // 21000 * 1 gwei
      expect(estimate.l1DataFee).toBe(BigInt(50000000000000));

      // Total should include 10% buffer
      const unbufferedTotal = BigInt(21000000000000) + BigInt(50000000000000);
      const expectedTotal = unbufferedTotal + (unbufferedTotal * BigInt(10)) / BigInt(100);
      expect(estimate.totalFee).toBe(expectedTotal);
    });

    it('should format costs correctly in ETH', async () => {
      const estimate = await gasModule.estimateTotalCost({
        from: TEST_ADDRESS_1,
        to: TEST_ADDRESS_2,
        value: parseEther('1'),
      });

      expect(estimate.formattedInETH).toMatch(/^\d+\.\d+$/);
      expect(estimate.formattedInETH).toContain('0.');
    });

    it('should format costs correctly in MNT', async () => {
      const estimate = await gasModule.estimateTotalCost({
        from: TEST_ADDRESS_1,
        to: TEST_ADDRESS_2,
        value: parseEther('1'),
      });

      expect(estimate.formattedInMNT).toMatch(/^\d+\.\d+$/);
      expect(estimate.formattedInMNT).toContain('0.');
    });

    it('should handle RPC errors gracefully', async () => {
      vi.mocked(mockL2Client.estimateGas).mockRejectedValue(new Error('RPC failed'));

      await expect(
        gasModule.estimateTotalCost({
          from: TEST_ADDRESS_1,
          to: TEST_ADDRESS_2,
          value: parseEther('1'),
        })
      ).rejects.toThrow(RPCError);
    });

    it('should handle gas oracle errors gracefully', async () => {
      vi.mocked(mockL2Client.readContract).mockRejectedValue(new Error('Oracle failed'));

      await expect(
        gasModule.estimateTotalCost({
          from: TEST_ADDRESS_1,
          to: TEST_ADDRESS_2,
          value: parseEther('1'),
        })
      ).rejects.toThrow(GasOracleError);
    });
  });

  describe('estimateDepositERC20Cost', () => {
    beforeEach(() => {
      vi.mocked(mockL1Client.getGasPrice).mockResolvedValue(BigInt(2000000000)); // 2 gwei
      vi.mocked(mockL1Client.estimateGas).mockResolvedValue(BigInt(150000));
    });

    it('should estimate ERC20 deposit cost', async () => {
      const estimate = await gasModule.estimateDepositERC20Cost({
        from: TEST_ADDRESS_1,
        l1TokenAddress: TEST_TOKEN_L1,
        l2TokenAddress: TEST_TOKEN_L2,
        amount: parseEther('100'),
      });

      expect(estimate).toHaveProperty('totalFee');
      expect(estimate.l2ExecutionFee).toBe(BigInt(0)); // Deposit happens on L1
      expect(estimate.totalFee).toBeGreaterThan(BigInt(0));
    });

    it('should use provided minGasLimit', async () => {
      await gasModule.estimateDepositERC20Cost({
        from: TEST_ADDRESS_1,
        l1TokenAddress: TEST_TOKEN_L1,
        l2TokenAddress: TEST_TOKEN_L2,
        amount: parseEther('100'),
        minGasLimit: 200000,
      });

      expect(mockL1Client.estimateGas).toHaveBeenCalled();
    });

    it('should handle large amounts correctly', async () => {
      const estimate = await gasModule.estimateDepositERC20Cost({
        from: TEST_ADDRESS_1,
        l1TokenAddress: TEST_TOKEN_L1,
        l2TokenAddress: TEST_TOKEN_L2,
        amount: parseEther('1000000'), // 1 million tokens
      });

      expect(mockL1Client.estimateGas).toHaveBeenCalled();
      expect(estimate.totalFee).toBeGreaterThan(BigInt(0));
    });
  });

  describe('estimateDepositNFTCost', () => {
    beforeEach(() => {
      vi.mocked(mockL1Client.getGasPrice).mockResolvedValue(BigInt(2000000000));
      vi.mocked(mockL1Client.estimateGas).mockResolvedValue(BigInt(180000));
    });

    it('should estimate NFT deposit cost', async () => {
      const estimate = await gasModule.estimateDepositNFTCost({
        from: TEST_ADDRESS_1,
        l1TokenAddress: TEST_NFT_L1,
        l2TokenAddress: TEST_NFT_L2,
        tokenId: BigInt(42),
      });

      expect(estimate).toHaveProperty('totalFee');
      expect(estimate.totalFee).toBeGreaterThan(BigInt(0));
    });
  });

  describe('estimateWithdrawERC20InitiateCost', () => {
    beforeEach(() => {
      vi.mocked(mockL2Client.getGasPrice).mockResolvedValue(BigInt(1000000000));
      vi.mocked(mockL2Client.estimateGas).mockResolvedValue(BigInt(100000));
      vi.mocked(mockL2Client.readContract).mockResolvedValue(BigInt(30000000000000));
    });

    it('should estimate ERC20 withdrawal initiate cost', async () => {
      const estimate = await gasModule.estimateWithdrawERC20InitiateCost({
        from: TEST_ADDRESS_1,
        l1TokenAddress: TEST_TOKEN_L1,
        l2TokenAddress: TEST_TOKEN_L2,
        amount: parseEther('50'),
      });

      expect(estimate).toHaveProperty('totalFee');
      expect(estimate).toHaveProperty('l2ExecutionFee');
      expect(estimate).toHaveProperty('l1DataFee');
      expect(estimate.totalFee).toBeGreaterThan(BigInt(0));
    });
  });

  describe('estimateWithdrawNFTInitiateCost', () => {
    beforeEach(() => {
      vi.mocked(mockL2Client.getGasPrice).mockResolvedValue(BigInt(1000000000));
      vi.mocked(mockL2Client.estimateGas).mockResolvedValue(BigInt(120000));
      vi.mocked(mockL2Client.readContract).mockResolvedValue(BigInt(35000000000000));
    });

    it('should estimate NFT withdrawal initiate cost', async () => {
      const estimate = await gasModule.estimateWithdrawNFTInitiateCost({
        from: TEST_ADDRESS_1,
        l1TokenAddress: TEST_NFT_L1,
        l2TokenAddress: TEST_NFT_L2,
        tokenId: BigInt(99),
      });

      expect(estimate).toHaveProperty('totalFee');
      expect(estimate.totalFee).toBeGreaterThan(BigInt(0));
    });
  });

  describe('estimateWithdrawProveCost', () => {
    beforeEach(() => {
      vi.mocked(mockL1Client.getGasPrice).mockResolvedValue(BigInt(3000000000));
      vi.mocked(mockL1Client.estimateGas).mockResolvedValue(BigInt(250000));
    });

    it('should estimate withdrawal prove cost', async () => {
      const estimate = await gasModule.estimateWithdrawProveCost({
        from: TEST_ADDRESS_1,
      });

      expect(estimate).toHaveProperty('totalFee');
      expect(estimate.totalFee).toBeGreaterThan(BigInt(0));
    });
  });

  describe('estimateWithdrawFinalizeCost', () => {
    beforeEach(() => {
      vi.mocked(mockL1Client.getGasPrice).mockResolvedValue(BigInt(3000000000));
      vi.mocked(mockL1Client.estimateGas).mockResolvedValue(BigInt(200000));
    });

    it('should estimate withdrawal finalize cost', async () => {
      const estimate = await gasModule.estimateWithdrawFinalizeCost({
        from: TEST_ADDRESS_1,
      });

      expect(estimate).toHaveProperty('totalFee');
      expect(estimate.totalFee).toBeGreaterThan(BigInt(0));
    });
  });

  describe('estimateCompleteWithdrawalCost', () => {
    beforeEach(() => {
      // L2 for initiate
      vi.mocked(mockL2Client.getGasPrice).mockResolvedValue(BigInt(1000000000));
      vi.mocked(mockL2Client.estimateGas).mockResolvedValue(BigInt(100000));
      vi.mocked(mockL2Client.readContract).mockResolvedValue(BigInt(30000000000000));

      // L1 for prove and finalize
      vi.mocked(mockL1Client.getGasPrice).mockResolvedValue(BigInt(3000000000));
      vi.mocked(mockL1Client.estimateGas).mockResolvedValue(BigInt(250000));
    });

    it('should estimate complete withdrawal cost for all 3 phases', async () => {
      const estimate = await gasModule.estimateCompleteWithdrawalCost({
        from: TEST_ADDRESS_1,
        tokenType: 'erc20',
        l1TokenAddress: TEST_TOKEN_L1,
        l2TokenAddress: TEST_TOKEN_L2,
        amount: parseEther('25'),
      });

      expect(estimate).toHaveProperty('initiate');
      expect(estimate).toHaveProperty('prove');
      expect(estimate).toHaveProperty('finalize');
      expect(estimate).toHaveProperty('total');
      expect(estimate.total).toHaveProperty('totalFee');
      expect(estimate.total).toHaveProperty('formattedInETH');
      expect(estimate.total).toHaveProperty('formattedInMNT');

      expect(estimate.total.totalFee).toBeGreaterThan(BigInt(0));
      expect(estimate.total.totalFee).toBeGreaterThan(estimate.initiate.totalFee);
    });

    it('should sum all phases correctly', async () => {
      const estimate = await gasModule.estimateCompleteWithdrawalCost({
        from: TEST_ADDRESS_1,
        tokenType: 'erc20',
        l1TokenAddress: TEST_TOKEN_L1,
        l2TokenAddress: TEST_TOKEN_L2,
        amount: parseEther('25'),
      });

      const manualTotal =
        estimate.initiate.totalFee +
        estimate.prove.totalFee +
        estimate.finalize.totalFee;

      expect(estimate.total.totalFee).toBe(manualTotal);
    });
  });

  describe('formatCostBreakdown', () => {
    it('should format cost breakdown as human-readable string', () => {
      const estimate = {
        l2ExecutionFee: BigInt(21000000000000),
        l1DataFee: BigInt(50000000000000),
        totalFee: BigInt(78100000000000),
        formattedInETH: '0.0781',
        formattedInMNT: '0.0781',
        breakdown: {
          l2GasEstimate: BigInt(21000),
          l2GasPrice: BigInt(1000000000),
        },
      };

      const formatted = gasModule.formatCostBreakdown(estimate);

      expect(formatted).toContain('L2 Execution Fee');
      expect(formatted).toContain('L1 Data Fee');
      expect(formatted).toContain('Total:');
      expect(formatted).toContain('0.0781');
    });
  });

  describe('checkSufficientBalance', () => {
    it('should return true when user has sufficient balance', async () => {
      vi.mocked(mockL1Client.getBalance).mockResolvedValue(parseEther('1'));

      const estimate = {
        totalFee: parseEther('0.5'),
      } as any;

      const result = await gasModule.checkSufficientBalance(
        TEST_ADDRESS_1,
        estimate,
        true
      );

      expect(result.hasSufficientBalance).toBe(true);
      expect(result.currentBalance).toBe(parseEther('1'));
      expect(result.required).toBe(parseEther('0.5'));
      expect(result.shortfall).toBe(BigInt(0));
    });

    it('should return false when user has insufficient balance', async () => {
      vi.mocked(mockL2Client.getBalance).mockResolvedValue(parseEther('0.1'));

      const estimate = {
        totalFee: parseEther('0.5'),
      } as any;

      const result = await gasModule.checkSufficientBalance(
        TEST_ADDRESS_1,
        estimate,
        false
      );

      expect(result.hasSufficientBalance).toBe(false);
      expect(result.currentBalance).toBe(parseEther('0.1'));
      expect(result.required).toBe(parseEther('0.5'));
      expect(result.shortfall).toBe(parseEther('0.4'));
    });
  });

  describe('Custom Errors', () => {
    it('should create GasEstimationError correctly', () => {
      const error = new GasEstimationError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GasEstimationError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('GasEstimationError');
    });

    it('should create RPCError correctly', () => {
      const error = new RPCError('RPC failed');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GasEstimationError);
      expect(error).toBeInstanceOf(RPCError);
      expect(error.message).toBe('RPC Error: RPC failed');
      expect(error.name).toBe('RPCError');
    });

    it('should create GasOracleError correctly', () => {
      const error = new GasOracleError('Oracle failed');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GasEstimationError);
      expect(error).toBeInstanceOf(GasOracleError);
      expect(error.message).toBe('Gas Oracle Error: Oracle failed');
      expect(error.name).toBe('GasOracleError');
    });
  });
});
