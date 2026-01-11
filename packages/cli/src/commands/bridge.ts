/**
 * Bridge Operation Commands
 *
 * Commands for depositing and withdrawing tokens via the Mantle bridge.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../logger.js';
import { initSDK, getWalletAddress, shutdownSDK } from '../sdk.js';
import { withErrorHandler, CLIError } from '../utils/errorHandler.js';
import {
  formatJson,
  shortenAddress,
  formatTxHash,
  getEtherscanTxUrl,
} from '../utils/formatter.js';

// ============================================
// TYPES
// ============================================

interface BridgeOptions {
  to?: string;
  l2Token?: string;
  l1Token?: string;
  tokenType?: 'erc20' | 'erc721';
  json?: boolean;
}

interface TransactionResult {
  operation: string;
  token: string;
  amount?: string;
  tokenId?: string;
  recipient: string;
  txHash: string;
  network: string;
  explorerUrl: string;
  status: 'success' | 'pending' | 'failed';
  message?: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Validate Ethereum address
 */
function validateAddress(address: string, name: string): `0x${string}` {
  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new CLIError(
      `Invalid ${name}: ${address}`,
      ['Address must be 42 characters starting with 0x']
    );
  }
  return address as `0x${string}`;
}

/**
 * Parse amount string to bigint
 */
function parseAmount(amount: string): bigint {
  try {
    if (amount.includes('.')) {
      const [whole, decimal] = amount.split('.');
      const paddedDecimal = decimal.padEnd(18, '0').slice(0, 18);
      return BigInt(whole + paddedDecimal);
    }
    return BigInt(amount);
  } catch {
    throw new CLIError(
      `Invalid amount: ${amount}`,
      ['Amount must be a valid number']
    );
  }
}

/**
 * Display transaction result
 */
function displayTransactionResult(result: TransactionResult, json?: boolean): void {
  if (json) {
    console.log(formatJson(result));
    return;
  }

  logger.newline();

  // Header with status
  if (result.status === 'success') {
    console.log(chalk.bgGreen.black.bold(`  ✔ ${result.operation.toUpperCase()} SUCCESS  `));
  } else if (result.status === 'pending') {
    console.log(chalk.bgYellow.black.bold(`  ⏳ ${result.operation.toUpperCase()} PENDING  `));
  } else {
    console.log(chalk.bgRed.black.bold(`  ✖ ${result.operation.toUpperCase()} FAILED  `));
  }

  logger.newline();

  // Transaction details box
  logger.log(chalk.cyan('┌─ Transaction Details'));
  logger.log(chalk.cyan('├─ ') + chalk.gray('Token:     ') + chalk.white(shortenAddress(result.token)));
  if (result.amount) {
    logger.log(chalk.cyan('├─ ') + chalk.gray('Amount:    ') + chalk.white(result.amount));
  }
  if (result.tokenId) {
    logger.log(chalk.cyan('├─ ') + chalk.gray('Token ID:  ') + chalk.white(result.tokenId));
  }
  logger.log(chalk.cyan('├─ ') + chalk.gray('Recipient: ') + chalk.white(shortenAddress(result.recipient)));
  logger.log(chalk.cyan('├─ ') + chalk.gray('Network:   ') + chalk.white(result.network));
  logger.log(chalk.cyan('└─ ') + chalk.gray('TX Hash:   ') + chalk.green(formatTxHash(result.txHash)));

  logger.newline();

  // Explorer link
  logger.log(chalk.bold('View on Explorer:'));
  logger.log(chalk.blue(`  ${result.explorerUrl}`));

  if (result.message) {
    logger.newline();
    logger.log(chalk.gray(result.message));
  }

  logger.newline();
}

/**
 * Display withdrawal status
 */
