import type { Address, Hash } from 'viem';

export enum WithdrawalStatus {
  INITIATED = 'INITIATED',
  PROVEN = 'PROVEN',
  READY_FOR_FINALIZATION = 'READY_FOR_FINALIZATION',
  FINALIZED = 'FINALIZED',
}

export interface WithdrawalInfo {
  txHash: Hash;
  tokenAddress: Address;
  tokenId: bigint;
  from: Address;
  to: Address;
  status: WithdrawalStatus;
  initiatedAt?: bigint;
  provenAt?: bigint;
  finalizedAt?: bigint;
}
