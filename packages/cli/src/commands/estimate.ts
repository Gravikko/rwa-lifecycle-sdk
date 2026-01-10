/**
 * Gas Estimation Commands
 *
 * Commands for estimating gas costs for bridge operations.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../logger.js';
import { initSDK, getWalletAddress, shutdownSDK } from '../sdk.js';
import { withErrorHandler, CLIError } from '../utils/errorHandler.js';
import { formatEth, formatJson, shortenAddress } from '../utils/formatter.js';
import type { GasCostEstimate } from '@rwa-lifecycle/core';

// ============================================
// TYPES
// ============================================

interface EstimateOptions {
  to?: string;
  json?: boolean;
  debug?: boolean;
}

interface EstimateResult {
  operation: string;
  token: string;
  amount?: string;
  tokenId?: string;
  recipient?: string;
  estimate: {
    l2ExecutionFee: string;
    l1DataFee: string;
    totalFee: string;
    totalFeeWei: string;
    formattedInETH: string;
  };
  network: string;
  bufferPercentage: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Format gas estimate for display
 */
function formatEstimate(
  operation: string,
  token: string,
  estimate: GasCostEstimate,
  options: {
    amount?: string;
    tokenId?: string;
    recipient?: string;
    network: string;
    json?: boolean;
  }
): void {
  const result: EstimateResult = {
    operation,
    token,
    amount: options.amount,
    tokenId: options.tokenId,
    recipient: options.recipient,
    estimate: {
      l2ExecutionFee: formatEth(estimate.l2ExecutionFee),
      l1DataFee: formatEth(estimate.l1DataFee),
      totalFee: formatEth(estimate.totalFee),
      totalFeeWei: estimate.totalFee.toString(),
      formattedInETH: estimate.formattedInETH,
    },
    network: options.network,
    bufferPercentage: 10, // Default buffer
  };

  if (options.json) {
    console.log(formatJson(result));
    return;
  }

  // Pretty print
  logger.header('Gas Estimation Results');
  logger.newline();

  // Operation details
  logger.log(chalk.bold('Operation Details'));
  logger.keyValue('  Type', operation);
  logger.keyValue('  Token', token);
  if (options.amount) {
    logger.keyValue('  Amount', options.amount);
  }
  if (options.tokenId) {
    logger.keyValue('  Token ID', options.tokenId);
  }
  if (options.recipient) {
    logger.keyValue('  Recipient', shortenAddress(options.recipient));
  }
  logger.keyValue('  Network', options.network);

  logger.newline();
  logger.log(chalk.bold('Cost Breakdown'));
  logger.divider();

  // Cost breakdown
  logger.log(`  L2 Execution:  ${chalk.cyan(formatEth(estimate.l2ExecutionFee))}`);
  logger.log(`  L1 Data Fee:   ${chalk.cyan(formatEth(estimate.l1DataFee))}`);
  logger.divider();
  logger.log(`  ${chalk.bold('Total:')}         ${chalk.green(formatEth(estimate.totalFee))}`);

  logger.newline();
  logger.log(chalk.gray(`  Includes 10% safety buffer`));
  logger.log(chalk.gray(`  Actual cost may be lower`));
  logger.newline();
}

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
    // Handle decimal amounts (assume 18 decimals for now)
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

// ============================================
// COMMANDS
// ============================================

/**
 * Register estimate commands on the program
 */
