# Getting Started with RWA Lifecycle SDK

## Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (or npm/yarn)
- **Foundry** (for smart contract deployment)
- **Wallet** with MNT on Mantle Sepolia testnet

## Installation

### 1. Install the SDK

```bash
pnpm add @rwa-lifecycle/core
```

### 2. Set up Environment Variables

Create a `.env` file in your project:

```bash
# RPC Endpoints
MANTLE_TESTNET_RPC=https://rpc.sepolia.mantle.xyz
ETHEREUM_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Your private key (for testing only!)
PRIVATE_KEY=your_private_key_here

# Contract addresses (update after deployment)
TEST_RWA_TOKEN_ADDRESS=0x...
```

## Quick Start Example

### Basic SDK Initialization

```typescript
import { RWALifecycleSDK } from '@rwa-lifecycle/core';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantleSepoliaTestnet } from 'viem/chains';

// Create wallet client
const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);
const walletClient = createWalletClient({
  account,
  chain: mantleSepoliaTestnet,
  transport: http(process.env.MANTLE_TESTNET_RPC),
});

// Initialize SDK
const sdk = new RWALifecycleSDK({
  l1ChainId: 11155111, // Sepolia
  l2ChainId: 5003, // Mantle Sepolia
  l1RpcUrl: process.env.ETHEREUM_SEPOLIA_RPC!,
  l2RpcUrl: process.env.MANTLE_TESTNET_RPC!,
  walletClient,
});

console.log('SDK initialized!');
console.log('L2 Client:', sdk.getL2Client());
```

## Common Use Cases

### 1. Deploy Test RWA Token

```bash
# Clone the SDK repository for contracts
git clone https://github.com/yourusername/rwa-lifecycle-sdk.git
cd rwa-lifecycle-sdk

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your DEPLOYER_PRIVATE_KEY

# Deploy to Mantle Sepolia
pnpm contracts:deploy:testnet
```

### 2. Estimate Gas Costs (Phase 2)

```typescript
// This will be available after Phase 2 implementation
const cost = await sdk.gas.estimateBridgeCost(
  tokenAddress,
  tokenId
);

console.log('Gas Cost Breakdown:');
console.log(`L2 Execution: ${cost.l2ExecutionCost} wei`);
console.log(`L1 Data Fee: ${cost.l1DataFee} wei`);
console.log(`DA Fee: ${cost.daFee} wei`);
console.log(`Total: ${cost.total} wei`);
```

### 3. Automated Bridge Withdrawal (Phase 2)

```typescript
// Single call to handle entire L2→L1 flow
await sdk.bridge.withdrawAndFinalize(
  tokenAddress,
  tokenId,
  {
    onProgress: (status) => {
      console.log(`Withdrawal status: ${status}`);
      // INITIATED → PROVEN → FINALIZED
    }
  }
);
```

### 4. Query Asset Ownership (Phase 3)

```typescript
// Get all assets owned by address
const assets = await sdk.indexer.getAssetsByOwner(myAddress);

console.log(`You own ${assets.length} RWA tokens:`);
assets.forEach(asset => {
  console.log(`Token #${asset.id} - ${asset.transferCount} transfers`);
});
```

### 5. Compliance Check

```typescript
import { ComplianceModule } from '@rwa-lifecycle/compliance';
import { BlacklistPlugin } from '@rwa-lifecycle/compliance/plugins';

// Initialize compliance module
const compliance = new ComplianceModule({
  publicClient: sdk.getL2Client(),
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

console.log(`Token standard: ${result.tokenStandard}`);
console.log(`Transfer allowed: ${result.compliant}`);

// For custom tokens, register a plugin
const blacklistPlugin = new BlacklistPlugin();
compliance.registerPlugin(customTokenAddress, blacklistPlugin);

// Check again with plugin
const customResult = await compliance.checkCompliance(
  customTokenAddress,
  fromAddress,
  toAddress,
  amount
);
```

## Project Structure

When building with the SDK, organize your project like this:

```
my-rwa-app/
├── src/
│   ├── index.ts          # Main application
│   ├── config.ts         # SDK configuration
│   └── utils/
│       ├── bridge.ts     # Bridge helpers
│       └── compliance.ts # Compliance logic
├── .env                  # Environment variables
├── package.json
└── tsconfig.json
```

## Development Workflow

### 1. Local Development

```bash
# Install dependencies
pnpm install

# Run TypeScript in watch mode
pnpm dev

# Run your application
tsx src/index.ts
```

### 2. Testing on Mantle Sepolia

1. Get testnet MNT from [Mantle Faucet](https://faucet.sepolia.mantle.xyz/)
2. Deploy your test token or use existing one
3. Test SDK functions on testnet
4. Monitor transactions on [Mantle Explorer](https://explorer.sepolia.mantle.xyz/)

### 3. Production Deployment

```typescript
import { MAINNET_CONFIG } from '@rwa-lifecycle/core';

// Use mainnet configuration
const sdk = new RWALifecycleSDK({
  ...MAINNET_CONFIG,
  walletClient: yourMainnetWallet,
});
```

## Troubleshooting

### Common Issues

**1. "Module not found" errors**

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**2. RPC connection errors**

```typescript
// Add retry logic
const l2Client = createPublicClient({
  chain: mantleSepoliaTestnet,
  transport: http(process.env.MANTLE_TESTNET_RPC, {
    retryCount: 3,
    retryDelay: 1000,
  }),
});
```

**3. Transaction failures**

- Check wallet has sufficient MNT for gas
- Verify contract addresses are correct
- Ensure you're on the right network (testnet vs mainnet)

## Next Steps

- 📚 Read the [Architecture Overview](./architecture.md)
- 🔧 Check out [Examples](../examples/)
- 📖 Browse [API Reference](./api-reference.md)
- 🤝 Join the community on Discord

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/rwa-lifecycle-sdk/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/rwa-lifecycle-sdk/discussions)
- **Documentation**: [docs/](../docs/)

---

Ready to build? Start with Phase 2 implementation! 🚀
