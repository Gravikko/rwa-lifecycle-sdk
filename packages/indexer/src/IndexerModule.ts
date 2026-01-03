import type { IndexerConfig, IndexerClients } from './types.js';
import { IndexerDatabase } from './database/Database.js';
import { createIndexerClients } from './clients.js';
import { SyncManager } from './sync/SyncManager.js';
import { TransactionQuery } from './query/TransactionQuery.js';
import { DepositWithdrawalQuery } from './query/DepositWithdrawalQuery.js';
import { WithdrawalStatusQuery } from './query/WithdrawalStatusQuery.js';
import { EventSubscription } from './subscriptions/EventSubscription.js';

export class IndexerModule {
  private db: IndexerDatabase;
  private clients: IndexerClients;
  private syncManager: SyncManager;
  public readonly subscription: EventSubscription;
  public readonly transactions: TransactionQuery;
  public readonly deposits: DepositWithdrawalQuery;
  public readonly withdrawals: WithdrawalStatusQuery;

  constructor(config: IndexerConfig) {
    this.db = new IndexerDatabase(config.databasePath);
    this.clients = createIndexerClients(config);
    this.subscription = new EventSubscription();

    this.syncManager = new SyncManager(
      this.db,
      this.clients.l1,
      this.clients.l2,
      config,
      this.subscription
    );

    this.transactions = new TransactionQuery(this.db);
    this.deposits = new DepositWithdrawalQuery(this.db);
    this.withdrawals = new WithdrawalStatusQuery(this.db);
  }

  async start(): Promise<void> {
    await this.syncManager.start();
  }

  stop(): void {
    this.syncManager.stop();
  }

  async syncNow(): Promise<{ l1Events: number; l2Events: number }> {
    const [l1Events, l2Events] = await Promise.all([
      this.syncManager.syncChain('l1'),
      this.syncManager.syncChain('l2'),
    ]);

    return { l1Events, l2Events };
  }

  async backfill(options: {
    l1FromBlock?: bigint;
    l2FromBlock?: bigint;
    toBlock?: bigint;
  }): Promise<{ l1Events: number; l2Events: number }> {
    const results = await Promise.all([
      options.l1FromBlock
        ? this.syncManager.backfillChain(
            'l1',
            options.l1FromBlock,
            options.toBlock
          )
        : Promise.resolve(0),
      options.l2FromBlock
        ? this.syncManager.backfillChain(
            'l2',
            options.l2FromBlock,
            options.toBlock
          )
        : Promise.resolve(0),
    ]);

    return { l1Events: results[0], l2Events: results[1] };
  }

  async getStats() {
    return this.syncManager.getAllSyncStats();
  }

  close(): void {
    this.stop();
    this.subscription.removeAllSubscriptions();
    this.db.close();
  }
}
