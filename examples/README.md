# RWA Lifecycle SDK - Examples

This directory contains end-to-end examples demonstrating real-world usage scenarios of the RWA Lifecycle SDK.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp ../.env.example .env

# Edit .env with your values
nano .env

# Run an example
pnpm example:deposit
```

## Examples Overview

### 1. Complete Deposit Workflow (`01-complete-deposit-workflow.ts`)
**Full L1 → L2 deposit flow with gas estimation and compliance checks**

Demonstrates:
- SDK initialization with configuration
- Gas cost estimation before bridging
- ERC3643 compliance verification
- ERC20 token deposit to L2
- Transaction tracking and confirmation

**Use case**: Production-ready deposit implementation with all safety checks

### 2. Complete Withdrawal Workflow (`02-complete-withdrawal-workflow.ts`)
**Full 3-phase L2 → L1 withdrawal with automated tracking**

Demonstrates:
- Phase 1: Initiate withdrawal on L2 (burn tokens)
- Phase 2: Prove withdrawal on L1 (after challenge period)
- Phase 3: Finalize withdrawal on L1 (unlock tokens)
- Automated status tracking and waiting
- Complete cost breakdown for all phases

**Use case**: Production withdrawal implementation with proper phase management

### 3. Transaction Monitoring (`03-monitor-transactions.ts`)
**Real-time transaction monitoring and event subscriptions**

Demonstrates:
- Indexer initialization and real-time syncing
- Event subscriptions (deposits, withdrawals)
- Transaction history queries
- Pending withdrawal tracking
- User transaction filtering

**Use case**: Building dashboards and monitoring tools

### 4. Batch Operations (`04-batch-operations.ts`)
**Efficient batch processing for multiple tokens**

Demonstrates:
- Batch gas estimation for multiple tokens
- Sequential deposit processing
- Parallel compliance checks
- Error handling for partial failures
- Cost optimization strategies

**Use case**: Processing multiple assets efficiently

## Module-Specific Examples

For detailed module-specific examples, see:
- **Gas Module**: [`packages/gas/examples/`](../packages/gas/examples/)
- **Indexer Module**: [`packages/indexer/examples/`](../packages/indexer/examples/)
- **Core SDK**: [`packages/core/examples/`](../packages/core/examples/)
- **Bridge Module**: [`packages/bridge/examples/`](../packages/bridge/examples/)
- **Compliance Module**: [`packages/compliance/examples/`](../packages/compliance/examples/)

## Environment Variables

Create a `.env` file in this directory with:

```bash
# RPC Endpoints
L1_RPC_URL=https://eth-sepolia.public.blastapi.io
L2_RPC_URL=https://rpc.sepolia.mantle.xyz

# Private Key (for write operations)
PRIVATE_KEY=0x...

# Bridge Addresses (Sepolia Testnet)
L1_BRIDGE_ADDRESS=0x21F308067241B2028503c07bd7cB3751FFab0Fb2
L2_BRIDGE_ADDRESS=0x4200000000000000000000000000000000000010

# Test Token Addresses (replace with your tokens)
L1_TOKEN_ADDRESS=0x...
L2_TOKEN_ADDRESS=0x...
```

## Running Examples

Each example can be run independently:

```bash
# Deposit example
pnpm example:deposit

# Withdrawal example
pnpm example:withdraw

# Monitor transactions
pnpm example:monitor

# Batch operations
pnpm example:batch
```

## Safety Notes

⚠️ **Important**:
- These examples use **Sepolia testnet** by default
- Never commit your `.env` file or private keys
- Test thoroughly on testnet before using on mainnet
- Review gas estimates before confirming transactions
- Withdrawals take 7+ days on mainnet (challenge period)

## Network Information

### Sepolia Testnet (Default)
- **Ethereum Sepolia**: Chain ID 11155111
- **Mantle Sepolia**: Chain ID 5003
- **Bridge Contracts**: See `.env.example`

### Mainnet (Production)
- **Ethereum Mainnet**: Chain ID 1
- **Mantle Mainnet**: Chain ID 5000
- **Bridge Contracts**: Verify official addresses at [docs.mantle.xyz](https://docs.mantle.xyz)

## Need Help?

- **Documentation**: See main [README.md](../README.md)
- **API Reference**: See [packages/core/README.md](../packages/core/README.md)
- **Issues**: Report at GitHub issues

---

**Built for Mantle Hackathon 2026** • MIT License
