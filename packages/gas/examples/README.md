# Gas Module Examples

This directory contains practical examples demonstrating how to use the Gas Module for estimating transaction costs on Mantle L2.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set environment variables (optional):
```bash
export L1_RPC_URL="https://eth-sepolia.public.blastapi.io"
export L2_RPC_URL="https://rpc.sepolia.mantle.xyz"
```

## Running Examples

### TypeScript (with ts-node)
```bash
npx ts-node examples/basic-usage.ts
```

### JavaScript (compile first)
```bash
# Build the package
pnpm build

# Run the example
node examples/basic-usage.js
```

## Examples Included

### Example 1: ERC20 Deposit (L1 → L2)
Estimates the cost of depositing ERC20 tokens from Ethereum to Mantle.
- Shows L1 transaction cost
- Checks user balance
- Displays detailed fee breakdown

### Example 2: NFT Deposit (L1 → L2)
Estimates the cost of bridging an ERC721 NFT to Mantle.
- Demonstrates NFT-specific gas estimation
- Shows higher costs due to larger calldata

### Example 3: Withdrawal Initiation (L2 → L1)
Estimates the cost of initiating a withdrawal from Mantle back to Ethereum.
- Shows L2 execution fee
- Shows L1 data availability fee
- Explains this is only the first of 3 steps

### Example 4: Complete Withdrawal Cost
Estimates the total cost of a complete withdrawal including all 3 phases:
1. **Initiate** (L2): Submit withdrawal transaction on Mantle
2. **Prove** (L1): Submit proof after 7-day challenge period
3. **Finalize** (L1): Complete withdrawal on Ethereum

### Example 5: Custom Transaction
Shows how to estimate costs for any arbitrary transaction on Mantle.

### Example 6: Cost Comparison
Compares the costs of deposits vs withdrawals to help users make informed decisions.

### Example 7: Error Handling
Demonstrates proper error handling for:
- RPC errors (network issues)
- Gas Oracle errors (contract unavailable)
- Invalid inputs

## Key Concepts

### Gas Structure on Mantle

Mantle transactions have two fee components:

1. **L2 Execution Fee**: Cost to execute transaction on Mantle (cheap)
   - Similar to regular Ethereum gas
   - Paid in MNT
   - Usually very low

2. **L1 Data Fee**: Cost to post transaction data to Ethereum (expensive)
   - Required for L2 security
   - Paid in MNT (but priced in ETH)
   - Usually the dominant cost factor

### Safety Buffers

The Gas Module adds a configurable safety buffer (default 10%) to all estimates:
- Protects against gas price fluctuations
- Ensures transactions don't fail due to slight gas changes
- Configurable via `bufferPercentage` parameter

### Withdrawal Timing

Withdrawals from Mantle to Ethereum follow a 3-phase process:

1. **Initiate** (Immediate): Transaction on L2
2. **Prove** (After 7 days): Wait for challenge period, then prove on L1
3. **Finalize** (Immediate after prove): Complete withdrawal on L1

**Total time: ~7 days minimum**

## Tips

### Cost Optimization

1. **Batch operations**: If withdrawing multiple times, consider batching
2. **Monitor gas prices**: Check L1 gas prices before bridging
3. **Deposit is cheaper**: Moving assets L1 → L2 is much cheaper than L2 → L1
4. **Use safety buffers**: Better to overpay slightly than have transaction fail

### Error Handling

Always wrap gas estimation calls in try-catch blocks:
```typescript
try {
  const estimate = await gasModule.estimateDepositERC20Cost({...});
} catch (error) {
  if (error.name === 'RPCError') {
    // Handle network errors
  } else if (error.name === 'GasOracleError') {
    // Handle oracle errors
  }
}
```

### Balance Checks

Before executing transactions, always check if the user has sufficient balance:
```typescript
const estimate = await gasModule.estimateDepositERC20Cost({...});
const balanceCheck = await gasModule.checkSufficientBalance(
  userAddress,
  estimate,
  true // true for L1, false for L2
);

if (!balanceCheck.hasSufficientBalance) {
  console.log(`Need ${balanceCheck.shortfall} wei more`);
}
```

## Further Reading

- [Mantle Documentation](https://docs.mantle.xyz)
- [Mantle Gas Oracle](https://docs.mantle.xyz/network/for-developers/gas-and-fees)
- [Optimism Bedrock (Mantle's base)](https://docs.optimism.io/stack/protocol/overview)