function displayWithdrawalStatus(
  phase: string,
  txHash: string,
  details: {
    token?: string;
    amount?: string;
    canProve?: boolean;
    canFinalize?: boolean;
    estimatedTime?: string;
  },
  network: string,
  json?: boolean
): void {
  if (json) {
    console.log(formatJson({ phase, txHash, ...details, network }));
    return;
  }

  logger.newline();

  // Phase indicator
  const phases = ['Initiated', 'Proven', 'Finalized'];
  const currentPhaseIndex = phases.indexOf(phase);

  logger.log(chalk.bold('Withdrawal Progress'));
  phases.forEach((p, i) => {
    const isComplete = i < currentPhaseIndex;
    const isCurrent = i === currentPhaseIndex;
    const icon = isComplete ? chalk.green('✔') : isCurrent ? chalk.yellow('●') : chalk.gray('○');
    const label = isComplete ? chalk.green(p) : isCurrent ? chalk.yellow(p) : chalk.gray(p);
    logger.log(`  ${icon} Phase ${i + 1}: ${label}`);
  });

  logger.newline();

  // Details
  logger.log(chalk.cyan('┌─ Withdrawal Details'));
  logger.log(chalk.cyan('├─ ') + chalk.gray('TX Hash:   ') + chalk.white(formatTxHash(txHash)));
  if (details.token) {
    logger.log(chalk.cyan('├─ ') + chalk.gray('Token:     ') + chalk.white(shortenAddress(details.token)));
  }
  if (details.amount) {
    logger.log(chalk.cyan('├─ ') + chalk.gray('Amount:    ') + chalk.white(details.amount));
  }
  logger.log(chalk.cyan('└─ ') + chalk.gray('Network:   ') + chalk.white(network));

  logger.newline();

  // Next action
  if (details.canProve) {
    logger.log(chalk.yellow('Next Action: ') + chalk.white('Ready to prove'));
    logger.log(chalk.gray(`  Run: rwa prove-withdrawal ${txHash}`));
  } else if (details.canFinalize) {
    logger.log(chalk.yellow('Next Action: ') + chalk.white('Ready to finalize'));
    logger.log(chalk.gray(`  Run: rwa finalize-withdrawal ${txHash}`));
  } else if (details.estimatedTime) {
    logger.log(chalk.gray(`Estimated time until next phase: ${details.estimatedTime}`));
  }

  logger.newline();
}

// ============================================
// COMMANDS
// ============================================

/**
 * Register bridge commands on the program
 */
