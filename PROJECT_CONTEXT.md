# RWA Lifecycle SDK - Project Context

> **IMPORTANT**: Claude, always read this file first when resuming work on this project.

## Project Overview
Building a comprehensive SDK for managing Real-World Asset (RWA) tokenization lifecycle on Mantle L2.

**Hackathon**: Mantle Hackathon
**Goal**: Production-ready SDK for RWA management (bridging, gas estimation, compliance, storage, indexing)

## Architecture
Monorepo structure with 7 packages:
- `@rwa-lifecycle/core` - Main SDK orchestrator
- `@rwa-lifecycle/bridge` - L1 ↔ L2 bridging (ERC20 & ERC721)
- `@rwa-lifecycle/gas` - Gas cost estimation
- `@rwa-lifecycle/indexer` - Event indexing
- `@rwa-lifecycle/compliance` - KYC/AML
- `@rwa-lifecycle/storage` - EigenDA integration
- `@rwa-lifecycle/cli` - Command-line interface

## Implementation Plan (6 Phases, 19 Steps Each)

### ✅ Phase 1: Bridge Module (COMPLETED)
- Created L1/L2 bridge contracts interaction
- Implemented ERC20 and ERC721 bridging
- Built BridgeModule with deposit/withdraw methods
- Fixed IOptimismMintableERC721 interface issues
- Created TestRWA_Bridgeable NFT contract

### ✅ Phase 2: Gas Module (COMPLETED - 100%)
**Status**: Production-ready with full test coverage

**Completed Steps (19/19)**:
1. ✅ Types & Interfaces (types.ts)
2. ✅ Gas Oracle ABI (abi/GasOracle.ts)
3. ✅ Oracle addresses (oracles.ts)
4. ✅ GasModule class structure
5. ✅ estimateL2Gas (private)
6. ✅ estimateL1DataFee (private)
7. ✅ estimateTotalCost (public)
8. ✅ estimateDepositERC20Cost
9. ✅ estimateWithdrawERC20InitiateCost
10. ✅ estimateDepositNFTCost
11. ✅ estimateWithdrawNFTInitiateCost
12. ✅ estimateWithdrawProveCost
13. ✅ estimateWithdrawFinalizeCost
14. ✅ estimateCompleteWithdrawalCost (BONUS: shows all 3 withdrawal phases)
15. ✅ formatCostBreakdown helper
16. ✅ checkSufficientBalance helper
17. ✅ Custom errors (GasEstimationError, RPCError, GasOracleError)
18. ✅ Safety buffers (10% default)
19. ✅ Package exports (index.ts)
20. ✅ Integration with Core SDK
21. ✅ Unit tests (25/25 passing)
22. ✅ Usage examples (examples/basic-usage.ts)
23. ✅ Documentation (README.md - 700+ lines)

**Key Technical Decisions**:
- Using viem (not ethers)
- RLP transaction serialization for L1 data fee calculation
- Separate estimators for each bridge operation
- 3-phase withdrawal cost aggregation
- Configurable safety buffers

**Build Output**:
- Gas Module: 20.59 KB (ESM), 22.31 KB (CJS), 14.63 KB (types)
- Core SDK: 2.44 KB (ESM), 3.65 KB (CJS), 4.39 KB (types)

### ✅ Phase 3: Indexer Module (COMPLETED - 100%)
**Status**: All 4 phases complete - Production Ready
**Purpose**: Track and query historical bridge transactions and RWA token events

