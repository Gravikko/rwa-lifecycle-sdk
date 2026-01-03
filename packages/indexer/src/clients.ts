import { createPublicClient, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type { PublicClient, Chain } from 'viem';
import type { IndexerConfig, IndexerClients } from './types.js';
import { RPCError } from './types.js';

const mantleMainnet: Chain = {
  id: 5000,
  name: 'Mantle',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mantle.xyz'] },
    public: { http: ['https://rpc.mantle.xyz'] },
  },
  blockExplorers: {
    default: {
      name: 'Mantle Explorer',
      url: 'https://explorer.mantle.xyz',
    },
  },
};

const mantleSepolia: Chain = {
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.sepolia.mantle.xyz'] },
    public: { http: ['https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: {
      name: 'Mantle Sepolia Explorer',
      url: 'https://explorer.sepolia.mantle.xyz',
    },
  },
  testnet: true,
};

export function createIndexerClients(config: IndexerConfig): IndexerClients {
  try {
    const l1Chain = detectL1Chain(config.l1RpcUrl);
    const l2Chain = detectL2Chain(config.l2RpcUrl);

    const l1Client = createPublicClient({
      chain: l1Chain,
      transport: http(config.l1RpcUrl, {
        retryCount: 3,
        retryDelay: 1000,
        timeout: 30_000,
      }),
    });

    const l2Client = createPublicClient({
      chain: l2Chain,
      transport: http(config.l2RpcUrl, {
        retryCount: 3,
        retryDelay: 1000,
        timeout: 30_000,
      }),
    });

    return { l1: l1Client, l2: l2Client };
  } catch (error) {
    throw new RPCError('Failed to create RPC clients', error);
  }
}

function detectL1Chain(rpcUrl: string): Chain {
  if (rpcUrl.includes('sepolia')) {
    return sepolia;
  }
  if (rpcUrl.includes('mainnet') || rpcUrl.includes('ethereum')) {
    return mainnet;
  }
  return mainnet;
}

function detectL2Chain(rpcUrl: string): Chain {
  if (rpcUrl.includes('sepolia')) {
    return mantleSepolia;
  }
  return mantleMainnet;
}

export async function testRpcConnection(
  client: PublicClient,
  chainName: string
): Promise<void> {
  try {
    const blockNumber = await client.getBlockNumber();
    console.log(`✓ ${chainName} connected (block: ${blockNumber})`);
  } catch (error) {
    throw new RPCError(`Failed to connect to ${chainName}`, error);
  }
}
