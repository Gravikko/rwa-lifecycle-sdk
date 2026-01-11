# Phase 6: CLI Module - Implementation Plan

**Status**: ✅ COMPLETE (All 6 phases)
**Target**: Build a production-ready command-line interface for the RWA Lifecycle SDK

---

## Overview

The CLI module wraps the Core SDK convenience methods in an interactive command-line tool. It enables non-developers to perform bridge operations, estimate gas, check compliance, and track withdrawals without writing code.

**Dependencies**:
- `@rwa-lifecycle/core` - All SDK functionality
- `commander` - CLI framework (already in package.json)
- `chalk` - Terminal colors
- `dotenv` - Environment loading

---

## Phase 6.1: CLI Foundation & Setup - ✅ COMPLETE

### Objectives
- ✅ Initialize CLI package with base structure
- ✅ Implement configuration file management
- ✅ Create SDK initialization from CLI config
- ✅ Set up error handling and logging

### Deliverables
- ✅ `packages/cli/src/index.ts` - CLI entry point with commands
- ✅ `packages/cli/src/config.ts` - Config file management (`.env`, `.rwa-config.json`)
- ✅ `packages/cli/src/logger.ts` - Colored logging with chalk
- ✅ `packages/cli/src/utils/formatter.ts` - Output formatting utilities
- ✅ `packages/cli/src/utils/errorHandler.ts` - Error handling with suggestions
- ✅ CLI binary: `rwa` and `rwa-cli`

### Commands Implemented
- ✅ `rwa init` - Initialize CLI, create config files
- ✅ `rwa config get [key]` - Show configuration value(s)
- ✅ `rwa config set <key> <value>` - Update config
- ✅ `rwa config validate` - Validate configuration
- ✅ `rwa config path` - Show config file paths
- ✅ `rwa status` - Show SDK status and readiness
- ✅ `rwa --help` - Show all commands
- ✅ `rwa --version` - Show CLI version
- ✅ `rwa --json` - Output in JSON format
- ✅ `rwa --debug` - Enable debug output
- ✅ `rwa --quiet` - Suppress non-essential output

### Features Implemented
- Configuration loading from .env, .rwa-config.json, environment variables
- Config priority: CLI flags > env vars > .env file > config file > defaults
- Sensitive key masking (privateKey shown as ***)
- Error messages with actionable suggestions
- JSON output mode for scripting
- Colored terminal output with status icons

---

## Phase 6.2: Gas Estimation Commands - ✅ COMPLETE

### Objectives
- ✅ Implement gas estimation commands for all bridge operations
- ✅ Format costs in readable formats (ETH)
- ✅ Support both ERC20 and ERC721 tokens

### Deliverables
- ✅ `packages/cli/src/commands/estimate.ts` - Estimation command handler
- ✅ `packages/cli/src/sdk.ts` - SDK initialization helper

### Commands Implemented
```bash
rwa estimate-deposit-erc20 <token> <amount>
  --to <address>       (optional recipient)
  --l2-token <address> (optional L2 token address)

rwa estimate-deposit-erc721 <token> <tokenId>
  --to <address>       (optional recipient)
  --l2-token <address> (optional L2 token address)

rwa estimate-withdrawal-erc20 <token> <amount>
  --to <address>       (optional recipient)
  --l1-token <address> (optional L1 token address)
  --full               (show full 3-phase withdrawal cost)

rwa estimate-withdrawal-erc721 <token> <tokenId>
  --to <address>       (optional recipient)
  --l1-token <address> (optional L1 token address)
  --full               (show full 3-phase withdrawal cost)

rwa estimate
  (show help and examples for all estimation commands)
```

### Aliases
- `estimate-deposit-nft` → `estimate-deposit-erc721`
- `estimate-withdraw-erc20` → `estimate-withdrawal-erc20`
- `estimate-withdraw-nft` → `estimate-withdrawal-erc721`

### Output Format
```
Gas Estimation Results
═══════════════════════════════════════
Token Address:     0x1234...
Amount:            1000 units
Operation:         Deposit (ERC20)

Costs:
─────────────────────────────────────
L2 Execution:      0.0012 ETH (~$3.50)
L1 Data Fee:       0.0005 ETH (~$1.50)
─────────────────────────────────────
Total:             0.0017 ETH (~$5.00)

Safety Buffer:     10% (+0.00017 ETH)
Recommended:       0.00187 ETH (~$5.50)
```

### Tests
- Cost estimation for each operation type
- Output formatting
- Currency conversion (if implemented)

---

## Phase 6.3: Bridge Operation Commands - ✅ COMPLETE

### Objectives
- ✅ Implement commands for all bridge operations (deposit, withdrawal phases)
- ✅ Show transaction tracking and status
- ✅ Support ERC20 and ERC721

