/**
 * GasPriceOracle Contract ABI
 *
 * Predeployed at: 0x420000000000000000000000000000000000000F
 * Available on: Mantle Mainnet, Mantle Sepolia
 *
 * This contract provides gas price information for Optimism/Mantle L2 networks,
 * including the L1 data fee calculation.
 *
 * Key Methods:
 * - getL1Fee(bytes): Calculate L1 portion of transaction fee
 * - getL1GasUsed(bytes): Get L1 gas consumed for data posting
 * - baseFee(): Get current L1 base fee
 * - overhead(): Get overhead constant for L1 fee calculation
 * - scalar(): Get scalar multiplier for L1 fee
 */

export const GAS_PRICE_ORACLE_ABI = [
  {
    name: 'getL1Fee',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        name: '_data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    name: 'getL1GasUsed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        name: '_data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    name: 'baseFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    name: 'overhead',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    name: 'scalar',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    name: 'gasPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    name: 'l1BaseFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
] as const; 