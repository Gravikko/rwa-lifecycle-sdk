# @rwa-lifecycle/bridge

Bridge module for transferring Real World Assets (RWAs) between Ethereum L1 and Mantle L2.

## Features

- ✅ **ERC721 NFT Bridging** - Bridge NFT-based RWAs (real estate, art, etc.)
- ✅ **ERC20 Token Bridging** - Bridge tokenized RWAs (securities, bonds, etc.)
- ✅ **3-Phase Withdrawal** - Automated prove and finalize flow with ZK proofs
- ✅ **Fast Finality** - ~1-12 hour withdrawals (thanks to Mantle's OP Succinct ZK)
- ✅ **Type-Safe** - Full TypeScript support with viem

## Installation

```bash
npm install @rwa-lifecycle/bridge viem
```

## Quick Start

```typescript
import { BridgeModule } from '@rwa-lifecycle/bridge';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Setup clients
const account = privateKeyToAccount('0x...');

const l1PublicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY')
});

const l1WalletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY')
});

const l2PublicClient = createPublicClient({
  chain: { id: 5003, name: 'Mantle Sepolia' }, // Custom chain config
  transport: http('https://rpc.sepolia.mantle.xyz')
});

const l2WalletClient = createWalletClient({
  account,
  chain: { id: 5003, name: 'Mantle Sepolia' },
  transport: http('https://rpc.sepolia.mantle.xyz')
});

// Initialize bridge
const bridge = new BridgeModule({
  l1PublicClient,
  l2PublicClient,
  l1WalletClient,
  l2WalletClient,
  network: 'testnet'
});
```

## Usage Examples

### Deposit NFT (L1 → L2)

```typescript
// Deposit an RWA NFT from Ethereum to Mantle
const result = await bridge.depositNFT(
  '0x2765c33a024DF883c46Dc67c54221650f0Cc9563', // NFT contract on L1
  1n // Token ID
);

console.log('Deposited! TX:', result.txHash);
// NFT will arrive on L2 in ~10 minutes
```

### Deposit ERC20 Tokens (L1 → L2)

```typescript
// Deposit tokenized securities/bonds
const result = await bridge.depositERC20(
  '0x...', // Token contract on L1
  1000n * 10n ** 18n, // Amount (1000 tokens)
  {
    onProgress: (txHash) => console.log('Progress:', txHash)
  }
);
```

### Withdraw NFT (L2 → L1) - Full Flow

```typescript
// Automated withdrawal (handles all 3 phases)
const result = await bridge.withdrawAndFinalize(
  '0x...', // NFT contract on L2
  1n, // Token ID
  {
    onProgress: (status, data) => {
      console.log('Status:', status); // INITIATED → PROVEN → FINALIZED
    }
  }
);

// Total time: ~1-12 hours with ZK proofs
console.log('Withdrawn! Final TX:', result.txHash);
```

### Manual 3-Phase Withdrawal

```typescript
// Phase 1: Initiate on L2
const withdrawal = await bridge.initiateWithdrawal(
  '0x...', // NFT contract address on L2
  1n
);
console.log('Phase 1 complete:', withdrawal.txHash);

// Phase 2: Prove on L1 (wait ~1 hour for state root)
const proven = await bridge.proveWithdrawal(withdrawal.txHash);
console.log('Phase 2 complete:', proven.status); // PROVEN

// Phase 3: Finalize on L1 (wait ~1-12 hours for challenge period)
const finalized = await bridge.finalizeWithdrawal(withdrawal.txHash);
console.log('Phase 3 complete:', finalized.status); // FINALIZED
```

### Check Withdrawal Status

```typescript
const status = await bridge.getWithdrawalStatus(withdrawalTxHash);
console.log(status);
// "waiting-to-prove" | "ready-to-prove" | "waiting-to-finalize" | "ready-to-finalize" | "finalized"
```

## API Reference

### Deposits

#### `depositNFT(tokenAddress, tokenId, options?)`
Deposits an ERC721 NFT from L1 to L2.

**Parameters:**
- `tokenAddress: Address` - L1 NFT contract address
- `tokenId: bigint` - Token ID to deposit
- `options?: DepositOptions` - Optional configuration

**Returns:** `Promise<DepositInfo>`

---

#### `depositERC20(tokenAddress, amount, options?)`
Deposits ERC20 tokens from L1 to L2.

**Parameters:**
- `tokenAddress: Address` - L1 token contract address
- `amount: bigint` - Amount to deposit (in wei)
- `options?: DepositOptions` - Optional configuration

**Returns:** `Promise<DepositInfo>`

### Withdrawals

#### `initiateWithdrawal(tokenAddress, tokenId, options?)`
Phase 1: Initiates NFT withdrawal from L2 to L1.

**Returns:** `Promise<WithdrawalInfo>` with status `INITIATED`

---

#### `initiateERC20Withdrawal(tokenAddress, amount, options?)`
Phase 1: Initiates ERC20 withdrawal from L2 to L1.

**Returns:** `Promise<WithdrawalInfo>` with status `INITIATED`

---

#### `proveWithdrawal(withdrawalTxHash, options?)`
Phase 2: Proves the withdrawal on L1 (works for both ERC20 & ERC721).

**Parameters:**
- `withdrawalTxHash: Hash` - Transaction hash from `initiateWithdrawal`

**Returns:** `Promise<WithdrawalInfo>` with status `PROVEN`

---

#### `finalizeWithdrawal(withdrawalTxHash, options?)`
Phase 3: Finalizes the withdrawal on L1 (works for both ERC20 & ERC721).

**Returns:** `Promise<WithdrawalInfo>` with status `FINALIZED`

---

#### `withdrawAndFinalize(tokenAddress, tokenId, options?)`
Automated orchestration of all 3 phases. Handles initiate → prove → finalize automatically.

**Returns:** `Promise<WithdrawalInfo>` with final status `FINALIZED`

### Utilities

#### `getWithdrawalStatus(withdrawalTxHash)`
Check the current status of a withdrawal.

**Returns:** `Promise<string>` - Status string

## Types

### `DepositOptions`
```typescript
interface DepositOptions {
  to?: Address;              // Recipient address (defaults to sender)
  minGasLimit?: number;      // Minimum gas limit (default: 200000)
  onProgress?: (txHash: Hash) => void; // Progress callback
}
```

### `WithdrawalOptions`
```typescript
interface WithdrawalOptions {
  to?: Address;              // Recipient address (defaults to sender)
  minGasLimit?: number;      // Minimum gas limit (default: 200000)
  timeout?: number;          // Max wait time in ms
  onProgress?: (status: WithdrawalStatus, data?: any) => void;
}
```

### `WithdrawalStatus`
```typescript
enum WithdrawalStatus {
  INITIATED = 'INITIATED',
  PROVEN = 'PROVEN',
  READY_FOR_FINALIZATION = 'READY_FOR_FINALIZATION',
  FINALIZED = 'FINALIZED'
}
```

## Contract Addresses

### Mantle Sepolia Testnet
- L1StandardBridge: `0x21F308067241B2028503c07bd7cB3751FFab0Fb2`
- L2StandardBridge: `0x4200000000000000000000000000000000000010`
- OptimismPortal: `0xB3db4bd5bc225930eD674494F9A4F6a11B8EFBc8`

### Mantle Mainnet
- L1StandardBridge: `0x95fc37a27a2f68e3a647cdc081f0a89bb47c3012`
- L2StandardBridge: `0x4200000000000000000000000000000000000010`
- OptimismPortal: `0x291dc3819b863e1d14f44203006020586f1e8062`

## Technical Details

- **ZK Proofs**: Uses Mantle's OP Succinct for fast finality (~1-12 hours vs 7 days)
- **OP Stack Compatible**: Built on OP Stack architecture with ZK validity proofs
- **Viem-based**: Uses viem OP Stack extensions for type-safe blockchain interactions

## License

MIT

## Links

- [Mantle Network Docs](https://docs.mantle.xyz)
- [Viem OP Stack Guide](https://viem.sh/op-stack)
- [GitHub Repository](https://github.com/your-repo/rwa-lifecycle-sdk)