**Implementation Complete (19/19)**:
1. ✅ Package setup (package.json, tsconfig, folder structure)
2. ✅ Core types & interfaces (IndexerConfig, BridgeEvent, QueryFilter, WithdrawalStatus)
3. ✅ Database schema design (events, transactions, sync_state tables)
4. ✅ Database initialization (SQLite setup with better-sqlite3)
5. ✅ Event ABI definitions (DepositFinalized, WithdrawalInitiated, etc.)
6. ✅ Event parser utilities (decodeEventLog wrapper, data normalization)
7. ✅ RPC client configuration (L1/L2 viem clients)
8. ✅ Block tracker (persist last synced block, handle reorgs)
9. ✅ Event fetcher (getLogs with pagination, block range chunking)
10. ✅ Event processor (parse logs, save to DB with deduplication)
11. ✅ Sync manager (incremental sync loop, backfill historical data)
12. ✅ Query: getTransactions (filter by user, token, type, timerange)
13. ✅ Query: getDeposits / getWithdrawals (specialized queries)
14. ✅ Query: getWithdrawalStatus (track 3-phase withdrawal progress)
15. ✅ Filter & pagination support (limit, offset, cursor-based)
16. ✅ Error handling & retries (RPC timeouts, DB locks, exponential backoff)
17. ✅ Subscription support (EventEmitter for real-time updates)
18. ✅ Package exports & IndexerModule (main entry point, complete API)
19. ✅ Documentation & examples (README, basic-usage.ts, 700+ lines)

**Key Technical Decisions**:
- Database: SQLite with better-sqlite3 (fast, embedded, no server needed)
- RPC polling: Every 12 seconds (Mantle block time)
- Event storage: All bridge events (ERC20 + ERC721 deposits/withdrawals)
- Historical sync: Support from specific block or genesis
- Query interface: Filter by user, token, type, status, timerange
- Withdrawal tracking: Correlate Initiate → Prove → Finalize across L2/L1
- Database size: ~150-200 bytes per event, typical DB ~5-50 MB

**Architecture**:
```
IndexerModule
├── database/       (schema, migrations, queries)
├── sync/          (event fetcher, processor, manager)
├── query/         (transaction history, withdrawal status)
├── parsers/       (event decode & normalize)
└── subscriptions/ (real-time event emitters)
```

### ⏳ Phase 4: Compliance Module
**Status**: Not started
**Purpose**: KYC/AML verification and regulatory compliance for RWA tokenization

**Planned Steps (19)**:

#### Phase 4.1: Foundation (Steps 1-5)
1. ⏳ Package setup (package.json, tsconfig.json, folder structure)
2. ⏳ Core types & interfaces (ComplianceConfig, VerificationStatus, KYCLevel, RiskScore)
3. ⏳ Provider abstraction layer (IComplianceProvider interface for multiple vendors)
4. ⏳ Database schema (verification_records, risk_assessments, sanctions_cache)
5. ⏳ Error handling (ComplianceError, ProviderError, VerificationError)

#### Phase 4.2: KYC/AML Core (Steps 6-11)
6. ⏳ KYC verification workflow (document upload, identity verification, liveness check)
7. ⏳ AML risk assessment (transaction patterns, risk scoring, PEP screening)
8. ⏳ Sanctions screening (OFAC, UN, EU lists via on-chain oracle or API)
9. ⏳ Accredited investor verification (income/net worth thresholds by jurisdiction)
10. ⏳ Jurisdiction compliance (country-specific rules, blocked regions)
11. ⏳ Compliance status aggregator (combine all checks into single status)

#### Phase 4.3: Provider Integrations (Steps 12-15)
12. ⏳ Chainalysis integration (on-chain risk scoring, sanctions screening)
13. ⏳ Mock provider (for testing/development without API keys)
14. ⏳ On-chain attestation (store verification hashes on Mantle L2)
15. ⏳ Multi-provider support (fallback providers, provider selection)

#### Phase 4.4: Production Ready (Steps 16-19)
16. ⏳ Caching layer (Redis-compatible cache for verification results, TTL management)
17. ⏳ Webhook support (receive real-time updates from providers)
18. ⏳ Query methods (getVerificationStatus, getRiskScore, checkCompliance)
19. ⏳ Package exports, ComplianceModule, docs & examples

**Key Technical Decisions**:
- **Provider-Agnostic Architecture**: Abstract interface supports multiple KYC/AML vendors
- **On-Chain Attestations**: Store verification proofs on L2 (privacy-preserving hashes)
- **Caching Strategy**: Cache verification results (1-30 days TTL depending on risk level)
- **Risk Levels**: LOW, MEDIUM, HIGH, CRITICAL (affects transaction limits)
- **KYC Levels**: NONE, BASIC, INTERMEDIATE, ADVANCED (tiered access to RWA features)
- **Privacy First**: Never store PII on-chain, only verification hashes
- **Compliance Data**: Store verification status, not personal data

