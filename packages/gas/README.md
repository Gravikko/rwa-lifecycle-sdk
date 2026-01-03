# @rwa-lifecycle/gas

Gas estimation module for Mantle L2 transactions. Accurately estimates transaction costs including L2 execution fees and L1 data availability fees.

## Features

- ✅ **Accurate Cost Estimation**: Calculates both L2 execution and L1 data fees
- ✅ **Bridge Operations**: Specialized estimators for deposits and withdrawals
- ✅ **Complete Withdrawal Costs**: Estimates all 3 phases of L2 → L1 withdrawals
- ✅ **Safety Buffers**: Configurable buffer to protect against gas price fluctuations
- ✅ **Balance Checks**: Verify users have sufficient funds before transactions
- ✅ **Error Handling**: Custom error types for better debugging
- ✅ **TypeScript First**: Full type safety with comprehensive interfaces

## Installation

```bash
pnpm add @rwa-lifecycle/gas viem
```

## Quick Start

```typescript
import { createPublicClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { GasModule } from '@rwa-lifecycle/gas';

// Create clients
const l1Client = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.public.blastapi.io'),
});

const l2Client = createPublicClient({
  chain: {
    id: 5003,
    name: 'Mantle Sepolia',
    nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://rpc.sepolia.mantle.xyz'] },
      public: { http: ['https://rpc.sepolia.mantle.xyz'] },
    },
  },
  transport: http('https://rpc.sepolia.mantle.xyz'),
});

// Initialize Gas Module
const gasModule = new GasModule({
  l1PublicClient: l1Client,
  l2PublicClient: l2Client,
  network: 'testnet',
});

// Estimate ERC20 deposit cost
const estimate = await gasModule.estimateDepositERC20Cost({
  from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  l1TokenAddress: '0x7f11f79DEA8CE904ed0249a23930f2e59b43a385',
  l2TokenAddress: '0x...',
  amount: parseEther('100'),
});

console.log(`Total cost: ${estimate.formattedInETH} ETH`);
console.log(gasModule.formatCostBreakdown(estimate));
```

## Gas Structure on Mantle

Mantle transactions have two fee components:

### 1. L2 Execution Fee (Cheap)
- Cost to execute transaction on Mantle L2
- Paid in MNT
- Similar to regular Ethereum gas fees
- Usually very low

### 2. L1 Data Fee (Expensive)
- Cost to post transaction data to Ethereum L1
- Required for rollup security
- Paid in MNT (but priced based on L1 gas)
- Usually the dominant cost factor

**Total Fee = L2 Execution Fee + L1 Data Fee + Safety Buffer**

## API Reference

### Constructor

```typescript
new GasModule(config: GasConfig)
```

**Parameters:**
- `l1PublicClient`: Viem public client for L1 (Ethereum)
- `l2PublicClient`: Viem public client for L2 (Mantle)
- `network`: `'mainnet'` | `'testnet'`
- `gasOracleAddress?`: Custom gas oracle address (optional)
- `bufferPercentage?`: Safety buffer percentage (default: 10%)

### Core Methods

#### estimateTotalCost()

Estimate cost for any L2 transaction.

```typescript
async estimateTotalCost(
  transaction: {
    from: Address;
    to?: Address;
    data?: Hex;
    value?: bigint;
    gasLimit?: bigint;
    nonce?: number;
  },
  includeBreakdown?: boolean
): Promise<GasCostEstimate>
```

**Returns:**
```typescript
{
  l2ExecutionFee: bigint;      // L2 gas cost in wei
  l1DataFee: bigint;            // L1 data posting cost in wei
  totalFee: bigint;             // Total with buffer
  formattedInETH: string;       // Human-readable ETH amount
  formattedInMNT: string;       // Human-readable MNT amount
  breakdown: {
    l2GasEstimate: bigint;      // Gas units for L2
    l2GasPrice: bigint;         // Current L2 gas price
    l1GasUsed?: bigint;         // L1 gas for data (if available)
    l1BaseFee?: bigint;         // Current L1 base fee (if available)
    overhead?: bigint;          // Oracle overhead constant (if available)
    scalar?: bigint;            // Oracle scalar multiplier (if available)
  };
}
```

