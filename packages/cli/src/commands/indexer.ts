/**
 * Indexer Query Commands
 *
 * Commands for querying transaction history, tracking withdrawals,
 * and viewing pending operations.
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
  formatRelativeTime,
  formatTimestamp,
  formatDuration,
  formatTable,
  getEtherscanTxUrl,
} from '../utils/formatter.js';

// ============================================
// TYPES
// ============================================

interface TransactionDisplay {
  type: string;
  token: string;
  amount: string;
  hash: string;
  time: string;
  status: string;
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
 * Validate transaction hash
 */
function validateTxHash(hash: string): `0x${string}` {
  if (!hash.match(/^0x[a-fA-F0-9]{64}$/)) {
    throw new CLIError(
      `Invalid transaction hash: ${hash}`,
      ['Hash must be 66 characters starting with 0x']
    );
  }
  return hash as `0x${string}`;
}

/**
 * Get event type display name
 */
function getEventTypeDisplay(eventType: string): { name: string; icon: string; color: typeof chalk.green } {
  switch (eventType) {
    case 'ERC20DepositInitiated':
    case 'ERC721DepositInitiated':
      return { name: 'Deposit', icon: '↓', color: chalk.green };
    case 'DepositFinalized':
      return { name: 'Deposit Complete', icon: '✔', color: chalk.green };
    case 'WithdrawalInitiated':
      return { name: 'Withdrawal Started', icon: '↑', color: chalk.yellow };
    case 'WithdrawalProven':
      return { name: 'Withdrawal Proven', icon: '◐', color: chalk.blue };
    case 'WithdrawalFinalized':
      return { name: 'Withdrawal Complete', icon: '✔', color: chalk.green };
    default:
      return { name: eventType, icon: '•', color: chalk.white };
  }
}

/**
 * Get withdrawal phase display
 */
function getPhaseDisplay(phase: string): { name: string; icon: string; color: typeof chalk.green } {
  switch (phase) {
    case 'initiated':
      return { name: 'Phase 1: Initiated', icon: '○', color: chalk.yellow };
    case 'proven':
      return { name: 'Phase 2: Proven', icon: '◐', color: chalk.blue };
    case 'finalized':
      return { name: 'Phase 3: Finalized', icon: '●', color: chalk.green };
    default:
      return { name: phase, icon: '?', color: chalk.gray };
  }
}

/**
 * Format amount for display
 */
function formatAmount(amount?: bigint, tokenId?: bigint): string {
  if (tokenId !== undefined) {
    return `Token #${tokenId.toString()}`;
  }
  if (amount !== undefined) {
    // Format as decimal if it's a large number (likely in wei)
    const amountNum = Number(amount);
    if (amountNum > 1e15) {
      return `${(amountNum / 1e18).toFixed(4)}`;
    }
    return amount.toString();
  }
  return '-';
}

/**
 * Display transaction list
 */
function displayTransactionList(
  transactions: any[],
  total: number,
  offset: number,
  limit: number,
  network: string,
  json?: boolean
): void {
  if (json) {
    console.log(formatJson({
      transactions: transactions.map(tx => ({
        ...tx,
        blockNumber: tx.blockNumber?.toString(),
        timestamp: tx.timestamp?.toString(),
        amount: tx.amount?.toString(),
        tokenId: tx.tokenId?.toString(),
      })),
      total,
      offset,
      limit,
      hasMore: offset + transactions.length < total,
    }));
    return;
  }

  logger.newline();
  logger.log(chalk.bold('Transaction History'));
  logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

  if (transactions.length === 0) {
    logger.newline();
    logger.log(chalk.gray('  No transactions found.'));
    logger.newline();
    logger.log(chalk.gray('  Tip: Make sure the indexer is syncing.'));
    logger.log(chalk.gray('       Run: rwa indexer sync'));
    logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
    logger.newline();
    return;
  }

  logger.log(chalk.gray(`  Showing ${offset + 1}-${offset + transactions.length} of ${total} transactions`));
  logger.newline();

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const eventInfo = getEventTypeDisplay(tx.eventType);
    const chain = tx.chain === 'l1' ? 'L1' : 'L2';

    logger.log(chalk.bold(`${offset + i + 1}. `) + eventInfo.color(`${eventInfo.icon} ${eventInfo.name}`));
    logger.log(chalk.cyan('   Token:   ') + chalk.white(shortenAddress(tx.token || 'N/A')));
    logger.log(chalk.cyan('   Amount:  ') + chalk.white(formatAmount(tx.amount, tx.tokenId)));
    logger.log(chalk.cyan('   Hash:    ') + chalk.white(formatTxHash(tx.transactionHash)));
    logger.log(chalk.cyan('   Chain:   ') + chalk.white(chain));
    logger.log(chalk.cyan('   Time:    ') + chalk.white(formatRelativeTime(tx.timestamp)));

    if (i < transactions.length - 1) {
      logger.log(chalk.gray('   ─────────────────────────────────────────────────────'));
    }
  }

  logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

  // Pagination info
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (totalPages > 1) {
    logger.newline();
    logger.log(chalk.gray(`Page ${currentPage} of ${totalPages}`));
    if (offset + transactions.length < total) {
      logger.log(chalk.gray(`Use --offset ${offset + limit} for next page`));
    }
  }

  logger.newline();
}