### Deliverables
- ✅ `packages/cli/src/commands/bridge.ts` - Bridge operation handlers
- ✅ Transaction result formatting with explorer links

### Commands Implemented
```bash
# Deposits (L1 → L2)
rwa deposit-erc20 <token> <amount> [--to <address>]
rwa deposit-erc721 <token> <tokenId> [--to <address>]

# Withdrawals (L2 → L1, 3-phase process)
rwa withdraw-erc20 <token> <amount> [--to <address>]
rwa withdraw-erc721 <token> <tokenId> [--to <address>]
rwa prove-withdrawal <txHash>
rwa finalize-withdrawal <txHash>

# Help
rwa bridge (show all bridge commands)
```

### Aliases
- `deposit-nft` → `deposit-erc721`
- `withdraw-nft` → `withdraw-erc721`
- `initiate-withdrawal-erc20` → `withdraw-erc20`

### Features
- Beautiful transaction result display with colored boxes
- Explorer links (Etherscan for L1, Mantlescan for L2)
- Progress indicators for withdrawal phases
- Clear next-step guidance after each phase
- JSON output mode for scripting

---

## Phase 6.4: Compliance Check Commands - ✅ COMPLETE

### Objectives
- ✅ Check compliance before executing transfers
- ✅ List and manage compliance plugins
- ✅ Show detailed compliance results

### Deliverables
- `packages/cli/src/commands/compliance.ts` - Compliance check handlers

### Commands
```bash
rwa check-compliance <token> <from> <to> <amount>
  --simulate (optional: simulate transfer first)

rwa list-plugins
  Show registered compliance plugins

rwa plugin-info <pluginName>
  Show plugin details and requirements
```

### Output Format
```
Compliance Check Results
═══════════════════════════════════════
Token:             0x1234... (USDC)
Standard:          ERC3643 (T-REX)
From:              0xaaaa... (Verified: ✓)
To:                0xbbbb... (Verified: ✓)
Amount:            1000

Checks:
─────────────────────────────────────
canTransfer():     ✓ PASS
Identity Registry: ✓ Both identities verified
Custom Plugins:    ✓ Whitelist verified

Result:            ✓ COMPLIANT - Transfer allowed
```

### Tests
- ERC3643 compliance checks
- Plugin execution
- Non-compliant scenarios

---

## Phase 6.5: Indexer Query Commands - ✅ COMPLETE

### Objectives
- ✅ Query transaction history
- ✅ Track withdrawal progress
- ✅ Show pending withdrawals
- ✅ Display withdrawal timeline

### Deliverables
- `packages/cli/src/commands/indexer.ts` - Indexer query handlers

### Commands
```bash
rwa list-transactions
  --user <address> (optional filter)
  --type <deposit|withdrawal> (optional filter)
  --token <address> (optional filter)
  --limit <number> (default: 10)
  --offset <number> (default: 0)

rwa track-withdrawal <txHash>
  Show detailed withdrawal status and timeline

rwa list-pending-withdrawals
  Show all non-finalized withdrawals

rwa get-withdrawal-timeline <txHash>
  Show initiated → proven → finalized timeline
```

### Output Format
```
Transaction History
═══════════════════════════════════════
Showing 5 of 23 transactions

1. Deposit
   Token:      0x1234... (USDC)
   Amount:     1000
   Hash:       0xaaaa...
   Time:       2 hours ago
   Status:     ✓ Success

2. Withdrawal (Initiated)
   Token:      0x5678... (USDT)
   Amount:     500
   Hash:       0xbbbb...
   Time:       30 minutes ago
   Status:     ⏳ Pending proof (ETA: ~1 hour)

────────────────────────────────────
Page 1 of 3 | Use --offset 5 for next page
```

### Withdrawal Status Output
```
Withdrawal Status
═══════════════════════════════════════
Transaction Hash:  0xaaaa...
Token:             0x1234...
Amount:            1000

Progress:
─────────────────────────────────────
Phase 1: Initiated    ✓ 2026-01-10 14:30 UTC
Phase 2: Proven       ⏳ Ready now (submit proof)
Phase 3: Finalized    ⏳ Ready at 2026-01-10 22:30 UTC

Current Phase:       2/3 (Proven)
Next Action:         Run: rwa prove-withdrawal 0xaaaa...
Estimated Completion: ~8 hours 10 minutes
```

### Tests
- Transaction queries with filtering
- Pagination
- Withdrawal status calculation
- Timeline formatting

---

## Phase 6.6: Interactive Mode & Polish - ✅ COMPLETE

### Objectives
- ✅ Build interactive workflow for common operations
- ✅ Add progress indicators and better error messages
- ✅ Command aliases and shortcuts
- ✅ Help system enhancements

