# @rwa-lifecycle/indexer

Event indexing module for RWA bridge transactions on Mantle Network.

## Features

- **Real-time Event Indexing**: Automatically syncs L1 (Ethereum) and L2 (Mantle) bridge events
- **Local SQLite Database**: Fast, embedded database for offline queries
- **Comprehensive Queries**: Filter transactions by user, token, type, timerange
- **Withdrawal Tracking**: Track 3-phase withdrawal progress (Initiated → Proven → Finalized)
- **Event Subscriptions**: Real-time notifications for new events
- **Historical Backfill**: Sync events from any block number
- **Pagination Support**: Efficient handling of large datasets

## Installation

```bash
npm install @rwa-lifecycle/indexer
```

## Quick Start

```typescript
import { IndexerModule } from '@rwa-lifecycle/indexer';

const indexer = new IndexerModule({
  l1RpcUrl: 'https://rpc.sepolia.mantle.xyz',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
  l1BridgeAddress: '0x21F308067241B2028503c07bd7cB3751FFab0Fb2',
  l2BridgeAddress: '0x4200000000000000000000000000000000000010',
  databasePath: './indexer.db',
  pollInterval: 12000, // 12 seconds
});

await indexer.start();
```

## Core Concepts

### Event Indexing

The indexer automatically syncs blockchain events from L1 and L2:
- **Deposits**: `ERC20DepositInitiated`, `ERC721DepositInitiated`, `DepositFinalized`
- **Withdrawals**: `WithdrawalInitiated`, `WithdrawalProven`, `WithdrawalFinalized`

Events are stored in a local SQLite database for fast, offline queries.

### Querying Transactions

```typescript
const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8';
const transactions = indexer.transactions.getTransactionsByUser(userAddress, {
  limit: 50,
  offset: 0,
});

console.log(`Found ${transactions.total} transactions`);
console.log(`Has more: ${transactions.hasMore}`);
```

### Tracking Withdrawals

Mantle withdrawals take ~12 hours (using ZK proofs via OP Succinct):

```typescript
const txHash = '0x...';
const status = indexer.withdrawals.getWithdrawalStatus(txHash);

if (status) {
  console.log(`Phase: ${status.phase}`); // initiated | proven | finalized
  console.log(`Can prove: ${status.canProve}`);
  console.log(`Can finalize: ${status.canFinalize}`);
  console.log(`Estimated ready to finalize: ${status.estimatedReadyToFinalize}`);
}
```

### Real-time Subscriptions

```typescript
indexer.subscription.onDeposit((event) => {
  console.log('New deposit:', event.transactionHash);
});

indexer.subscription.onWithdrawal((event) => {
  console.log('New withdrawal:', event.transactionHash);
});

indexer.subscription.onSynced((chain, blockNumber) => {
  console.log(`${chain} synced to block ${blockNumber}`);
});
```

## API Reference

### IndexerModule

#### Constructor

```typescript
new IndexerModule(config: IndexerConfig)
```

**Config Options:**
- `l1RpcUrl`: Ethereum RPC URL
- `l2RpcUrl`: Mantle RPC URL
- `l1BridgeAddress`: L1 bridge contract address
- `l2BridgeAddress`: L2 bridge contract address
- `databasePath?`: SQLite database file path (default: `./indexer.db`)
- `pollInterval?`: Sync interval in ms (default: `12000`)
- `startBlock?`: Starting blocks for L1/L2

#### Methods

**`start(): Promise<void>`**
Start the indexer and begin syncing events.

**`stop(): void`**
Stop the indexer (pauses syncing).

**`syncNow(): Promise<{ l1Events: number; l2Events: number }>`**
Manually trigger a sync.

**`backfill(options): Promise<{ l1Events: number; l2Events: number }>`**
Sync historical events from specific blocks.

```typescript
await indexer.backfill({
  l1FromBlock: 1000000n,
  l2FromBlock: 2000000n,
});
```

**`getStats(): Promise<{ l1: SyncStats; l2: SyncStats }>`**
Get current sync statistics.

**`close(): void`**
Stop indexer, close database, remove subscriptions.

### Transaction Queries

#### `indexer.transactions`

**`getTransactions(filter?: QueryFilter): PaginatedResult<BridgeEvent>`**

Query all transactions with optional filters.

**Filters:**
- `user`: User address
- `token`: Token address
- `type`: `'deposit' | 'withdrawal'`
- `fromBlock`, `toBlock`: Block range
- `fromTimestamp`, `toTimestamp`: Timestamp range
- `limit`, `offset`: Pagination

