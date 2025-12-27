# Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER APPLICATION                          │
│            (dApp, CLI, Script using SDK)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RWA LIFECYCLE SDK                             │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │   Bridge     │     Gas      │   Indexer    │  Compliance  │ │
│  │   Module     │   Module     │   Module     │    Module    │ │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘ │
│         │              │              │              │          │
│  ┌──────▼──────────────▼──────────────▼──────────────▼───────┐ │
│  │              Core SDK (Orchestrator)                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┬──────────────┐
          │              │              │              │
          ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────┐
│  @mantleio/  │ │   Mantle     │ │ SubQuery │ │  EigenDA   │
│     sdk      │ │ Gas Oracle   │ │ Indexer  │ │ mt-batcher │
└──────┬───────┘ └──────┬───────┘ └────┬─────┘ └─────┬──────┘
       │                │              │             │
       ▼                ▼              ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN LAYER                         │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │   Mantle L2          │      │   Ethereum L1        │    │
│  │  - ERC721 Token      │◄────►│  - Bridge Contract   │    │
│  └──────────────────────┘      └──────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Core SDK (Orchestrator)

**Purpose**: Central coordination layer that manages all modules

**Responsibilities**:
- Initialize L1/L2 providers
- Coordinate between modules
- Provide unified API surface
- Handle configuration

**Key Classes**:
- `RWALifecycleSDK` - Main entry point

### 2. Bridge Module

**Purpose**: Automate Mantle L2→L1 withdrawals

**Three-Phase Flow**:
```
INITIATE (L2) → PROVE (L1) → FINALIZE (L1)
```

**Key Features**:
- Single-call automation: `withdrawAndFinalize()`
- Status polling and monitoring
- Progress callbacks
- Error handling and retries

### 3. Gas Module

**Purpose**: Estimate total transaction costs

**Cost Components**:
- L2 execution gas (standard EVM)
- L1 data fee (calldata posted to Ethereum)
- DA fee (EigenDA/modular DA cost)

**Key Features**:
- Real-time oracle integration
- Detailed cost breakdown
- Pre-transaction estimation

### 4. Indexer Module

**Purpose**: Query blockchain events efficiently

**Architecture**:
- SubQuery backend (GraphQL)
- Event deduplication
- State reconstruction
- Fast queries

**Key Features**:
- Asset ownership tracking
- Transfer history
- Withdrawal status monitoring

### 5. Compliance Module

**Purpose**: Pluggable KYC/AML verification

**Architecture**:
- Provider interface (`IComplianceProvider`)
- Built-in providers (Whitelist, On-chain Registry)
- Custom provider support

**Key Features**:
- Pre-transfer validation
- Multiple provider support
- Extensible architecture

### 6. Storage Module

**Purpose**: Archive metadata to EigenDA

**Architecture**:
- Blob encoding/decoding
- mt-batcher API integration
- On-chain reference storage

**Key Features**:
- Cheap immutable storage
- Legal document archival
- Compliance metadata

## Data Flow

### Withdrawal Flow

```
1. User calls sdk.withdrawAndFinalize(tokenId)
   │
   ├─► Check compliance
   │   └─► ComplianceModule.verify(recipient)
   │
   ├─► Estimate cost
   │   └─► GasModule.estimateBridgeCost()
   │
   ├─► Initiate withdrawal (L2 tx)
   │   └─► BridgeModule.initiate()
   │
   ├─► Wait for challenge period
   │   └─► BridgeModule.waitForReady()
   │
   ├─► Prove withdrawal (L1 tx)
   │   └─► BridgeModule.prove()
   │
   ├─► Finalize withdrawal (L1 tx)
   │   └─► BridgeModule.finalize()
   │
   └─► Archive event
       └─► StorageModule.archiveEvent()
```

## Technology Stack

### Smart Contracts
- Solidity 0.8.24
- Foundry (build, test, deploy)
- OpenZeppelin Contracts

### SDK
- TypeScript 5.3+
- Viem 2.x (blockchain interactions)
- Turbo (monorepo build system)

### Indexing
- SubQuery (event indexing)
- GraphQL (query API)
- PostgreSQL (data storage)

### Infrastructure
- EigenDA (data availability)
- Mantle L2 (execution layer)
- Ethereum L1 (settlement layer)

## Design Principles

1. **Modularity** - Each module is independent and swappable
2. **Type Safety** - Full TypeScript coverage with strict types
3. **Developer UX** - Simple APIs that hide complexity
4. **Contract Agnostic** - Works with any ERC-721/ERC-1155 token
5. **Production Ready** - Error handling, retries, monitoring

## Security Considerations

### Critical Areas

1. **Private Key Management**
   - Relayer must securely store keys
   - Recommend HSM/KMS integration
   - Never commit keys to git

2. **Event Deduplication**
   - Handle chain reorganizations
   - Validate event authenticity
   - Prevent double-processing

3. **Gas Estimation Accuracy**
   - Oracle data validation
   - Fallback mechanisms
   - User confirmation for high costs

4. **Compliance Provider Trust**
   - Verify provider integrity
   - Multi-provider support
   - Audit trail logging

## Performance Optimization

- **Parallel RPC calls** where possible
- **Caching** frequently accessed data
- **Batch processing** for indexer
- **Connection pooling** for providers

## Future Enhancements

- Multi-chain support (other OP Stack chains)
- Advanced relayer strategies (MEV protection)
- On-chain compliance registry
- Real-time WebSocket subscriptions
- Mobile SDK support
