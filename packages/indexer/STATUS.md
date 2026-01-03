# Indexer Module Status

**Version**: 1.0.0
**Status**: ALL PHASES COMPLETE - Production Ready
**Last Updated**: 2026-01-03

## Completion: 100% (19/19 steps)

All 4 phases complete. Indexer module is production-ready.

## Purpose

Track and query historical bridge transactions and RWA token events across L1 (Ethereum) and L2 (Mantle).

## Architecture Overview

### Database Layer
- **Engine**: SQLite with better-sqlite3
- **Schema**:
  - `events` table (raw blockchain events)
  - `transactions` table (normalized bridge transactions)
  - `sync_state` table (last synced block per chain)

### Sync Layer
- **Event Fetcher**: Polls RPC for new events using viem `getLogs`
- **Event Processor**: Parses and saves events to database
- **Sync Manager**: Coordinates incremental sync (every 12 seconds)
- **Backfill Support**: Sync historical events from specific block

### Query Layer
- `getTransactions()` - Filter by user, token, type, timerange
- `getDeposits()` / `getWithdrawals()` - Specialized queries
- `getWithdrawalStatus()` - Track 3-phase withdrawal progress
- Pagination support (limit, offset, cursor-based)

### Subscription Layer (Optional)
- EventEmitter for real-time updates
- Subscribe to specific event types

## Implementation Steps (15/19)

### Phase 1: Foundation (Steps 1-7) ✅ COMPLETE
- [x] 1. Package setup (package.json, tsconfig)
- [x] 2. Core types & interfaces (types.ts)
- [x] 3. Database schema design (database/schema.ts)
- [x] 4. Database initialization (database/Database.ts)
- [x] 5. Event ABI definitions (abi/BridgeEvents.ts)
- [x] 6. Event parser utilities (parsers/EventParser.ts)
- [x] 7. RPC client configuration (clients.ts)

### Phase 2: Core Sync (Steps 8-11) ✅ COMPLETE
- [x] 8. Block tracker (sync/BlockTracker.ts)
- [x] 9. Event fetcher (sync/EventFetcher.ts)
- [x] 10. Event processor (sync/EventProcessor.ts)
- [x] 11. Sync manager (sync/SyncManager.ts)

### Phase 3: Query Interface (Steps 12-15) ✅ COMPLETE
- [x] 12. Query: getTransactions (query/TransactionQuery.ts)
- [x] 13. Query: getDeposits/getWithdrawals (query/DepositWithdrawalQuery.ts)
- [x] 14. Query: getWithdrawalStatus (query/WithdrawalStatusQuery.ts)
- [x] 15. Filter & pagination support (PaginatedResult, QueryFilter)

### Phase 4: Production Ready (Steps 16-19) ✅ COMPLETE
- [x] 16. Error handling & retries (RPC retries, exponential backoff, custom errors)
- [x] 17. Subscription support (EventSubscription with EventEmitter)
- [x] 18. Package exports & IndexerModule (main entry point)
- [x] 19. Documentation & examples (README.md, basic-usage.ts)
- [x] BONUS: Unit tests (Database, Query, Subscription, Integration)

## Key Features ✅ ALL IMPLEMENTED

- [x] L1 + L2 event indexing
- [x] ERC20 deposit/withdrawal tracking
- [x] ERC721 (NFT) deposit/withdrawal tracking
- [x] 3-phase withdrawal status correlation
- [x] User transaction history
- [x] Token movement tracking
- [x] Real-time event subscriptions
- [x] Historical data backfill
- [x] Reorg handling
- [x] Local SQLite database (~5-50 MB)
- [x] Offline query support

## Technical Specifications

**RPC Polling**: Every 12 seconds (Mantle block time)
**Block Range**: Configurable (genesis or recent blocks)
**Event Storage**: ~150-200 bytes per event
**Database Size**:
- Per-user: ~1-10 KB
- Recent 6 months: ~5-20 MB
- Full history: ~10-500 MB (depends on network activity)

**Event Types**:
- `DepositFinalized` (L2)
- `WithdrawalInitiated` (L2)
- `WithdrawalProven` (L1)
- `WithdrawalFinalized` (L1)
- `ERC20DepositInitiated` (L1)
- `ERC721DepositInitiated` (L1)

**Networks**:
- L1: Ethereum Sepolia (11155111) / Mainnet (1)
- L2: Mantle Sepolia (5003) / Mainnet (5000)

## Dependencies (To Add)

```json
{
  "dependencies": {
    "viem": "^2.x",
    "better-sqlite3": "^11.x"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.x",
    "vitest": "^2.x"
  }
}
```

## Files to Create

```
packages/indexer/
├── src/
│   ├── types.ts                 (interfaces, types)
│   ├── IndexerModule.ts         (main class)
│   ├── database/
│   │   ├── schema.ts           (table definitions)
│   │   ├── Database.ts         (SQLite wrapper)
│   │   └── queries.ts          (prepared statements)
│   ├── sync/
│   │   ├── EventFetcher.ts     (getLogs wrapper)
│   │   ├── EventProcessor.ts   (parse & save)
│   │   ├── SyncManager.ts      (orchestration)
│   │   └── BlockTracker.ts     (state persistence)
│   ├── query/
│   │   ├── TransactionQuery.ts (getTransactions)
│   │   └── WithdrawalQuery.ts  (getWithdrawalStatus)
│   ├── parsers/
│   │   └── EventParser.ts      (decode events)
│   ├── subscriptions/
│   │   └── EventEmitter.ts     (real-time updates)
│   ├── abi/
│   │   └── BridgeEvents.ts     (event ABIs)
│   └── index.ts                (exports)
├── test/
│   └── IndexerModule.test.ts   (unit tests)
├── examples/
│   └── basic-usage.ts          (usage examples)
├── README.md                    (documentation)
└── package.json
```

## Test Coverage

**Unit Tests**: 4 test suites
- Database.test.ts: Database initialization, transactions, prepared statements
- TransactionQuery.test.ts: Pagination, filtering, statistics
- EventSubscription.test.ts: Event emission, filtering, unsubscribe
- IndexerModule.test.ts: Integration test for full module

**Test Files**:
- `test/setup.ts`: Test utilities and cleanup
- `test/mocks.ts`: Mock data generators
- `vitest.config.ts`: Test configuration

**Run Tests**:
```bash
npm test
```

## Resolved Challenges

1. ✅ **Chain Reorganizations**: Implemented in BlockTracker with event/transaction cleanup
2. ✅ **Rate Limiting**: RPC retry logic with exponential backoff (3 attempts)
3. ✅ **Large Block Ranges**: Block chunking (10k blocks per request)
4. ✅ **Withdrawal Correlation**: WithdrawalStatusQuery correlates 3 phases
5. ✅ **Database Locking**: WAL mode enables concurrent reads during writes
6. ✅ **ZK Withdrawal Timing**: Fixed to 12 hours (Mantle OP Succinct, not 7 days)
