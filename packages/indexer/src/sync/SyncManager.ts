import type { PublicClient, Address } from 'viem';
import type { IndexerDatabase } from '../database/Database.js';
import type { ChainType, IndexerConfig } from '../types.js';
import { SyncError } from '../types.js';
import { BlockTracker } from './BlockTracker.js';
import { EventFetcher } from './EventFetcher.js';
import { EventProcessor } from './EventProcessor.js';
import type { EventSubscription } from '../subscriptions/EventSubscription.js';

const DEFAULT_POLL_INTERVAL = 12000;
const REORG_CHECK_DEPTH = 10n;

export interface SyncStats {
  chain: ChainType;
  lastSyncedBlock: bigint;
  latestBlock: bigint;
  eventCount: number;
  isIndexing: boolean;
  isSynced: boolean;
}

export class SyncManager {
  private blockTracker: BlockTracker;
  private l1Fetcher: EventFetcher;
  private l2Fetcher: EventFetcher;
  private processor: EventProcessor;
  private pollInterval: number;
  private l1Addresses: Address[];
  private l2Addresses: Address[];
  private subscription?: EventSubscription;

  private l1SyncTimer?: NodeJS.Timeout;
  private l2SyncTimer?: NodeJS.Timeout;
  private isStopped = false;

  constructor(
    private db: IndexerDatabase,
    private l1Client: PublicClient,
    private l2Client: PublicClient,
    config: IndexerConfig,
    subscription?: EventSubscription
  ) {
    this.blockTracker = new BlockTracker(db);
    this.l1Fetcher = new EventFetcher(l1Client, 'l1');
    this.l2Fetcher = new EventFetcher(l2Client, 'l2');
    this.processor = new EventProcessor(db, subscription);
    this.subscription = subscription;
    this.pollInterval = config.pollInterval || DEFAULT_POLL_INTERVAL;
    this.l1Addresses = [config.l1BridgeAddress];
    this.l2Addresses = [config.l2BridgeAddress];
  }

  async start(): Promise<void> {
    if (!this.isStopped) {
      throw new SyncError('Sync manager is already running');
    }

    this.isStopped = false;

    await this.syncChain('l1');
    await this.syncChain('l2');

    this.startPolling();
  }

  stop(): void {
    this.isStopped = true;

    if (this.l1SyncTimer) {
      clearTimeout(this.l1SyncTimer);
      this.l1SyncTimer = undefined;
    }

    if (this.l2SyncTimer) {
      clearTimeout(this.l2SyncTimer);
      this.l2SyncTimer = undefined;
    }

    this.blockTracker.setIndexingStatus('l1', false);
    this.blockTracker.setIndexingStatus('l2', false);
  }

  async syncChain(chain: ChainType): Promise<number> {
    const fetcher = chain === 'l1' ? this.l1Fetcher : this.l2Fetcher;
    const addresses = chain === 'l1' ? this.l1Addresses : this.l2Addresses;

    try {
      this.blockTracker.setIndexingStatus(chain, true);

      const syncState = this.blockTracker.getSyncState(chain);
      const latestBlock = await fetcher.getLatestBlock();

      if (syncState.lastSyncedBlock >= latestBlock) {
        this.blockTracker.setIndexingStatus(chain, false);
        return 0;
      }

      const fromBlock = syncState.lastSyncedBlock + 1n;
      const toBlock = latestBlock;

      const logs = await fetcher.fetchEvents({
        fromBlock,
        toBlock,
        addresses,
      });

      const timestamp = await fetcher.getBlockTimestamp(toBlock);

      const processedCount = this.processor.processLogs(
        logs,
        chain,
        timestamp
      );

      this.blockTracker.updateSyncState(chain, toBlock, timestamp);

      if (this.subscription) {
        this.subscription.emitSynced(chain, toBlock);
      }

      this.blockTracker.setIndexingStatus(chain, false);

      return processedCount;
    } catch (error) {
      this.blockTracker.setIndexingStatus(chain, false);
      throw new SyncError(`Failed to sync ${chain}`, error);
    }
  }

  async backfillChain(
    chain: ChainType,
    fromBlock: bigint,
    toBlock?: bigint
  ): Promise<number> {
    const fetcher = chain === 'l1' ? this.l1Fetcher : this.l2Fetcher;
    const addresses = chain === 'l1' ? this.l1Addresses : this.l2Addresses;

    try {
      this.blockTracker.setIndexingStatus(chain, true);

      const latestBlock = toBlock || (await fetcher.getLatestBlock());

      const logs = await fetcher.fetchEvents({
        fromBlock,
        toBlock: latestBlock,
        addresses,
      });

      const timestamp = await fetcher.getBlockTimestamp(latestBlock);

      const processedCount = this.processor.processLogs(
        logs,
        chain,
        timestamp
      );

      const syncState = this.blockTracker.getSyncState(chain);
      if (latestBlock > syncState.lastSyncedBlock) {
        this.blockTracker.updateSyncState(chain, latestBlock, timestamp);
        if (this.subscription) {
          this.subscription.emitSynced(chain, latestBlock);
        }
      }

      this.blockTracker.setIndexingStatus(chain, false);

      return processedCount;
    } catch (error) {
      this.blockTracker.setIndexingStatus(chain, false);
      throw new SyncError(
        `Failed to backfill ${chain} from block ${fromBlock}`,
        error
      );
    }
  }

  private startPolling(): void {
    this.scheduleSync('l1');
    this.scheduleSync('l2');
  }

  private scheduleSync(chain: ChainType): void {
    if (this.isStopped) return;

    const timer = setTimeout(async () => {
      try {
        await this.syncChain(chain);
      } catch (error) {
        console.error(`Error syncing ${chain}:`, error);
      } finally {
        this.scheduleSync(chain);
      }
    }, this.pollInterval);

    if (chain === 'l1') {
      this.l1SyncTimer = timer;
    } else {
      this.l2SyncTimer = timer;
    }
  }

  async getSyncStats(chain: ChainType): Promise<SyncStats> {
    const fetcher = chain === 'l1' ? this.l1Fetcher : this.l2Fetcher;
    const syncState = this.blockTracker.getSyncState(chain);
    const latestBlock = await fetcher.getLatestBlock();
    const eventCount = this.processor.getEventCount(chain);

    return {
      chain,
      lastSyncedBlock: syncState.lastSyncedBlock,
      latestBlock,
      eventCount,
      isIndexing: syncState.isIndexing,
      isSynced: latestBlock - syncState.lastSyncedBlock <= 5n,
    };
  }

  async getAllSyncStats(): Promise<{
    l1: SyncStats;
    l2: SyncStats;
  }> {
    const [l1, l2] = await Promise.all([
      this.getSyncStats('l1'),
      this.getSyncStats('l2'),
    ]);

    return { l1, l2 };
  }
}
