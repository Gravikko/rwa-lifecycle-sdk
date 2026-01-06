# RWA Lifecycle SDK - Project Context

> **IMPORTANT**: Claude, always read this file first when resuming work on this project.

## Project Overview
Building a comprehensive SDK for managing Real-World Asset (RWA) tokenization lifecycle on Mantle L2.

**Hackathon**: Mantle Hackathon
**Goal**: Production-ready SDK for RWA management (bridging, gas estimation, compliance, indexing)

## Architecture
Monorepo structure with 6 packages:
- `@rwa-lifecycle/core` - Main SDK orchestrator
- `@rwa-lifecycle/bridge` - L1 ↔ L2 bridging (ERC20 & ERC721)
- `@rwa-lifecycle/gas` - Gas cost estimation
- `@rwa-lifecycle/indexer` - Event indexing
- `@rwa-lifecycle/compliance` - KYC/AML
- `@rwa-lifecycle/cli` - Command-line interface

## Implementation Plan (7 Phases)

### ✅ Phase 1: Foundation (COMPLETED)
- Monorepo setup (Turborepo + pnpm workspaces)
- TypeScript configuration for all packages
- 6 package scaffolds (core, bridge, gas, indexer, compliance, cli)
- Foundry smart contracts setup
- TestRWA.sol (ERC-721) contract
- Comprehensive documentation (README, GETTING_STARTED, architecture)

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
- Event types: All bridge events (ERC20 + ERC721 deposits/withdrawals)
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

### ✅ Phase 4: Compliance Module (COMPLETED - 100%)
**Status**: Production-ready with full test coverage (53/53 tests passing)
**Purpose**: On-chain compliance verification for RWA tokens (ERC3643 & custom implementations)

**Scope - What We're Building:**
1. ✅ **ERC3643 Support** - Built-in checker for standard compliance interface
2. ✅ **Plugin Adapter** - Users provide custom compliance logic for non-standard tokens
3. ✅ **Auto-detect Token Standard** - Detect if token is ERC3643, ERC20, or ERC721
4. ✅ **Transfer Simulation** - Test if transfer will succeed before executing

**NOT Building:**
- ❌ Off-chain KYC/AML providers (Chainalysis, Sumsub, etc.)
- ❌ Sanctions screening APIs (OFAC/UN) - these are off-chain
- ❌ Auto-detection of custom modifiers (impossible - no standard)

**Completed Steps (12/12)**:

#### Phase 4.1: Foundation (Steps 1-3) ✅ COMPLETE
1. ✅ Package setup (package.json, tsconfig.json, folder structure)
2. ✅ Core types & interfaces (ComplianceConfig, TokenStandard enum, ComplianceResult)
3. ✅ Error handling (ComplianceError, TokenNotSupportedError, SimulationError, etc.)

#### Phase 4.2: ERC3643 Support (Steps 4-6) ✅ COMPLETE
4. ✅ ERC3643 ABI definitions (canTransfer, isVerified, identityRegistry)
5. ✅ ERC3643 checker implementation (detect interface, call compliance functions)
6. ✅ Identity Registry integration (read on-chain verification status)

#### Phase 4.3: Plugin System (Steps 7-9) ✅ COMPLETE
7. ✅ Plugin interface (ICompliancePlugin for custom token logic)
8. ✅ Plugin adapter (register and execute custom checks)
9. ✅ Built-in plugins (BlacklistPlugin, WhitelistPlugin with multiple variants)

#### Phase 4.4: Advanced Features (Steps 10-12) ✅ COMPLETE
10. ✅ Auto-detect token standard (check if ERC3643, ERC20, ERC721)
11. ✅ Transfer simulation (staticCall to test before executing)
12. ✅ Package exports, ComplianceModule, comprehensive tests (53/53 passing)

**Key Technical Decisions**:
- **On-Chain Only**: All compliance checks read from blockchain (no off-chain APIs)
- **Standard Support**: Native ERC3643 interface support
- **Plugin System**: Extensible for custom token compliance logic
- **Standard Detection**: Auto-detect token type (ERC3643, ERC20, ERC721)
- **Simulation First**: Test transfers before execution to prevent failures
- **No Database**: Stateless module, reads directly from blockchain

**Supported Token Types**:
- ERC3643 (T-REX standard) - Built-in support
- Custom compliance tokens - Via plugin system
- Plain ERC20/ERC721 - Via custom plugins

