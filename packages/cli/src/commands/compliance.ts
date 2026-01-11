/**
 * Compliance Check Commands
 *
 * Commands for checking compliance, detecting token standards, and managing plugins.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../logger.js';
import { initSDK, shutdownSDK } from '../sdk.js';
import { withErrorHandler, CLIError } from '../utils/errorHandler.js';
import { formatJson, shortenAddress } from '../utils/formatter.js';

// ============================================
// TYPES
// ============================================

interface ComplianceResult {
  compliant: boolean;
  reason?: string;
  tokenStandard: string;
  token: string;
  from: string;
  to: string;
  amount: string;
  simulationResult?: {
    success: boolean;
    revertReason?: string;
  };
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
 * Display compliance check result
 */
function displayComplianceResult(result: ComplianceResult, json?: boolean): void {
  if (json) {
    console.log(formatJson(result));
    return;
  }

  logger.newline();

  // Header with status
  if (result.compliant) {
    console.log(chalk.bgGreen.black.bold('  COMPLIANT - Transfer Allowed  '));
  } else {
    console.log(chalk.bgRed.black.bold('  NOT COMPLIANT - Transfer Blocked  '));
  }

  logger.newline();

  // Details box
  logger.log(chalk.bold('Compliance Check Results'));
  logger.log(chalk.gray('═════════════════════════════════════════'));

  logger.log(chalk.cyan('  Token:        ') + chalk.white(shortenAddress(result.token)));
  logger.log(chalk.cyan('  Standard:     ') + chalk.white(result.tokenStandard));
  logger.log(chalk.cyan('  From:         ') + chalk.white(shortenAddress(result.from)));
  logger.log(chalk.cyan('  To:           ') + chalk.white(shortenAddress(result.to)));
  logger.log(chalk.cyan('  Amount:       ') + chalk.white(result.amount));

  logger.newline();
  logger.log(chalk.gray('─────────────────────────────────────────'));

  // Result details
  if (result.compliant) {
    logger.log(chalk.green('  Result:       ') + chalk.green('PASS'));
  } else {
    logger.log(chalk.red('  Result:       ') + chalk.red('FAIL'));
    if (result.reason) {
      logger.log(chalk.red('  Reason:       ') + chalk.white(result.reason));
    }
  }

  // Simulation result if available
  if (result.simulationResult) {
    logger.newline();
    logger.log(chalk.bold('Transfer Simulation:'));
    if (result.simulationResult.success) {
      logger.log(chalk.green('  Status:       ') + chalk.green('Would succeed'));
    } else {
      logger.log(chalk.red('  Status:       ') + chalk.red('Would fail'));
      if (result.simulationResult.revertReason) {
        logger.log(chalk.red('  Revert:       ') + chalk.white(result.simulationResult.revertReason));
      }
    }
  }

  logger.log(chalk.gray('═════════════════════════════════════════'));
  logger.newline();
}

/**
 * Display token standard detection result
 */
function displayStandardDetection(
  token: string,
  standard: string,
  json?: boolean
): void {
  if (json) {
    console.log(formatJson({ token, standard }));
    return;
  }

  logger.newline();

  const standardColors: Record<string, typeof chalk.green> = {
    ERC3643: chalk.green,
    ERC20: chalk.blue,
    ERC721: chalk.magenta,
    UNKNOWN: chalk.gray,
  };

  const color = standardColors[standard] || chalk.white;

  logger.log(chalk.bold('Token Standard Detection'));
  logger.log(chalk.gray('═════════════════════════════════════════'));
  logger.log(chalk.cyan('  Token:     ') + chalk.white(shortenAddress(token)));
  logger.log(chalk.cyan('  Standard:  ') + color(standard));
  logger.log(chalk.gray('═════════════════════════════════════════'));

  // Additional info based on standard
  logger.newline();
  if (standard === 'ERC3643') {
    logger.log(chalk.green('This is an ERC3643 (T-REX) security token.'));
    logger.log(chalk.gray('Native compliance checking is supported via identity registry.'));
  } else if (standard === 'ERC20') {
    logger.log(chalk.blue('This is a standard ERC20 token.'));
    logger.log(chalk.gray('Register a custom plugin for compliance checks.'));
  } else if (standard === 'ERC721') {
    logger.log(chalk.magenta('This is a standard ERC721 NFT.'));
    logger.log(chalk.gray('Register a custom plugin for compliance checks.'));
  } else {
    logger.log(chalk.yellow('Unable to detect token standard.'));
    logger.log(chalk.gray('Ensure the contract implements ERC20, ERC721, or ERC3643.'));
  }

  logger.newline();
}

/**
 * Display plugin list
 */