/**
 * Display withdrawal status
 */
function displayWithdrawalStatus(
  status: any,
  network: string,
  json?: boolean
): void {
  if (json) {
    console.log(formatJson({
      ...status,
      initiatedAt: status.initiatedAt?.toString(),
      provenAt: status.provenAt?.toString(),
      finalizedAt: status.finalizedAt?.toString(),
      estimatedReadyToProve: status.estimatedReadyToProve?.toString(),
      estimatedReadyToFinalize: status.estimatedReadyToFinalize?.toString(),
    }));
    return;
  }

  const phaseInfo = getPhaseDisplay(status.phase);

  logger.newline();
  logger.log(chalk.bold('Withdrawal Status'));
  logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

  // Transaction info
  logger.log(chalk.cyan('  TX Hash:        ') + chalk.white(formatTxHash(status.initiatedTxHash)));
  logger.log(chalk.cyan('  Current Phase:  ') + phaseInfo.color(`${phaseInfo.icon} ${phaseInfo.name}`));

  logger.newline();

  // Phase progress
  logger.log(chalk.bold('  Progress:'));

  // Phase 1: Initiated
  const p1Icon = status.initiatedAt ? chalk.green('✔') : chalk.gray('○');
  const p1Time = status.initiatedAt ? formatTimestamp(status.initiatedAt) : 'Pending';
  logger.log(`    ${p1Icon} Phase 1: Initiated    ${chalk.gray(p1Time)}`);

  // Phase 2: Proven
  if (status.provenAt) {
    logger.log(`    ${chalk.green('✔')} Phase 2: Proven       ${chalk.gray(formatTimestamp(status.provenAt))}`);
  } else if (status.canProve) {
    logger.log(`    ${chalk.yellow('●')} Phase 2: Proven       ${chalk.yellow('Ready now!')}`);
  } else {
    const readyToProve = status.estimatedReadyToProve
      ? formatTimestamp(status.estimatedReadyToProve)
      : 'Waiting...';
    logger.log(`    ${chalk.gray('○')} Phase 2: Proven       ${chalk.gray(readyToProve)}`);
  }

  // Phase 3: Finalized
  if (status.finalizedAt) {
    logger.log(`    ${chalk.green('✔')} Phase 3: Finalized    ${chalk.gray(formatTimestamp(status.finalizedAt))}`);
  } else if (status.canFinalize) {
    logger.log(`    ${chalk.yellow('●')} Phase 3: Finalized    ${chalk.yellow('Ready now!')}`);
  } else if (status.estimatedReadyToFinalize) {
    const readyToFinalize = formatTimestamp(status.estimatedReadyToFinalize);
    logger.log(`    ${chalk.gray('○')} Phase 3: Finalized    ${chalk.gray(readyToFinalize)}`);
  } else {
    logger.log(`    ${chalk.gray('○')} Phase 3: Finalized    ${chalk.gray('Waiting for proof...')}`);
  }

  logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

  // Next action
  logger.newline();
  if (status.canProve && !status.provenAt) {
    logger.log(chalk.bold('Next Action: ') + chalk.yellow('Ready to prove!'));
    logger.log(chalk.gray(`  Run: rwa prove-withdrawal ${status.initiatedTxHash}`));
  } else if (status.canFinalize && !status.finalizedAt) {
    logger.log(chalk.bold('Next Action: ') + chalk.yellow('Ready to finalize!'));
    logger.log(chalk.gray(`  Run: rwa finalize-withdrawal ${status.initiatedTxHash}`));
  } else if (status.phase === 'finalized') {
    logger.log(chalk.green('Withdrawal complete! Tokens have been released to L1.'));
  } else if (status.estimatedReadyToFinalize) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const remaining = Number(status.estimatedReadyToFinalize - now) * 1000;
    if (remaining > 0) {
      logger.log(chalk.gray(`Estimated completion: ${formatDuration(remaining)}`));
    }
  }

  logger.newline();
}

