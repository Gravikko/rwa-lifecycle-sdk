import type { Address, Hash } from 'viem';

export interface TransferEvent {
  id: string;
  tokenId: string;
  from: Address;
  to: Address;
  blockNumber: bigint;
  timestamp: bigint;
  transactionHash: Hash;
}

export interface Asset {
  id: string;
  currentOwner: Address;
  mintedAt: bigint;
  transferCount: number;
  transfers?: TransferEvent[];
}