**Supported Providers**:
- Chainalysis (on-chain risk scoring, sanctions screening)
- Mock Provider (testing/development)
- Extensible for: Sumsub, Onfido, Jumio, Civic, etc.

**Architecture**:
```
ComplianceModule
├── providers/      (Chainalysis, Mock, IComplianceProvider)
├── verification/   (KYC workflow, AML checks, sanctions)
├── attestation/    (on-chain proof storage)
├── cache/          (verification result caching)
├── database/       (compliance records, risk scores)
└── query/          (status checks, risk queries)
```

**Database Schema**:
- `verification_records`: user_address, kyc_level, verification_date, expiry, provider
- `risk_assessments`: address, risk_score, risk_level, last_assessed, factors
- `sanctions_cache`: address, is_sanctioned, lists, last_checked
- `compliance_status`: address, is_compliant, blocked_reasons, last_updated

**Compliance Flow**:
1. User initiates KYC via SDK
2. Provider performs verification (document check, liveness, etc.)
3. Results cached and stored in database
4. On-chain attestation created (hash only, no PII)
5. Compliance status updated (COMPLIANT / NON_COMPLIANT / PENDING)
6. SDK checks compliance before bridge transactions

### ⏳ Phase 5: Storage Module
**Status**: Not started
**Purpose**: EigenDA integration for decentralized document storage (legal docs, certificates, audit reports for RWAs)

**Planned Steps (19)**:

#### Phase 5.1: Foundation (Steps 1-5)
1. ⏳ Package setup (package.json, tsconfig.json, folder structure)
2. ⏳ Core types & interfaces (StorageConfig, BlobMetadata, StorageProof, UploadOptions)
3. ⏳ EigenDA client setup (gRPC Disperser or REST Proxy client)
4. ⏳ Database schema (blobs, certificates, retrieval_keys)
5. ⏳ Error handling (StorageError, DisperserError, RetrievalError, BlobNotFoundError)

#### Phase 5.2: Core Operations (Steps 6-11)
6. ⏳ Blob upload (disperse data to EigenDA, handle chunking for large files)
7. ⏳ Status polling (monitor blob dispersal status with retry logic)
8. ⏳ Certificate handling (store DA certificates, verify proofs)
9. ⏳ Blob retrieval (fetch data using DA certificate)
10. ⏳ Metadata storage (associate blobs with RWA tokens, store descriptions)
11. ⏳ Blob expiry tracking (14-day TTL, expiry warnings, re-upload automation)

#### Phase 5.3: Advanced Features (Steps 12-15)
12. ⏳ File chunking (split large documents >1MB into multiple blobs)
13. ⏳ Client-side encryption (encrypt sensitive docs before upload, AES-256-GCM)
14. ⏳ IPFS fallback (optional permanent storage for critical documents)
15. ⏳ Document versioning (track multiple versions of same document, diff support)

#### Phase 5.4: Production Ready (Steps 16-19)
16. ⏳ Local blob cache (cache retrieved blobs to avoid redundant fetches)
17. ⏳ Query methods (getBlobByToken, getBlobsByAddress, searchByMetadata)
18. ⏳ Integration with Bridge & Core SDK (auto-store transaction receipts)
19. ⏳ Package exports, StorageModule, docs & examples

**Key Technical Decisions**:
- **EigenDA Proxy (REST API)**: Simpler than gRPC, handles payment state & polling automatically
- **Blob Storage Duration**: 14 days on EigenDA (temporary DA, not permanent)
- **Large Files**: Chunking strategy for files >1MB (max blob size varies by network)
- **Encryption**: Client-side encryption for sensitive legal documents
- **Metadata**: Store blob-to-RWA token mappings in local SQLite
- **Use Cases**: Legal agreements, audit reports, property certificates, compliance docs