function displayPluginList(
  namedPlugins: string[],
  registeredTokens: string[],
  json?: boolean
): void {
  if (json) {
    console.log(formatJson({ namedPlugins, registeredTokens }));
    return;
  }

  logger.newline();
  logger.log(chalk.bold('Compliance Plugins'));
  logger.log(chalk.gray('═════════════════════════════════════════'));

  // Named plugins
  logger.newline();
  logger.log(chalk.bold('Named Plugins:'));
  if (namedPlugins.length === 0) {
    logger.log(chalk.gray('  (none registered)'));
  } else {
    namedPlugins.forEach((name) => {
      logger.log(chalk.cyan(`  - ${name}`));
    });
  }

  // Token-specific plugins
  logger.newline();
  logger.log(chalk.bold('Token-Specific Plugins:'));
  if (registeredTokens.length === 0) {
    logger.log(chalk.gray('  (none registered)'));
  } else {
    registeredTokens.forEach((token) => {
      logger.log(chalk.cyan(`  - ${shortenAddress(token)}`));
    });
  }

  logger.log(chalk.gray('═════════════════════════════════════════'));

  logger.newline();
  logger.log(chalk.gray('Note: Plugins are registered programmatically via the SDK.'));
  logger.log(chalk.gray('See: sdk.compliance.registerPlugin(token, plugin)'));
  logger.log(chalk.gray('See: sdk.compliance.registerNamedPlugin(name, plugin)'));
  logger.newline();
}

// ============================================
// COMMANDS
// ============================================

/**
 * Register compliance commands on the program
 */
