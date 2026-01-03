import { EventEmitter } from 'events';
import type { BridgeEvent, EventType, ChainType } from '../types.js';

export type SubscriptionEventMap = {
  event: (event: BridgeEvent) => void;
  deposit: (event: BridgeEvent) => void;
  withdrawal: (event: BridgeEvent) => void;
  error: (error: Error) => void;
  synced: (chain: ChainType, blockNumber: bigint) => void;
};

export class EventSubscription extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  onEvent(callback: (event: BridgeEvent) => void): () => void {
    this.on('event', callback);
    return () => this.off('event', callback);
  }

  onDeposit(callback: (event: BridgeEvent) => void): () => void {
    this.on('deposit', callback);
    return () => this.off('deposit', callback);
  }

  onWithdrawal(callback: (event: BridgeEvent) => void): () => void {
    this.on('withdrawal', callback);
    return () => this.off('withdrawal', callback);
  }

  onError(callback: (error: Error) => void): () => void {
    this.on('error', callback);
    return () => this.off('error', callback);
  }

  onSynced(
    callback: (chain: ChainType, blockNumber: bigint) => void
  ): () => void {
    this.on('synced', callback);
    return () => this.off('synced', callback);
  }

  onEventType(
    eventType: EventType,
    callback: (event: BridgeEvent) => void
  ): () => void {
    const handler = (event: BridgeEvent) => {
      if (event.eventType === eventType) {
        callback(event);
      }
    };
    this.on('event', handler);
    return () => this.off('event', handler);
  }

  onChain(
    chain: ChainType,
    callback: (event: BridgeEvent) => void
  ): () => void {
    const handler = (event: BridgeEvent) => {
      if (event.chain === chain) {
        callback(event);
      }
    };
    this.on('event', handler);
    return () => this.off('event', handler);
  }

  emitEvent(event: BridgeEvent): void {
    this.emit('event', event);

    const isDeposit = [
      'ERC20DepositInitiated',
      'ERC721DepositInitiated',
      'DepositFinalized',
    ].includes(event.eventType);

    const isWithdrawal = [
      'WithdrawalInitiated',
      'WithdrawalProven',
      'WithdrawalFinalized',
    ].includes(event.eventType);

    if (isDeposit) {
      this.emit('deposit', event);
    }

    if (isWithdrawal) {
      this.emit('withdrawal', event);
    }
  }

  emitError(error: Error): void {
    this.emit('error', error);
  }

  emitSynced(chain: ChainType, blockNumber: bigint): void {
    this.emit('synced', chain, blockNumber);
  }

  removeAllSubscriptions(): void {
    this.removeAllListeners();
  }
}