/**
 * Display pending withdrawals list
 */
function displayPendingWithdrawals(
  withdrawals: any[],
  network: string,
  json?: boolean
): void {
  if (json) {
    console.log(formatJson(withdrawals.map(w => ({
      ...w,
      initiatedAt: w.initiatedAt?.toString(),
      provenAt: w.provenAt?.toString(),
      estimatedReadyToProve: w.estimatedReadyToProve?.toString(),
      estimatedReadyToFinalize: w.estimatedReadyToFinalize?.toString(),
    }))));
    return;
  }

  logger.newline();
  logger.log(chalk.bold('Pending Withdrawals'));
  logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

  if (withdrawals.length === 0) {
    logger.newline();
    logger.log(chalk.gray('  No pending withdrawals found.'));
    logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
    logger.newline();
    return;
  }

  logger.log(chalk.gray(`  Found ${withdrawals.length} pending withdrawal(s)`));
  logger.newline();

  for (let i = 0; i < withdrawals.length; i++) {
    const w = withdrawals[i];
    const phaseInfo = getPhaseDisplay(w.phase);

    logger.log(chalk.bold(`${i + 1}. `) + chalk.white(formatTxHash(w.initiatedTxHash)));
    logger.log(chalk.cyan('   Phase:    ') + phaseInfo.color(`${phaseInfo.icon} ${phaseInfo.name}`));
    logger.log(chalk.cyan('   Started:  ') + chalk.white(formatRelativeTime(w.initiatedAt)));

    // Action status
    if (w.canProve && !w.provenAt) {
      logger.log(chalk.cyan('   Action:   ') + chalk.yellow('Ready to prove'));
    } else if (w.canFinalize && !w.finalizedAt) {
      logger.log(chalk.cyan('   Action:   ') + chalk.yellow('Ready to finalize'));
    } else if (w.estimatedReadyToFinalize) {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const remaining = Number(w.estimatedReadyToFinalize - now) * 1000;
      if (remaining > 0) {
        logger.log(chalk.cyan('   ETA:      ') + chalk.gray(formatDuration(remaining)));
      }
    }

    if (i < withdrawals.length - 1) {
      logger.log(chalk.gray('   ─────────────────────────────────────────────────────'));
    }
  }

  logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

  // Summary
  const readyToProve = withdrawals.filter(w => w.canProve && !w.provenAt).length;
  const readyToFinalize = withdrawals.filter(w => w.canFinalize && !w.finalizedAt).length;

  if (readyToProve > 0 || readyToFinalize > 0) {
    logger.newline();
    logger.log(chalk.bold('Summary:'));
    if (readyToProve > 0) {
      logger.log(chalk.yellow(`  ${readyToProve} withdrawal(s) ready to prove`));
    }
    if (readyToFinalize > 0) {
      logger.log(chalk.yellow(`  ${readyToFinalize} withdrawal(s) ready to finalize`));
    }
  }

  logger.newline();
}

/**
 * Display withdrawal timeline
 */
