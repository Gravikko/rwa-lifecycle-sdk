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
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────┐
│  @mantleio/  │ │   Mantle     │ │ SubQuery │
│     sdk      │ │ Gas Oracle   │ │ Indexer  │
└──────┬───────┘ └──────┬───────┘ └────┬─────┘
       │                │              │
       ▼                ▼              ▼
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

**Purpose**: On-chain compliance verification for RWA tokens

**Architecture**:
- ERC3643 standard support (T-REX protocol)
- Plugin system (`ICompliancePlugin`)
- Token standard detection
- Transfer simulation

**Key Features**:
- Native ERC3643 compliance checking
- Identity Registry integration
- Custom compliance plugins (Blacklist, Whitelist examples)
- Auto-detect token standard
- Pre-transfer simulation to prevent failures
- On-chain only (no off-chain APIs)
- Stateless operation (no database)

## Data Flow

### Withdrawal Flow

```
1. User calls sdk.withdrawAndFinalize(tokenId)
   │
   ├─► Check compliance
   │   └─► ComplianceModule.checkCompliance(token, from, to, amount)
   │       ├─► Detect token standard (ERC3643/ERC20/ERC721)
   │       ├─► Check registered plugin (if any)
   │       ├─► Call ERC3643 canTransfer() (if applicable)
   │       └─► Simulate transfer (if requested)
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
   └─► Finalize withdrawal (L1 tx)
       └─► BridgeModule.finalize()
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

4. **Compliance Verification**
   - Trust on-chain data only
   - Validate ERC3643 interface implementations
   - Test custom plugins thoroughly
   - Handle detection failures gracefully

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
