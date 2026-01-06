# RWA Lifecycle SDK

> TypeScript SDK for managing Real-World Asset tokens on Mantle L2

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Foundry](https://img.shields.io/badge/Built%20with-Foundry-FFDB1C.svg)](https://getfoundry.sh/)

## What Does This SDK Do?

This SDK helps you **bridge tokenized real-world assets (RWAs) between Ethereum L1 and Mantle L2**.

If you have an RWA token (property deed, bond, commodity) on Ethereum and want to move it to Mantle L2 for faster/cheaper trading, this SDK automates the entire process.

## Prerequisites

Before using this SDK, you need:

- ✅ An RWA token (ERC20 or ERC721) on Ethereum L1
- ✅ Node.js >= 18
- ✅ ETH for L1 gas fees
- ✅ MNT for L2 gas fees
- ✅ RPC URLs for both L1 (Ethereum) and L2 (Mantle)

## The Workflow

```
1. Check Cost    → How much will bridging cost?
2. Bridge Token  → Move token from L1 to L2 (or L2 to L1)
3. Track History → See all your bridge transactions
4. (Optional) Check Compliance → Verify KYC/AML if required
```

## Quick Start

### Installation

```bash
npm install @rwa-lifecycle/core
# or
pnpm add @rwa-lifecycle/core
```

### Basic Example

```typescript
import { RWALifecycleSDK } from '@rwa-lifecycle/core';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// Initialize SDK
const sdk = new RWALifecycleSDK({
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
  walletClient: createWalletClient({
    account: privateKeyToAccount('0x...'),
    chain: sepolia,
    transport: http(),
  }),
});

// 1. Check how much it will cost
const cost = await sdk.gas.estimateDepositERC20Cost(
  '0x...', // token address
  BigInt(100 * 10**18) // amount
);

console.log(`Total cost: ${cost.totalCostETH} ETH`);
console.log(`L2 execution: ${cost.l2ExecutionFee} ETH`);
console.log(`L1 data fee: ${cost.l1DataFee} ETH`);

// 2. Check if user has enough balance
const hasBalance = await sdk.gas.checkSufficientBalance(
  userAddress,
  cost
);

if (!hasBalance) {
  throw new Error('Insufficient balance');
}

// 3. Execute the bridge (deposit L1 → L2)
// await sdk.bridge.depositERC20(tokenAddress, amount);

// 4. Track transaction history
// const history = await sdk.indexer.getTransactions({
//   user: userAddress,
//   type: 'deposit',
// });
```

## Modules

### Core Modules (Required)

| Module | Purpose | Status |
|--------|---------|--------|
| **@rwa-lifecycle/bridge** | Execute L1 ↔ L2 token transfers | ✅ Complete |
| **@rwa-lifecycle/gas** | Estimate bridge costs | ✅ Complete |
| **@rwa-lifecycle/indexer** | Track transaction history | ✅ Complete |
| **@rwa-lifecycle/compliance** | On-chain compliance verification (ERC3643 & plugins) | ✅ Complete |

### Optional Modules

| Module | Purpose | Status |
|--------|---------|--------|
| **@rwa-lifecycle/cli** | Command-line interface (no coding) | ⏳ Planned |

## Individual Module Usage

### Gas Module

```typescript
import { GasModule } from '@rwa-lifecycle/gas';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const gasModule = new GasModule({
  l1PublicClient: createPublicClient({
    chain: sepolia,
    transport: http('https://eth-sepolia.public.blastapi.io'),
  }),
  l2PublicClient: createPublicClient({
    chain: { id: 5003, name: 'Mantle Sepolia', ... },
    transport: http('https://rpc.sepolia.mantle.xyz'),
  }),
});

// Estimate deposit cost
const depositCost = await gasModule.estimateDepositERC20Cost(
  tokenAddress,
  amount
);

// Estimate complete withdrawal (all 3 phases)
const withdrawalCost = await gasModule.estimateCompleteWithdrawalCost(
  tokenAddress,
  amount
);
```

### Bridge Module

```typescript
import { BridgeModule } from '@rwa-lifecycle/bridge';

const bridge = new BridgeModule({ l1Client, l2Client });

// Deposit ERC20 (L1 → L2)
await bridge.depositERC20(tokenAddress, amount);

// Deposit ERC721/NFT (L1 → L2)
await bridge.depositNFT(tokenAddress, tokenId);

// Withdraw ERC20 (L2 → L1) - 3 phases
await bridge.withdrawERC20Initiate(tokenAddress, amount);
// Wait ~12 hours for ZK proof...
await bridge.withdrawERC20Prove(withdrawalHash);
// Wait for finalization window...
await bridge.withdrawERC20Finalize(withdrawalHash);
```

### Indexer Module

```typescript
import { IndexerModule } from '@rwa-lifecycle/indexer';

const indexer = new IndexerModule({
  l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
  l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
  l1BridgeAddress: '0x...',
  l2BridgeAddress: '0x...',
});

// Start syncing events
await indexer.start();

// Query transactions
const deposits = await indexer.getDeposits({
  user: userAddress,
  limit: 10,
});

// Track withdrawal status (3 phases)
const status = await indexer.getWithdrawalStatus(withdrawalId);
console.log(`Phase: ${status.phase}`); // initiated, proven, finalized
console.log(`Can prove: ${status.canProve}`);
console.log(`Can finalize: ${status.canFinalize}`);

// Stop syncing
indexer.stop();
```

### Compliance Module

```typescript
import { ComplianceModule } from '@rwa-lifecycle/compliance';
import { BlacklistPlugin } from '@rwa-lifecycle/compliance/plugins';

const compliance = new ComplianceModule({
  publicClient: l2PublicClient,
  network: 'testnet',
});

// Check ERC3643 token compliance
const result = await compliance.checkCompliance(
  tokenAddress,
  fromAddress,
  toAddress,
  amount
);

if (!result.compliant) {
  throw new Error(`Transfer blocked: ${result.reason}`);
}

// Register custom plugin for non-standard tokens
const blacklistPlugin = new BlacklistPlugin();
compliance.registerPlugin(customTokenAddress, blacklistPlugin);

// Check with plugin
const customResult = await compliance.checkCompliance(
  customTokenAddress,
  fromAddress,
  toAddress,
  amount
);

// Detect token standard
const standard = await compliance.detectStandard(tokenAddress);
console.log(`Token standard: ${standard}`); // ERC3643, ERC20, ERC721, or UNKNOWN
```

## Project Structure

```
rwa-lifecycle-sdk/
├── packages/
│   ├── core/          # Main SDK orchestrator
│   ├── bridge/        # L1 ↔ L2 bridging (ERC20 & ERC721)
│   ├── gas/           # Gas cost estimation
│   ├── indexer/       # Event indexing & transaction history
│   ├── compliance/    # KYC/AML hooks (optional)
│   └── cli/           # Command-line tool (planned)
├── contracts/         # Foundry smart contracts
│   └── src/
│       └── TestRWA.sol # Example ERC-721 RWA token
└── examples/          # Integration examples
```

## Networks Supported

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Ethereum Sepolia (L1) | 11155111 | https://eth-sepolia.public.blastapi.io |
| Mantle Sepolia (L2) | 5003 | https://rpc.sepolia.mantle.xyz |
| Ethereum Mainnet (L1) | 1 | https://eth.public-rpc.com |
| Mantle Mainnet (L2) | 5000 | https://rpc.mantle.xyz |

## Key Features

### Gas Estimation
- ✅ Accurate L2 + L1 data fee calculation
- ✅ Mantle Gas Oracle integration
- ✅ 3-phase withdrawal cost aggregation
- ✅ Balance checking utilities
- ✅ Safety buffers (configurable)

### Bridge Operations
- ✅ ERC20 deposit (L1 → L2)
- ✅ ERC721 deposit (L1 → L2)
- ✅ ERC20 withdrawal (L2 → L1, 3 phases)
- ✅ ERC721 withdrawal (L2 → L1, 3 phases)
- ⏳ Automated withdrawal finalization (planned)

### Event Indexing
- ✅ Real-time event syncing (12-second intervals)
- ✅ SQLite local database
- ✅ Transaction history queries
- ✅ Withdrawal status tracking
- ✅ User/token filtering
- ✅ Pagination support

### Compliance Verification
- ✅ ERC3643 standard support (T-REX protocol)
- ✅ Identity Registry integration
- ✅ Custom compliance plugins
- ✅ Token standard auto-detection
- ✅ Transfer simulation (prevent failed transactions)
- ✅ On-chain only (no off-chain APIs)
- ✅ Stateless operation

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/rwa-lifecycle-sdk.git
cd rwa-lifecycle-sdk

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Environment Configuration

```bash
cp .env.example .env
# Edit .env with your RPC URLs and private keys
```

### Build Smart Contracts

```bash
cd contracts
forge build
forge test
```

## Use Cases

### 1. Property Tokenization Platform
Bridge tokenized property deeds from Ethereum to Mantle for trading.

### 2. Bond Trading Platform
Move tokenized bonds to Mantle L2 for lower gas costs.

### 3. RWA Marketplace
Enable users to trade RWA tokens on L2 with automatic bridging.

### 4. Compliance Dashboard
Track all bridge transactions for audit and compliance purposes.

## Understanding Mantle's Bridge

### Deposit (L1 → L2)
1. Lock tokens on L1 bridge contract
2. Tokens minted on L2 (~10 minutes)
3. User can now trade on Mantle

### Withdrawal (L2 → L1)
1. **Initiate**: Burn tokens on L2 (~instant)
2. **Prove**: Submit ZK proof to L1 (~12 hours wait)
3. **Finalize**: Unlock tokens on L1 (~instant after prove)

**Total withdrawal time**: ~12 hours (Mantle uses ZK proofs, not optimistic 7-day challenge)

## Gas Costs on Mantle

Mantle charges **two types of fees**:

1. **L2 Execution Fee**: Cost to execute transaction on Mantle
2. **L1 Data Fee**: Cost to publish transaction data to Ethereum

**Example**:
```
Deposit 100 ERC20 tokens:
├─ L2 execution: ~$0.02
├─ L1 data fee: ~$0.50
└─ Total: ~$0.52
```

Our Gas Module calculates both automatically.

## Important Notes

### Withdrawal Time
- Mantle uses **ZK proofs** (via OP Succinct)
- Withdrawal time: **~12 hours** (not 7 days like optimistic rollups)
- You must call all 3 phases: initiate → prove → finalize

### Security
⚠️ This is a hackathon project - use at your own risk.

Key security considerations:
- Store private keys securely (use hardware wallets in production)
- Verify contract addresses before bridging
- Test on testnet first
- Double-check gas estimates before executing

### RWA Compliance
The SDK includes a Compliance Module that supports:
- **ERC3643 tokens**: Automatic compliance checking via `canTransfer()`
- **Custom tokens**: Extensible plugin system for any compliance logic
- **Pre-bridge validation**: Check compliance before executing transfers
- **On-chain only**: All checks read directly from blockchain

For maximum security, use ERC3643-compliant tokens (T-REX standard)

## Documentation

- [Gas Module README](./packages/gas/README.md) - Detailed gas estimation docs
- [Indexer Module README](./packages/indexer/README.md) - Event indexing guide
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) - Technical implementation details

## FAQ

**Q: What's an RWA token?**
A: A blockchain token representing ownership of a real-world asset (property, bond, commodity, etc.)

**Q: Why bridge to Mantle?**
A: Mantle L2 offers ~95% lower gas fees than Ethereum L1

**Q: How long does withdrawal take?**
A: ~12 hours (3 phases: initiate → prove → finalize)

**Q: Does this handle KYC/AML?**
A: Yes! The Compliance Module checks ERC3643 tokens and supports custom compliance via plugins

**Q: Can I use this with any ERC20/ERC721?**
A: Yes, as long as the token implements the standard Mantle bridge interface

## Contributing

This is a hackathon project. Contributions welcome!

```bash
git checkout -b feature/amazing-feature
pnpm test
# Submit PR
```

## License

MIT License - see [LICENSE](./LICENSE)

## Acknowledgments

- Built for the **Mantle Hackathon**
- Powered by [Foundry](https://getfoundry.sh/), [Viem](https://viem.sh/), [Turbo](https://turbo.build/)

---

**Built for the Mantle ecosystem 🚀**
