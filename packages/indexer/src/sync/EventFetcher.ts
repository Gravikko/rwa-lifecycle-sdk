import type { PublicClient, Log, Address } from 'viem';
import { RPCError } from '../types.js';
import { L1_EVENTS, L2_EVENTS } from '../abi/BridgeEvents.js';

const BLOCK_CHUNK_SIZE = 10000n;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export interface FetchEventsOptions {
  fromBlock: bigint;
  toBlock: bigint;
  addresses?: Address[];
}

export class EventFetcher {
  constructor(
    private client: PublicClient,
    private chainType: 'l1' | 'l2'
  ) {}

  async fetchEvents(options: FetchEventsOptions): Promise<Log[]> {
    const { fromBlock, toBlock, addresses } = options;
    const allLogs: Log[] = [];

    const chunks = this.createBlockChunks(fromBlock, toBlock);

    for (const { from, to } of chunks) {
      const logs = await this.fetchChunk(from, to, addresses);
      allLogs.push(...logs);
    }

    return allLogs;
  }

  private async fetchChunk(
    fromBlock: bigint,
    toBlock: bigint,
    addresses?: Address[]
  ): Promise<Log[]> {
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const events = this.chainType === 'l1' ? L1_EVENTS : L2_EVENTS;

        const logs = await this.client.getLogs({
          address: addresses,
          events: events as any,
          fromBlock,
          toBlock,
        });

        return logs as Log[];
      } catch (error) {
        attempt++;

        if (attempt >= MAX_RETRIES) {
          throw new RPCError(
            `Failed to fetch logs after ${MAX_RETRIES} attempts (blocks ${fromBlock}-${toBlock})`,
            error
          );
        }

        await this.delay(RETRY_DELAY_MS * attempt);
      }
    }

    return [];
  }

  private createBlockChunks(
    fromBlock: bigint,
    toBlock: bigint
  ): Array<{ from: bigint; to: bigint }> {
    const chunks: Array<{ from: bigint; to: bigint }> = [];
    let currentFrom = fromBlock;

    while (currentFrom <= toBlock) {
      const currentTo =
        currentFrom + BLOCK_CHUNK_SIZE - 1n > toBlock
          ? toBlock
          : currentFrom + BLOCK_CHUNK_SIZE - 1n;

      chunks.push({ from: currentFrom, to: currentTo });
      currentFrom = currentTo + 1n;
    }

    return chunks;
  }

  async getLatestBlock(): Promise<bigint> {
    try {
      return await this.client.getBlockNumber();
    } catch (error) {
      throw new RPCError('Failed to get latest block number', error);
    }
  }

  async getBlockTimestamp(blockNumber: bigint): Promise<bigint> {
    try {
      const block = await this.client.getBlock({
        blockNumber,
      });
      return block.timestamp;
    } catch (error) {
      throw new RPCError(
        `Failed to get timestamp for block ${blockNumber}`,
        error
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