#### estimateDepositERC20Cost()

Estimate cost of depositing ERC20 tokens from L1 → L2.

```typescript
async estimateDepositERC20Cost(options: {
  from: Address;
  l1TokenAddress: Address;
  l2TokenAddress: Address;
  amount: bigint;
  minGasLimit?: number;
}): Promise<GasCostEstimate>
```

#### estimateDepositNFTCost()

Estimate cost of depositing ERC721 NFT from L1 → L2.

```typescript
async estimateDepositNFTCost(options: {
  from: Address;
  l1TokenAddress: Address;
  l2TokenAddress: Address;
  tokenId: bigint;
  minGasLimit?: number;
}): Promise<GasCostEstimate>
```

#### estimateWithdrawERC20InitiateCost()

Estimate cost of initiating ERC20 withdrawal from L2 → L1 (Phase 1 only).

```typescript
async estimateWithdrawERC20InitiateCost(options: {
  from: Address;
  l1TokenAddress: Address;
  l2TokenAddress: Address;
  amount: bigint;
  minGasLimit?: number;
}): Promise<GasCostEstimate>
```

#### estimateWithdrawNFTInitiateCost()

Estimate cost of initiating NFT withdrawal from L2 → L1 (Phase 1 only).

```typescript
async estimateWithdrawNFTInitiateCost(options: {
  from: Address;
  l1TokenAddress: Address;
  l2TokenAddress: Address;
  tokenId: bigint;
  minGasLimit?: number;
}): Promise<GasCostEstimate>
```

#### estimateWithdrawProveCost()

Estimate cost of proving withdrawal on L1 (Phase 2).

```typescript
async estimateWithdrawProveCost(options: {
  from: Address;
}): Promise<GasCostEstimate>
```

**Note:** Uses typical gas cost (~250,000 gas) as actual proof data isn't available pre-transaction.

#### estimateWithdrawFinalizeCost()

Estimate cost of finalizing withdrawal on L1 (Phase 3).

```typescript
async estimateWithdrawFinalizeCost(options: {
  from: Address;
}): Promise<GasCostEstimate>
```

**Note:** Uses typical gas cost (~100,000 gas) as actual finalization data isn't available pre-transaction.

#### estimateCompleteWithdrawalCost()

**⭐ RECOMMENDED**: Estimate complete withdrawal cost including all 3 phases.

```typescript
async estimateCompleteWithdrawalCost(options: {
  from: Address;
  tokenType: 'erc20' | 'erc721';
  l1TokenAddress: Address;
  l2TokenAddress: Address;
  amount?: bigint;     // Required for ERC20
  tokenId?: bigint;    // Required for ERC721
}): Promise<{
  initiate: GasCostEstimate;   // Phase 1: Initiate on L2
  prove: GasCostEstimate;      // Phase 2: Prove on L1 (after 7 days)
  finalize: GasCostEstimate;   // Phase 3: Finalize on L1
  total: {
    totalFee: bigint;
    formattedInETH: string;
    formattedInMNT: string;
  };
}>
```

**Example:**
```typescript
const estimate = await gasModule.estimateCompleteWithdrawalCost({
  from: userAddress,
  tokenType: 'erc20',
  l1TokenAddress,
  l2TokenAddress,
  amount: parseEther('100'),
});

console.log('Complete Withdrawal:');
console.log(`  Initiate:  ${estimate.initiate.formattedInMNT} MNT`);
console.log(`  Prove:     ${estimate.prove.formattedInETH} ETH`);
console.log(`  Finalize:  ${estimate.finalize.formattedInETH} ETH`);
console.log(`  TOTAL:     ${estimate.total.formattedInETH} ETH`);
```