**Supported Operations**:
- Upload documents (PDF, JSON, images)
- Retrieve documents via DA certificate
- List all documents for an RWA token
- Check blob availability status
- Auto-expire and re-upload critical docs

**Architecture**:
```
StorageModule
├── client/         (EigenDA Proxy REST client)
├── disperser/      (blob upload, status polling)
├── retriever/      (blob download, verification)
├── encryption/     (AES-256-GCM encryption/decryption)
├── chunking/       (split/merge large files)
├── database/       (blob metadata, certificates, keys)
├── cache/          (local blob cache for performance)
└── query/          (search blobs by token, address, metadata)
```

**Database Schema**:
- `blobs`: blob_id, rwa_token_address, da_certificate, upload_date, expiry_date, file_size, file_type
- `certificates`: certificate_hash, blob_commitment, disperser_id, batch_id, batch_header_hash
- `retrieval_keys`: blob_id, encryption_key (encrypted), iv, metadata (JSON)
- `blob_metadata`: blob_id, title, description, version, tags (JSON), uploader_address

**EigenDA Blob Lifecycle**:
1. Client submits blob to disperser (via REST API)
2. Disperser encodes blob and disperses to operators
3. Operators store blob chunks and sign attestations
4. Disperser aggregates signatures and returns DA certificate
5. Client stores certificate in database
6. To retrieve: Submit certificate → disperser returns blob
7. After 14 days: Blob expires, must re-upload if needed

**API Integration**:
- **Endpoint**: `https://disperser-holesky.eigenda.xyz` (testnet)
- **Methods**:
  - POST /dispersal - Upload blob, returns certificate
  - GET /status/:requestID - Check dispersal status
  - GET /retrieval/:certificate - Download blob
- **Auth**: API key required for mainnet
- **Limits**: ~10 MB/s throughput (100+ MB/s coming mid-2026)

### ⏳ Phase 6: CLI Module
**Status**: Not started

## Key Learnings

### Gas Module Implementation
1. **Mantle Gas Structure**: Two fees (L2 execution + L1 data)
2. **Gas Oracle**: Predeployed at `0x420000000000000000000000000000000000000F`
3. **Withdrawal Process**: 3 phases (Initiate, Prove, Finalize) taking ~12 hours (Mantle uses ZK proofs via OP Succinct)
4. **Transaction Serialization**: Must include gasPrice for legacy tx serialization
5. **Test Addresses**: Must be valid 40-char hex for viem validation

### User Preferences
- Removed `compareGasCosts()` function (user feedback: not needed)
- Focus on practical, production-ready code
- Comprehensive documentation preferred
- Real-world examples valued

## Important Addresses

### Mantle Sepolia (Testnet)
- Chain ID: 5003
- RPC: https://rpc.sepolia.mantle.xyz
- L1: Ethereum Sepolia (11155111)
- Gas Oracle: 0x420000000000000000000000000000000000000F

### Mantle Mainnet
- Chain ID: 5000
- RPC: https://rpc.mantle.xyz
- L1: Ethereum Mainnet (1)
- Gas Oracle: 0x420000000000000000000000000000000000000F

## Git Status
**Branch**: main
**Modified Files**:
- packages/core/src/SDK.ts
- packages/gas/src/GasModule.ts
- packages/gas/src/index.ts

**New Files**:
- packages/gas/README.md
- packages/gas/examples/
- packages/gas/src/GasModule.test.ts
- test-gas-module.ts
- packages/gas/test-integration.ts

**Not Yet Committed**: Gas Module work (ready for commit when user confirms)

## Next Steps
1. **Option A**: Commit Gas Module work
2. **Option B**: Start Phase 3 (Indexer Module)
3. **Option C**: Test Gas Module on real network
4. **Option D**: Continue with remaining modules

## Developer Notes
- All code uses TypeScript with strict type checking
- Testing with vitest (25/25 tests passing)
- Documentation follows clear structure with examples
- Integration tests available for real network validation
- User prefers not using emojis in code unless requested

---
**Last Updated**: 2026-01-03
**Completion**: 3/6 phases (50%)
