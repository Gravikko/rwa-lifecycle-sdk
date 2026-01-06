/**
 * ABI definitions for ERC3643 (T-REX) standard contracts
 *
 * ERC3643 is a standard for compliant security tokens with built-in
 * identity verification and transfer restrictions.
 *
 * @see https://erc3643.org/
 */

/**
 * ERC165 Interface Detection
 * Used to check if a contract supports ERC3643
 */
export const ERC165_ABI = [
  {
    name: 'supportsInterface',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'interfaceId', type: 'bytes4' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

/**
 * ERC3643 Token Interface
 * Main compliance functions for the security token
 */
export const ERC3643_TOKEN_ABI = [
  {
    name: 'canTransfer',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isVerified',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'identityRegistry',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'compliance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

/**
 * Identity Registry Interface
 * Stores and manages investor identities and verification status
 */
export const IDENTITY_REGISTRY_ABI = [
  {
    name: 'isVerified',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'contains',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'investorCountry',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint16' }],
  },
  {
    name: 'identity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
] as const;

/**
 * ERC3643 Interface IDs for ERC165 detection
 *
 * These are used with supportsInterface() to detect if a contract
 * implements the ERC3643 standard.
 */
export const ERC3643_INTERFACE_IDS = {
  /** ERC3643 Token interface ID */
  ERC3643_TOKEN: '0x0b0c6777',

  /** Identity Registry interface ID */
  IDENTITY_REGISTRY: '0x8b7c8b0a',

  /** ERC165 interface ID (interface detection itself) */
  ERC165: '0x01ffc9a7',
} as const;
