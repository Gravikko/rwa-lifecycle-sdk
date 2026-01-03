/**
 * Indexer Module - Event indexing and querying
 * Phase 1, 2, 3 & 4 In Progress (Foundation + Core Sync + Query Interface + Production Ready)
 */

export * from './types.js';
export { IndexerModule } from './IndexerModule.js';
export { IndexerDatabase } from './database/Database.js';
export { EventParser } from './parsers/EventParser.js';
export { createIndexerClients, testRpcConnection } from './clients.js';
export { BlockTracker } from './sync/BlockTracker.js';
export { EventFetcher } from './sync/EventFetcher.js';
export { EventProcessor } from './sync/EventProcessor.js';
export { SyncManager } from './sync/SyncManager.js';
export type { SyncStats } from './sync/SyncManager.js';
export { TransactionQuery } from './query/TransactionQuery.js';
export { DepositWithdrawalQuery } from './query/DepositWithdrawalQuery.js';
export { WithdrawalStatusQuery } from './query/WithdrawalStatusQuery.js';
export { EventSubscription } from './subscriptions/EventSubscription.js';
export * from './abi/BridgeEvents.js';
export * from './database/schema.js';
