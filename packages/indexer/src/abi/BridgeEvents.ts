/**
 * Bridge Event ABIs for Indexing
 * Events emitted by L1 and L2 bridge contracts
 */

export const BRIDGE_EVENTS = {
  L1StandardBridge: {
    ERC20DepositInitiated: {
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
  },

  L1ERC721Bridge: {
    ERC721BridgeInitiated: {
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
  },

  OptimismPortal: {
    WithdrawalProven: {
      name: 'WithdrawalProven',
      type: 'event',
      inputs: [
        { name: 'withdrawalHash', type: 'bytes32', indexed: true },
        { name: 'from', type: 'address', indexed: true },
        { name: 'to', type: 'address', indexed: true },
      ],
    },
    WithdrawalFinalized: {
      name: 'WithdrawalFinalized',
      type: 'event',
      inputs: [
        { name: 'withdrawalHash', type: 'bytes32', indexed: true },
        { name: 'success', type: 'bool', indexed: false },
      ],
    },
  },

  L2StandardBridge: {
    DepositFinalized: {
      name: 'DepositFinalized',
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
    WithdrawalInitiated: {
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
  },

  L2ERC721Bridge: {
    ERC721BridgeFinalized: {
      name: 'ERC721BridgeFinalized',
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
    ERC721BridgeInitiated: {
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
  },
} as const;

export const L1_EVENTS = [
  BRIDGE_EVENTS.L1StandardBridge.ERC20DepositInitiated,
  BRIDGE_EVENTS.L1ERC721Bridge.ERC721BridgeInitiated,
  BRIDGE_EVENTS.OptimismPortal.WithdrawalProven,
  BRIDGE_EVENTS.OptimismPortal.WithdrawalFinalized,
] as const;

export const L2_EVENTS = [
  BRIDGE_EVENTS.L2StandardBridge.DepositFinalized,
  BRIDGE_EVENTS.L2StandardBridge.WithdrawalInitiated,
  BRIDGE_EVENTS.L2ERC721Bridge.ERC721BridgeFinalized,
  BRIDGE_EVENTS.L2ERC721Bridge.ERC721BridgeInitiated,
] as const;