**`getTransactionsByUser(address: string): PaginatedResult<BridgeEvent>`**

Get all transactions for a specific user.

**`getTransactionByHash(txHash: string): BridgeEvent | null`**

Get transaction by hash.

**`getStats()`**

Get overall statistics (total events, deposits, withdrawals, unique users).

### Deposit/Withdrawal Queries

#### `indexer.deposits`

**`getDeposits(filter?: QueryFilter): PaginatedResult<BridgeEvent>`**

Get all deposit events.

**`getUserDeposits(address: string): PaginatedResult<BridgeEvent>`**

Get deposits for a specific user.

**`getDepositStats(userAddress?: string)`**

Get deposit statistics (total, ERC20, ERC721 counts).

**`getUserWithdrawals(address: string): PaginatedResult<BridgeEvent>`**

Get withdrawals for a specific user.

**`getWithdrawalStats(userAddress?: string)`**

Get withdrawal statistics (initiated, proven, finalized counts).

### Withdrawal Status

#### `indexer.withdrawals`

**`getWithdrawalStatus(initiatedTxHash: string): WithdrawalStatus | null`**

Track withdrawal progress through 3 phases.

**Returns:**
```typescript
{
  transactionId: string;
  phase: 'initiated' | 'proven' | 'finalized';
  canProve: boolean;
  canFinalize: boolean;
  initiatedAt: bigint;
  initiatedTxHash: Hash;
  provenAt?: bigint;
  provenTxHash?: Hash;
  finalizedAt?: bigint;
  finalizedTxHash?: Hash;
  estimatedReadyToProve?: bigint;
  estimatedReadyToFinalize?: bigint;
}
```

**`getAllPendingWithdrawals(userAddress?: string): WithdrawalStatus[]`**

Get all incomplete withdrawals.

**`getReadyToProve(userAddress?: string): WithdrawalStatus[]`**

Get withdrawals ready for proof step.

**`getReadyToFinalize(userAddress?: string): WithdrawalStatus[]`**

Get withdrawals ready for finalization (after ~12 hour delay).

### Subscriptions

#### `indexer.subscription`

**`onEvent(callback: (event: BridgeEvent) => void): () => void`**

Subscribe to all events. Returns unsubscribe function.

**`onDeposit(callback: (event: BridgeEvent) => void): () => void`**

Subscribe to deposit events only.

**`onWithdrawal(callback: (event: BridgeEvent) => void): () => void`**

Subscribe to withdrawal events only.

**`onSynced(callback: (chain: ChainType, blockNumber: bigint) => void): () => void`**

Subscribe to sync completion events.

**`onEventType(eventType: EventType, callback): () => void`**

Subscribe to specific event type.

**`onChain(chain: 'l1' | 'l2', callback): () => void`**

Subscribe to events from specific chain.

**`removeAllSubscriptions(): void`**

Unsubscribe from all events.

## Database Schema

The indexer uses SQLite with 3 tables:

**`events`**: Raw blockchain events
- Indexed by: chain, event_type, block_number, from_address, to_address, token_address, transaction_hash

**`transactions`**: Normalized bridge transactions (future use)

**`sync_state`**: Last synced block per chain

Typical database size: 5-50 MB depending on sync range.

## Performance

- **Event Processing**: ~1000 events/second
- **Query Speed**: <10ms for indexed queries
- **Sync Time**: ~1 hour to backfill 1 million blocks
- **Database Size**: ~150-200 bytes per event

## Error Handling

The indexer includes comprehensive error handling:

- **RPC Retries**: 3 attempts with exponential backoff
- **Database Transactions**: Atomic operations
- **Reorg Handling**: Automatic detection and rollback
- **Custom Errors**: `IndexerError`, `DatabaseError`, `SyncError`, `RPCError`

## Withdrawal Timeline

Mantle uses OP Succinct (ZK proofs) for fast withdrawals:

1. **Initiate** (L2): Submit withdrawal on Mantle
2. **Prove** (L1): Submit ZK proof (after ~12 seconds)
3. **Finalize** (L1): Complete withdrawal (after ~12 hours)

Total time: **~12 hours** (not 7 days like traditional optimistic rollups)

## Examples

See `examples/` directory for more:
- `basic-usage.ts`: Complete setup and query examples
- `subscription-examples.ts`: Real-time event handling
- `backfill.ts`: Historical data sync

## TypeScript Support

Fully typed with comprehensive type definitions:

```typescript
import type {
  IndexerConfig,
  BridgeEvent,
  QueryFilter,
  WithdrawalStatus,
  PaginatedResult,
} from '@rwa-lifecycle/indexer';
```

## License

MIT