### Utility Methods

#### formatCostBreakdown()

Format gas estimate as human-readable breakdown.

```typescript
formatCostBreakdown(estimate: GasCostEstimate): string
```

**Example output:**
```
Gas Cost Breakdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
L2 Execution Fee: 0.000021 ETH
L1 Data Fee:      0.00005 ETH
──────────────────────────────────────────────────
Total:            0.0000781 ETH

L2: 26.88% | L1: 73.12%
```

#### checkSufficientBalance()

Check if user has sufficient balance for the transaction.

```typescript
async checkSufficientBalance(
  userAddress: Address,
  estimate: GasCostEstimate,
  onL1: boolean
): Promise<{
  hasSufficientBalance: boolean;
  currentBalance: bigint;
  required: bigint;
  shortfall: bigint;
}>
```

**Parameters:**
- `userAddress`: User's address to check
- `estimate`: Gas cost estimate
- `onL1`: `true` to check L1 balance, `false` for L2

**Example:**
```typescript
const balanceCheck = await gasModule.checkSufficientBalance(
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  estimate,
  true // Check L1 balance for deposit
);

if (!balanceCheck.hasSufficientBalance) {
  console.log(`Insufficient balance! Need ${balanceCheck.shortfall} wei more`);
}
```

### Configuration Methods

#### getGasOracleAddress()

Get the currently configured gas oracle address.

```typescript
getGasOracleAddress(): Address
```

#### getNetwork()

Get the currently configured network.

```typescript
getNetwork(): 'mainnet' | 'testnet'
```

#### getConfig()

Get the complete current configuration.

```typescript
getConfig(): GasConfig
```

## Error Handling

The Gas Module provides custom error types for better error handling:

### GasEstimationError

Base error class for all gas estimation errors.

```typescript
try {
  const estimate = await gasModule.estimateTotalCost({...});
} catch (error) {
  if (error instanceof GasEstimationError) {
    console.error('Gas estimation failed:', error.message);
  }
}
```

### RPCError

Thrown when RPC requests fail (network issues, invalid endpoints, etc.).

```typescript
catch (error) {
  if (error instanceof RPCError) {
    console.error('RPC Error:', error.message);
    console.error('Original:', error.originalError);
  }
}
```

### GasOracleError

Thrown when gas oracle contract calls fail (unavailable, incorrect network, etc.).

```typescript
catch (error) {
  if (error instanceof GasOracleError) {
    console.error('Gas Oracle Error:', error.message);
  }
}
```

## Constants

### Gas Oracle Addresses

```typescript
import {
  GAS_PRICE_ORACLE_ADDRESS,
  MANTLE_SEPOLIA_GAS_ORACLE,
  MANTLE_MAINNET_GAS_ORACLE,
  getGasOracleAddress,
  getGasOracleConfig,
} from '@rwa-lifecycle/gas';

// All Mantle networks use the same address
console.log(GAS_PRICE_ORACLE_ADDRESS); // 0x420000000000000000000000000000000000000F

// Get oracle address for specific network
const address = getGasOracleAddress('testnet');
```

### Gas Price Oracle ABI

```typescript
import { GAS_PRICE_ORACLE_ABI } from '@rwa-lifecycle/gas';

// Use with viem to read oracle directly
const l1Fee = await l2Client.readContract({
  address: GAS_PRICE_ORACLE_ADDRESS,
  abi: GAS_PRICE_ORACLE_ABI,
  functionName: 'getL1Fee',
  args: [serializedTx],
});
```

## TypeScript Types

```typescript
import type {
  GasConfig,
  GasCostEstimate,
  TransactionType,
  GasEstimateOptions,
} from '@rwa-lifecycle/gas';
```

## Examples

See the [`examples/`](./examples/) directory for comprehensive usage examples:

- **basic-usage.ts**: Complete examples for all operations
- **README.md**: Detailed explanation of examples

## Best Practices

### 1. Always Use Safety Buffers

Gas prices can fluctuate. The default 10% buffer protects against failed transactions:

```typescript
const gasModule = new GasModule({
  l1PublicClient,
  l2PublicClient,
  network: 'testnet',
  bufferPercentage: 15, // 15% buffer for extra safety
});
```

### 2. Check Balance Before Transactions

```typescript
const estimate = await gasModule.estimateDepositERC20Cost({...});
const balanceCheck = await gasModule.checkSufficientBalance(userAddress, estimate, true);

if (!balanceCheck.hasSufficientBalance) {
  throw new Error(`Insufficient balance: need ${balanceCheck.shortfall} wei more`);
}
```

### 3. Use Complete Withdrawal Estimates

For withdrawals, always show users the COMPLETE cost (all 3 phases):

```typescript
// ❌ BAD: Only shows Phase 1
const initiateOnly = await gasModule.estimateWithdrawERC20InitiateCost({...});

// ✅ GOOD: Shows all 3 phases
const complete = await gasModule.estimateCompleteWithdrawalCost({...});
console.log(`Total withdrawal cost: ${complete.total.formattedInETH} ETH`);
```

### 4. Handle Errors Gracefully

```typescript
try {
  const estimate = await gasModule.estimateDepositERC20Cost({...});
} catch (error) {
  if (error instanceof RPCError) {
    // Retry or show "Network error, please try again"
  } else if (error instanceof GasOracleError) {
    // Fallback or show "Gas estimation unavailable"
  } else {
    // Log unexpected error
  }
}
```

### 5. Format Costs for Users

```typescript
const estimate = await gasModule.estimateDepositERC20Cost({...});

// Use formatted strings for display
console.log(`Cost: ${estimate.formattedInETH} ETH`);

// Use breakdown for detailed view
console.log(gasModule.formatCostBreakdown(estimate));

// Use raw bigints for calculations
const totalInWei = estimate.totalFee;
```

## Withdrawal Process

Withdrawals from Mantle to Ethereum are a 3-phase process:

### Phase 1: Initiate (L2)
- **Action**: Submit withdrawal transaction on Mantle
- **Cost**: L2 execution + L1 data fee (paid in MNT)
- **Timing**: Immediate

### Phase 2: Prove (L1)
- **Action**: Submit Merkle proof on Ethereum
- **Cost**: L1 gas (paid in ETH)
- **Timing**: After 7-day challenge period
- **Gas**: ~250,000 gas

### Phase 3: Finalize (L1)
- **Action**: Complete withdrawal on Ethereum
- **Cost**: L1 gas (paid in ETH)
- **Timing**: Immediately after proving
- **Gas**: ~100,000 gas

**Total Time: Minimum 7 days**

## Network Information

### Mantle Sepolia Testnet
- **Chain ID**: 5003
- **RPC**: https://rpc.sepolia.mantle.xyz
- **L1**: Ethereum Sepolia
- **Gas Oracle**: 0x420000000000000000000000000000000000000F

### Mantle Mainnet
- **Chain ID**: 5000
- **RPC**: https://rpc.mantle.xyz
- **L1**: Ethereum Mainnet
- **Gas Oracle**: 0x420000000000000000000000000000000000000F

## Contributing

Contributions are welcome! Please see the main repository README for contribution guidelines.

## License

MIT

## Related Packages

- `@rwa-lifecycle/core` - Main SDK orchestrator
- `@rwa-lifecycle/bridge` - Bridge operations module
- `@rwa-lifecycle/indexer` - Event indexing module

## Support

For questions or issues:
- GitHub Issues: https://github.com/your-org/rwa-lifecycle-sdk/issues
- Documentation: https://docs.your-domain.com

---

Built with ❤️ for the Mantle hackathon