function displayWithdrawalTimeline(
  timeline: any,
  txHash: string,
  network: string,
  json?: boolean
): void {
  if (json) {
    console.log(formatJson({
      txHash,
      initiated: timeline.initiated ? {
        ...timeline.initiated,
        timestamp: timeline.initiated.timestamp?.toString(),
        blockNumber: timeline.initiated.blockNumber?.toString(),
      } : undefined,
      proven: timeline.proven ? {
        ...timeline.proven,
        timestamp: timeline.proven.timestamp?.toString(),
        blockNumber: timeline.proven.blockNumber?.toString(),
      } : undefined,
      finalized: timeline.finalized ? {
        ...timeline.finalized,
        timestamp: timeline.finalized.timestamp?.toString(),
      } : undefined,
      estimatedCompletion: timeline.estimatedCompletion?.toString(),
    }));
    return;
  }

  logger.newline();
  logger.log(chalk.bold('Withdrawal Timeline'));
  logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
  logger.log(chalk.cyan('  TX Hash: ') + chalk.white(formatTxHash(txHash)));
  logger.newline();

  if (!timeline.initiated) {
    logger.log(chalk.gray('  Withdrawal not found.'));
    logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
    logger.newline();
    return;
  }

  // Visual timeline
  const initiated = timeline.initiated;
  const proven = timeline.proven;
  const finalized = timeline.finalized;

  // Phase 1
  logger.log(chalk.green('  ●') + chalk.bold(' Initiated'));
  logger.log(chalk.gray(`    └─ ${formatTimestamp(initiated.timestamp)}`));
  if (initiated.txHash) {
    logger.log(chalk.gray(`       TX: ${formatTxHash(initiated.txHash)}`));
  }

  // Connector to phase 2
  if (proven) {
    logger.log(chalk.green('  │'));
    logger.log(chalk.green('  ●') + chalk.bold(' Proven'));
    logger.log(chalk.gray(`    └─ ${formatTimestamp(proven.timestamp)}`));
    if (proven.txHash) {
      logger.log(chalk.gray(`       TX: ${formatTxHash(proven.txHash)}`));
    }
  } else {
    logger.log(chalk.yellow('  │'));
    logger.log(chalk.yellow('  ○') + chalk.gray(' Proven (pending)'));
  }

  // Connector to phase 3
  if (finalized) {
    logger.log(chalk.green('  │'));
    logger.log(chalk.green('  ●') + chalk.bold(' Finalized'));
    logger.log(chalk.gray(`    └─ ${formatTimestamp(finalized.timestamp)}`));
    if (finalized.txHash) {
      logger.log(chalk.gray(`       TX: ${formatTxHash(finalized.txHash)}`));
    }
  } else if (proven) {
    logger.log(chalk.yellow('  │'));
    logger.log(chalk.yellow('  ○') + chalk.gray(' Finalized (pending)'));
  } else {
    logger.log(chalk.gray('  │'));
    logger.log(chalk.gray('  ○') + chalk.gray(' Finalized (waiting)'));
  }

  logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

  // Estimated completion
  if (!finalized && timeline.estimatedCompletion) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const remaining = Number(timeline.estimatedCompletion - now) * 1000;
    logger.newline();
    if (remaining > 0) {
      logger.log(chalk.gray(`Estimated completion: ${formatDuration(remaining)}`));
    } else {
      logger.log(chalk.yellow('Ready to finalize!'));
    }
  }

  logger.newline();
}

// ============================================
// COMMANDS
// ============================================

/**
 * Register indexer commands on the program
 */