### Files Created/Modified
- ✅ `packages/compliance/src/types.ts` - Type definitions
- ✅ `packages/compliance/src/errors.ts` - Error classes
- ✅ `packages/compliance/src/erc3643/abi.ts` - ERC3643 ABIs
- ✅ `packages/compliance/src/erc3643/detector.ts` - ERC3643 detection
- ✅ `packages/compliance/src/erc3643/checker.ts` - Compliance checking
- ✅ `packages/compliance/src/erc3643/registry.ts` - Identity Registry
- ✅ `packages/compliance/src/plugins/adapter.ts` - Plugin system
- ✅ `packages/compliance/src/plugins/examples/BlacklistPlugin.ts` - Example plugin
- ✅ `packages/compliance/src/plugins/examples/WhitelistPlugin.ts` - Example plugin
- ✅ `packages/compliance/src/detector/standardDetector.ts` - Standard detection
- ✅ `packages/compliance/src/simulation/simulator.ts` - Transfer simulation
- ✅ `packages/compliance/src/ComplianceModule.ts` - Main module
- ✅ `packages/compliance/src/__tests__/` - 5 test files, 53 tests

**Architecture**:
```
ComplianceModule
├── erc3643/        (Standard ERC3643 interface support)
│   ├── detector.ts (Check if token implements ERC3643)
│   ├── checker.ts  (Call canTransfer, isVerified)
│   └── registry.ts (Identity Registry integration)
├── plugins/        (Custom token compliance)
│   ├── ICompliancePlugin.ts (Plugin interface)
│   ├── adapter.ts  (Plugin registration & execution)
│   └── examples/   (Built-in plugin examples)
├── simulation/     (Transfer testing)
│   └── simulator.ts (staticCall transfer simulation)
└── detector/       (Token standard detection)
    └── standardDetector.ts (ERC3643/ERC20/ERC721)
```

**Compliance Flow**:
1. Detect token standard (ERC3643, custom, or plain)
2. If ERC3643: Call `canTransfer()` directly
3. If custom: Execute user-provided plugin
4. Simulate transfer to verify success
5. Return compliance result (pass/fail with reason)
6. SDK proceeds with bridge transaction only if compliant

### ⏳ Phase 5: Core Module Integration
**Status**: Not started
**Purpose**: Wire all modules together into unified SDK

**Current State**:
- ✅ Package dependencies defined
- ✅ Gas Module integrated
- ❌ Bridge, Indexer, Compliance commented out
- ❌ No convenience methods
- ❌ No integration tests

**Planned Steps (12)**:

#### Phase 5.1: Configuration & Types (Steps 1-3)
1. ⏳ Update SDKConfig interface (add Bridge/Indexer/Compliance config)
2. ⏳ Update config.ts defaults (bridge addresses, database path, network)
3. ⏳ Type compatibility check (merge duplicate types)

#### Phase 5.2: Module Initialization (Steps 4-7)
4. ⏳ Initialize BridgeModule (wallet clients, contract addresses)
5. ⏳ Initialize IndexerModule (RPC URLs, database path, auto-start option)
6. ⏳ Initialize ComplianceModule (L2 client, network)
7. ⏳ Verify GasModule integration (consistency check)

#### Phase 5.3: Convenience Methods (Steps 8-10)
8. ⏳ Add `bridgeWithCompliance()` method (check then bridge)
9. ⏳ Add `estimateAndBridge()` method (estimate, check, bridge)
10. ⏳ Add indexer convenience methods (getMyTransactions, trackWithdrawal)

#### Phase 5.4: Testing & Documentation (Steps 11-12)
11. ⏳ Integration tests (SDK initialization, module coordination, 10-15 tests)
12. ⏳ Update README (complete examples, convenience methods, configuration)

**Key Technical Decisions**:
- **Module Orchestration**: Core initializes all modules with shared clients
- **Convenience Layer**: High-level methods combining multiple modules
- **Optional Dependencies**: Modules can be used independently or via Core
- **Configuration Merging**: Smart defaults + user overrides
- **Error Propagation**: Clear error messages from each module

### ⏳ Phase 6: CLI Module
**Status**: Not started
**Purpose**: Command-line interface for SDK (no-code usage)

**Current State**:
- ✅ Package scaffold exists
- ❌ No CLI framework setup
- ❌ No commands implemented
- ❌ No configuration system

**Planned Steps (16)**:

#### Phase 6.1: Foundation (Steps 1-4)
1. ⏳ Package setup (dependencies: commander, chalk, ora, inquirer)
2. ⏳ CLI entry point (bin script, argument parsing)
3. ⏳ Configuration system (.rwarc file, env variables)
4. ⏳ Logging and error handling (structured output, debug mode)

#### Phase 6.2: Core Commands (Steps 5-8)
5. ⏳ `init` command (setup wizard, create .rwarc)
6. ⏳ `config` command (view/edit configuration)
7. ⏳ `version` command (show version info)
8. ⏳ `help` command (enhanced help with examples)

#### Phase 6.3: Module Commands (Steps 9-12)
9. ⏳ Gas commands (`gas estimate <token> <amount>`, `gas compare`)
10. ⏳ Bridge commands (`bridge deposit`, `bridge withdraw`, `bridge status <txHash>`)
11. ⏳ Compliance commands (`compliance check`, `compliance register-plugin`)
12. ⏳ Indexer commands (`indexer start`, `indexer query`, `indexer stop`)

