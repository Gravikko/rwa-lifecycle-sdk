# @rwa-lifecycle/core

Main SDK orchestrator for the RWA Lifecycle SDK. This package provides a unified interface to manage tokenized Real-World Assets (RWA) on Mantle L2, including bridging, gas estimation, compliance checking, and event indexing.

## Installation

```bash
pnpm add @rwa-lifecycle/core
# or
npm install @rwa-lifecycle/core
```

## Quick Start

```typescript
import { RWALifecycleSDK } from '@rwa-lifecycle/core';

// Initialize SDK (read-only mode)
const sdk = new RWALifecycleSDK({
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
});

// Initialize with wallet (for bridging)
const sdk = new RWALifecycleSDK({
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
  privateKey: '0x...', // Your private key
});
```

## Features

- **Bridge Module**: Deposit/withdraw ERC20 and ERC721 tokens between L1 and L2
- **Gas Module**: Estimate gas costs for all bridge operations
- **Compliance Module**: Check compliance before transfers (ERC3643, custom plugins)
- **Indexer Module**: Track and query historical bridge transactions

## Configuration

### Minimal Configuration

Only RPC URLs are required - everything else has sensible defaults:

```typescript
const sdk = new RWALifecycleSDK({
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
});
```

### Full Configuration

```typescript
const sdk = new RWALifecycleSDK({
  // Network (required)
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',

  // Network selection (auto-detected if not specified)
  network: 'testnet', // or 'mainnet'
  l1ChainId: 11155111, // Sepolia
  l2ChainId: 5003, // Mantle Sepolia

  // Wallet (required for bridging)
  privateKey: '0x...', // 64-character hex string

  // Gas module options
  gasOracleAddress: '0x420000000000000000000000000000000000000F',
  gasBufferPercentage: 10, // Add 10% buffer to estimates

  // Indexer module options
  indexerDbPath: './.rwa-data/indexer.db',
  indexerPollInterval: 12000, // 12 seconds
  indexerAutoStart: false,
  indexerStartBlock: { l1: 0n, l2: 0n },

  // Custom bridge contract addresses (rarely needed)
  bridgeContracts: {
    l1StandardBridge: '0x...',
    l2StandardBridge: '0x...',
    // ...
  },
});
```

## API Reference

### Module Access

Access individual modules directly:

```typescript
// Gas estimation
const estimate = await sdk.gas.estimateDepositERC20Cost({
  from: '0x...',
  l1TokenAddress: '0x...',
  l2TokenAddress: '0x...',
  amount: 1000n,
});

// Bridge operations (requires wallet)
if (sdk.bridge) {
  const result = await sdk.bridge.depositERC20('0x...', 1000n);
}

// Compliance checking
const result = await sdk.compliance.checkCompliance(
  '0x...', // token
  '0x...', // from
  '0x...', // to
  1000n   // amount
);

// Indexer queries
const transactions = sdk.indexer.transactions.getTransactionsByUser('0x...');
```

### Convenience Methods

High-level methods that combine multiple modules:

#### `bridgeWithCompliance()`

Check compliance before bridging. Prevents failed transactions due to compliance restrictions.

```typescript
const result = await sdk.bridgeWithCompliance({
  tokenAddress: '0x...',
  amount: 1000n,
  direction: 'deposit', // or 'withdrawal'
  to: '0x...', // optional recipient
  tokenType: 'ERC20', // or 'ERC721'
  simulate: true, // optional: simulate transfer first
});

if (!result.compliant) {
  console.error(`Blocked: ${result.complianceReason}`);
} else {
  console.log(`Bridged! TX: ${result.txHash}`);
}
```

#### `estimateAndBridge()`

Estimate gas, optionally check compliance, and optionally execute bridge.

```typescript
// Dry run - estimate only
const estimate = await sdk.estimateAndBridge({
  tokenAddress: '0x...',
  amount: 1000n,
  direction: 'deposit',
  dryRun: true,
});
console.log(`Cost: ${estimate.estimate.formattedInETH} ETH`);

// Full execution with compliance check
const result = await sdk.estimateAndBridge({
  tokenAddress: '0x...',
  amount: 1000n,
  direction: 'deposit',
  checkCompliance: true,
});

if (result.executed) {
  console.log(`TX: ${result.txHash}`);
}
```

#### `getMyTransactions()`

Query indexer for transactions associated with your wallet.

```typescript
// Get all transactions
const result = await sdk.getMyTransactions();
console.log(`Found ${result.total} transactions`);

// Filter by type
const deposits = await sdk.getMyTransactions({ type: 'deposit' });
const withdrawals = await sdk.getMyTransactions({ type: 'withdrawal' });

// Pagination
const page2 = await sdk.getMyTransactions({ limit: 10, offset: 10 });
```

#### `trackWithdrawal()`

Track a withdrawal's progress through the 3-phase process.

```typescript
const status = await sdk.trackWithdrawal('0x...');

if (status) {
  console.log(`Phase: ${status.phase}`); // initiated, proven, finalized
  console.log(`Can prove: ${status.canProve}`);
  console.log(`Can finalize: ${status.canFinalize}`);

  if (status.estimatedReadyToFinalize) {
    const eta = new Date(Number(status.estimatedReadyToFinalize) * 1000);
    console.log(`Ready to finalize at: ${eta}`);
  }
}
```