export function registerEstimateCommands(program: Command): void {
  // ============================================
  // ESTIMATE DEPOSIT ERC20
  // ============================================
  program
    .command('estimate-deposit-erc20')
    .description('Estimate gas cost for depositing ERC20 tokens to L2')
    .argument('<token>', 'L1 token address')
    .argument('<amount>', 'Amount to deposit (in wei or with decimals)')
    .option('--to <address>', 'Recipient address on L2 (defaults to sender)')
    .option('--l2-token <address>', 'L2 token address (defaults to same as L1)')
    .action(
      withErrorHandler(async (token: string, amount: string, options: EstimateOptions & { l2Token?: string }) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();

          spinner.text = 'Estimating gas cost...';

          const tokenAddress = validateAddress(token, 'token address');
          const l2TokenAddress = options.l2Token
            ? validateAddress(options.l2Token, 'L2 token address')
            : tokenAddress;
          const amountBigInt = parseAmount(amount);

          // Get sender address (use zero address if no wallet)
          const from = getWalletAddress() ?? '0x0000000000000000000000000000000000000001';

          const estimate = await sdk.gas.estimateDepositERC20Cost({
            from: from as `0x${string}`,
            l1TokenAddress: tokenAddress,
            l2TokenAddress: l2TokenAddress,
            amount: amountBigInt,
          });

          spinner.stop();

          const rootOpts = program.opts();
          formatEstimate('Deposit ERC20', token, estimate, {
            amount,
            recipient: options.to,
            network: config.network ?? 'testnet',
            json: rootOpts.json,
          });
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // ESTIMATE DEPOSIT ERC721
  // ============================================
  program
    .command('estimate-deposit-erc721')
    .alias('estimate-deposit-nft')
    .description('Estimate gas cost for depositing an NFT to L2')
    .argument('<token>', 'L1 NFT contract address')
    .argument('<tokenId>', 'Token ID to deposit')
    .option('--to <address>', 'Recipient address on L2 (defaults to sender)')
    .option('--l2-token <address>', 'L2 token address (defaults to same as L1)')
    .action(
      withErrorHandler(async (token: string, tokenId: string, options: EstimateOptions & { l2Token?: string }) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();

          spinner.text = 'Estimating gas cost...';

          const tokenAddress = validateAddress(token, 'token address');
          const l2TokenAddress = options.l2Token
            ? validateAddress(options.l2Token, 'L2 token address')
            : tokenAddress;
          const tokenIdBigInt = BigInt(tokenId);

          // Get sender address
          const from = getWalletAddress() ?? '0x0000000000000000000000000000000000000001';

          const estimate = await sdk.gas.estimateDepositNFTCost({
            from: from as `0x${string}`,
            l1TokenAddress: tokenAddress,
            l2TokenAddress: l2TokenAddress,
            tokenId: tokenIdBigInt,
          });

          spinner.stop();

          const rootOpts = program.opts();
          formatEstimate('Deposit ERC721 (NFT)', token, estimate, {
            tokenId,
            recipient: options.to,
            network: config.network ?? 'testnet',
            json: rootOpts.json,
          });
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // ESTIMATE WITHDRAWAL ERC20
  // ============================================
  program
    .command('estimate-withdrawal-erc20')
    .alias('estimate-withdraw-erc20')
    .description('Estimate gas cost for withdrawing ERC20 tokens to L1')
    .argument('<token>', 'L2 token address')
    .argument('<amount>', 'Amount to withdraw (in wei or with decimals)')
    .option('--to <address>', 'Recipient address on L1 (defaults to sender)')
    .option('--l1-token <address>', 'L1 token address (defaults to same as L2)')
    .option('--full', 'Show full 3-phase withdrawal cost')
    .action(
      withErrorHandler(async (token: string, amount: string, options: EstimateOptions & { l1Token?: string; full?: boolean }) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();

          spinner.text = 'Estimating gas cost...';

          const tokenAddress = validateAddress(token, 'token address');
          const l1TokenAddress = options.l1Token
            ? validateAddress(options.l1Token, 'L1 token address')
            : tokenAddress;
          const amountBigInt = parseAmount(amount);

          // Get sender address
          const from = getWalletAddress() ?? '0x0000000000000000000000000000000000000001';

          if (options.full) {
            // Full 3-phase withdrawal cost
            const estimate = await sdk.gas.estimateFullWithdrawalCost({
              from: from as `0x${string}`,
              l1TokenAddress: l1TokenAddress,
              l2TokenAddress: tokenAddress,
              amount: amountBigInt,
            });

            spinner.stop();

            const rootOpts = program.opts();

            if (rootOpts.json) {
              console.log(formatJson({
                operation: 'Full Withdrawal ERC20 (3 phases)',
                token,
                amount,
                phases: {
                  initiate: {
                    l2ExecutionFee: formatEth(estimate.initiate.l2ExecutionFee),
                    l1DataFee: formatEth(estimate.initiate.l1DataFee),
                    total: formatEth(estimate.initiate.totalFee),
                  },
                  prove: {
                    l1ExecutionFee: formatEth(estimate.prove.l1ExecutionFee),
                    total: formatEth(estimate.prove.totalFee),
                  },
                  finalize: {
                    l1ExecutionFee: formatEth(estimate.finalize.l1ExecutionFee),
                    total: formatEth(estimate.finalize.totalFee),
                  },
                },
                totalCost: formatEth(estimate.totalCost),
                network: config.network,
              }));
              return;
            }

            // Pretty print full withdrawal
            logger.header('Full Withdrawal Gas Estimation');
            logger.newline();

            logger.log(chalk.bold('Operation Details'));
            logger.keyValue('  Type', 'Full Withdrawal ERC20 (3 phases)');
            logger.keyValue('  Token', token);
            logger.keyValue('  Amount', amount);
            logger.keyValue('  Network', config.network ?? 'testnet');

            logger.newline();
            logger.log(chalk.bold('Phase 1: Initiate (L2)'));
            logger.log(`  L2 Execution:  ${chalk.cyan(formatEth(estimate.initiate.l2ExecutionFee))}`);
            logger.log(`  L1 Data Fee:   ${chalk.cyan(formatEth(estimate.initiate.l1DataFee))}`);
            logger.log(`  Subtotal:      ${chalk.white(formatEth(estimate.initiate.totalFee))}`);

            logger.newline();
            logger.log(chalk.bold('Phase 2: Prove (L1)'));
            logger.log(`  L1 Execution:  ${chalk.cyan(formatEth(estimate.prove.l1ExecutionFee))}`);
            logger.log(`  Subtotal:      ${chalk.white(formatEth(estimate.prove.totalFee))}`);

            logger.newline();
            logger.log(chalk.bold('Phase 3: Finalize (L1)'));
            logger.log(`  L1 Execution:  ${chalk.cyan(formatEth(estimate.finalize.l1ExecutionFee))}`);
            logger.log(`  Subtotal:      ${chalk.white(formatEth(estimate.finalize.totalFee))}`);

            logger.newline();
            logger.divider('═');
            logger.log(`  ${chalk.bold('Total Cost:')}   ${chalk.green(formatEth(estimate.totalCost))}`);
            logger.divider('═');

            logger.newline();
            logger.log(chalk.yellow('Note: Withdrawal process takes ~12 hours total'));
            logger.log(chalk.gray('  - Phase 1: Immediate'));
            logger.log(chalk.gray('  - Phase 2: ~1-2 hours after initiation'));
            logger.log(chalk.gray('  - Phase 3: ~10-12 hours after proving'));
            logger.newline();
          } else {
            // Just initiation cost
            const estimate = await sdk.gas.estimateWithdrawERC20InitiateCost({
              from: from as `0x${string}`,
              l1TokenAddress: l1TokenAddress,
              l2TokenAddress: tokenAddress,
              amount: amountBigInt,
            });

            spinner.stop();

            const rootOpts = program.opts();
            formatEstimate('Withdraw ERC20 (Initiate)', token, estimate, {
              amount,
              recipient: options.to,
              network: config.network ?? 'testnet',
              json: rootOpts.json,
            });

            if (!rootOpts.json) {
              logger.log(chalk.gray('  Tip: Use --full to see total 3-phase withdrawal cost'));
              logger.newline();
            }
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
  // ESTIMATE WITHDRAWAL ERC721
  // ============================================
  program
    .command('estimate-withdrawal-erc721')
    .alias('estimate-withdraw-nft')
    .description('Estimate gas cost for withdrawing an NFT to L1')
    .argument('<token>', 'L2 NFT contract address')
    .argument('<tokenId>', 'Token ID to withdraw')
    .option('--to <address>', 'Recipient address on L1 (defaults to sender)')
    .option('--l1-token <address>', 'L1 token address (defaults to same as L2)')
    .option('--full', 'Show full 3-phase withdrawal cost')
    .action(
      withErrorHandler(async (token: string, tokenId: string, options: EstimateOptions & { l1Token?: string; full?: boolean }) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();

          spinner.text = 'Estimating gas cost...';

          const tokenAddress = validateAddress(token, 'token address');
          const l1TokenAddress = options.l1Token
            ? validateAddress(options.l1Token, 'L1 token address')
            : tokenAddress;
          const tokenIdBigInt = BigInt(tokenId);

          // Get sender address
          const from = getWalletAddress() ?? '0x0000000000000000000000000000000000000001';

          if (options.full) {
            // Full 3-phase withdrawal cost
            const estimate = await sdk.gas.estimateFullNFTWithdrawalCost({
              from: from as `0x${string}`,
              l1TokenAddress: l1TokenAddress,
              l2TokenAddress: tokenAddress,
              tokenId: tokenIdBigInt,
            });

            spinner.stop();

            const rootOpts = program.opts();

            if (rootOpts.json) {
              console.log(formatJson({
                operation: 'Full Withdrawal ERC721 (3 phases)',
                token,
                tokenId,
                phases: {
                  initiate: {
                    l2ExecutionFee: formatEth(estimate.initiate.l2ExecutionFee),
                    l1DataFee: formatEth(estimate.initiate.l1DataFee),
                    total: formatEth(estimate.initiate.totalFee),
                  },
                  prove: {
                    l1ExecutionFee: formatEth(estimate.prove.l1ExecutionFee),
                    total: formatEth(estimate.prove.totalFee),
                  },
                  finalize: {
                    l1ExecutionFee: formatEth(estimate.finalize.l1ExecutionFee),
                    total: formatEth(estimate.finalize.totalFee),
                  },
                },
                totalCost: formatEth(estimate.totalCost),
                network: config.network,
              }));
              return;
            }

            // Pretty print
            logger.header('Full NFT Withdrawal Gas Estimation');
            logger.newline();

            logger.log(chalk.bold('Operation Details'));
            logger.keyValue('  Type', 'Full Withdrawal ERC721 (3 phases)');
            logger.keyValue('  Token', token);
            logger.keyValue('  Token ID', tokenId);
            logger.keyValue('  Network', config.network ?? 'testnet');

            logger.newline();
            logger.log(chalk.bold('Phase 1: Initiate (L2)'));
            logger.log(`  L2 Execution:  ${chalk.cyan(formatEth(estimate.initiate.l2ExecutionFee))}`);
            logger.log(`  L1 Data Fee:   ${chalk.cyan(formatEth(estimate.initiate.l1DataFee))}`);
            logger.log(`  Subtotal:      ${chalk.white(formatEth(estimate.initiate.totalFee))}`);

            logger.newline();
            logger.log(chalk.bold('Phase 2: Prove (L1)'));
            logger.log(`  L1 Execution:  ${chalk.cyan(formatEth(estimate.prove.l1ExecutionFee))}`);
            logger.log(`  Subtotal:      ${chalk.white(formatEth(estimate.prove.totalFee))}`);

            logger.newline();
            logger.log(chalk.bold('Phase 3: Finalize (L1)'));
            logger.log(`  L1 Execution:  ${chalk.cyan(formatEth(estimate.finalize.l1ExecutionFee))}`);
            logger.log(`  Subtotal:      ${chalk.white(formatEth(estimate.finalize.totalFee))}`);

            logger.newline();
            logger.divider('═');
            logger.log(`  ${chalk.bold('Total Cost:')}   ${chalk.green(formatEth(estimate.totalCost))}`);
            logger.divider('═');

            logger.newline();
            logger.log(chalk.yellow('Note: Withdrawal process takes ~12 hours total'));
            logger.newline();
          } else {
            // Just initiation cost
            const estimate = await sdk.gas.estimateWithdrawNFTInitiateCost({
              from: from as `0x${string}`,
              l1TokenAddress: l1TokenAddress,
              l2TokenAddress: tokenAddress,
              tokenId: tokenIdBigInt,
            });

            spinner.stop();

            const rootOpts = program.opts();
            formatEstimate('Withdraw ERC721 (Initiate)', token, estimate, {
              tokenId,
              recipient: options.to,
              network: config.network ?? 'testnet',
              json: rootOpts.json,
            });

            if (!rootOpts.json) {
              logger.log(chalk.gray('  Tip: Use --full to see total 3-phase withdrawal cost'));
              logger.newline();
            }
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
  // ESTIMATE (INTERACTIVE)
  // ============================================
  program
    .command('estimate')
    .description('Show gas estimation help and examples')
    .action(() => {
      logger.header('Gas Estimation Commands');
      logger.newline();

      logger.log(chalk.bold('Available Commands:'));
      logger.newline();

      logger.log(chalk.cyan('  estimate-deposit-erc20 <token> <amount>'));
      logger.log(chalk.gray('    Estimate cost to deposit ERC20 tokens to L2'));
      logger.log(chalk.gray('    Example: rwa estimate-deposit-erc20 0x1234... 1000000000000000000'));
      logger.newline();

      logger.log(chalk.cyan('  estimate-deposit-erc721 <token> <tokenId>'));
      logger.log(chalk.gray('    Estimate cost to deposit an NFT to L2'));
      logger.log(chalk.gray('    Example: rwa estimate-deposit-erc721 0x1234... 42'));
      logger.newline();

      logger.log(chalk.cyan('  estimate-withdrawal-erc20 <token> <amount>'));
      logger.log(chalk.gray('    Estimate cost to withdraw ERC20 tokens to L1'));
      logger.log(chalk.gray('    Example: rwa estimate-withdrawal-erc20 0x1234... 1000000000000000000'));
      logger.log(chalk.gray('    Use --full for total 3-phase cost'));
      logger.newline();

      logger.log(chalk.cyan('  estimate-withdrawal-erc721 <token> <tokenId>'));
      logger.log(chalk.gray('    Estimate cost to withdraw an NFT to L1'));
      logger.log(chalk.gray('    Example: rwa estimate-withdrawal-erc721 0x1234... 42'));
      logger.log(chalk.gray('    Use --full for total 3-phase cost'));
      logger.newline();

      logger.log(chalk.bold('Common Options:'));
      logger.log(chalk.gray('  --to <address>        Recipient address'));
      logger.log(chalk.gray('  --l1-token <address>  L1 token address (for withdrawals)'));
      logger.log(chalk.gray('  --l2-token <address>  L2 token address (for deposits)'));
      logger.log(chalk.gray('  --full                Show full withdrawal cost (all 3 phases)'));
      logger.log(chalk.gray('  --json                Output in JSON format'));
      logger.newline();
    });
}
