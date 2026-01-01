/**
 * Simple ERC20 Bridge Test
 *
 * This script tests bridging a simple ERC20 token from Sepolia to Mantle
 *
 * Prerequisites:
 * 1. ETH on Sepolia for gas
 * 2. MNT on Mantle Sepolia for L2 gas
 *
 * Run: npx tsx packages/bridge/test-erc20-bridge.ts
 */

import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { BridgeModule } from './src/BridgeModule.js';
import dotenv from 'dotenv';

dotenv.config();

// Mantle Sepolia chain config
const mantleSepoliaTestnet = {
  id: 5003,
  name: 'Mantle Sepolia Testnet',
  network: 'mantle-sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MANTLE_TESTNET_RPC!] },
    public: { http: ['https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantle Explorer', url: 'https://explorer.sepolia.mantle.xyz' },
  },
  testnet: true,
} as const;

async function main() {
  console.log('🌉 Testing ERC20 Bridge\n');

  // Setup account
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log('Account:', account.address);

  // Create clients
  const l1PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.ETHEREUM_SEPOLIA_RPC),
  });

  const l2PublicClient = createPublicClient({
    chain: mantleSepoliaTestnet,
    transport: http(process.env.MANTLE_TESTNET_RPC),
  });

  const l1WalletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.ETHEREUM_SEPOLIA_RPC),
  });

  const l2WalletClient = createWalletClient({
    account,
    chain: mantleSepoliaTestnet,
    transport: http(process.env.MANTLE_TESTNET_RPC),
  });

  // Check balances
  console.log('\n💰 Checking balances...');
  const l1Balance = await l1PublicClient.getBalance({ address: account.address });
  const l2Balance = await l2PublicClient.getBalance({ address: account.address });

  console.log(`L1 (Sepolia) ETH: ${(Number(l1Balance) / 1e18).toFixed(4)} ETH`);
  console.log(`L2 (Mantle) MNT: ${(Number(l2Balance) / 1e18).toFixed(4)} MNT`);

  if (l1Balance === 0n) {
    console.log('\n❌ No ETH on Sepolia. Get testnet ETH from: https://sepoliafaucet.com/');
    return;
  }

  if (l2Balance === 0n) {
    console.log('\n⚠️  No MNT on Mantle Sepolia. You can bridge ETH to get MNT.');
    console.log('   For now, we\'ll just test L1 deposit (won\'t need L2 gas yet)');
  }

  // Initialize Bridge Module
  console.log('\n🔧 Initializing Bridge Module...');
  const bridge = new BridgeModule({
    l1PublicClient,
    l2PublicClient,
    l1WalletClient,
    l2WalletClient,
    network: 'testnet',
  });

  console.log('✅ Bridge Module initialized\n');

  // For ERC20 testing, we need to deploy a simple test token
  console.log('📝 Next steps to test ERC20 bridging:');
  console.log('1. Deploy a simple ERC20 token on Sepolia');
  console.log('2. Create L2 token using Mantle factory');
  console.log('3. Use bridge.depositERC20() to bridge tokens\n');

  console.log('💡 Alternative: Test ETH bridging instead (no token deployment needed)');
  console.log('   ETH can be bridged directly as the native asset\n');

  // Test ETH deposit as simplest case
  console.log('🧪 Would you like to test ETH deposit? (0.001 ETH)');
  console.log('   This will cost ~$0.50 in gas on Sepolia');
  console.log('\n   Uncomment the code below to execute:');
  console.log(`
  // const depositTx = await bridge.depositETH(parseEther('0.001'));
  // console.log('✅ ETH Deposit TX:', depositTx);
  `);
}

main().catch(console.error);