#### `getMyPendingWithdrawals()`

Get all non-finalized withdrawals for your wallet.

```typescript
const pending = await sdk.getMyPendingWithdrawals();

for (const withdrawal of pending) {
  console.log(`TX: ${withdrawal.initiatedTxHash}`);
  console.log(`Phase: ${withdrawal.phase}`);

  if (withdrawal.canProve) {
    console.log('Ready to prove!');
  } else if (withdrawal.canFinalize) {
    console.log('Ready to finalize!');
  }
}
```

#### `getWithdrawalsReadyToProve()` / `getWithdrawalsReadyToFinalize()`

Filter withdrawals by readiness state.

```typescript
// Get withdrawals ready for proving on L1
const readyToProve = await sdk.getWithdrawalsReadyToProve();
for (const w of readyToProve) {
  await sdk.bridge?.proveWithdrawal(w.initiatedTxHash);
}

// Get withdrawals ready for finalization on L1
const readyToFinalize = await sdk.getWithdrawalsReadyToFinalize();
for (const w of readyToFinalize) {
  await sdk.bridge?.finalizeWithdrawal(w.initiatedTxHash);
}
```

#### `getWithdrawalTimeline()`

Get detailed timestamps for each withdrawal phase.

```typescript
const timeline = await sdk.getWithdrawalTimeline('0x...');

if (timeline.initiated) {
  console.log(`Initiated: ${new Date(Number(timeline.initiated.timestamp) * 1000)}`);
}
if (timeline.proven) {
  console.log(`Proven: ${new Date(Number(timeline.proven.timestamp) * 1000)}`);
}
if (timeline.finalized) {
  console.log(`Finalized: ${new Date(Number(timeline.finalized.timestamp) * 1000)}`);
}
if (timeline.estimatedCompletion) {
  console.log(`ETA: ${new Date(Number(timeline.estimatedCompletion) * 1000)}`);
}
```

### Utility Methods

```typescript
// Check if bridging is available
if (sdk.isBridgeEnabled()) {
  // Bridge operations available
}

// Get current configuration
const config = sdk.getConfig();

// Access underlying clients
const l1Client = sdk.getL1Client();
const l2Client = sdk.getL2Client();
const l1Wallet = sdk.getL1WalletClient(); // undefined if no wallet
const l2Wallet = sdk.getL2WalletClient(); // undefined if no wallet

// Shutdown (stops indexer, releases resources)
sdk.shutdown();
```

## Network Configuration

### Testnet (Default)

```typescript
const sdk = new RWALifecycleSDK({
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
  network: 'testnet', // optional, auto-detected
});
```

### Mainnet

```typescript
const sdk = new RWALifecycleSDK({
  l1RpcUrl: 'https://eth-mainnet.public.blastapi.io',
  l2RpcUrl: 'https://rpc.mantle.xyz',
  network: 'mainnet',
});
```

## Type Exports

The package re-exports types from all sub-modules:

```typescript
import {
  // SDK types
  SDKConfig,
  WithdrawalStatus,
  RWAMetadata,
  BridgeWithComplianceResult,
  EstimateAndBridgeResult,

  // Gas module types
  GasCostEstimate,
  GasConfig,

  // Compliance module types
  ComplianceResult,
  ICompliancePlugin,

  // Bridge module types
  DepositOptions,
  WithdrawalOptions,
  DepositInfo,
  WithdrawalInfo,

  // Indexer module types
  BridgeEvent,
  QueryFilter,
  PaginatedResult,
} from '@rwa-lifecycle/core';
```

## Error Handling

```typescript
try {
  const result = await sdk.bridgeWithCompliance({
    tokenAddress: '0x...',
    amount: 1000n,
    direction: 'deposit',
  });
} catch (error) {
  if (error.message.includes('Bridge not available')) {
    console.error('Initialize SDK with a wallet to enable bridging');
  } else if (error.message.includes('No wallet address')) {
    console.error('Wallet required for this operation');
  } else {
    console.error('Bridge error:', error.message);
  }
}
```

## Withdrawal Process

Mantle uses OP Succinct (ZK proofs) for withdrawals, which takes ~12 hours total:

1. **Initiate** (L2): Start withdrawal on Mantle
2. **Prove** (L1): Submit ZK proof to Ethereum (~1-2 hours wait)
3. **Finalize** (L1): Complete withdrawal (~10-12 hours after prove)

```typescript
// Track withdrawal progress
const status = await sdk.trackWithdrawal(txHash);

// Get all pending withdrawals
const pending = await sdk.getMyPendingWithdrawals();

// Find ready-to-prove withdrawals
const readyToProve = await sdk.getWithdrawalsReadyToProve();

// Find ready-to-finalize withdrawals
const readyToFinalize = await sdk.getWithdrawalsReadyToFinalize();
```

## Related Packages

- `@rwa-lifecycle/bridge` - L1/L2 bridging operations
- `@rwa-lifecycle/gas` - Gas cost estimation
- `@rwa-lifecycle/compliance` - Compliance verification
- `@rwa-lifecycle/indexer` - Event tracking and queries

## License

MIT
