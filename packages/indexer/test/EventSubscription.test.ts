import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventSubscription } from '../src/subscriptions/EventSubscription.js';
import { createMockBridgeEvent } from './mocks.js';

describe('EventSubscription', () => {
  let subscription: EventSubscription;

  beforeEach(() => {
    subscription = new EventSubscription();
  });

  afterEach(() => {
    subscription.removeAllSubscriptions();
  });

  describe('onEvent', () => {
    it('should receive all events', () => {
      const callback = vi.fn();
      subscription.onEvent(callback);

      const event = createMockBridgeEvent();
      subscription.emitEvent(event);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = subscription.onEvent(callback);

      const event = createMockBridgeEvent();
      subscription.emitEvent(event);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      subscription.emitEvent(event);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('onDeposit', () => {
    it('should only receive deposit events', () => {
      const callback = vi.fn();
      subscription.onDeposit(callback);

      const depositEvent = createMockBridgeEvent({
        eventType: 'DepositFinalized',
      });
      const withdrawalEvent = createMockBridgeEvent({
        eventType: 'WithdrawalInitiated',
      });

      subscription.emitEvent(depositEvent);
      subscription.emitEvent(withdrawalEvent);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(depositEvent);
    });

    it('should handle ERC20 and ERC721 deposit events', () => {
      const callback = vi.fn();
      subscription.onDeposit(callback);

      const erc20Deposit = createMockBridgeEvent({
        eventType: 'ERC20DepositInitiated',
      });
      const erc721Deposit = createMockBridgeEvent({
        eventType: 'ERC721DepositInitiated',
      });

      subscription.emitEvent(erc20Deposit);
      subscription.emitEvent(erc721Deposit);

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('onWithdrawal', () => {
    it('should only receive withdrawal events', () => {
      const callback = vi.fn();
      subscription.onWithdrawal(callback);

      const withdrawalEvent = createMockBridgeEvent({
        eventType: 'WithdrawalInitiated',
      });
      const depositEvent = createMockBridgeEvent({
        eventType: 'DepositFinalized',
      });

      subscription.emitEvent(withdrawalEvent);
      subscription.emitEvent(depositEvent);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(withdrawalEvent);
    });

    it('should handle all withdrawal phases', () => {
      const callback = vi.fn();
      subscription.onWithdrawal(callback);

      const initiated = createMockBridgeEvent({
        eventType: 'WithdrawalInitiated',
      });
      const proven = createMockBridgeEvent({
        eventType: 'WithdrawalProven',
      });
      const finalized = createMockBridgeEvent({
        eventType: 'WithdrawalFinalized',
      });

      subscription.emitEvent(initiated);
      subscription.emitEvent(proven);
      subscription.emitEvent(finalized);

      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe('onEventType', () => {
    it('should filter by specific event type', () => {
      const callback = vi.fn();
      subscription.onEventType('WithdrawalInitiated', callback);

      const withdrawalEvent = createMockBridgeEvent({
        eventType: 'WithdrawalInitiated',
      });
      const depositEvent = createMockBridgeEvent({
        eventType: 'DepositFinalized',
      });

      subscription.emitEvent(withdrawalEvent);
      subscription.emitEvent(depositEvent);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(withdrawalEvent);
    });
  });

  describe('onChain', () => {
    it('should filter by chain', () => {
      const callback = vi.fn();
      subscription.onChain('l1', callback);

      const l1Event = createMockBridgeEvent({ chain: 'l1' });
      const l2Event = createMockBridgeEvent({ chain: 'l2' });

      subscription.emitEvent(l1Event);
      subscription.emitEvent(l2Event);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(l1Event);
    });
  });

  describe('onSynced', () => {
    it('should receive sync events', () => {
      const callback = vi.fn();
      subscription.onSynced(callback);

      subscription.emitSynced('l1', 1000n);
      subscription.emitSynced('l2', 2000n);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, 'l1', 1000n);
      expect(callback).toHaveBeenNthCalledWith(2, 'l2', 2000n);
    });
  });

  describe('onError', () => {
    it('should receive error events', () => {
      const callback = vi.fn();
      subscription.onError(callback);

      const error = new Error('Test error');
      subscription.emitError(error);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(error);
    });
  });

  describe('removeAllSubscriptions', () => {
    it('should remove all listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      subscription.onEvent(callback1);
      subscription.onDeposit(callback2);
      subscription.onWithdrawal(callback3);

      subscription.removeAllSubscriptions();

      const event = createMockBridgeEvent();
      subscription.emitEvent(event);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });
  });
});