export function registerIndexerCommands(program: Command): void {
  // ============================================
  // LIST TRANSACTIONS
  // ============================================
  program
    .command('list-transactions')
    .alias('txs')
    .alias('transactions')
    .description('List bridge transactions')
    .option('--user <address>', 'Filter by user address')
    .option('--token <address>', 'Filter by token address')
    .option('--type <type>', 'Filter by type (deposit or withdrawal)')
    .option('--limit <number>', 'Number of results to return', '10')
    .option('--offset <number>', 'Skip first N results', '0')
    .action(
      withErrorHandler(async (options: {
        user?: string;
        token?: string;
        type?: string;
        limit?: string;
        offset?: string;
      }) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          // Parse options
          const limit = parseInt(options.limit || '10', 10);
          const offset = parseInt(options.offset || '0', 10);

          // Build filter
          const filter: any = {
            limit,
            offset,
          };

          if (options.user) {
            filter.user = validateAddress(options.user, 'user address');
          }

          if (options.token) {
            filter.token = validateAddress(options.token, 'token address');
          }

          if (options.type) {
            if (!['deposit', 'withdrawal'].includes(options.type)) {
              throw new CLIError(
                `Invalid type: ${options.type}`,
                ['Use: deposit or withdrawal']
              );
            }
            filter.type = options.type as 'deposit' | 'withdrawal';
          }

          spinner.text = 'Querying transactions...';

          const result = sdk.indexer.transactions.getTransactions(filter);

          spinner.stop();

          const rootOpts = program.opts();
          displayTransactionList(
            result.items,
            result.total,
            result.offset,
            result.limit,
            network,
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
  // TRACK WITHDRAWAL
  // ============================================
  program
    .command('track-withdrawal')
    .alias('track')
    .description('Track withdrawal status and progress')
    .argument('<txHash>', 'Transaction hash from withdrawal initiation')
    .action(
      withErrorHandler(async (txHash: string) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          const validTxHash = validateTxHash(txHash);

          spinner.text = 'Fetching withdrawal status...';

          const status = await sdk.trackWithdrawal(validTxHash);

          spinner.stop();

          if (!status) {
            throw new CLIError(
              'Withdrawal not found',
              [
                'Ensure the transaction hash is correct',
                'The withdrawal may not be indexed yet',
                'Run: rwa indexer sync (to sync latest events)',
              ]
            );
          }

          const rootOpts = program.opts();
          displayWithdrawalStatus(status, network, rootOpts.json);
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // LIST PENDING WITHDRAWALS
  // ============================================
  program
    .command('list-pending-withdrawals')
    .alias('pending')
    .alias('pending-withdrawals')
    .description('List all non-finalized withdrawals')
    .option('--user <address>', 'Filter by user address (defaults to connected wallet)')
    .action(
      withErrorHandler(async (options: { user?: string }) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          let userAddress: string | undefined;

          if (options.user) {
            userAddress = validateAddress(options.user, 'user address');
          } else {
            // Try to use connected wallet
            userAddress = getWalletAddress();
          }

          spinner.text = 'Fetching pending withdrawals...';

          const withdrawals = sdk.indexer.withdrawals.getAllPendingWithdrawals(userAddress);

          spinner.stop();

          const rootOpts = program.opts();
          displayPendingWithdrawals(withdrawals, network, rootOpts.json);
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // GET WITHDRAWAL TIMELINE
  // ============================================
  program
    .command('get-withdrawal-timeline')
    .alias('timeline')
    .description('Show detailed withdrawal timeline')
    .argument('<txHash>', 'Transaction hash from withdrawal initiation')
    .action(
      withErrorHandler(async (txHash: string) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          const validTxHash = validateTxHash(txHash);

          spinner.text = 'Fetching withdrawal timeline...';

          const timeline = await sdk.getWithdrawalTimeline(validTxHash);

          spinner.stop();

          const rootOpts = program.opts();
          displayWithdrawalTimeline(timeline, validTxHash, network, rootOpts.json);
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // LIST READY TO PROVE
  // ============================================
  program
    .command('list-ready-to-prove')
    .alias('ready-prove')
    .description('List withdrawals ready to prove')
    .option('--user <address>', 'Filter by user address')
    .action(
      withErrorHandler(async (options: { user?: string }) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          let userAddress: string | undefined;

          if (options.user) {
            userAddress = validateAddress(options.user, 'user address');
          } else {
            userAddress = getWalletAddress();
          }

          spinner.text = 'Fetching withdrawals ready to prove...';

          const withdrawals = sdk.indexer.withdrawals.getReadyToProve(userAddress);

          spinner.stop();

          const rootOpts = program.opts();

          if (rootOpts.json) {
            console.log(formatJson(withdrawals.map(w => ({
              ...w,
              initiatedAt: w.initiatedAt?.toString(),
              estimatedReadyToProve: w.estimatedReadyToProve?.toString(),
            }))));
            return;
          }

          logger.newline();
          logger.log(chalk.bold('Withdrawals Ready to Prove'));
          logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

          if (withdrawals.length === 0) {
            logger.newline();
            logger.log(chalk.gray('  No withdrawals ready to prove.'));
            logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
            logger.newline();
            return;
          }

          logger.log(chalk.gray(`  Found ${withdrawals.length} withdrawal(s) ready to prove`));
          logger.newline();

          for (let i = 0; i < withdrawals.length; i++) {
            const w = withdrawals[i];
            logger.log(chalk.bold(`${i + 1}. `) + chalk.white(formatTxHash(w.initiatedTxHash)));
            logger.log(chalk.cyan('   Started:  ') + chalk.white(formatRelativeTime(w.initiatedAt)));
            logger.log(chalk.cyan('   Command:  ') + chalk.yellow(`rwa prove-withdrawal ${w.initiatedTxHash}`));

            if (i < withdrawals.length - 1) {
              logger.log(chalk.gray('   ─────────────────────────────────────────────────────'));
            }
          }

          logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
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
  // LIST READY TO FINALIZE
  // ============================================
  program
    .command('list-ready-to-finalize')
    .alias('ready-finalize')
    .description('List withdrawals ready to finalize')
    .option('--user <address>', 'Filter by user address')
    .action(
      withErrorHandler(async (options: { user?: string }) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          let userAddress: string | undefined;

          if (options.user) {
            userAddress = validateAddress(options.user, 'user address');
          } else {
            userAddress = getWalletAddress();
          }

          spinner.text = 'Fetching withdrawals ready to finalize...';

          const withdrawals = sdk.indexer.withdrawals.getReadyToFinalize(userAddress);

          spinner.stop();

          const rootOpts = program.opts();

          if (rootOpts.json) {
            console.log(formatJson(withdrawals.map(w => ({
              ...w,
              initiatedAt: w.initiatedAt?.toString(),
              provenAt: w.provenAt?.toString(),
              estimatedReadyToFinalize: w.estimatedReadyToFinalize?.toString(),
            }))));
            return;
          }

          logger.newline();
          logger.log(chalk.bold('Withdrawals Ready to Finalize'));
          logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

          if (withdrawals.length === 0) {
            logger.newline();
            logger.log(chalk.gray('  No withdrawals ready to finalize.'));
            logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
            logger.newline();
            return;
          }

          logger.log(chalk.gray(`  Found ${withdrawals.length} withdrawal(s) ready to finalize`));
          logger.newline();

          for (let i = 0; i < withdrawals.length; i++) {
            const w = withdrawals[i];
            logger.log(chalk.bold(`${i + 1}. `) + chalk.white(formatTxHash(w.initiatedTxHash)));
            logger.log(chalk.cyan('   Started:  ') + chalk.white(formatRelativeTime(w.initiatedAt)));
            logger.log(chalk.cyan('   Proven:   ') + chalk.white(formatRelativeTime(w.provenAt)));
            logger.log(chalk.cyan('   Command:  ') + chalk.yellow(`rwa finalize-withdrawal ${w.initiatedTxHash}`));

            if (i < withdrawals.length - 1) {
              logger.log(chalk.gray('   ─────────────────────────────────────────────────────'));
            }
          }

          logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
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
  // INDEXER SYNC
  // ============================================
  program
    .command('indexer-sync')
    .alias('sync')
    .description('Manually sync the indexer with the latest events')
    .action(
      withErrorHandler(async () => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();

          spinner.text = 'Syncing events from L1 and L2...';

          const result = await sdk.indexer.syncNow();

          spinner.stop();

          const rootOpts = program.opts();

          if (rootOpts.json) {
            console.log(formatJson(result));
            return;
          }

          logger.newline();
          logger.log(chalk.bold('Indexer Sync Complete'));
          logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
          logger.log(chalk.cyan('  L1 Events:  ') + chalk.white(result.l1Events.toString()));
          logger.log(chalk.cyan('  L2 Events:  ') + chalk.white(result.l2Events.toString()));
          logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
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
  // INDEXER STATS
  // ============================================
  program
    .command('indexer-stats')
    .alias('stats')
    .description('Show indexer statistics')
    .action(
      withErrorHandler(async () => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();

          spinner.text = 'Fetching indexer stats...';

          const [stats, syncStats] = await Promise.all([
            sdk.indexer.transactions.getStats(),
            sdk.indexer.getStats(),
          ]);

          spinner.stop();

          const rootOpts = program.opts();

          if (rootOpts.json) {
            console.log(formatJson({ stats, syncStats }));
            return;
          }

          logger.newline();
          logger.log(chalk.bold('Indexer Statistics'));
          logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));

          logger.newline();
          logger.log(chalk.bold('  Event Counts:'));
          logger.log(chalk.cyan('    Total Events:   ') + chalk.white(stats.totalEvents.toString()));
          logger.log(chalk.cyan('    Deposits:       ') + chalk.white(stats.depositCount.toString()));
          logger.log(chalk.cyan('    Withdrawals:    ') + chalk.white(stats.withdrawalCount.toString()));
          logger.log(chalk.cyan('    Unique Users:   ') + chalk.white(stats.uniqueUsers.toString()));

          if (syncStats) {
            logger.newline();
            logger.log(chalk.bold('  Sync Status:'));
            if (syncStats.l1) {
              logger.log(chalk.cyan('    L1 Last Block:  ') + chalk.white(syncStats.l1.lastSyncedBlock?.toString() ?? 'N/A'));
            }
            if (syncStats.l2) {
              logger.log(chalk.cyan('    L2 Last Block:  ') + chalk.white(syncStats.l2.lastSyncedBlock?.toString() ?? 'N/A'));
            }
          }

          logger.log(chalk.gray(`═══════════════════════════════════════════════════════════`));
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
  // INDEXER HELP
  // ============================================
  program
    .command('indexer')
    .description('Show indexer commands help and examples')
    .action(() => {
      logger.header('Indexer Commands');
      logger.newline();

      logger.log(chalk.bold('Transaction Queries:'));
      logger.newline();

      logger.log(chalk.cyan('  list-transactions'));
      logger.log(chalk.gray('    List all bridge transactions'));
      logger.log(chalk.gray('    Aliases: txs, transactions'));
      logger.log(chalk.gray('    Options:'));
      logger.log(chalk.gray('      --user <address>     Filter by user'));
      logger.log(chalk.gray('      --token <address>    Filter by token'));
      logger.log(chalk.gray('      --type <type>        deposit or withdrawal'));
      logger.log(chalk.gray('      --limit <n>          Results per page (default: 10)'));
      logger.log(chalk.gray('      --offset <n>         Skip first N results'));
      logger.log(chalk.gray('    Example: rwa txs --type deposit --limit 5'));
      logger.newline();

      logger.log(chalk.bold('Withdrawal Tracking:'));
      logger.newline();

      logger.log(chalk.cyan('  track-withdrawal <txHash>'));
      logger.log(chalk.gray('    Track withdrawal progress through phases'));
      logger.log(chalk.gray('    Alias: track'));
      logger.log(chalk.gray('    Example: rwa track 0xabc...'));
      logger.newline();

      logger.log(chalk.cyan('  list-pending-withdrawals'));
      logger.log(chalk.gray('    Show all non-finalized withdrawals'));
      logger.log(chalk.gray('    Aliases: pending, pending-withdrawals'));
      logger.log(chalk.gray('    Example: rwa pending'));
      logger.newline();

      logger.log(chalk.cyan('  get-withdrawal-timeline <txHash>'));
      logger.log(chalk.gray('    Show detailed withdrawal timeline'));
      logger.log(chalk.gray('    Alias: timeline'));
      logger.log(chalk.gray('    Example: rwa timeline 0xabc...'));
      logger.newline();

      logger.log(chalk.bold('Action-Ready Withdrawals:'));
      logger.newline();

      logger.log(chalk.cyan('  list-ready-to-prove'));
      logger.log(chalk.gray('    List withdrawals ready to be proven'));
      logger.log(chalk.gray('    Alias: ready-prove'));
      logger.newline();

      logger.log(chalk.cyan('  list-ready-to-finalize'));
      logger.log(chalk.gray('    List withdrawals ready to be finalized'));
      logger.log(chalk.gray('    Alias: ready-finalize'));
      logger.newline();

      logger.log(chalk.bold('Indexer Management:'));
      logger.newline();

      logger.log(chalk.cyan('  indexer-sync'));
      logger.log(chalk.gray('    Manually sync latest events from chains'));
      logger.log(chalk.gray('    Alias: sync'));
      logger.newline();

      logger.log(chalk.cyan('  indexer-stats'));
      logger.log(chalk.gray('    Show indexer statistics'));
      logger.log(chalk.gray('    Alias: stats'));
      logger.newline();
    });
}
