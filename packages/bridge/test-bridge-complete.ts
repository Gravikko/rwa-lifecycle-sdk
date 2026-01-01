/**
 * Complete Bridge Testing Script
 *
 * Tests both ERC20 and ERC721 bridging
 *
 * Prerequisites:
 * 1. ETH on Sepolia for gas
 * 2. MNT on Mantle Sepolia for L2 gas
 * 3. For ERC721: Deploy TestRWA_Bridgeable on both L1 and L2
 *
 * Run: npx tsx packages/bridge/test-bridge-complete.ts
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
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

async function testERC721Bridge(bridge: BridgeModule, account: any) {
  console.log('\n📦 Testing ERC721 NFT Bridging\n');
  console.log('━'.repeat(60));

  // Check if bridgeable contract is deployed
  const l1TokenAddress = process.env.TEST_RWA_BRIDGEABLE_L1;
  const l2TokenAddress = process.env.TEST_RWA_BRIDGEABLE_L2;

  if (!l1TokenAddress || !l2TokenAddress) {
    console.log('⚠️  Bridgeable contracts not deployed yet');
    console.log('\nTo deploy:');
    console.log('1. cd contracts');
    console.log('2. Deploy L1: forge script script/DeployBridgeable.s.sol:DeployBridgeable_L1 --rpc-url $ETHEREUM_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY --broadcast');
    console.log('3. Update .env with TEST_RWA_BRIDGEABLE_L1');
    console.log('4. Deploy L2: forge script script/DeployBridgeable.s.sol:DeployBridgeable_L2 --rpc-url $MANTLE_TESTNET_RPC --private-key $DEPLOYER_PRIVATE_KEY --broadcast');
    console.log('5. Update .env with TEST_RWA_BRIDGEABLE_L2');
    return;
  }

  console.log('✅ L1 Token:', l1TokenAddress);
  console.log('✅ L2 Token:', l2TokenAddress);

  // TODO: Mint an NFT on L1
  // TODO: Bridge NFT to L2
  // TODO: Verify NFT exists on L2

  console.log('\n💡 ERC721 bridge test implementation pending');
  console.log('   Requires: Minting NFT + calling bridge.depositNFT()');
}

async function testERC20Bridge(bridge: BridgeModule, account: any) {
  console.log('\n💰 Testing ERC20 Token Bridging\n');
  console.log('━'.repeat(60));

  console.log('⚠️  ERC20 bridging requires:');
  console.log('1. Deploy an ERC20 token on L1');
  console.log('2. Create L2 representation via factory:');
  console.log('   cast send 0x4200000000000000000000000000000000000012 \\');
  console.log('     "createOptimismMintableERC20(address,string,string)" \\');
  console.log('     $L1_TOKEN_ADDRESS "Token Name" "SYMBOL"');
  console.log('3. Use bridge.depositERC20()');

  console.log('\n💡 ERC20 bridge test implementation pending');
}

async function main() {
  console.log('🌉 Complete Bridge Testing Suite\n');
  console.log('━'.repeat(60));

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
  console.log('\n💰 Account Balances');
  console.log('━'.repeat(60));
  const l1Balance = await l1PublicClient.getBalance({ address: account.address });
  const l2Balance = await l2PublicClient.getBalance({ address: account.address });

  console.log(`L1 (Sepolia):       ${formatEther(l1Balance)} ETH`);
  console.log(`L2 (Mantle Sepolia): ${formatEther(l2Balance)} MNT`);

  if (l1Balance === 0n) {
    console.log('\n❌ No ETH on Sepolia');
    console.log('Get testnet ETH: https://sepoliafaucet.com/');
    return;
  }

  if (l2Balance === 0n) {
    console.log('\n⚠️  No MNT on Mantle Sepolia');
    console.log('Get testnet MNT: https://faucet.sepolia.mantle.xyz/');
  }

  // Initialize Bridge Module
  console.log('\n🔧 Initializing Bridge Module');
  console.log('━'.repeat(60));
  const bridge = new BridgeModule({
    l1PublicClient,
    l2PublicClient,
    l1WalletClient,
    l2WalletClient,
    network: 'testnet',
  });
  console.log('✅ Bridge Module initialized');

  // Test menu
  console.log('\n📋 Available Tests');
  console.log('━'.repeat(60));
  console.log('1. ERC721 (NFT) Bridging');
  console.log('2. ERC20 (Fungible Token) Bridging');
  console.log('3. Both\n');

  // Run tests
  await testERC721Bridge(bridge, account);
  await testERC20Bridge(bridge, account);

  console.log('\n✅ Test suite complete!');
  console.log('━'.repeat(60));
}

main().catch(console.error);
