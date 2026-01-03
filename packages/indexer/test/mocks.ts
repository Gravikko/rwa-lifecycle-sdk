import type { BridgeEvent, ChainType, EventType } from '../src/types.js';
import type { Log } from 'viem';

export function createMockBridgeEvent(
  overrides: Partial<BridgeEvent> = {}
): BridgeEvent {
  return {
    id: '0xabc123-0',
    chain: 'l2',
    eventType: 'DepositFinalized',
    blockNumber: 1000n,
    blockHash: '0xblock123',
    transactionHash: '0xabc123',
    logIndex: 0,
    timestamp: 1700000000n,
    from: '0x1234567890123456789012345678901234567890',
    to: '0x0987654321098765432109876543210987654321',
    token: '0xtoken1234567890123456789012345678901234567890',
    amount: 1000000000000000000n,
    ...overrides,
  };
}

export function createMockLog(overrides: Partial<Log> = {}): Log {
  return {
    address: '0x4200000000000000000000000000000000000010',
    topics: [
      '0x73d170910aba9e6d50b102db522b1dbcd796216f5128b445aa2135272886497e',
      '0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0x0000000000000000000000001234567890123456789012345678901234567890',
    ],
    data: '0x00000000000000000000000009876543210987654321098765432109876543210000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000',
    blockNumber: 1000n,
    blockHash: '0xblock123',
    transactionHash: '0xabc123',
    transactionIndex: 0,
    logIndex: 0,
    removed: false,
    ...overrides,
  } as Log;
}

export function createMockEvents(count: number, chain: ChainType = 'l2'): BridgeEvent[] {
  return Array.from({ length: count }, (_, i) =>
    createMockBridgeEvent({
      id: `0xtx${i}-${i}`,
      transactionHash: `0xtx${i}` as any,
      blockNumber: BigInt(1000 + i),
      timestamp: BigInt(1700000000 + i * 12),
      chain,
      logIndex: i,
    })
  );
}
