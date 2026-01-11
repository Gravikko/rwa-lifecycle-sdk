/**
 * Interactive Mode Commands
 *
 * Guided workflows for bridge operations without needing to remember command syntax.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { logger } from '../logger.js';
import { initSDK, getWalletAddress, shutdownSDK } from '../sdk.js';
import { withErrorHandler, CLIError } from '../utils/errorHandler.js';
import {
  formatJson,
  shortenAddress,
  formatTxHash,
  formatEth,
  getEtherscanTxUrl,
} from '../utils/formatter.js';

// ============================================
// TYPES
// ============================================

type Operation = 'deposit' | 'withdrawal' | 'track' | 'compliance' | 'estimate';
type TokenType = 'erc20' | 'erc721';

interface WorkflowContext {
  operation?: Operation;
  tokenType?: TokenType;
  tokenAddress?: string;
  amount?: string;
  tokenId?: string;
  recipient?: string;
  txHash?: string;
}

// ============================================
// PROMPTS
// ============================================

/**
 * Main menu selection
 */
async function selectOperation(): Promise<Operation> {
  const { operation } = await inquirer.prompt([
    {
      type: 'list',
      name: 'operation',
      message: 'What would you like to do?',
      choices: [
        { name: '↓  Deposit tokens to L2 (L1 → L2)', value: 'deposit' },
        { name: '↑  Withdraw tokens to L1 (L2 → L1)', value: 'withdrawal' },
        { name: '📊  Track withdrawal status', value: 'track' },
        { name: '💰  Estimate gas costs', value: 'estimate' },
        { name: '✓  Check compliance', value: 'compliance' },
      ],
    },
  ]);
  return operation;
}

/**
 * Token type selection
 */
async function selectTokenType(): Promise<TokenType> {
  const { tokenType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'tokenType',
      message: 'What type of token?',
      choices: [
        { name: 'ERC20 (Fungible token)', value: 'erc20' },
        { name: 'ERC721 (NFT)', value: 'erc721' },
      ],
    },
  ]);
  return tokenType;
}

/**
 * Token address input
 */
async function inputTokenAddress(): Promise<string> {
  const { address } = await inquirer.prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Enter token contract address:',
      validate: (input: string) => {
        if (!input.match(/^0x[a-fA-F0-9]{40}$/)) {
          return 'Please enter a valid Ethereum address (0x followed by 40 hex characters)';
        }
        return true;
      },
    },
  ]);
  return address;
}

/**
 * Amount input for ERC20
 */
async function inputAmount(): Promise<string> {
  const { amount } = await inquirer.prompt([
    {
      type: 'input',
      name: 'amount',
      message: 'Enter amount (in wei or decimals, e.g., 1.5 or 1500000000000000000):',
      validate: (input: string) => {
        try {
          if (input.includes('.')) {
            const num = parseFloat(input);
            if (isNaN(num) || num <= 0) {
              return 'Please enter a valid positive number';
            }
          } else {
            const num = BigInt(input);
            if (num <= 0n) {
              return 'Please enter a valid positive number';
            }
          }
          return true;
        } catch {
          return 'Please enter a valid number';
        }
      },
    },
  ]);
  return amount;
}

/**
 * Token ID input for ERC721
 */
async function inputTokenId(): Promise<string> {
  const { tokenId } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tokenId',
      message: 'Enter NFT token ID:',
      validate: (input: string) => {
        try {
          const num = BigInt(input);
          if (num < 0n) {
            return 'Token ID must be a non-negative number';
          }
          return true;
        } catch {
          return 'Please enter a valid token ID number';
        }
      },
    },
  ]);
  return tokenId;
}

/**
 * Transaction hash input
 */
async function inputTxHash(): Promise<string> {
  const { txHash } = await inquirer.prompt([
    {
      type: 'input',
      name: 'txHash',
      message: 'Enter transaction hash:',
      validate: (input: string) => {
        if (!input.match(/^0x[a-fA-F0-9]{64}$/)) {
          return 'Please enter a valid transaction hash (0x followed by 64 hex characters)';
        }
        return true;
      },
    },
  ]);
  return txHash;
}

/**
 * Recipient address input (optional)
 */