export function registerBridgeCommands(program: Command): void {
  // ============================================
  // DEPOSIT ERC20
  // ============================================
  program
    .command('deposit-erc20')
    .description('Deposit ERC20 tokens from L1 to L2')
    .argument('<token>', 'L1 token address')
    .argument('<amount>', 'Amount to deposit (in wei or with decimals)')
    .option('--to <address>', 'Recipient address on L2 (defaults to sender)')
    .option('--l2-token <address>', 'L2 token address (defaults to same as L1)')
    .action(
      withErrorHandler(async (token: string, amount: string, options: BridgeOptions) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK({ requireWallet: true });
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          if (!sdk.bridge) {
            throw new CLIError('Bridge not available', ['Ensure wallet is configured']);
          }

          const tokenAddress = validateAddress(token, 'token address');
          const amountBigInt = parseAmount(amount);
          const walletAddress = getWalletAddress()!;
          const recipient = options.to ? validateAddress(options.to, 'recipient') : walletAddress;

          spinner.text = 'Submitting deposit transaction...';

          const result = await sdk.bridge.depositERC20(tokenAddress, amountBigInt, {
            to: recipient,
          });

          spinner.stop();

          const rootOpts = program.opts();
          displayTransactionResult(
            {
              operation: 'Deposit ERC20',
              token: tokenAddress,
              amount,
              recipient,
              txHash: result.txHash,
              network,
              explorerUrl: getEtherscanTxUrl(result.txHash, network, 'l1'),
              status: 'success',
              message: 'Tokens will arrive on L2 in ~2-5 minutes',
            },
            rootOpts.json
          );
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // DEPOSIT ERC721
  // ============================================
  program
    .command('deposit-erc721')
    .alias('deposit-nft')
    .description('Deposit an NFT from L1 to L2')
    .argument('<token>', 'L1 NFT contract address')
    .argument('<tokenId>', 'Token ID to deposit')
    .option('--to <address>', 'Recipient address on L2 (defaults to sender)')
    .option('--l2-token <address>', 'L2 token address (defaults to same as L1)')
    .action(
      withErrorHandler(async (token: string, tokenId: string, options: BridgeOptions) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK({ requireWallet: true });
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          if (!sdk.bridge) {
            throw new CLIError('Bridge not available', ['Ensure wallet is configured']);
          }

          const tokenAddress = validateAddress(token, 'token address');
          const tokenIdBigInt = BigInt(tokenId);
          const walletAddress = getWalletAddress()!;
          const recipient = options.to ? validateAddress(options.to, 'recipient') : walletAddress;

          spinner.text = 'Submitting deposit transaction...';

          const result = await sdk.bridge.depositNFT(tokenAddress, tokenIdBigInt, {
            to: recipient,
          });

          spinner.stop();

          const rootOpts = program.opts();
          displayTransactionResult(
            {
              operation: 'Deposit NFT',
              token: tokenAddress,
              tokenId,
              recipient,
              txHash: result.txHash,
              network,
              explorerUrl: getEtherscanTxUrl(result.txHash, network, 'l1'),
              status: 'success',
              message: 'NFT will arrive on L2 in ~2-5 minutes',
            },
            rootOpts.json
          );
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // INITIATE WITHDRAWAL ERC20
  // ============================================
  program
    .command('withdraw-erc20')
    .alias('initiate-withdrawal-erc20')
    .description('Initiate ERC20 withdrawal from L2 to L1 (Phase 1 of 3)')
    .argument('<token>', 'L2 token address')
    .argument('<amount>', 'Amount to withdraw (in wei or with decimals)')
    .option('--to <address>', 'Recipient address on L1 (defaults to sender)')
    .option('--l1-token <address>', 'L1 token address (defaults to same as L2)')
    .action(
      withErrorHandler(async (token: string, amount: string, options: BridgeOptions) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK({ requireWallet: true });
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          if (!sdk.bridge) {
            throw new CLIError('Bridge not available', ['Ensure wallet is configured']);
          }

          const tokenAddress = validateAddress(token, 'token address');
          const amountBigInt = parseAmount(amount);
          const walletAddress = getWalletAddress()!;
          const recipient = options.to ? validateAddress(options.to, 'recipient') : walletAddress;

          spinner.text = 'Initiating withdrawal on L2...';

          const result = await sdk.bridge.initiateERC20Withdrawal(tokenAddress, amountBigInt, {
            to: recipient,
          });

          spinner.stop();

          const rootOpts = program.opts();
          displayTransactionResult(
            {
              operation: 'Initiate Withdrawal',
              token: tokenAddress,
              amount,
              recipient,
              txHash: result.txHash,
              network,
              explorerUrl: getEtherscanTxUrl(result.txHash, network, 'l2'),
              status: 'success',
              message: 'Withdrawal initiated (Phase 1/3). Wait ~1-2 hours, then prove.',
            },
            rootOpts.json
          );

          if (!rootOpts.json) {
            logger.log(chalk.yellow('Next steps:'));
            logger.log(chalk.gray(`  1. Wait for the challenge period (~1-2 hours)`));
            logger.log(chalk.gray(`  2. Run: rwa prove-withdrawal ${result.txHash}`));
            logger.log(chalk.gray(`  3. Wait for finalization period (~10-12 hours)`));
            logger.log(chalk.gray(`  4. Run: rwa finalize-withdrawal ${result.txHash}`));
            logger.newline();
          }
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // INITIATE WITHDRAWAL ERC721
  // ============================================
  program
    .command('withdraw-erc721')
    .alias('withdraw-nft')
    .description('Initiate NFT withdrawal from L2 to L1 (Phase 1 of 3)')
    .argument('<token>', 'L2 NFT contract address')
    .argument('<tokenId>', 'Token ID to withdraw')
    .option('--to <address>', 'Recipient address on L1 (defaults to sender)')
    .option('--l1-token <address>', 'L1 token address (defaults to same as L2)')
    .action(
      withErrorHandler(async (token: string, tokenId: string, options: BridgeOptions) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK({ requireWallet: true });
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          if (!sdk.bridge) {
            throw new CLIError('Bridge not available', ['Ensure wallet is configured']);
          }

          const tokenAddress = validateAddress(token, 'token address');
          const tokenIdBigInt = BigInt(tokenId);
          const walletAddress = getWalletAddress()!;
          const recipient = options.to ? validateAddress(options.to, 'recipient') : walletAddress;

          spinner.text = 'Initiating NFT withdrawal on L2...';

          const result = await sdk.bridge.initiateERC721Withdrawal(tokenAddress, tokenIdBigInt, {
            to: recipient,
          });

          spinner.stop();

          const rootOpts = program.opts();
          displayTransactionResult(
            {
              operation: 'Initiate NFT Withdrawal',
              token: tokenAddress,
              tokenId,
              recipient,
              txHash: result.txHash,
              network,
              explorerUrl: getEtherscanTxUrl(result.txHash, network, 'l2'),
              status: 'success',
              message: 'Withdrawal initiated (Phase 1/3). Wait ~1-2 hours, then prove.',
            },
            rootOpts.json
          );

          if (!rootOpts.json) {
            logger.log(chalk.yellow('Next steps:'));
            logger.log(chalk.gray(`  1. Wait for the challenge period (~1-2 hours)`));
            logger.log(chalk.gray(`  2. Run: rwa prove-withdrawal ${result.txHash}`));
            logger.newline();
          }
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // PROVE WITHDRAWAL
  // ============================================
  program
    .command('prove-withdrawal')
    .description('Submit withdrawal proof on L1 (Phase 2 of 3)')
    .argument('<txHash>', 'Transaction hash from withdrawal initiation')
    .action(
      withErrorHandler(async (txHash: string) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK({ requireWallet: true });
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          if (!sdk.bridge) {
            throw new CLIError('Bridge not available', ['Ensure wallet is configured']);
          }

          // Validate tx hash format
          if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
            throw new CLIError('Invalid transaction hash', ['Must be 66 characters starting with 0x']);
          }

          spinner.text = 'Submitting withdrawal proof on L1...';

          const result = await sdk.bridge.proveWithdrawal(txHash as `0x${string}`);

          spinner.stop();

          const rootOpts = program.opts();

          if (rootOpts.json) {
            console.log(formatJson({
              operation: 'Prove Withdrawal',
              initiatedTxHash: txHash,
              proveTxHash: result.txHash,
              network,
              status: 'success',
            }));
            return;
          }

          logger.newline();
          console.log(chalk.bgGreen.black.bold('  ✔ WITHDRAWAL PROVEN  '));
          logger.newline();

          logger.log(chalk.cyan('┌─ Proof Details'));
          logger.log(chalk.cyan('├─ ') + chalk.gray('Initiated TX: ') + chalk.white(formatTxHash(txHash)));
          logger.log(chalk.cyan('├─ ') + chalk.gray('Prove TX:     ') + chalk.green(formatTxHash(result.txHash)));
          logger.log(chalk.cyan('└─ ') + chalk.gray('Network:      ') + chalk.white(network));

          logger.newline();
          logger.log(chalk.bold('View on Explorer:'));
          logger.log(chalk.blue(`  ${getEtherscanTxUrl(result.txHash, network, 'l1')}`));

          logger.newline();
          logger.log(chalk.yellow('Next step:'));
          logger.log(chalk.gray(`  Wait ~10-12 hours, then run:`));
          logger.log(chalk.gray(`  rwa finalize-withdrawal ${txHash}`));
          logger.newline();
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // FINALIZE WITHDRAWAL
  // ============================================
  program
    .command('finalize-withdrawal')
    .description('Finalize withdrawal on L1 (Phase 3 of 3)')
    .argument('<txHash>', 'Transaction hash from withdrawal initiation')
    .action(
      withErrorHandler(async (txHash: string) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK({ requireWallet: true });
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          if (!sdk.bridge) {
            throw new CLIError('Bridge not available', ['Ensure wallet is configured']);
          }

          // Validate tx hash format
          if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
            throw new CLIError('Invalid transaction hash', ['Must be 66 characters starting with 0x']);
          }

          spinner.text = 'Finalizing withdrawal on L1...';

          const result = await sdk.bridge.finalizeWithdrawal(txHash as `0x${string}`);

          spinner.stop();

          const rootOpts = program.opts();

          if (rootOpts.json) {
            console.log(formatJson({
              operation: 'Finalize Withdrawal',
              initiatedTxHash: txHash,
              finalizeTxHash: result.txHash,
              network,
              status: 'success',
            }));
            return;
          }

          logger.newline();
          console.log(chalk.bgGreen.black.bold('  ✔ WITHDRAWAL COMPLETE  '));
          logger.newline();

          logger.log(chalk.cyan('┌─ Finalization Details'));
          logger.log(chalk.cyan('├─ ') + chalk.gray('Initiated TX:  ') + chalk.white(formatTxHash(txHash)));
          logger.log(chalk.cyan('├─ ') + chalk.gray('Finalize TX:   ') + chalk.green(formatTxHash(result.txHash)));
          logger.log(chalk.cyan('└─ ') + chalk.gray('Network:       ') + chalk.white(network));

          logger.newline();
          logger.log(chalk.bold('View on Explorer:'));
          logger.log(chalk.blue(`  ${getEtherscanTxUrl(result.txHash, network, 'l1')}`));

          logger.newline();
          logger.log(chalk.green('Tokens have been released to your L1 address!'));
          logger.newline();
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // BRIDGE HELP
  // ============================================
  program
    .command('bridge')
    .description('Show bridge commands help and examples')
    .action(() => {
      logger.header('Bridge Commands');
      logger.newline();

      logger.log(chalk.bold('Deposit Commands (L1 → L2):'));
      logger.newline();

      logger.log(chalk.cyan('  deposit-erc20 <token> <amount>'));
      logger.log(chalk.gray('    Deposit ERC20 tokens to L2'));
      logger.log(chalk.gray('    Example: rwa deposit-erc20 0x1234... 1000000000000000000'));
      logger.newline();

      logger.log(chalk.cyan('  deposit-erc721 <token> <tokenId>'));
      logger.log(chalk.gray('    Deposit an NFT to L2'));
      logger.log(chalk.gray('    Example: rwa deposit-erc721 0x1234... 42'));
      logger.newline();

      logger.log(chalk.bold('Withdrawal Commands (L2 → L1):'));
      logger.log(chalk.gray('  Withdrawals are a 3-phase process taking ~12 hours total'));
      logger.newline();

      logger.log(chalk.cyan('  withdraw-erc20 <token> <amount>'));
      logger.log(chalk.gray('    Phase 1: Initiate ERC20 withdrawal'));
      logger.log(chalk.gray('    Example: rwa withdraw-erc20 0x1234... 1000000000000000000'));
      logger.newline();

      logger.log(chalk.cyan('  withdraw-erc721 <token> <tokenId>'));
      logger.log(chalk.gray('    Phase 1: Initiate NFT withdrawal'));
      logger.log(chalk.gray('    Example: rwa withdraw-erc721 0x1234... 42'));
      logger.newline();

      logger.log(chalk.cyan('  prove-withdrawal <txHash>'));
      logger.log(chalk.gray('    Phase 2: Submit withdrawal proof (after ~1-2 hours)'));
      logger.log(chalk.gray('    Example: rwa prove-withdrawal 0xabcd...'));
      logger.newline();

      logger.log(chalk.cyan('  finalize-withdrawal <txHash>'));
      logger.log(chalk.gray('    Phase 3: Claim tokens on L1 (after ~10-12 hours)'));
      logger.log(chalk.gray('    Example: rwa finalize-withdrawal 0xabcd...'));
      logger.newline();

      logger.log(chalk.bold('Withdrawal Timeline:'));
      logger.log(chalk.gray('  ┌─ Phase 1: Initiate   (immediate)'));
      logger.log(chalk.gray('  ├─ Wait ~1-2 hours'));
      logger.log(chalk.gray('  ├─ Phase 2: Prove      (submit proof)'));
      logger.log(chalk.gray('  ├─ Wait ~10-12 hours'));
      logger.log(chalk.gray('  └─ Phase 3: Finalize   (claim tokens)'));
      logger.newline();

      logger.log(chalk.bold('Common Options:'));
      logger.log(chalk.gray('  --to <address>        Recipient address'));
      logger.log(chalk.gray('  --l1-token <address>  L1 token address'));
      logger.log(chalk.gray('  --l2-token <address>  L2 token address'));
      logger.log(chalk.gray('  --json                Output in JSON format'));
      logger.newline();
    });
}
