/**
 * Gas Module - Estimates gas costs for Mantle L2 transactions
 *
 * Mantle transactions have two fee components:
 * 1. L2 Execution Fee: Cost to execute on Mantle L2 (cheap)
 * 2. L1 Data Fee: Cost to post data to Ethereum L1 (expensive)
 *
 * This module calculates both and provides a total cost estimate.
 */

import type { Address, PublicClient } from 'viem';
import { formatEther, serializeTransaction } from 'viem';
import type { GasConfig, GasCostEstimate } from './types.js';
import { GAS_PRICE_ORACLE_ABI } from './abi/GasOracle.js';
import { getGasOracleAddress } from './oracles.js';

export class GasModule {
  // Viem public clients
  private l1PublicClient: PublicClient;
  private l2PublicClient: PublicClient;

  // Network configuration
  private network: 'mainnet' | 'testnet';

  // Gas oracle contract
  private gasOracleAddress: Address;

  // Configuration
  private bufferPercentage: number;

  /**
   * Initialize the Gas Module
   *
   * @param config - Gas module configuration
   * @example
   * ```typescript
   * const gasModule = new GasModule({
   *   l1PublicClient: createPublicClient({ chain: sepolia, ... }),
   *   l2PublicClient: createPublicClient({ chain: mantleSepoliaTestnet, ... }),
   *   network: 'testnet',
   * });
   * ```
   */
  constructor(config: GasConfig) {
    this.l1PublicClient = config.l1PublicClient;
    this.l2PublicClient = config.l2PublicClient;
    this.network = config.network;
    this.bufferPercentage = config.bufferPercentage ?? 10; // Default 10% buffer

    // Get gas oracle address (custom or default)
    this.gasOracleAddress = config.gasOracleAddress ?? getGasOracleAddress(config.network);
  }

  /**
   * Get the gas oracle address being used
   */
  getGasOracleAddress(): Address {
    return this.gasOracleAddress;
  }

  /**
   * Get the current network configuration
   */
  getNetwork(): 'mainnet' | 'testnet' {
    return this.network;
  }

  /**
   * Get the safety buffer percentage
   */
  getBufferPercentage(): number {
    return this.bufferPercentage;
  }

  // ============================================
  // CORE GAS ESTIMATION METHODS
  // ============================================

  /**
   * Estimate L2 execution gas for a transaction
   *
   * This calculates the cost to execute a transaction on Mantle L2.
   * This is typically much cheaper than the L1 data fee.
   *
   * @param transaction - Transaction to estimate
   * @returns Object with L2 gas estimate, gas price, and fee
   * @private
   */
  private async estimateL2Gas(transaction: {
    from: Address;
    to?: Address;
    data?: `0x${string}`;
    value?: bigint;
    gasLimit?: bigint;
  }): Promise<{
    gasEstimate: bigint;
    gasPrice: bigint;
    fee: bigint;
  }> {
    // Get current L2 gas price
    const gasPrice = await this.l2PublicClient.getGasPrice();

    // Estimate gas for the transaction
    let gasEstimate: bigint;

    if (transaction.gasLimit) {
      // Use provided gas limit
      gasEstimate = transaction.gasLimit;
    } else {
      // Estimate gas
      gasEstimate = await this.l2PublicClient.estimateGas({
        account: transaction.from,
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
      });
    }

    // Calculate L2 execution fee
    const fee = gasEstimate * gasPrice;

    return {
      gasEstimate,
      gasPrice,
      fee,
    };
  }