async function inputRecipient(defaultAddress: string): Promise<string> {
  const { useDefault } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useDefault',
      message: `Send to your own address (${shortenAddress(defaultAddress)})?`,
      default: true,
    },
  ]);

  if (useDefault) {
    return defaultAddress;
  }

  const { recipient } = await inquirer.prompt([
    {
      type: 'input',
      name: 'recipient',
      message: 'Enter recipient address:',
      validate: (input: string) => {
        if (!input.match(/^0x[a-fA-F0-9]{40}$/)) {
          return 'Please enter a valid Ethereum address';
        }
        return true;
      },
    },
  ]);
  return recipient;
}

/**
 * Confirmation prompt
 */
async function confirmAction(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false,
    },
  ]);
  return confirmed;
}

/**
 * Select from pending withdrawals
 */
async function selectWithdrawal(withdrawals: any[]): Promise<string | null> {
  if (withdrawals.length === 0) {
    return null;
  }

  const choices = withdrawals.map((w, i) => ({
    name: `${i + 1}. ${formatTxHash(w.initiatedTxHash)} - ${w.phase} (${w.canProve ? 'ready to prove' : w.canFinalize ? 'ready to finalize' : 'waiting'})`,
    value: w.initiatedTxHash,
  }));

  choices.push({ name: '← Back to main menu', value: '' });

  const { txHash } = await inquirer.prompt([
    {
      type: 'list',
      name: 'txHash',
      message: 'Select a withdrawal to track:',
      choices,
    },
  ]);

  return txHash || null;
}

// ============================================
// WORKFLOWS
// ============================================

/**
 * Deposit workflow
 */
