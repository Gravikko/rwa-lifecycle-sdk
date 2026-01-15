# RWA Lifecycle SDK

> TypeScript SDK for bridging Real-World Asset tokens between Ethereum L1 and Mantle L2

## Overview

Complete SDK for bridging tokenized real-world assets (RWAs) to Mantle L2. Supports gas estimation, compliance verification, transaction tracking, and automated withdrawal finalization.

**Features:**
- Bridge ERC20 & ERC721 tokens (L1 ↔ L2)
- Accurate gas estimation (L2 execution + L1 data fees)
- SQLite event indexing & transaction history
- ERC3643 compliance verification + custom plugins
- CLI with 40+ commands
- Automated relayer for withdrawal finalization

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/rwa-lifecycle-sdk.git
cd rwa-lifecycle-sdk

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

**Note:**
- **Tests** (`pnpm test`) are fully mocked - no `.env` needed
- **Examples** execute real transactions - requires `.env` with `PRIVATE_KEY` and testnet funds
- **SDK read-only operations** (gas estimation, status checks) work without `.env`

## Quick Start

### Basic Usage

```typescript
import { RWALifecycleSDK } from '@rwa-lifecycle/core';

// Initialize SDK
const sdk = new RWALifecycleSDK({
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
  privateKey: '0x...', // optional for read-only
});

// Estimate gas cost
const estimate = await sdk.estimateAndBridge({
  tokenAddress: '0x...',
  amount: BigInt(100 * 10**18),
  direction: 'deposit',
  dryRun: true,
});
console.log(`Cost: ${estimate.estimate.formattedInETH} ETH`);

// Bridge with compliance check
const result = await sdk.bridgeWithCompliance({
  tokenAddress: '0x...',
  amount: BigInt(100 * 10**18),
  direction: 'deposit',
});

// Track transactions
const txs = await sdk.getMyTransactions({ type: 'deposit' });
```

### CLI Usage

```bash
# Run CLI from the monorepo
pnpm --filter @rwa-lifecycle/cli start

# Or use the built CLI directly
cd packages/cli
pnpm start

# Initialize configuration
pnpm start init

# Estimate costs
pnpm start estimate-deposit-erc20 0x... 1000

# Bridge tokens
pnpm start deposit-erc20 0x... 1000

# Track withdrawal (3-phase process)
pnpm start track-withdrawal 0x...

# Interactive mode
pnpm start interactive
```

## Packages

| Package | Purpose |
|---------|---------|
| **@rwa-lifecycle/core** | Main SDK orchestrator with convenience methods |
| **@rwa-lifecycle/bridge** | L1 ↔ L2 token bridging (ERC20 & ERC721) |
| **@rwa-lifecycle/gas** | Gas estimation (L2 execution + L1 data fees) |
| **@rwa-lifecycle/indexer** | SQLite event indexing & transaction history |
| **@rwa-lifecycle/compliance** | ERC3643 compliance + custom plugins |
| **@rwa-lifecycle/cli** | Command-line interface (40+ commands) |
| **@rwa-lifecycle/relayer** | Automated withdrawal finalization service |

## Mantle Bridge Explained

### Deposit (L1 → L2)
1. Lock tokens on L1 bridge contract
2. Tokens minted on L2 (~10 minutes)

### Withdrawal (L2 → L1)
1. **Initiate**: Burn tokens on L2
2. **Prove**: Submit ZK proof to L1 (~12 hours wait)
3. **Finalize**: Unlock tokens on L1

**Total time**: ~12 hours

## Security

⚠️ **Hackathon project - use at your own risk**

- Test on Sepolia testnet first
- Verify contract addresses before bridging
- Use hardware wallets for production
- ERC3643 tokens recommended for compliance

## Examples

See the [`/examples`](./examples/) directory for complete working examples:

| Example | Description |
|---------|-------------|
| `01-complete-deposit-workflow.ts` | Full L1→L2 deposit with gas estimation & compliance |
| `02-complete-withdrawal-workflow.ts` | 3-phase L2→L1 withdrawal process |
| `03-monitor-transactions.ts` | Query transactions & track withdrawals |
| `04-batch-operations.ts` | Batch processing multiple tokens |

```bash
cd examples
pnpm install

# Set up environment (requires testnet funds)
cp ../.env.example .env
# Edit .env with your PRIVATE_KEY (wallet with Sepolia ETH)

# Run an example (executes real transactions on testnet)
pnpm example:deposit
pnpm example:withdraw
pnpm example:monitor
pnpm example:batch
```

## Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| Ethereum Sepolia | 11155111 | https://eth-sepolia.public.blastapi.io |
| Mantle Sepolia | 5003 | https://rpc.sepolia.mantle.xyz |
| Ethereum Mainnet | 1 | https://eth.public-rpc.com |
| Mantle Mainnet | 5000 | https://rpc.mantle.xyz |

## License

MIT - Built for Mantle Global Hackathon 2025

---

**Powered by** [Viem](https://viem.sh/) • [Turbo](https://turbo.build/)
