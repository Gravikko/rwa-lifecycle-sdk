/**
 * Test script for depositing NFT from Sepolia to Mantle Sepolia
 *
 * Prerequisites:
 * 1. Set DEPLOYER_PRIVATE_KEY in .env
 * 2. Have Sepolia ETH in your wallet
 * 3. TestRWA contract deployed on Sepolia (0x2765c33a024DF883c46Dc67c54221650f0Cc9563)
 * 4. Mint an NFT on Sepolia first using: forge script contracts/script/Deploy.s.sol --sig "mint()"
 */

import { BridgeModule } from './src/BridgeModule.js';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env
dotenv.config({ path: resolve(__dirname, '../../.env') });

// Mantle Sepolia chain config
const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia Testnet',
  network: 'mantle-sepolia',
  nativeCurrency: {
    name: 'MNT',
    symbol: 'MNT',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.sepolia.mantle.xyz'] },
    public: { http: ['https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantle Sepolia Explorer', url: 'https://explorer.sepolia.mantle.xyz' },
  },
} as const;

async function main() {
  console.log('🚀 Starting Bridge Test: Deposit NFT from Sepolia → Mantle Sepolia\n');

  // Setup
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not found in .env');
  }

  const account = privateKeyToAccount(privateKey);
  console.log('📍 Using account:', account.address);

  // TestRWA contract on Sepolia (L1)
  const TEST_RWA_ADDRESS = process.env.TEST_RWA_TOKEN_ADDRESS || '0x74FCC496E0c4cBb3e59C5F09e3661cA20520a661';
  const TOKEN_ID = 1n; // Change this if you minted a different token ID

  console.log('📍 TestRWA Contract:', TEST_RWA_ADDRESS);
  console.log('📍 Token ID:', TOKEN_ID.toString());
  console.log('');

  // Create clients
  console.log('🔧 Creating viem clients...');

  const l1PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const l1WalletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  const l2PublicClient = createPublicClient({
    chain: mantleSepolia,
    transport: http(),
  });

  const l2WalletClient = createWalletClient({
    account,
    chain: mantleSepolia,
    transport: http(),
  });

  console.log('✅ Clients created\n');

  // Initialize bridge
  console.log('🌉 Initializing bridge module...');
  const bridge = new BridgeModule({
    l1PublicClient,
    l2PublicClient,
    l1WalletClient,
    l2WalletClient,
    network: 'testnet',
  });
  console.log('✅ Bridge initialized\n');

  // Check NFT ownership on L1
  console.log('🔍 Step 1: Checking NFT ownership on Sepolia...');
  try {
    const owner = await l1PublicClient.readContract({
      address: TEST_RWA_ADDRESS,
      abi: [
        {
          name: 'ownerOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'tokenId', type: 'uint256' }],
          outputs: [{ name: '', type: 'address' }],
        },
      ],
      functionName: 'ownerOf',
      args: [TOKEN_ID],
    });

    console.log('   Owner:', owner);
    console.log('   Your address:', account.address);

    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error('You do not own this NFT! Mint it first using: forge script contracts/script/Deploy.s.sol --sig "mint()"');
    }
    console.log('✅ You own the NFT!\n');
  } catch (error: any) {
    if (error.message.includes('ERC721NonexistentToken')) {
      throw new Error('Token does not exist! Mint it first using: forge script contracts/script/Deploy.s.sol --sig "mint()"');
    }
    throw error;
  }

  // Check balance
  console.log('💰 Checking ETH balance on Sepolia...');
  const balance = await l1PublicClient.getBalance({ address: account.address });
  console.log('   Balance:', (Number(balance) / 1e18).toFixed(4), 'ETH');
  if (balance < 10000000000000000n) { // 0.01 ETH
    console.warn('⚠️  Warning: Low balance, you might need more ETH for gas');
  }
  console.log('');

  // Deposit NFT
  console.log('🚀 Step 2: Depositing NFT to Mantle Sepolia...');
  console.log('   This will:');
  console.log('   1. Approve L1StandardBridge to transfer your NFT');
  console.log('   2. Call bridgeERC721() on L1StandardBridge');
  console.log('   3. Wait for transaction confirmation');
  console.log('');

  try {
    const result = await bridge.depositNFT(
      TEST_RWA_ADDRESS,
      TOKEN_ID,
      {
        onProgress: (txHash) => {
          console.log('   📝 Transaction submitted:', txHash);
        },
      }
    );

    console.log('\n🎉 SUCCESS! NFT Deposited!\n');
    console.log('📋 Deposit Details:');
    console.log('   Transaction Hash:', result.txHash);
    console.log('   Token Address:', result.tokenAddress);
    console.log('   Token ID:', result.tokenId.toString());
    console.log('   From:', result.from);
    console.log('   To:', result.to);
    console.log('');

    console.log('🔗 View on Etherscan:');
    console.log('   https://sepolia.etherscan.io/tx/' + result.txHash);
    console.log('');

    console.log('⏳ Next Steps:');
    console.log('   1. Wait ~10-15 minutes for the NFT to arrive on Mantle Sepolia');
    console.log('   2. Check ownership on Mantle Sepolia explorer:');
    console.log('      https://explorer.sepolia.mantle.xyz/token/' + TEST_RWA_ADDRESS);
    console.log('   3. Try withdrawing it back using test-withdrawal.ts');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
