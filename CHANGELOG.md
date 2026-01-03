# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Phase 3: Indexer Module - 2026-01-03 ✅ COMPLETE
#### Implementation (19/19 steps - Production Ready)
- Complete indexer module with all 4 phases
- Phase 1: Foundation (types, database, ABIs, RPC clients)
- Phase 2: Core Sync (block tracker, event fetcher, processor, sync manager)
- Phase 3: Query Interface (transactions, deposits/withdrawals, withdrawal status)
- Phase 4: Production Ready (error handling, subscriptions, docs, examples)
- Production-ready with comprehensive documentation (700+ lines)

#### Features ✅ IMPLEMENTED
- L1 + L2 bridge event indexing (auto-sync every 12s)
- ERC20 & ERC721 transaction tracking
- 3-phase withdrawal status correlation (Initiated → Proven → Finalized)
- User transaction history queries with pagination
- Real-time event subscriptions (EventEmitter)
- Historical data backfill support
- Offline query capability (local SQLite)
- Withdrawal timeline tracking (~12 hours for Mantle OP Succinct)
- Reorg handling and error recovery
- Comprehensive query filters (user, token, type, timerange)

#### Technical Details
- Database: SQLite with better-sqlite3 (WAL mode, indexed queries)
- RPC: Exponential backoff retry logic (3 attempts)
- Event processing: ~1000 events/second
- Query speed: <10ms for indexed queries
- Database size: ~5-50 MB typical, ~150-200 bytes per event
- Withdrawal finalization: ~12 hours (Mantle uses ZK proofs, not 7 days)

#### Test Coverage
- 4 test suites: Database, TransactionQuery, EventSubscription, IndexerModule
- Unit tests for core functionality
- Integration tests for complete workflows
- Test utilities and mock data generators
- Vitest configuration for coverage reporting

### Phase 2: Gas Module - 2026-01-02
#### Added
- Complete Gas Module implementation (20.59 KB ESM)
- 25 passing unit tests with 100% critical path coverage
- Comprehensive documentation (700+ lines)
- 7 usage examples with detailed explanations
- Integration with Core SDK
- Real network integration test suite

#### Features
- Accurate L2 + L1 gas cost estimation
- Bridge operation cost estimation (ERC20 & ERC721)
- 3-phase withdrawal cost aggregation
- Balance checking utilities
- Cost formatting helpers
- Custom error types (GasEstimationError, RPCError, GasOracleError)
- Configurable safety buffers (default 10%)

#### Technical Details
- Uses viem for Ethereum interactions
- RLP transaction serialization for L1 data fees
- Gas Oracle at 0x420000000000000000000000000000000000000F
- Supports both Mantle mainnet (5000) and testnet (5003)

### Phase 1: Bridge Module - 2025-12-XX
#### Added
- BridgeModule for L1 ↔ L2 asset transfers
- ERC20 and ERC721 bridging support
- TestRWA_Bridgeable NFT contract
- IOptimismMintableERC721 interface (full Optimism Bedrock spec)

## Project Started - 2025-12-XX
- Initial monorepo setup
- Core SDK structure
- 6-module architecture defined