#### Phase 6.4: UX & Polish (Steps 13-16)
13. ⏳ Interactive prompts (inquirer for missing params)
14. ⏳ Progress indicators (ora spinners for async operations)
15. ⏳ Output formatting (--json flag, table formatting with cli-table3)
16. ⏳ Complete README (installation, all commands, examples)

**Key Technical Decisions**:
- **Framework**: Commander.js for command parsing
- **Config File**: `.rwarc` JSON file in project root
- **Interactive Mode**: Inquirer.js prompts for missing params
- **Output**: Chalk for colors, cli-table3 for tables, ora for spinners
- **SDK Integration**: CLI wraps Core SDK with user-friendly interface
- **Error Handling**: Clear error messages, exit codes, debug mode

**CLI Structure**:
```
rwa init                          # Setup wizard
rwa config [get|set] <key>        # Manage configuration

rwa gas estimate <token> <amount> # Estimate gas cost
rwa gas compare deposit withdraw  # Compare operation costs

rwa bridge deposit <token> <amount>       # Deposit to L2
rwa bridge withdraw <token> <amount>      # Withdraw to L1
rwa bridge status <txHash>                # Check withdrawal status

rwa compliance check <token> <from> <to>  # Check compliance
rwa compliance detect <token>             # Detect token standard

rwa indexer start                 # Start event syncing
rwa indexer query --user <address> --type deposit  # Query events
rwa indexer stop                  # Stop syncing
```

**Configuration File** (`.rwarc`):
```json
{
  "network": "testnet",
  "l1RpcUrl": "https://eth-sepolia.public.blastapi.io",
  "l2RpcUrl": "https://rpc.sepolia.mantle.xyz",
  "privateKey": "env:PRIVATE_KEY",
  "indexerDbPath": "./.rwa-data/indexer.db"
}
```

### ⏳ Phase 7: Relayer Service
**Status**: Not started
**Purpose**: Automated withdrawal finalization service

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

## Uncommitted Changes

**Branch**: main

**Modified Files**:
- .env.example
- CHECKLIST.md
- PROJECT_CONTEXT.md
- PROJECT_STATUS.md
- docs/architecture.md
- packages/core/package.json
- packages/core/src/config.ts
- packages/core/src/types.ts

**Complete Implementations** (Ready to commit):
- ✅ Phase 2: Gas Module (all files complete, 25/25 tests passing)
- ✅ Phase 3: Indexer Module (all files complete)
- ✅ Phase 4: Compliance Module (all files complete, 53/53 tests passing)

## Next Steps
1. **Option A**: Commit Phases 2-4 work
2. **Option B**: Start Phase 5 (Core Module Integration)
3. **Option C**: Test on Mantle Sepolia testnet
4. **Option D**: Start Phase 6 (CLI Module)
5. **Option E**: Start Phase 7 (Relayer Service)

## Developer Notes
- All code uses TypeScript with strict type checking
- Testing with vitest (Gas: 25/25, Compliance: 53/53 tests passing)
- Documentation follows clear structure with examples
- Integration tests available for real network validation
- User prefers not using emojis in code unless requested

## Current State Summary

### What's Working Now
1. **Gas Module** - Fully functional cost estimation
   - L2 execution fee calculation
   - L1 data fee calculation (RLP serialization)
   - 3-phase withdrawal cost aggregation
   - 25/25 tests passing

2. **Indexer Module** - Event tracking & querying
   - SQLite database with full schema
   - Real-time event syncing (12-second intervals)
   - Transaction history queries
   - Withdrawal status tracking
   - User/token filtering & pagination

3. **Compliance Module** - On-chain compliance verification
   - ERC3643 standard support (canTransfer, isVerified)
   - Identity Registry integration
   - Plugin system for custom compliance logic
   - Token standard auto-detection
   - Transfer simulation (staticCall)
   - 53/53 tests passing

4. **Core SDK** - Main orchestrator
   - L1/L2 client initialization
   - Module coordination
   - Configuration management
   - Exports Gas, Indexer, Compliance modules

### What to Build Next
- **Phase 5**: Core Module Integration (wire all modules together)
- **Phase 6**: CLI Tool (command-line interface)
- **Phase 7**: Relayer Service (auto-finalization)

### Testing & Deployment
- Test on Mantle Sepolia (https://rpc.sepolia.mantle.xyz)
- Verify with Bridge Module examples
- Create integration examples combining all modules

---
**Last Updated**: 2026-01-06
**Completion**: 4/7 phases (57%)
**Status**: Phases 1-4 complete. Bridge, Gas, Indexer & Compliance modules production-ready. Phase 5 (Core Integration) next.
