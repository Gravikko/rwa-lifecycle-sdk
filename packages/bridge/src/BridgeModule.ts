/**
 * Bridge Module - Automates Mantle L2↔L1 token bridging
 *
 * This module handles:
 * - ERC721 NFT deposits (L1 → L2)
 * - ERC721 NFT withdrawals (L2 → L1)
 * - 3-phase withdrawal process: initiate → prove → finalize
 *
 * Documentation: https://docs.mantle.xyz/network/for-devs/cross-dom-comm
 */

import type { Address, Hash, PublicClient, WalletClient } from 'viem';
import { publicActionsL1, publicActionsL2, walletActionsL1, walletActionsL2 } from 'viem/op-stack';
import type {
    BridgeConfig,
    WithdrawalOptions,
    DepositOptions,
    WithdrawalInfo,
    DepositInfo,
} from './types.js';
import { WithdrawalStatus } from './types.js';
import {
    MANTLE_SEPOLIA_CONTRACTS,
    MANTLE_MAINNET_CONTRACTS,
    L1_STANDARD_BRIDGE_ABI,
    L2_STANDARD_BRIDGE_ABI,
    L1_ERC721_BRIDGE_ABI,
    L2_ERC721_BRIDGE_ABI,
    OPTIMISM_PORTAL_ABI,
    L2_OUTPUT_ORACLE_ABI,
    ERC20_ABI,
    ERC721_ABI,
} from './contracts.js';

export class BridgeModule {
    // Viem clients extended with OP Stack actions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private l1PublicClient: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private l2PublicClient: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private l1WalletClient: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private l2WalletClient: any;

    // Contract addresses (based on network)
    private contracts: typeof MANTLE_SEPOLIA_CONTRACTS;

    /**
     * Initialize the Bridge Module
     *
     * @param config - Configuration with L1/L2 clients
     * @example
     * ```typescript
     * const bridge = new BridgeModule({
     *   l1PublicClient: createPublicClient({ chain: sepolia, ... }),
     *   l2PublicClient: createPublicClient({ chain: mantleSepoliaTestnet, ... }),
     *   l1WalletClient: createWalletClient({ ... }),
     *   l2WalletClient: createWalletClient({ ... }),
     *   network: 'testnet',
     * });
     * ```
     */
    constructor(config: BridgeConfig) {
        // Extend clients with OP Stack actions
        this.l1PublicClient = config.l1PublicClient.extend(publicActionsL1());
        this.l2PublicClient = config.l2PublicClient.extend(publicActionsL2());
        this.l1WalletClient = config.l1WalletClient.extend(walletActionsL1());
        this.l2WalletClient = config.l2WalletClient.extend(walletActionsL2());

        // Select contracts based on network
        this.contracts =
            config.network === 'mainnet'
                ? MANTLE_MAINNET_CONTRACTS
                : MANTLE_SEPOLIA_CONTRACTS;
    }

    // ============================================
    // DEPOSIT (L1 → L2)
    // ============================================

