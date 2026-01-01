/**
 * Mantle Bridge Contract Addresses and ABIs 
 */

import type { Address } from 'viem';

// ============================================
// CONTRACT ADDRESSES - SEPOLIA TESTNET
// ============================================

export const MANTLE_SEPOLIA_CONTRACTS = {
  // L2 (Mantle Sepolia) Contracts
  L2StandardBridge: '0x4200000000000000000000000000000000000010' as Address,
  L2ERC721Bridge: '0x4200000000000000000000000000000000000014' as Address,
  L2CrossDomainMessenger: '0x4200000000000000000000000000000000000007' as Address,
  L2ToL1MessagePasser: '0x4200000000000000000000000000000000000016' as Address,

  // L1 (Ethereum Sepolia) Contracts
  L1StandardBridge: '0x21F308067241B2028503c07bd7cB3751FFab0Fb2' as Address,
  L1ERC721Bridge: '0x94343BeF783Af58f46e23bEB859e4cb11B65C4eb' as Address,
  L1CrossDomainMessenger: '0x37dAC5312e31Adb8BB0802Fc72Ca84DA5cDfcb4c' as Address,
  L2OutputOracle: '0x4121dc8e48Bc6196795eb4867772A5e259fecE07' as Address,
  OptimismPortal: '0xB3db4bd5bc225930eD674494F9A4F6a11B8EFBc8' as Address,
};

// ============================================
// CONTRACT ADDRESSES - MAINNET
// ============================================

export const MANTLE_MAINNET_CONTRACTS = {
  L2StandardBridge: '0x4200000000000000000000000000000000000010' as Address,
  L2CrossDomainMessenger: '0x4200000000000000000000000000000000000007' as Address,
  L2ToL1MessagePasser: '0x4200000000000000000000000000000000000016' as Address,

  // L1 Addresses (Ethereum Mainnet)
  L1StandardBridge: '0x95fc37a27a2f68e3a647cdc081f0a89bb47c3012' as Address,
  L1CrossDomainMessenger: '0x676A795fe6E43C17c668de16730c3F690FEB7120' as Address,
  L2OutputOracle: '0x329664673A05952fE896328A252136c34863f6B9' as Address,
  OptimismPortal: '0x291dc3819b863e1d14f44203006020586f1e8062' as Address,
};

// ============================================
// CONTRACT ABIs
// ============================================

/**
 * L1StandardBridge ABI - For depositing tokens to L2
 * Key methods: depositERC20, depositERC20To (ERC20), bridgeERC721, bridgeERC721To (ERC721)
 */