### Deliverables
- `packages/cli/src/commands/interactive.ts` - Interactive mode handler
- Enhanced error messages with suggestions
- Progress spinners for long operations
- Examples and quick-start guide

### Features

#### Interactive Workflow
```bash
rwa interactive
# Launches guided workflow:
# 1. "What would you like to do?" → Bridge / Estimate / Track / Check Compliance
# 2. "Deposit or Withdrawal?" → Deposit / Withdrawal
# 3. "Token type?" → ERC20 / ERC721
# 4. "Token address?" → [input]
# 5. "Amount?" → [input]
# 6. Review and confirm
# 7. Execute (with progress spinner)
# 8. Show result
```

#### Aliases
```bash
rwa est-dep20     # estimate-deposit-erc20
rwa est-dep721    # estimate-deposit-erc721
rwa est-wd20      # estimate-withdrawal-erc20
rwa est-wd721     # estimate-withdrawal-erc721
rwa dep20         # deposit-erc20
rwa dep721        # deposit-erc721
rwa init-wd       # initiate-withdrawal
rwa prove         # prove-withdrawal
rwa finalize      # finalize-withdrawal
rwa comp          # check-compliance
rwa txs           # list-transactions
rwa track         # track-withdrawal
rwa pending       # list-pending-withdrawals
rwa timeline      # get-withdrawal-timeline
```

#### Error Messages with Suggestions
```
Error: Insufficient balance
────────────────────────────────────
Your wallet has 100 USDC but need 1000 USDC.

Suggestions:
- Bridge more tokens from L1: rwa deposit-erc20 0x... 1000
- Check wallet balance: rwa balance
- Use a different token with more balance
```

#### Progress Indicators
```
Executing deposit... ⠋ (Waiting for transaction...)
Executing deposit... ⠙ (Block 12345)
Executing deposit... ⠹ (Block 12346)
Executing deposit... ✓ Success

Transaction: 0xabcd...
Confirmed in: 2 blocks
Time elapsed: 34 seconds
```

### Tests
- Interactive prompt responses
- Alias resolution
- Error message quality
- Progress indicator rendering

---

## Success Criteria

### Minimum Viable Product (MVP)
- ✓ All 6 sub-phases implemented
- ✓ All commands functional and tested
- ✓ Configuration system working
- ✓ Basic error handling
- ✓ ~50+ tests passing

### Stretch Goals
- ✓ Interactive mode with guided workflows
- ✓ Tab completion / autocomplete
- ✓ Transaction result links to Etherscan
- ✓ USD price conversion for gas estimates
- ✓ Export transaction history (CSV, JSON)
- ✓ Configuration validation
- ✓ Multiple wallet support / account switching

---

## File Structure

```
packages/cli/
├── src/
│   ├── index.ts                 # Entry point, commander setup
│   ├── config.ts                # Config file management
│   ├── logger.ts                # Logging setup
│   ├── commands/
│   │   ├── estimate.ts          # Gas estimation commands (6.2)
│   │   ├── bridge.ts            # Bridge operation commands (6.3)
│   │   ├── compliance.ts        # Compliance check commands (6.4)
│   │   ├── indexer.ts           # Indexer query commands (6.5)
│   │   └── interactive.ts       # Interactive mode (6.6)
│   ├── utils/
│   │   ├── formatter.ts         # Output formatting
│   │   ├── spinner.ts           # Progress indicators
│   │   └── errorHandler.ts      # Error handling & suggestions
│   └── __tests__/
│       ├── cli.test.ts          # Integration tests
│       ├── commands/
│       │   ├── estimate.test.ts
│       │   ├── bridge.test.ts
│       │   ├── compliance.test.ts
│       │   ├── indexer.test.ts
│       │   └── interactive.test.ts
│       └── mocks.ts             # Test mocks
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## Dependencies

**Already in package.json**:
- `commander` - CLI framework
- `pino` - Logging
- `@rwa-lifecycle/core` - SDK

**New installations**:
- `ora` - Progress spinners
- `prompts` - Interactive prompts (if adding interactive mode)
- `chalk` - Terminal colors (optional, for better output)

---

## Next Steps

1. **Start with 6.1** - Create CLI foundation and config system
2. **Build commands incrementally** - 6.2 → 6.3 → 6.4 → 6.5
3. **Polish and testing** - 6.6 with interactive mode and better UX
4. **Documentation** - README.md with examples and usage guide

---

## Related Documentation

- `PROJECT_STATUS.md` - Overall project progress
- `packages/core/README.md` - Core SDK API reference
- `packages/gas/README.md` - Gas module details
- `packages/compliance/README.md` - Compliance module details
- `packages/indexer/README.md` - Indexer module details