    /**
     * Deposit an ERC721 NFT from Ethereum L1 to Mantle L2
     *
     * TODO: Implement the following steps:
     * 1. Check NFT ownership on L1
     * 2. Approve L1StandardBridge to transfer the NFT
     * 3. Call L1StandardBridge.bridgeERC721() or depositERC721()
     * 4. Wait for transaction confirmation
     * 5. Return deposit info with transaction hash
     *
     * @param tokenAddress - L1 NFT contract address
     * @param tokenId - Token ID to deposit
     * @param options - Deposit options (recipient, gas limit, etc.)
     * @returns Deposit information
     */
    async depositNFT(
        tokenAddress: Address,
        tokenId: bigint,
        options?: DepositOptions
    ): Promise<DepositInfo> {
        const recipient = options?.to || this.l1WalletClient.account?.address;
        if (!recipient) throw new Error('No recipient address');

        // Step 1: Check NFT ownership on L1
        const owner = await this.l1PublicClient.readContract({
            address: tokenAddress,
            abi: ERC721_ABI,
            functionName: 'ownerOf',
            args: [tokenId],
        });

        if (owner.toLowerCase() !== recipient.toLowerCase()) {
            throw new Error('You do not own this NFT');
        }

        // Step 2: Approve L1ERC721Bridge to transfer the NFT
        const approveTx = await this.l1WalletClient.writeContract({
            account: this.l1WalletClient.account!,
            chain: null,
            address: tokenAddress,
            abi: ERC721_ABI,
            functionName: 'approve',
            args: [this.contracts.L1ERC721Bridge, tokenId],
        });

        // Wait for approval transaction
        await this.l1PublicClient.waitForTransactionReceipt({ hash: approveTx });

        // Step 3: Call L1ERC721Bridge.bridgeERC721() to deposit
        const depositTx = await this.l1WalletClient.writeContract({
            account: this.l1WalletClient.account!,
            chain: null,
            address: this.contracts.L1ERC721Bridge,
            abi: L1_ERC721_BRIDGE_ABI,
            functionName: 'bridgeERC721',
            args: [
                tokenAddress,                        // _localToken (L1 address)
                tokenAddress,                        // _remoteToken (L2 address, same for standard tokens)
                tokenId,                            // _tokenId
                options?.minGasLimit || 200000,     // _minGasLimit
                '0x' as `0x${string}`,              // _extraData
            ],
        });

        // Step 4: Wait for deposit transaction confirmation
        const receipt = await this.l1PublicClient.waitForTransactionReceipt({
            hash: depositTx
        });

        // Call progress callback if provided
        if (options?.onProgress) {
            options.onProgress(depositTx);
        }

        // Step 5: Return deposit info with transaction hash
        return {
            txHash: depositTx,
            tokenAddress,
            tokenId,
            from: recipient,
            to: recipient,
            depositedAt: BigInt(Math.floor(Date.now() / 1000)),
        };
    }

