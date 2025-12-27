# RWA Lifecycle SDK

> Developer-focused library that automates the full lifecycle of tokenized real-world assets on Mantle

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Foundry](https://img.shields.io/badge/Built%20with-Foundry-FFDB1C.svg)](https://getfoundry.sh/)

## 🎯 Overview

RWA Lifecycle SDK is a comprehensive TypeScript library that simplifies building applications for tokenized real-world assets (RWAs) on Mantle. It automates complex workflows including:

- **🌉 Cross-chain bridging** - Automated L2→L1 withdrawal finalization (initiate → prove → finalize)
- **⛽ Gas estimation** - Accurate cost forecasting across L2 execution, L1 data, and DA fees
- **📊 Event indexing** - Reconstruct marketplace and bridge state from on-chain events
- **✅ Compliance hooks** - Pluggable KYC/AML verification for regulated assets
- **💾 Data archival** - EigenDA integration for cheap, immutable metadata storage
- **🔄 Automated relayer** - Background service for hands-free withdrawal finalization

## 🚀 Quick Start

### Installation

```bash
# Using pnpm (recommended)
pnpm add @rwa-lifecycle/core

# Using npm
npm install @rwa-lifecycle/core

# Using yarn
yarn add @rwa-lifecycle/core
```

### Basic Usage

```typescript
import { RWALifecycleSDK } from '@rwa-lifecycle/core';

// Initialize SDK
const sdk = new RWALifecycleSDK({
  l1RpcUrl: process.env.ETHEREUM_RPC,
  l2RpcUrl: process.env.MANTLE_RPC,
  walletClient: yourWalletClient, // viem wallet client
});

// Estimate gas for bridge withdrawal
const cost = await sdk.gas.estimateBridgeCost(tokenAddress, tokenId);
console.log(`Total cost: ${cost.total} ETH`);

// Automated L2→L1 withdrawal (single call!)
await sdk.bridge.withdrawAndFinalize(tokenAddress, tokenId, {
  onProgress: (status) => console.log(`Status: ${status}`)
});

// Query indexed assets
const myAssets = await sdk.indexer.getAssetsByOwner(myAddress);
```

## 📦 Project Structure

```
rwa-lifecycle-sdk/
├── packages/
│   ├── core/          # Main SDK orchestrator
│   ├── bridge/        # Mantle bridge automation
│   ├── gas/           # Gas estimation module
│   ├── indexer/       # Event indexing client
│   ├── compliance/    # KYC/AML hooks
│   ├── storage/       # EigenDA integration
│   └── cli/           # Command-line tool
├── contracts/         # Foundry smart contracts
│   └── src/
│       └── TestRWA.sol # Example ERC-721 RWA token
├── relayer/           # Automated finalization service
└── examples/          # Integration examples
```

## 🛠️ Development Setup

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Foundry (for smart contracts)

### Clone and Install

```bash
# Clone repository
git clone https://github.com/yourusername/rwa-lifecycle-sdk.git
cd rwa-lifecycle-sdk

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build smart contracts
pnpm contracts:build
```

### Environment Configuration

```bash
cp .env.example .env
# Edit .env with your RPC URLs and private keys
```

## 📋 Development Roadmap

### ✅ Phase 1: Foundation (Completed)
- [x] Monorepo structure with Turborepo
- [x] TypeScript package scaffolds
- [x] Foundry project setup
- [x] Test ERC-721 contract

### 🚧 Phase 2: Core Modules (In Progress)
- [ ] Bridge automation module
- [ ] Gas estimation module
- [ ] Provider initialization
- [ ] End-to-end bridge testing

### 📅 Phase 3: Indexing & State
- [ ] SubQuery project setup
- [ ] Event handlers
- [ ] GraphQL client
- [ ] State reconstruction

### 📅 Phase 4: Advanced Features
- [ ] Compliance module with providers
- [ ] EigenDA storage integration
- [ ] Metadata archival
- [ ] Automated relayer service

### 📅 Phase 5: Developer Experience
- [ ] CLI tool (withdraw, estimate, query)
- [ ] Example scripts
- [ ] API documentation
- [ ] Integration guides

## 🏗️ Smart Contracts

### TestRWA Token

A minimal ERC-721 implementation for testing the SDK:

```bash
# Deploy to Mantle Sepolia
pnpm contracts:deploy:testnet

# Verify contract
forge verify-contract <CONTRACT_ADDRESS> TestRWA \
  --chain mantle-sepolia \
  --watch
```

## 📚 Documentation

- [Architecture Overview](./docs/architecture.md) - System design and components
- [API Reference](./docs/api-reference.md) - Complete SDK API documentation
- [Integration Guide](./docs/integration-guide.md) - Step-by-step integration
- [Gas Estimation](./docs/gas-estimation.md) - Understanding Mantle fees

## 🤝 Contributing

Contributions are welcome! This is a hackathon project with 20 days of active development.

```bash
# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes and test
pnpm test

# Submit a pull request
```

## 🔒 Security Considerations

⚠️ **This is a hackathon project** - Not production-ready!

Key areas requiring security review:
- Private key management in relayer
- Event deduplication logic
- Gas estimation accuracy
- Compliance provider trust model

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

## 🙏 Acknowledgments

- Built for the Mantle Hackathon
- Powered by [Foundry](https://getfoundry.sh/), [Viem](https://viem.sh/), and [Turbo](https://turbo.build/)
- Inspired by the need for better RWA tooling on L2s

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/yourusername/rwa-lifecycle-sdk/issues)
- Documentation: [Read the docs](./docs/)
- Examples: See [examples/](./examples/)

---

**Built with ❤️ for the Mantle ecosystem**
