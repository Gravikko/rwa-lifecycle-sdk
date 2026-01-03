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
import { formatEther, serializeTransaction, encodeFunctionData } from 'viem';
import type { GasConfig, GasCostEstimate, GasEstimateOptions } from './types.js';
import { GAS_PRICE_ORACLE_ABI } from './abi/GasOracle.js';
import { getGasOracleAddress } from './oracles.js';

// ============================================
// CUSTOM ERRORS
// ============================================

/**
 * Base error for Gas Module
 */
export class GasEstimationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GasEstimationError';
  }
}

/**
 * Error thrown when RPC requests fail
 */
export class RPCError extends GasEstimationError {
  constructor(message: string, public originalError?: unknown) {
    super(`RPC Error: ${message}`);
    this.name = 'RPCError';
  }
}

/**
 * Error thrown when gas oracle is unavailable or returns invalid data
 */
export class GasOracleError extends GasEstimationError {
  constructor(message: string, public originalError?: unknown) {
    super(`Gas Oracle Error: ${message}`);
    this.name = 'GasOracleError';
  }
}

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
   * Get the current configuration
   */
  getConfig(): GasConfig {
    return {
      l1PublicClient: this.l1PublicClient,
      l2PublicClient: this.l2PublicClient,
      network: this.network,
      gasOracleAddress: this.gasOracleAddress,
      bufferPercentage: this.bufferPercentage,
    };
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
    try {
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
    } catch (error) {
      throw new RPCError('Failed to estimate L2 gas', error);
    }
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
    // Use legacy transaction format with gasPrice
    const gasPrice = await this.l2PublicClient.getGasPrice();
    const serializedTx = serializeTransaction({
      to: transaction.to,
      value: transaction.value ?? 0n,
      data: transaction.data ?? '0x',
      nonce: transaction.nonce ?? 0,
      gasLimit: transaction.gasLimit ?? 21000n,
      gasPrice, // Required for legacy transaction serialization
      // Note: We're serializing an unsigned transaction
      // The gas oracle needs the RLP-encoded data to calculate the fee
    });

    try {
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
    } catch (error) {
      throw new GasOracleError('Failed to get L1 data fee from gas oracle', error);
    }
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

  // ============================================
  // BRIDGE-SPECIFIC GAS ESTIMATION
  // ============================================

  /**
   * Estimate gas cost for an ERC20 deposit from L1 to L2
   *
   * @param options - Deposit options
   * @returns Gas cost estimate for the deposit transaction
   */
  async estimateDepositERC20Cost(options: {
    from: Address;
    l1TokenAddress: Address;
    l2TokenAddress: Address;
    amount: bigint;
    minGasLimit?: number;
  }): Promise<GasCostEstimate> {
    // Minimal L1StandardBridge ABI for depositERC20
    const L1_STANDARD_BRIDGE_ABI = [
      {
        name: 'depositERC20',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: '_l1Token', type: 'address' },
          { name: '_l2Token', type: 'address' },
          { name: '_amount', type: 'uint256' },
          { name: '_minGasLimit', type: 'uint32' },
          { name: '_extraData', type: 'bytes' },
        ],
        outputs: [],
      },
    ] as const;

    // L1StandardBridge address (same on both networks for Mantle)
    const L1_STANDARD_BRIDGE = '0x21F308067241B2028503c07bd7cB3751FFab0Fb2' as Address; // Sepolia
    // For mainnet: 0x95fc37a27a2f68e3a647cdc081f0a89bb47c3012

    // Encode the deposit function call
    const data = encodeFunctionData({
      abi: L1_STANDARD_BRIDGE_ABI,
      functionName: 'depositERC20',
      args: [
        options.l1TokenAddress,
        options.l2TokenAddress,
        options.amount,
        options.minGasLimit ?? 200000,
        '0x' as `0x${string}`,
      ],
    });

    // This executes on L1 (Ethereum)
    // We estimate using L1 client but L1 doesn't have L1 data fee
    // So we just estimate the L1 execution cost
    const gasEstimate = await this.l1PublicClient.estimateGas({
      account: options.from,
      to: L1_STANDARD_BRIDGE,
      data,
    });

    const gasPrice = await this.l1PublicClient.getGasPrice();
    const totalFee = gasEstimate * gasPrice;
    const bufferedTotal = totalFee + (totalFee * BigInt(this.bufferPercentage)) / 100n;

    return {
      l2ExecutionFee: 0n, // Deposit is on L1, no L2 fee
      l1DataFee: totalFee, // All cost is L1 execution
      totalFee: bufferedTotal,
      formattedInETH: formatEther(bufferedTotal),
      formattedInMNT: formatEther(bufferedTotal),
      breakdown: {
        l2GasEstimate: gasEstimate,
        l2GasPrice: gasPrice,
      },
    };
  }

  /**
   * Estimate gas cost for an ERC721 deposit from L1 to L2
   *
   * @param options - Deposit options
   * @returns Gas cost estimate for the deposit transaction
   */
  async estimateDepositNFTCost(options: {
    from: Address;
    l1TokenAddress: Address;
    l2TokenAddress: Address;
    tokenId: bigint;
    minGasLimit?: number;
  }): Promise<GasCostEstimate> {
    // Minimal L1ERC721Bridge ABI
    const L1_ERC721_BRIDGE_ABI = [
      {
        name: 'bridgeERC721',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: '_localToken', type: 'address' },
          { name: '_remoteToken', type: 'address' },
          { name: '_tokenId', type: 'uint256' },
          { name: '_minGasLimit', type: 'uint32' },
          { name: '_extraData', type: 'bytes' },
        ],
        outputs: [],
      },
    ] as const;

    const L1_ERC721_BRIDGE = '0x94343BeF783Af58f46e23bEB859e4cb11B65C4eb' as Address; // Sepolia

    const data = encodeFunctionData({
      abi: L1_ERC721_BRIDGE_ABI,
      functionName: 'bridgeERC721',
      args: [
        options.l1TokenAddress,
        options.l2TokenAddress,
        options.tokenId,
        options.minGasLimit ?? 200000,
        '0x' as `0x${string}`,
      ],
    });

    const gasEstimate = await this.l1PublicClient.estimateGas({
      account: options.from,
      to: L1_ERC721_BRIDGE,
      data,
    });

    const gasPrice = await this.l1PublicClient.getGasPrice();
    const totalFee = gasEstimate * gasPrice;
    const bufferedTotal = totalFee + (totalFee * BigInt(this.bufferPercentage)) / 100n;

    return {
      l2ExecutionFee: 0n,
      l1DataFee: totalFee,
      totalFee: bufferedTotal,
      formattedInETH: formatEther(bufferedTotal),
      formattedInMNT: formatEther(bufferedTotal),
      breakdown: {
        l2GasEstimate: gasEstimate,
        l2GasPrice: gasPrice,
      },
    };
  }

  /**
   * Estimate gas cost for ERC20 withdrawal initiation from L2 to L1
   *
   * This is the first step of the 3-phase withdrawal process.
   * Executes on L2, so includes both L2 execution and L1 data fees.
   *
   * @param options - Withdrawal options
   * @returns Gas cost estimate for the withdrawal initiation
   */
  async estimateWithdrawERC20InitiateCost(options: {
    from: Address;
    l1TokenAddress: Address;
    l2TokenAddress: Address;
    amount: bigint;
    minGasLimit?: number;
  }): Promise<GasCostEstimate> {
    // Minimal L2StandardBridge ABI for withdraw
    const L2_STANDARD_BRIDGE_ABI = [
      {
        name: 'withdraw',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: '_l2Token', type: 'address' },
          { name: '_amount', type: 'uint256' },
          { name: '_minGasLimit', type: 'uint32' },
          { name: '_extraData', type: 'bytes' },
        ],
        outputs: [],
      },
    ] as const;

    const L2_STANDARD_BRIDGE = '0x4200000000000000000000000000000000000010' as Address;

    const data = encodeFunctionData({
      abi: L2_STANDARD_BRIDGE_ABI,
      functionName: 'withdraw',
      args: [
        options.l2TokenAddress,
        options.amount,
        options.minGasLimit ?? 200000,
        '0x' as `0x${string}`,
      ],
    });

    // This executes on L2, so we use the full estimateTotalCost
    return this.estimateTotalCost({
      from: options.from,
      to: L2_STANDARD_BRIDGE,
      data,
    });
  }

  /**
   * Estimate gas cost for ERC721 withdrawal initiation from L2 to L1
   *
   * This is the first step of the 3-phase withdrawal process.
   * Executes on L2, so includes both L2 execution and L1 data fees.
   *
   * @param options - Withdrawal options
   * @returns Gas cost estimate for the withdrawal initiation
   */
  async estimateWithdrawNFTInitiateCost(options: {
    from: Address;
    l1TokenAddress: Address;
    l2TokenAddress: Address;
    tokenId: bigint;
    minGasLimit?: number;
  }): Promise<GasCostEstimate> {
    // Minimal L2ERC721Bridge ABI
    const L2_ERC721_BRIDGE_ABI = [
      {
        name: 'bridgeERC721',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: '_localToken', type: 'address' },
          { name: '_remoteToken', type: 'address' },
          { name: '_tokenId', type: 'uint256' },
          { name: '_minGasLimit', type: 'uint32' },
          { name: '_extraData', type: 'bytes' },
        ],
        outputs: [],
      },
    ] as const;

    const L2_ERC721_BRIDGE = '0x4200000000000000000000000000000000000014' as Address;

    const data = encodeFunctionData({
      abi: L2_ERC721_BRIDGE_ABI,
      functionName: 'bridgeERC721',
      args: [
        options.l2TokenAddress,
        options.l1TokenAddress,
        options.tokenId,
        options.minGasLimit ?? 200000,
        '0x' as `0x${string}`,
      ],
    });

    return this.estimateTotalCost({
      from: options.from,
      to: L2_ERC721_BRIDGE,
      data,
    });
  }

  /**
   * Estimate gas cost for proving a withdrawal on L1
   *
   * This is the second step of the 3-phase withdrawal process.
   * Executes on L1 after the challenge period (7 days on mainnet).
   *
   * Note: This provides an estimate based on typical prove transactions.
   * Actual cost depends on the size of the withdrawal proof.
   *
   * @param options - Prove options
   * @returns Gas cost estimate for the prove transaction
   */
  async estimateWithdrawProveCost(options: {
    from: Address;
  }): Promise<GasCostEstimate> {
    // Proving is complex and requires withdrawal transaction data
    // We'll estimate based on typical prove transaction gas usage
    // Typical prove transaction uses ~250,000 gas

    const TYPICAL_PROVE_GAS = 250000n;
    const gasPrice = await this.l1PublicClient.getGasPrice();
    const totalFee = TYPICAL_PROVE_GAS * gasPrice;
    const bufferedTotal = totalFee + (totalFee * BigInt(this.bufferPercentage)) / 100n;

    return {
      l2ExecutionFee: 0n, // Prove is on L1, no L2 fee
      l1DataFee: totalFee, // All cost is L1 execution
      totalFee: bufferedTotal,
      formattedInETH: formatEther(bufferedTotal),
      formattedInMNT: formatEther(bufferedTotal),
      breakdown: {
        l2GasEstimate: TYPICAL_PROVE_GAS,
        l2GasPrice: gasPrice,
      },
    };
  }

  /**
   * Estimate gas cost for finalizing a withdrawal on L1
   *
   * This is the third and final step of the 3-phase withdrawal process.
   * Executes on L1 after the prove transaction is confirmed.
   *
   * Note: This provides an estimate based on typical finalize transactions.
   *
   * @param options - Finalize options
   * @returns Gas cost estimate for the finalize transaction
   */
  async estimateWithdrawFinalizeCost(options: {
    from: Address;
  }): Promise<GasCostEstimate> {
    // Finalizing is simpler than proving
    // Typical finalize transaction uses ~100,000 gas

    const TYPICAL_FINALIZE_GAS = 100000n;
    const gasPrice = await this.l1PublicClient.getGasPrice();
    const totalFee = TYPICAL_FINALIZE_GAS * gasPrice;
    const bufferedTotal = totalFee + (totalFee * BigInt(this.bufferPercentage)) / 100n;

    return {
      l2ExecutionFee: 0n, // Finalize is on L1, no L2 fee
      l1DataFee: totalFee, // All cost is L1 execution
      totalFee: bufferedTotal,
      formattedInETH: formatEther(bufferedTotal),
      formattedInMNT: formatEther(bufferedTotal),
      breakdown: {
        l2GasEstimate: TYPICAL_FINALIZE_GAS,
        l2GasPrice: gasPrice,
      },
    };
  }

  /**
   * Estimate total cost for ALL withdrawal steps (initiate + prove + finalize)
   *
   * This is a convenience method that estimates the complete cost
   * of withdrawing tokens from L2 to L1, including all 3 phases.
   *
   * @param options - Withdrawal options
   * @returns Combined gas cost estimate for all withdrawal steps
   */
  async estimateCompleteWithdrawalCost(options: {
    from: Address;
    tokenType: 'erc20' | 'erc721';
    l1TokenAddress: Address;
    l2TokenAddress: Address;
    amount?: bigint; // For ERC20
    tokenId?: bigint; // For ERC721
  }): Promise<{
    initiate: GasCostEstimate;
    prove: GasCostEstimate;
    finalize: GasCostEstimate;
    total: {
      totalFee: bigint;
      formattedInETH: string;
      formattedInMNT: string;
    };
  }> {
    // Estimate initiate cost
    let initiate: GasCostEstimate;
    if (options.tokenType === 'erc20') {
      if (!options.amount) throw new Error('Amount required for ERC20');
      initiate = await this.estimateWithdrawERC20InitiateCost({
        from: options.from,
        l1TokenAddress: options.l1TokenAddress,
        l2TokenAddress: options.l2TokenAddress,
        amount: options.amount,
      });
    } else {
      if (!options.tokenId) throw new Error('Token ID required for ERC721');
      initiate = await this.estimateWithdrawNFTInitiateCost({
        from: options.from,
        l1TokenAddress: options.l1TokenAddress,
        l2TokenAddress: options.l2TokenAddress,
        tokenId: options.tokenId,
      });
    }

    // Estimate prove cost
    const prove = await this.estimateWithdrawProveCost({ from: options.from });

    // Estimate finalize cost
    const finalize = await this.estimateWithdrawFinalizeCost({ from: options.from });

    // Calculate total
    const totalFee = initiate.totalFee + prove.totalFee + finalize.totalFee;

    return {
      initiate,
      prove,
      finalize,
      total: {
        totalFee,
        formattedInETH: formatEther(totalFee),
        formattedInMNT: formatEther(totalFee),
      },
    };
  }

  // ============================================
  // FORMATTING & UTILITY METHODS
  // ============================================

  /**
   * Format a gas cost estimate into a human-readable breakdown
   *
   * @param estimate - Gas cost estimate to format
   * @returns Formatted string with cost breakdown
   */
  formatCostBreakdown(estimate: GasCostEstimate): string {
    const lines: string[] = [];

    lines.push('Gas Cost Breakdown:');
    lines.push('━'.repeat(50));

    if (estimate.l2ExecutionFee > 0n) {
      lines.push(`L2 Execution Fee: ${formatEther(estimate.l2ExecutionFee)} ETH`);
    }

    if (estimate.l1DataFee > 0n) {
      lines.push(`L1 Data Fee:      ${formatEther(estimate.l1DataFee)} ETH`);
    }

    lines.push('─'.repeat(50));
    lines.push(`Total:            ${estimate.formattedInETH} ETH`);

    // Show percentage breakdown if both fees exist
    if (estimate.l2ExecutionFee > 0n && estimate.l1DataFee > 0n) {
      const totalBeforeBuffer = estimate.l2ExecutionFee + estimate.l1DataFee;
      const l2Percentage = Number((estimate.l2ExecutionFee * 10000n) / totalBeforeBuffer) / 100;
      const l1Percentage = Number((estimate.l1DataFee * 10000n) / totalBeforeBuffer) / 100;

      lines.push('');
      lines.push(`L2: ${l2Percentage.toFixed(2)}% | L1: ${l1Percentage.toFixed(2)}%`);
    }

    return lines.join('\n');
  }

  /**
   * Check if the user has sufficient balance for a transaction
   *
   * @param userAddress - User's address
   * @param estimate - Gas cost estimate
   * @param onL1 - Whether to check L1 (true) or L2 (false) balance
   * @returns Whether user has sufficient balance
   */
  async checkSufficientBalance(
    userAddress: Address,
    estimate: GasCostEstimate,
    onL1 = false
  ): Promise<{
    hasSufficientBalance: boolean;
    currentBalance: bigint;
    required: bigint;
    shortfall: bigint;
  }> {
    const client = onL1 ? this.l1PublicClient : this.l2PublicClient;
    const currentBalance = await client.getBalance({ address: userAddress });
    const required = estimate.totalFee;
    const hasSufficientBalance = currentBalance >= required;
    const shortfall = hasSufficientBalance ? 0n : required - currentBalance;

    return {
      hasSufficientBalance,
      currentBalance,
      required,
      shortfall,
    };
  }
}