    /**
     * Deposit ERC20 tokens from L1 (Ethereum) to L2 (Mantle)
     *
     * @param tokenAddress - L1 ERC20 token contract address
     * @param amount - Amount of tokens to deposit (in wei)
     * @param options - Deposit options
     * @returns Deposit information
     */
    async depositERC20(
        tokenAddress: Address,
        amount: bigint,
        options?: DepositOptions
    ): Promise<DepositInfo> {
        const recipient = options?.to || this.l1WalletClient.account?.address;
        if (!recipient) throw new Error('No recipient address');

        // Step 1: Check token balance on L1
        const balance = await this.l1PublicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [recipient],
        });

        if (balance < amount) {
            throw new Error(`Insufficient balance: have ${balance}, need ${amount}`);
        }

        // Step 2: Approve L1StandardBridge to transfer tokens
        const approveTx = await this.l1WalletClient.writeContract({
            account: this.l1WalletClient.account!,
            chain: null,
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [this.contracts.L1StandardBridge, amount],
        });

        await this.l1PublicClient.waitForTransactionReceipt({ hash: approveTx });

        // Step 3: Call L1StandardBridge.depositERC20() to deposit
        const depositTx = await this.l1WalletClient.writeContract({
            account: this.l1WalletClient.account!,
            chain: null,
            address: this.contracts.L1StandardBridge,
            abi: L1_STANDARD_BRIDGE_ABI,
            functionName: 'depositERC20',
            args: [
                tokenAddress,                        // _l1Token
                tokenAddress,                        // _l2Token (same address on L2)
                amount,                              // _amount
                options?.minGasLimit || 200000,     // _minGasLimit
                '0x' as `0x${string}`,              // _extraData
            ],
        });

        const receipt = await this.l1PublicClient.waitForTransactionReceipt({
            hash: depositTx
        });

        if (options?.onProgress) {
            options.onProgress(depositTx);
        }

        return {
            txHash: depositTx,
            tokenAddress,
            tokenId: amount, // Using tokenId field to store amount for ERC20
            from: recipient,
            to: recipient,
            depositedAt: BigInt(Math.floor(Date.now() / 1000)),
        };
    }

    // ============================================
    // WITHDRAWAL (L2 → L1) - 3 PHASES
    // ============================================

    /** 
     * @param tokenAddress - L2 NFT contract address
     * @param tokenId - Token ID to withdraw
     * @param options - Withdrawal options
     * @returns Withdrawal information with INITIATED status
     */
    async initiateERC721Withdrawal(
        tokenAddress: Address,
        tokenId: bigint,
        options?: WithdrawalOptions
    ): Promise<WithdrawalInfo> {
        const recipient = options?.to || this.l1WalletClient.account?.address;
        if (!recipient) throw new Error('No recipient address');

        // Step 1: Check NFT ownership on L2
        const owner = await this.l2PublicClient.readContract({
            address: tokenAddress,
            abi: ERC721_ABI,
            functionName: 'ownerOf',
            args: [tokenId],
        });

        if (owner.toLowerCase() !== recipient.toLowerCase()) {
            throw new Error('You do not own this NFT');
        }

        // Step 2: Approve L2ERC721Bridge to transfer the NFT
        const approveTx = await this.l2WalletClient.writeContract({
            account: this.l2WalletClient.account!,
            chain: null,
            address: tokenAddress,
            abi: ERC721_ABI,
            functionName: 'approve',
            args: [this.contracts.L2ERC721Bridge, tokenId],
        });

        // Wait for approval transaction
        await this.l2PublicClient.waitForTransactionReceipt({ hash: approveTx });

        // Step 3: Call L2ERC721Bridge.bridgeERC721() to initiate withdrawal
        const withdrawTx = await this.l2WalletClient.writeContract({
            account: this.l2WalletClient.account!,
            chain: null,
            address: this.contracts.L2ERC721Bridge,
            abi: L2_ERC721_BRIDGE_ABI,
            functionName: 'bridgeERC721',
            args: [
                tokenAddress,                        // _localToken (L2 address)
                tokenAddress,                        // _remoteToken (L1 address, same for standard tokens)
                tokenId,                            // _tokenId
                options?.minGasLimit || 200000,     // _minGasLimit
                '0x' as `0x${string}`,              // _extraData
            ],
        });

        // Step 4: Wait for withdrawal transaction confirmation
        const receipt = await this.l2PublicClient.waitForTransactionReceipt({
            hash: withdrawTx
        });

        // Call progress callback if provided
        if (options?.onProgress) {
            options.onProgress(WithdrawalStatus.INITIATED, { txHash: withdrawTx });
        }

        // Step 5: Return withdrawal info with INITIATED status
        return {
            txHash: withdrawTx,
            tokenAddress,
            tokenId,
            from: recipient,
            to: recipient,
            status: WithdrawalStatus.INITIATED,
            initiatedAt: BigInt(Math.floor(Date.now() / 1000)),
        };
    }

    /**
     * Initiate ERC20 withdrawal from L2 (Mantle) to L1 (Ethereum) - Phase 1
     *
     * @param tokenAddress - L2 ERC20 token contract address
     * @param amount - Amount of tokens to withdraw (in wei)
     * @param options - Withdrawal options
     * @returns Withdrawal information with INITIATED status
     */
    async initiateERC20Withdrawal(
        tokenAddress: Address,
        amount: bigint,
        options?: WithdrawalOptions
    ): Promise<WithdrawalInfo> {
        const recipient = options?.to || this.l1WalletClient.account?.address;
        if (!recipient) throw new Error('No recipient address');

        // Step 1: Check token balance on L2
        const balance = await this.l2PublicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [recipient],
        });

        if (balance < amount) {
            throw new Error(`Insufficient balance: have ${balance}, need ${amount}`);
        }

        // Step 2: Approve L2StandardBridge to transfer tokens
        const approveTx = await this.l2WalletClient.writeContract({
            account: this.l2WalletClient.account!,
            chain: null,
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [this.contracts.L2StandardBridge, amount],
        });

        await this.l2PublicClient.waitForTransactionReceipt({ hash: approveTx });

        // Step 3: Call L2StandardBridge.withdraw() to initiate withdrawal
        const withdrawTx = await this.l2WalletClient.writeContract({
            account: this.l2WalletClient.account!,
            chain: null,
            address: this.contracts.L2StandardBridge,
            abi: L2_STANDARD_BRIDGE_ABI,
            functionName: 'withdraw',
            args: [
                tokenAddress,                        // _l2Token
                amount,                              // _amount
                options?.minGasLimit || 200000,     // _minGasLimit
                '0x' as `0x${string}`,              // _extraData
            ],
        });

        const receipt = await this.l2PublicClient.waitForTransactionReceipt({
            hash: withdrawTx
        });

        if (options?.onProgress) {
            options.onProgress(WithdrawalStatus.INITIATED, { txHash: withdrawTx });
        }

        return {
            txHash: withdrawTx,
            tokenAddress,
            tokenId: amount, // Using tokenId field to store amount for ERC20
            from: recipient,
            to: recipient,
            status: WithdrawalStatus.INITIATED,
            initiatedAt: BigInt(Math.floor(Date.now() / 1000)),
        };
    }

    /**
     * Phase 2: Prove withdrawal on L1 (Ethereum)
     *
     * TODO: Implement the following steps:
     * 1. Wait for L2 state root to be posted to L1 (~60 minutes)
     * 2. Get withdrawal message from L2 transaction logs
     * 3. Fetch merkle proof from Mantle node/API
     * 4. Get L2 output proposal from L2OutputOracle
     * 5. Call OptimismPortal.proveWithdrawalTransaction() with proof
     * 6. Wait for transaction confirmation
     * 7. Return updated withdrawal info with PROVEN status
     *
     * @param withdrawalTxHash - Transaction hash from initiateWithdrawal
     * @returns Updated withdrawal information with PROVEN status
     */
    async proveWithdrawal(
        withdrawalTxHash: Hash,
        options?: WithdrawalOptions
    ): Promise<WithdrawalInfo> {
        // Step 1: Get the L2 transaction receipt
        const receipt = await this.l2PublicClient.getTransactionReceipt({
            hash: withdrawalTxHash
        });

        // Step 2: Wait for L2 state root to be posted to L1 (~60 minutes with ZK proofs)
        // and get the withdrawal message from L2 transaction logs
        const { output, withdrawal } = await this.l1PublicClient.waitToProve({
            receipt,
            targetChain: this.l2PublicClient.chain!,
        });

        // Step 3: Build the proof parameters (fetches merkle proof automatically)
        const args = await this.l2PublicClient.buildProveWithdrawal({
            output,
            withdrawal,
        });

        // Step 4: Call OptimismPortal.proveWithdrawalTransaction() via viem
        const proveTxHash = await this.l1WalletClient.proveWithdrawal(args);

        // Step 5: Wait for transaction confirmation
        const proveReceipt = await this.l1PublicClient.waitForTransactionReceipt({
            hash: proveTxHash
        });

        // Call progress callback if provided
        if (options?.onProgress) {
            options.onProgress(WithdrawalStatus.PROVEN, { txHash: proveTxHash });
        }

        // Step 6: Return updated withdrawal info with PROVEN status
        return {
            txHash: withdrawalTxHash,
            tokenAddress: withdrawal.target as Address, // L1 token address from withdrawal
            tokenId: BigInt(0), // We don't have tokenId in withdrawal object, would need to parse logs
            from: withdrawal.sender as Address,
            to: withdrawal.target as Address,
            status: WithdrawalStatus.PROVEN,
            initiatedAt: BigInt(receipt.blockNumber),
            provenAt: BigInt(proveReceipt.blockNumber),
            withdrawalHash: withdrawal.withdrawalHash as Hash,
        };
    }

    /**
     * Phase 3: Finalize withdrawal on L1 (Ethereum) 
     *
     * @param withdrawalTxHash - Transaction hash from initiateWithdrawal
     * @returns Updated withdrawal information with FINALIZED status
     */
    async finalizeWithdrawal(
        withdrawalTxHash: Hash,
        options?: WithdrawalOptions
    ): Promise<WithdrawalInfo> {
        // Step 1: Get the L2 transaction receipt
        const receipt = await this.l2PublicClient.getTransactionReceipt({
            hash: withdrawalTxHash
        });

        // Step 2: Get withdrawal data from the receipt
        const { withdrawal } = await this.l1PublicClient.getWithdrawals({ receipt });

        // Step 3: Wait for challenge period to pass (~1-12 hours with ZK proofs)
        await this.l1PublicClient.waitToFinalize({
            targetChain: this.l2PublicClient.chain!,
            withdrawalHash: withdrawal.withdrawalHash,
        });

        // Step 4: Call OptimismPortal.finalizeWithdrawalTransaction() on L1
        const finalizeTxHash = await this.l1WalletClient.finalizeWithdrawal({
            targetChain: this.l2PublicClient.chain!,
            withdrawal,
        });

        // Step 5: Wait for finalization transaction confirmation
        const finalizeReceipt = await this.l1PublicClient.waitForTransactionReceipt({
            hash: finalizeTxHash
        });

        // Step 6: Call progress callback if provided
        if (options?.onProgress) {
            options.onProgress(WithdrawalStatus.FINALIZED, { txHash: finalizeTxHash });
        }

        // Step 7: Return updated withdrawal info with FINALIZED status
        return {
            txHash: withdrawalTxHash,
            tokenAddress: withdrawal.target as Address,
            tokenId: BigInt(0), // Would need to parse from logs to get actual tokenId
            from: withdrawal.sender as Address,
            to: withdrawal.target as Address,
            status: WithdrawalStatus.FINALIZED,
            initiatedAt: BigInt(receipt.blockNumber),
            withdrawalHash: withdrawal.withdrawalHash as Hash,
            finalizedAt: BigInt(finalizeReceipt.blockNumber),
        };
    }

    // ============================================
    // ORCHESTRATION
    // ============================================

    /**
     * Automated end-to-end withdrawal: L2 → L1 
     *
     * @param tokenAddress - L2 NFT contract address
     * @param tokenId - Token ID to withdraw
     * @param options - Withdrawal options with progress callback
     * @returns Final withdrawal information with FINALIZED status
     *
     * @example
     * ```typescript
     * const result = await bridge.withdrawAndFinalize(
     *   '0x2765c33a024DF883c46Dc67c54221650f0Cc9563',
     *   1n,
     *   {
     *     onProgress: (status) => console.log(`Status: ${status}`),
     *   }
     * );
     * ```
     */
    async withdrawAndFinalize(
        tokenAddress: Address,
        tokenId: bigint,
        options?: WithdrawalOptions
    ): Promise<WithdrawalInfo> {
        try {
            // Phase 1: Initiate withdrawal on L2
            const initiateResult: WithdrawalInfo = await this.initiateERC721Withdrawal(
                tokenAddress,
                tokenId,
                options
            );

            // Phase 2: Wait for state root (~1 hour with ZK), then prove on L1
            const proveResult: WithdrawalInfo = await this.proveWithdrawal(
                initiateResult.txHash,
                options
            );

            // Phase 3: Wait for challenge period (~1-12 hours with ZK), then finalize on L1
            const finalizeResult: WithdrawalInfo = await this.finalizeWithdrawal(
                proveResult.txHash,
                options
            );

            // Return final result with FINALIZED status
            return finalizeResult;

        } catch (error) {
            // Re-throw with context about which phase failed
            if (error instanceof Error) {
                throw new Error(`Withdrawal failed: ${error.message}`);
            }
            throw error;
        }
    }

    // ============================================
    // UTILITIES
    // ============================================

    /**
     * Get current status of a withdrawal
     *
     * Uses viem's getWithdrawalStatus to check if withdrawal is:
     * - "waiting-to-prove" (not yet ready to prove)
     * - "ready-to-prove" (can call proveWithdrawal)
     * - "waiting-to-finalize" (proven but challenge period not over)
     * - "ready-to-finalize" (can call finalizeWithdrawal)
     * - "finalized" (complete)
     *
     * @param withdrawalTxHash - Transaction hash from initiateWithdrawal
     * @returns Withdrawal status string
     */
    async getWithdrawalStatus(withdrawalTxHash: Hash): Promise<string> {
        const receipt = await this.l2PublicClient.getTransactionReceipt({
            hash: withdrawalTxHash
        });

        const status = await this.l1PublicClient.getWithdrawalStatus({
            receipt,
            targetChain: this.l2PublicClient.chain!,
        });

        return status;
    }
}