export const L1_STANDARD_BRIDGE_ABI = [
  // ERC20 deposit functions
  {
    name: 'depositERC20',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_l1Token', type: 'address' },
      { name: '_l2Token', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'depositERC20To',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_l1Token', type: 'address' },
      { name: '_l2Token', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  // ERC721 deposit functions
  {
    name: 'bridgeERC721',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_localToken', type: 'address' },
      { name: '_remoteToken', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'bridgeERC721To',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_localToken', type: 'address' },
      { name: '_remoteToken', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  // Events
  {
    name: 'ERC20DepositInitiated',
    type: 'event',
    inputs: [
      { name: 'l1Token', type: 'address', indexed: true },
      { name: 'l2Token', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'extraData', type: 'bytes', indexed: false },
    ],
  },
  {
    name: 'ERC721BridgeInitiated',
    type: 'event',
    inputs: [
      { name: 'localToken', type: 'address', indexed: true },
      { name: 'remoteToken', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: false },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'extraData', type: 'bytes', indexed: false },
    ],
  },
] as const;

/**
 * L2StandardBridge ABI - For withdrawing tokens from L2
 * Key methods: withdraw, withdrawTo (ERC20), bridgeERC721, bridgeERC721To (ERC721)
 */
export const L2_STANDARD_BRIDGE_ABI = [
  // ERC20 withdrawal functions
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: '_l2Token', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'withdrawTo',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: '_l2Token', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  // ERC721 withdrawal functions
  {
    name: 'bridgeERC721',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_localToken', type: 'address' },
      { name: '_remoteToken', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'bridgeERC721To',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_localToken', type: 'address' },
      { name: '_remoteToken', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  // Events
  {
    name: 'WithdrawalInitiated',
    type: 'event',
    inputs: [
      { name: 'l1Token', type: 'address', indexed: true },
      { name: 'l2Token', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'extraData', type: 'bytes', indexed: false },
    ],
  },
  {
    name: 'ERC721BridgeInitiated',
    type: 'event',
    inputs: [
      { name: 'localToken', type: 'address', indexed: true },
      { name: 'remoteToken', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: false },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'extraData', type: 'bytes', indexed: false },
    ],
  },
] as const;

/**
 * OptimismPortal ABI - For proving and finalizing withdrawals on L1
 * Key methods: proveWithdrawalTransaction, finalizeWithdrawalTransaction
 */
export const OPTIMISM_PORTAL_ABI = [
  {
    name: 'proveWithdrawalTransaction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_tx',
        type: 'tuple',
        components: [
          { name: 'nonce', type: 'uint256' },
          { name: 'sender', type: 'address' },
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gasLimit', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
      { name: '_l2OutputIndex', type: 'uint256' },
      {
        name: '_outputRootProof',
        type: 'tuple',
        components: [
          { name: 'version', type: 'bytes32' },
          { name: 'stateRoot', type: 'bytes32' },
          { name: 'messagePasserStorageRoot', type: 'bytes32' },
          { name: 'latestBlockhash', type: 'bytes32' },
        ],
      },
      { name: '_withdrawalProof', type: 'bytes[]' },
    ],
    outputs: [],
  },
  {
    name: 'finalizeWithdrawalTransaction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_tx',
        type: 'tuple',
        components: [
          { name: 'nonce', type: 'uint256' },
          { name: 'sender', type: 'address' },
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gasLimit', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
  // Event emitted when withdrawal is proven
  {
    name: 'WithdrawalProven',
    type: 'event',
    inputs: [
      { name: 'withdrawalHash', type: 'bytes32', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
    ],
  },
  // Event emitted when withdrawal is finalized
  {
    name: 'WithdrawalFinalized',
    type: 'event',
    inputs: [
      { name: 'withdrawalHash', type: 'bytes32', indexed: true },
      { name: 'success', type: 'bool', indexed: false },
    ],
  },
] as const;

/**
 * L2OutputOracle ABI - For getting L2 state roots on L1
 */
export const L2_OUTPUT_ORACLE_ABI = [
  {
    name: 'getL2Output',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_l2OutputIndex', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'outputRoot', type: 'bytes32' },
          { name: 'timestamp', type: 'uint128' },
          { name: 'l2BlockNumber', type: 'uint128' },
        ],
      },
    ],
  },
  {
    name: 'latestOutputIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * ERC20 ABI - For approving and transferring tokens
 */
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * L1ERC721Bridge ABI - For depositing NFTs to L2
 * Key methods: bridgeERC721, bridgeERC721To
 */
export const L1_ERC721_BRIDGE_ABI = [
  {
    name: 'bridgeERC721',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_localToken', type: 'address' },
      { name: '_remoteToken', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'bridgeERC721To',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_localToken', type: 'address' },
      { name: '_remoteToken', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'ERC721BridgeInitiated',
    type: 'event',
    inputs: [
      { name: 'localToken', type: 'address', indexed: true },
      { name: 'remoteToken', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: false },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'extraData', type: 'bytes', indexed: false },
    ],
  },
] as const;

/**
 * L2ERC721Bridge ABI - For withdrawing NFTs from L2
 * Key methods: bridgeERC721, bridgeERC721To
 */
export const L2_ERC721_BRIDGE_ABI = [
  {
    name: 'bridgeERC721',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_localToken', type: 'address' },
      { name: '_remoteToken', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'bridgeERC721To',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_localToken', type: 'address' },
      { name: '_remoteToken', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'ERC721BridgeInitiated',
    type: 'event',
    inputs: [
      { name: 'localToken', type: 'address', indexed: true },
      { name: 'remoteToken', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: false },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'extraData', type: 'bytes', indexed: false },
    ],
  },
] as const;

/**
 * ERC721 ABI - For approving and transferring NFTs
 */
export const ERC721_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;
