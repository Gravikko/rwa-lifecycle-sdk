import type { Log, Address, Hash } from 'viem';
import { decodeEventLog } from 'viem';
import type { BridgeEvent, ChainType, EventType } from '../types.js';
import { BRIDGE_EVENTS } from '../abi/BridgeEvents.js';

export class EventParser {
  parseLog(log: Log, chain: ChainType, timestamp: bigint): BridgeEvent | null {
    try {
      const eventType = this.identifyEventType(log, chain);
      if (!eventType) {
        return null;
      }

      const eventAbi = this.getEventAbi(eventType, chain);
      if (!eventAbi) {
        return null;
      }

      const decoded = decodeEventLog({
        abi: [eventAbi],
        data: log.data,
        topics: log.topics,
      });

      return this.createBridgeEvent(
        decoded,
        log,
        chain,
        eventType,
        timestamp
      );
    } catch (error) {
      console.error('Failed to parse event:', error);
      return null;
    }
  }

  private identifyEventType(log: Log, chain: ChainType): EventType | null {
    const signature = log.topics[0];

    if (chain === 'l1') {
      if (signature === this.getEventSignature('ERC20DepositInitiated')) {
        return 'ERC20DepositInitiated';
      }
      if (signature === this.getEventSignature('ERC721DepositInitiated')) {
        return 'ERC721DepositInitiated';
      }
      if (signature === this.getEventSignature('WithdrawalProven')) {
        return 'WithdrawalProven';
      }
      if (signature === this.getEventSignature('WithdrawalFinalized')) {
        return 'WithdrawalFinalized';
      }
    }

    if (chain === 'l2') {
      if (signature === this.getEventSignature('DepositFinalized')) {
        return 'DepositFinalized';
      }
      if (signature === this.getEventSignature('WithdrawalInitiated')) {
        return 'WithdrawalInitiated';
      }
      if (
        signature === this.getEventSignature('ERC721BridgeInitiated') ||
        signature === this.getEventSignature('ERC721BridgeFinalized')
      ) {
        return 'WithdrawalInitiated';
      }
    }

    return null;
  }

  private getEventAbi(eventType: EventType, chain: ChainType) {
    if (eventType === 'ERC20DepositInitiated') {
      return BRIDGE_EVENTS.L1StandardBridge.ERC20DepositInitiated;
    }
    if (eventType === 'ERC721DepositInitiated') {
      return BRIDGE_EVENTS.L1ERC721Bridge.ERC721BridgeInitiated;
    }
    if (eventType === 'WithdrawalProven') {
      return BRIDGE_EVENTS.OptimismPortal.WithdrawalProven;
    }
    if (eventType === 'WithdrawalFinalized') {
      return BRIDGE_EVENTS.OptimismPortal.WithdrawalFinalized;
    }
    if (eventType === 'DepositFinalized') {
      return BRIDGE_EVENTS.L2StandardBridge.DepositFinalized;
    }
    if (eventType === 'WithdrawalInitiated') {
      return BRIDGE_EVENTS.L2StandardBridge.WithdrawalInitiated;
    }

    return null;
  }

  private getEventSignature(eventName: string): Hash | null {
    return null;
  }

  private createBridgeEvent(
    decoded: any,
    log: Log,
    chain: ChainType,
    eventType: EventType,
    timestamp: bigint
  ): BridgeEvent {
    const args = decoded.args as any;

    const id = `${log.transactionHash}-${log.logIndex}`;

    const baseEvent: BridgeEvent = {
      id,
      chain,
      eventType,
      blockNumber: log.blockNumber!,
      blockHash: log.blockHash!,
      transactionHash: log.transactionHash!,
      logIndex: Number(log.logIndex!),
      timestamp,
      from: (args.from || args.sender) as Address,
      to: (args.to || args.target) as Address,
    };

    if (args.l1Token || args.l2Token || args.localToken) {
      baseEvent.token = (args.l1Token || args.l2Token || args.localToken) as Address;
    }

    if (args.tokenId !== undefined) {
      baseEvent.tokenId = BigInt(args.tokenId);
    }

    if (args.amount !== undefined) {
      baseEvent.amount = BigInt(args.amount);
    }

    if (args.extraData) {
      baseEvent.data = args.extraData as string;
    }

    return baseEvent;
  }

  generateEventId(transactionHash: Hash, logIndex: number): string {
    return `${transactionHash}-${logIndex}`;
  }

  normalizeAddress(address: string): Address {
    return address.toLowerCase() as Address;
  }
}