export function registerComplianceCommands(program: Command): void {
  // ============================================
  // CHECK COMPLIANCE
  // ============================================
  program
    .command('check-compliance')
    .alias('compliance-check')
    .description('Check if a transfer is compliant')
    .argument('<token>', 'Token contract address')
    .argument('<from>', 'Sender address')
    .argument('<to>', 'Recipient address')
    .argument('<amount>', 'Transfer amount (or token ID for ERC721)')
    .option('--simulate', 'Simulate the transfer to verify it would succeed')
    .option('--network <network>', 'Network to check on (l1 or l2)', 'l2')
    .action(
      withErrorHandler(async (
        token: string,
        from: string,
        to: string,
        amount: string,
        options: { simulate?: boolean; network?: string }
      ) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();

          const tokenAddress = validateAddress(token, 'token address');
          const fromAddress = validateAddress(from, 'from address');
          const toAddress = validateAddress(to, 'to address');
          const amountBigInt = parseAmount(amount);

          spinner.text = 'Checking compliance...';

          const result = await sdk.compliance.checkCompliance(
            tokenAddress,
            fromAddress,
            toAddress,
            amountBigInt,
            { simulate: options.simulate }
          );

          spinner.stop();

          const rootOpts = program.opts();
          const complianceResult: ComplianceResult = {
            compliant: result.compliant,
            reason: result.reason,
            tokenStandard: result.tokenStandard,
            token: tokenAddress,
            from: fromAddress,
            to: toAddress,
            amount,
          };

          displayComplianceResult(complianceResult, rootOpts.json);
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // DETECT STANDARD
  // ============================================
  program
    .command('detect-standard')
    .alias('token-standard')
    .description('Detect the standard of a token (ERC20, ERC721, ERC3643)')
    .argument('<token>', 'Token contract address')
    .action(
      withErrorHandler(async (token: string) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();

          const tokenAddress = validateAddress(token, 'token address');

          spinner.text = 'Detecting token standard...';

          const standard = await sdk.compliance.detectStandard(tokenAddress);

          spinner.stop();

          const rootOpts = program.opts();
          displayStandardDetection(tokenAddress, standard, rootOpts.json);
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // SIMULATE TRANSFER
  // ============================================
  program
    .command('simulate-transfer')
    .alias('sim-transfer')
    .description('Simulate a token transfer to check if it would succeed')
    .argument('<token>', 'Token contract address')
    .argument('<from>', 'Sender address')
    .argument('<to>', 'Recipient address')
    .argument('<amount>', 'Transfer amount (or token ID for ERC721)')
    .action(
      withErrorHandler(async (
        token: string,
        from: string,
        to: string,
        amount: string
      ) => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();

          const tokenAddress = validateAddress(token, 'token address');
          const fromAddress = validateAddress(from, 'from address');
          const toAddress = validateAddress(to, 'to address');
          const amountBigInt = parseAmount(amount);

          spinner.text = 'Simulating transfer...';

          const result = await sdk.compliance.simulateTransfer(
            tokenAddress,
            fromAddress,
            toAddress,
            amountBigInt
          );

          spinner.stop();

          const rootOpts = program.opts();

          if (rootOpts.json) {
            console.log(formatJson({
              token: tokenAddress,
              from: fromAddress,
              to: toAddress,
              amount,
              success: result.success,
              revertReason: result.revertReason,
            }));
            return;
          }

          logger.newline();

          if (result.success) {
            console.log(chalk.bgGreen.black.bold('  SIMULATION PASSED  '));
            logger.newline();
            logger.log(chalk.green('The transfer would succeed on-chain.'));
          } else {
            console.log(chalk.bgRed.black.bold('  SIMULATION FAILED  '));
            logger.newline();
            logger.log(chalk.red('The transfer would fail on-chain.'));
            if (result.revertReason) {
              logger.newline();
              logger.log(chalk.bold('Revert Reason:'));
              logger.log(chalk.gray(`  ${result.revertReason}`));
            }
          }

          logger.newline();
          logger.log(chalk.bold('Transfer Details:'));
          logger.log(chalk.cyan('  Token:   ') + chalk.white(shortenAddress(tokenAddress)));
          logger.log(chalk.cyan('  From:    ') + chalk.white(shortenAddress(fromAddress)));
          logger.log(chalk.cyan('  To:      ') + chalk.white(shortenAddress(toAddress)));
          logger.log(chalk.cyan('  Amount:  ') + chalk.white(amount));
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
  // LIST PLUGINS
  // ============================================
  program
    .command('list-plugins')
    .alias('plugins')
    .description('Show registered compliance plugins')
    .action(
      withErrorHandler(async () => {
        const spinner = ora('Initializing SDK...').start();

        try {
          const sdk = initSDK();

          spinner.text = 'Loading plugins...';

          const namedPlugins = sdk.compliance.getNamedPlugins();
          const registeredTokens = sdk.compliance.getRegisteredTokens();

          spinner.stop();

          const rootOpts = program.opts();
          displayPluginList(namedPlugins, registeredTokens, rootOpts.json);
        } catch (error) {
          spinner.stop();
          throw error;
        } finally {
          shutdownSDK();
        }
      })
    );

  // ============================================
  // COMPLIANCE HELP
  // ============================================
  program
    .command('compliance')
    .description('Show compliance commands help and examples')
    .action(() => {
      logger.header('Compliance Commands');
      logger.newline();

      logger.log(chalk.bold('Token Standard Detection:'));
      logger.newline();

      logger.log(chalk.cyan('  detect-standard <token>'));
      logger.log(chalk.gray('    Detect if token is ERC20, ERC721, or ERC3643'));
      logger.log(chalk.gray('    Example: rwa detect-standard 0x1234...'));
      logger.newline();

      logger.log(chalk.bold('Compliance Checking:'));
      logger.newline();

      logger.log(chalk.cyan('  check-compliance <token> <from> <to> <amount>'));
      logger.log(chalk.gray('    Check if a transfer is compliant'));
      logger.log(chalk.gray('    Options:'));
      logger.log(chalk.gray('      --simulate   Simulate the transfer too'));
      logger.log(chalk.gray('    Example: rwa check-compliance 0x1234... 0xaaaa... 0xbbbb... 1000'));
      logger.newline();

      logger.log(chalk.bold('Transfer Simulation:'));
      logger.newline();

      logger.log(chalk.cyan('  simulate-transfer <token> <from> <to> <amount>'));
      logger.log(chalk.gray('    Simulate a transfer to check if it would succeed'));
      logger.log(chalk.gray('    Example: rwa simulate-transfer 0x1234... 0xaaaa... 0xbbbb... 1000'));
      logger.newline();

      logger.log(chalk.bold('Plugin Management:'));
      logger.newline();

      logger.log(chalk.cyan('  list-plugins'));
      logger.log(chalk.gray('    Show all registered compliance plugins'));
      logger.log(chalk.gray('    Example: rwa list-plugins'));
      logger.newline();

      logger.log(chalk.bold('Supported Token Standards:'));
      logger.log(chalk.green('  ERC3643 (T-REX)') + chalk.gray(' - Native compliance via identity registry'));
      logger.log(chalk.blue('  ERC20') + chalk.gray('           - Custom plugins for compliance'));
      logger.log(chalk.magenta('  ERC721') + chalk.gray('          - Custom plugins for compliance'));
      logger.newline();

      logger.log(chalk.bold('Plugin Registration (via SDK):'));
      logger.log(chalk.gray('  // Register a plugin for a specific token'));
      logger.log(chalk.gray("  sdk.compliance.registerPlugin('0x...', myPlugin);"));
      logger.log(chalk.gray(''));
      logger.log(chalk.gray('  // Register a named plugin for reuse'));
      logger.log(chalk.gray("  sdk.compliance.registerNamedPlugin('blacklist', blacklistPlugin);"));
      logger.newline();
    });
}