  /**
   * Estimate L1 data fee for a transaction
   *
   * This calculates the cost to post transaction data to Ethereum L1.
   * This is typically the EXPENSIVE part (often 95%+ of total cost).
   *
   * @param transaction - Transaction to estimate
   * @returns Object with L1 fee and optional breakdown
   * @private
   */
  private async estimateL1DataFee(transaction: {
    from: Address;
    to?: Address;
    data?: `0x${string}`;
    value?: bigint;
    nonce?: number;
    gasLimit?: bigint;
  }): Promise<{
    fee: bigint;
    gasUsed?: bigint;
    baseFee?: bigint;
    overhead?: bigint;
    scalar?: bigint;
  }> {
    // Serialize the transaction to RLP-encoded bytes
    // This is what gets posted to L1
    const serializedTx = serializeTransaction({
      to: transaction.to,
      value: transaction.value ?? 0n,
      data: transaction.data ?? '0x',
      nonce: transaction.nonce ?? 0,
      gasLimit: transaction.gasLimit ?? 21000n,
      // Note: We're serializing an unsigned transaction
      // The gas oracle needs the RLP-encoded data to calculate the fee
    });

    // Call the gas oracle to get L1 fee
    const l1Fee = await this.l2PublicClient.readContract({
      address: this.gasOracleAddress,
      abi: GAS_PRICE_ORACLE_ABI,
      functionName: 'getL1Fee',
      args: [serializedTx],
    }) as bigint;

    // Optionally get detailed breakdown
    let gasUsed: bigint | undefined;
    let baseFee: bigint | undefined;
    let overhead: bigint | undefined;
    let scalar: bigint | undefined;

    try {
      // These calls may fail on some networks or versions
      gasUsed = await this.l2PublicClient.readContract({
        address: this.gasOracleAddress,
        abi: GAS_PRICE_ORACLE_ABI,
        functionName: 'getL1GasUsed',
        args: [serializedTx],
      }) as bigint;

      baseFee = await this.l2PublicClient.readContract({
        address: this.gasOracleAddress,
        abi: GAS_PRICE_ORACLE_ABI,
        functionName: 'l1BaseFee',
      }) as bigint;

      overhead = await this.l2PublicClient.readContract({
        address: this.gasOracleAddress,
        abi: GAS_PRICE_ORACLE_ABI,
        functionName: 'overhead',
      }) as bigint;

      scalar = await this.l2PublicClient.readContract({
        address: this.gasOracleAddress,
        abi: GAS_PRICE_ORACLE_ABI,
        functionName: 'scalar',
      }) as bigint;
    } catch (error) {
      // Breakdown not available, that's okay
      // We still have the total L1 fee which is most important
    }

    return {
      fee: l1Fee,
      gasUsed,
      baseFee,
      overhead,
      scalar,
    };
  }

  /**
   * Estimate total transaction cost (L2 + L1)
   *
   * This is the main public method that calculates the complete cost
   * of a transaction including both L2 execution and L1 data fees.
   *
   * @param transaction - Transaction to estimate
   * @param includeBreakdown - Whether to include detailed breakdown (default: true)
   * @returns Complete gas cost estimate
   * @public
   */
  async estimateTotalCost(
    transaction: {
      from: Address;
      to?: Address;
      data?: `0x${string}`;
      value?: bigint;
      gasLimit?: bigint;
      nonce?: number;
    },
    includeBreakdown = true
  ): Promise<GasCostEstimate> {
    // Estimate L2 execution cost
    const l2Estimate = await this.estimateL2Gas(transaction);

    // Estimate L1 data fee
    const l1Estimate = await this.estimateL1DataFee(transaction);

    // Calculate total fee
    const totalFee = l2Estimate.fee + l1Estimate.fee;

    // Apply safety buffer
    const bufferedTotal = totalFee + (totalFee * BigInt(this.bufferPercentage)) / 100n;

    // Format for display
    const formattedInETH = formatEther(bufferedTotal);
    const formattedInMNT = formatEther(bufferedTotal); // MNT has same decimals as ETH

    // Build result
    const result: GasCostEstimate = {
      l2ExecutionFee: l2Estimate.fee,
      l1DataFee: l1Estimate.fee,
      totalFee: bufferedTotal,
      formattedInETH,
      formattedInMNT,
      breakdown: {
        l2GasEstimate: l2Estimate.gasEstimate,
        l2GasPrice: l2Estimate.gasPrice,
        ...(includeBreakdown && {
          l1GasUsed: l1Estimate.gasUsed,
          l1BaseFee: l1Estimate.baseFee,
          overhead: l1Estimate.overhead,
          scalar: l1Estimate.scalar,
        }),
      },
    };

    return result;
  }
}