async function depositWorkflow(sdk: any, network: string, json: boolean): Promise<void> {
  const tokenType = await selectTokenType();
  const tokenAddress = await inputTokenAddress();

  const walletAddress = getWalletAddress();
  if (!walletAddress) {
    throw new CLIError('No wallet configured', ['Set RWA_PRIVATE_KEY in .env']);
  }

  const recipient = await inputRecipient(walletAddress);

  let amount: string | undefined;
  let tokenId: string | undefined;

  if (tokenType === 'erc20') {
    amount = await inputAmount();
  } else {
    tokenId = await inputTokenId();
  }

  // Show summary
  logger.newline();
  logger.log(chalk.bold('Deposit Summary'));
  logger.log(chalk.gray('─────────────────────────────────────────'));
  logger.log(chalk.cyan('  Token:     ') + chalk.white(shortenAddress(tokenAddress)));
  logger.log(chalk.cyan('  Type:      ') + chalk.white(tokenType.toUpperCase()));
  if (amount) {
    logger.log(chalk.cyan('  Amount:    ') + chalk.white(amount));
  }
  if (tokenId) {
    logger.log(chalk.cyan('  Token ID:  ') + chalk.white(tokenId));
  }
  logger.log(chalk.cyan('  Recipient: ') + chalk.white(shortenAddress(recipient)));
  logger.log(chalk.cyan('  Direction: ') + chalk.white('L1 → L2'));
  logger.log(chalk.gray('─────────────────────────────────────────'));
  logger.newline();

  const confirmed = await confirmAction('Execute this deposit?');
  if (!confirmed) {
    logger.log(chalk.yellow('Deposit cancelled.'));
    return;
  }

  const spinner = ora('Executing deposit...').start();

  try {
    let result;
    if (tokenType === 'erc20') {
      const amountBigInt = amount!.includes('.')
        ? BigInt(Math.floor(parseFloat(amount!) * 1e18))
        : BigInt(amount!);
      result = await sdk.bridge.depositERC20(tokenAddress as `0x${string}`, amountBigInt, {
        to: recipient as `0x${string}`,
      });
    } else {
      result = await sdk.bridge.depositNFT(tokenAddress as `0x${string}`, BigInt(tokenId!), {
        to: recipient as `0x${string}`,
      });
    }

    spinner.stop();

    if (json) {
      console.log(formatJson({
        operation: 'deposit',
        tokenType,
        token: tokenAddress,
        amount,
        tokenId,
        recipient,
        txHash: result.txHash,
        status: 'success',
      }));
      return;
    }

    logger.newline();
    console.log(chalk.bgGreen.black.bold('  ✔ DEPOSIT SUCCESSFUL  '));
    logger.newline();

    logger.log(chalk.cyan('  TX Hash: ') + chalk.green(formatTxHash(result.txHash)));
    logger.newline();

    logger.log(chalk.bold('View on Explorer:'));
    logger.log(chalk.blue(`  ${getEtherscanTxUrl(result.txHash, network as any, 'l1')}`));
    logger.newline();

    logger.log(chalk.gray('Tokens will arrive on L2 in ~2-5 minutes'));
    logger.newline();
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Withdrawal workflow
 */
async function withdrawalWorkflow(sdk: any, network: string, json: boolean): Promise<void> {
  const tokenType = await selectTokenType();
  const tokenAddress = await inputTokenAddress();

  const walletAddress = getWalletAddress();
  if (!walletAddress) {
    throw new CLIError('No wallet configured', ['Set RWA_PRIVATE_KEY in .env']);
  }

  const recipient = await inputRecipient(walletAddress);

  let amount: string | undefined;
  let tokenId: string | undefined;

  if (tokenType === 'erc20') {
    amount = await inputAmount();
  } else {
    tokenId = await inputTokenId();
  }

  // Show summary
  logger.newline();
  logger.log(chalk.bold('Withdrawal Summary'));
  logger.log(chalk.gray('─────────────────────────────────────────'));
  logger.log(chalk.cyan('  Token:     ') + chalk.white(shortenAddress(tokenAddress)));
  logger.log(chalk.cyan('  Type:      ') + chalk.white(tokenType.toUpperCase()));
  if (amount) {
    logger.log(chalk.cyan('  Amount:    ') + chalk.white(amount));
  }
  if (tokenId) {
    logger.log(chalk.cyan('  Token ID:  ') + chalk.white(tokenId));
  }
  logger.log(chalk.cyan('  Recipient: ') + chalk.white(shortenAddress(recipient)));
  logger.log(chalk.cyan('  Direction: ') + chalk.white('L2 → L1'));
  logger.log(chalk.gray('─────────────────────────────────────────'));
  logger.newline();

  logger.log(chalk.yellow('Note: Withdrawals take ~12 hours to complete (3-phase process)'));
  logger.newline();

  const confirmed = await confirmAction('Initiate this withdrawal?');
  if (!confirmed) {
    logger.log(chalk.yellow('Withdrawal cancelled.'));
    return;
  }

  const spinner = ora('Initiating withdrawal...').start();

  try {
    let result;
    if (tokenType === 'erc20') {
      const amountBigInt = amount!.includes('.')
        ? BigInt(Math.floor(parseFloat(amount!) * 1e18))
        : BigInt(amount!);
      result = await sdk.bridge.initiateERC20Withdrawal(tokenAddress as `0x${string}`, amountBigInt, {
        to: recipient as `0x${string}`,
      });
    } else {
      result = await sdk.bridge.initiateERC721Withdrawal(tokenAddress as `0x${string}`, BigInt(tokenId!), {
        to: recipient as `0x${string}`,
      });
    }

    spinner.stop();

    if (json) {
      console.log(formatJson({
        operation: 'withdrawal',
        phase: 'initiated',
        tokenType,
        token: tokenAddress,
        amount,
        tokenId,
        recipient,
        txHash: result.txHash,
        status: 'success',
      }));
      return;
    }

    logger.newline();
    console.log(chalk.bgGreen.black.bold('  ✔ WITHDRAWAL INITIATED  '));
    logger.newline();

    logger.log(chalk.cyan('  TX Hash: ') + chalk.green(formatTxHash(result.txHash)));
    logger.newline();

    logger.log(chalk.bold('View on Explorer:'));
    logger.log(chalk.blue(`  ${getEtherscanTxUrl(result.txHash, network as any, 'l2')}`));
    logger.newline();

    logger.log(chalk.yellow('Next steps:'));
    logger.log(chalk.gray('  1. Wait ~1-2 hours for proof maturity'));
    logger.log(chalk.gray(`  2. Run: rwa prove-withdrawal ${result.txHash}`));
    logger.log(chalk.gray('  3. Wait ~10-12 hours after proving'));
    logger.log(chalk.gray(`  4. Run: rwa finalize-withdrawal ${result.txHash}`));
    logger.newline();
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Track withdrawal workflow
 */
async function trackWorkflow(sdk: any, network: string, json: boolean): Promise<void> {
  // Check if user wants to select from pending or enter hash manually
  const { method } = await inquirer.prompt([
    {
      type: 'list',
      name: 'method',
      message: 'How would you like to track?',
      choices: [
        { name: 'Enter transaction hash', value: 'manual' },
        { name: 'Select from pending withdrawals', value: 'pending' },
      ],
    },
  ]);

  let txHash: string;

  if (method === 'pending') {
    const spinner = ora('Fetching pending withdrawals...').start();
    const userAddress = getWalletAddress();
    const pending = sdk.indexer.withdrawals.getAllPendingWithdrawals(userAddress);
    spinner.stop();

    const selected = await selectWithdrawal(pending);
    if (!selected) {
      if (pending.length === 0) {
        logger.log(chalk.gray('No pending withdrawals found.'));
      }
      return;
    }
    txHash = selected;
  } else {
    txHash = await inputTxHash();
  }

  const spinner = ora('Fetching withdrawal status...').start();

  try {
    const status = await sdk.trackWithdrawal(txHash as `0x${string}`);
    spinner.stop();

    if (!status) {
      throw new CLIError('Withdrawal not found', ['Ensure the transaction hash is correct']);
    }

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

    // Display status
    logger.newline();
    logger.log(chalk.bold('Withdrawal Status'));
    logger.log(chalk.gray('═══════════════════════════════════════════════════════════'));
    logger.log(chalk.cyan('  TX Hash: ') + chalk.white(formatTxHash(status.initiatedTxHash)));
    logger.log(chalk.cyan('  Phase:   ') + chalk.white(status.phase));
    logger.log(chalk.gray('═══════════════════════════════════════════════════════════'));
    logger.newline();

    // Progress display
    const phases = [
      { name: 'Initiated', done: true },
      { name: 'Proven', done: !!status.provenAt },
      { name: 'Finalized', done: !!status.finalizedAt },
    ];

    for (const phase of phases) {
      const icon = phase.done ? chalk.green('✔') : chalk.gray('○');
      logger.log(`  ${icon} ${phase.name}`);
    }

    logger.newline();

    // Next action
    if (status.canProve && !status.provenAt) {
      logger.log(chalk.yellow('Action available: ') + 'Ready to prove!');

      const proveNow = await confirmAction('Prove withdrawal now?');
      if (proveNow) {
        const proveSpinner = ora('Proving withdrawal...').start();
        try {
          const proveResult = await sdk.bridge.proveWithdrawal(txHash as `0x${string}`);
          proveSpinner.stop();
          logger.log(chalk.green('Withdrawal proven!'));
          logger.log(chalk.cyan('  Prove TX: ') + chalk.white(formatTxHash(proveResult.txHash)));
        } catch (error) {
          proveSpinner.stop();
          throw error;
        }
      }
    } else if (status.canFinalize && !status.finalizedAt) {
      logger.log(chalk.yellow('Action available: ') + 'Ready to finalize!');

      const finalizeNow = await confirmAction('Finalize withdrawal now?');
      if (finalizeNow) {
        const finalizeSpinner = ora('Finalizing withdrawal...').start();
        try {
          const finalizeResult = await sdk.bridge.finalizeWithdrawal(txHash as `0x${string}`);
          finalizeSpinner.stop();
          logger.log(chalk.green('Withdrawal finalized! Tokens released to L1.'));
          logger.log(chalk.cyan('  Finalize TX: ') + chalk.white(formatTxHash(finalizeResult.txHash)));
        } catch (error) {
          finalizeSpinner.stop();
          throw error;
        }
      }
    } else if (status.phase === 'finalized') {
      logger.log(chalk.green('Withdrawal complete!'));
    } else {
      logger.log(chalk.gray('Waiting for next phase...'));
    }

    logger.newline();
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Gas estimation workflow
 */
async function estimateWorkflow(sdk: any, network: string, json: boolean): Promise<void> {
  const { direction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'direction',
      message: 'What type of operation?',
      choices: [
        { name: 'Deposit (L1 → L2)', value: 'deposit' },
        { name: 'Withdrawal (L2 → L1)', value: 'withdrawal' },
      ],
    },
  ]);

  const tokenType = await selectTokenType();
  const tokenAddress = await inputTokenAddress();

  const walletAddress = getWalletAddress() || '0x0000000000000000000000000000000000000001';

  let amount: string | undefined;
  let tokenId: string | undefined;

  if (tokenType === 'erc20') {
    amount = await inputAmount();
  } else {
    tokenId = await inputTokenId();
  }

  const spinner = ora('Estimating gas costs...').start();

  try {
    let estimate;

    if (direction === 'deposit') {
      if (tokenType === 'erc20') {
        const amountBigInt = amount!.includes('.')
          ? BigInt(Math.floor(parseFloat(amount!) * 1e18))
          : BigInt(amount!);
        estimate = await sdk.gas.estimateDepositERC20Cost({
          from: walletAddress as `0x${string}`,
          l1TokenAddress: tokenAddress as `0x${string}`,
          l2TokenAddress: tokenAddress as `0x${string}`,
          amount: amountBigInt,
        });
      } else {
        estimate = await sdk.gas.estimateDepositNFTCost({
          from: walletAddress as `0x${string}`,
          l1TokenAddress: tokenAddress as `0x${string}`,
          l2TokenAddress: tokenAddress as `0x${string}`,
          tokenId: BigInt(tokenId!),
        });
      }
    } else {
      if (tokenType === 'erc20') {
        const amountBigInt = amount!.includes('.')
          ? BigInt(Math.floor(parseFloat(amount!) * 1e18))
          : BigInt(amount!);
        estimate = await sdk.gas.estimateWithdrawERC20InitiateCost({
          from: walletAddress as `0x${string}`,
          l1TokenAddress: tokenAddress as `0x${string}`,
          l2TokenAddress: tokenAddress as `0x${string}`,
          amount: amountBigInt,
        });
      } else {
        estimate = await sdk.gas.estimateWithdrawNFTInitiateCost({
          from: walletAddress as `0x${string}`,
          l1TokenAddress: tokenAddress as `0x${string}`,
          l2TokenAddress: tokenAddress as `0x${string}`,
          tokenId: BigInt(tokenId!),
        });
      }
    }

    spinner.stop();

    if (json) {
      console.log(formatJson({
        direction,
        tokenType,
        token: tokenAddress,
        amount,
        tokenId,
        estimate: {
          totalFee: estimate.totalFee.toString(),
          l2ExecutionFee: estimate.l2ExecutionFee.toString(),
          l1DataFee: estimate.l1DataFee.toString(),
          formattedInETH: estimate.formattedInETH,
        },
      }));
      return;
    }

    logger.newline();
    logger.log(chalk.bold('Gas Estimation Results'));
    logger.log(chalk.gray('═══════════════════════════════════════════════════════════'));
    logger.log(chalk.cyan('  Operation:       ') + chalk.white(direction === 'deposit' ? 'Deposit' : 'Withdrawal'));
    logger.log(chalk.cyan('  Token Type:      ') + chalk.white(tokenType.toUpperCase()));
    logger.log(chalk.cyan('  Token:           ') + chalk.white(shortenAddress(tokenAddress)));
    logger.newline();

    logger.log(chalk.bold('  Costs:'));
    logger.log(chalk.cyan('    L2 Execution:  ') + chalk.white(formatEth(estimate.l2ExecutionFee)));
    logger.log(chalk.cyan('    L1 Data Fee:   ') + chalk.white(formatEth(estimate.l1DataFee)));
    logger.log(chalk.gray('    ─────────────────────────────────────────'));
    logger.log(chalk.cyan('    Total:         ') + chalk.green(estimate.formattedInETH));

    logger.log(chalk.gray('═══════════════════════════════════════════════════════════'));

    if (direction === 'withdrawal') {
      logger.newline();
      logger.log(chalk.yellow('Note: This is only the initiation cost. Full withdrawal includes:'));
      logger.log(chalk.gray('  - Phase 1: Initiation on L2 (shown above)'));
      logger.log(chalk.gray('  - Phase 2: Prove on L1 (additional L1 gas)'));
      logger.log(chalk.gray('  - Phase 3: Finalize on L1 (additional L1 gas)'));
    }

    logger.newline();
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Compliance check workflow
 */
async function complianceWorkflow(sdk: any, network: string, json: boolean): Promise<void> {
  const tokenAddress = await inputTokenAddress();

  const { from } = await inquirer.prompt([
    {
      type: 'input',
      name: 'from',
      message: 'Enter sender address:',
      validate: (input: string) => {
        if (!input.match(/^0x[a-fA-F0-9]{40}$/)) {
          return 'Please enter a valid Ethereum address';
        }
        return true;
      },
    },
  ]);

  const { to } = await inquirer.prompt([
    {
      type: 'input',
      name: 'to',
      message: 'Enter recipient address:',
      validate: (input: string) => {
        if (!input.match(/^0x[a-fA-F0-9]{40}$/)) {
          return 'Please enter a valid Ethereum address';
        }
        return true;
      },
    },
  ]);

  const amount = await inputAmount();

  const spinner = ora('Checking compliance...').start();

  try {
    const amountBigInt = amount.includes('.')
      ? BigInt(Math.floor(parseFloat(amount) * 1e18))
      : BigInt(amount);

    const result = await sdk.compliance.checkCompliance(
      tokenAddress as `0x${string}`,
      from as `0x${string}`,
      to as `0x${string}`,
      amountBigInt,
      { simulate: true }
    );

    spinner.stop();

    if (json) {
      console.log(formatJson({
        token: tokenAddress,
        from,
        to,
        amount,
        ...result,
      }));
      return;
    }

    logger.newline();

    if (result.compliant) {
      console.log(chalk.bgGreen.black.bold('  COMPLIANT - Transfer Allowed  '));
    } else {
      console.log(chalk.bgRed.black.bold('  NOT COMPLIANT - Transfer Blocked  '));
    }

    logger.newline();

    logger.log(chalk.bold('Compliance Check Results'));
    logger.log(chalk.gray('═══════════════════════════════════════════════════════════'));
    logger.log(chalk.cyan('  Token:     ') + chalk.white(shortenAddress(tokenAddress)));
    logger.log(chalk.cyan('  Standard:  ') + chalk.white(result.tokenStandard || 'Unknown'));
    logger.log(chalk.cyan('  From:      ') + chalk.white(shortenAddress(from)));
    logger.log(chalk.cyan('  To:        ') + chalk.white(shortenAddress(to)));
    logger.log(chalk.cyan('  Amount:    ') + chalk.white(amount));
    logger.log(chalk.gray('═══════════════════════════════════════════════════════════'));

    if (!result.compliant && result.reason) {
      logger.newline();
      logger.log(chalk.red('Reason: ') + chalk.white(result.reason));
    }

    logger.newline();
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

// ============================================
// MAIN INTERACTIVE LOOP
// ============================================

/**
 * Run interactive mode
 */
async function runInteractiveMode(sdk: any, network: string, json: boolean): Promise<void> {
  logger.newline();
  console.log(chalk.bgBlue.white.bold('  RWA Lifecycle SDK - Interactive Mode  '));
  logger.newline();

  let continueLoop = true;

  while (continueLoop) {
    try {
      const operation = await selectOperation();

      switch (operation) {
        case 'deposit':
          await depositWorkflow(sdk, network, json);
          break;
        case 'withdrawal':
          await withdrawalWorkflow(sdk, network, json);
          break;
        case 'track':
          await trackWorkflow(sdk, network, json);
          break;
        case 'estimate':
          await estimateWorkflow(sdk, network, json);
          break;
        case 'compliance':
          await complianceWorkflow(sdk, network, json);
          break;
      }

      // Ask if user wants to continue
      const { continue: cont } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Would you like to perform another operation?',
          default: true,
        },
      ]);

      continueLoop = cont;
    } catch (error) {
      if ((error as any).name === 'ExitPromptError') {
        // User pressed Ctrl+C
        continueLoop = false;
      } else {
        throw error;
      }
    }
  }

  logger.newline();
  logger.log(chalk.gray('Goodbye!'));
  logger.newline();
}

// ============================================
// COMMANDS
// ============================================

/**
 * Register interactive commands on the program
 */
export function registerInteractiveCommands(program: Command): void {
  program
    .command('interactive')
    .alias('i')
    .alias('wizard')
    .description('Start interactive mode with guided prompts')
    .action(
      withErrorHandler(async () => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          spinner.stop();

          const rootOpts = program.opts();
          await runInteractiveMode(sdk, network, rootOpts.json);
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // Quick deposit command
  program
    .command('quick-deposit')
    .alias('qd')
    .description('Quickly deposit tokens with guided prompts')
    .action(
      withErrorHandler(async () => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK({ requireWallet: true });
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          spinner.stop();

          const rootOpts = program.opts();
          await depositWorkflow(sdk, network, rootOpts.json);
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // Quick withdrawal command
  program
    .command('quick-withdrawal')
    .alias('qw')
    .description('Quickly withdraw tokens with guided prompts')
    .action(
      withErrorHandler(async () => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK({ requireWallet: true });
          const config = sdk.getConfig();
          const network = config.network ?? 'testnet';

          spinner.stop();

          const rootOpts = program.opts();
          await withdrawalWorkflow(sdk, network, rootOpts.json);
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );
}
