#!/usr/bin/env node

/**
 * RWA Lifecycle CLI
 *
 * Command-line interface for the RWA Lifecycle SDK.
 * Provides commands for bridging, gas estimation, compliance checking, and more.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from './logger.js';
import {
  loadConfig,
  createEnvTemplate,
  createConfigTemplate,
  getConfigValue,
  setConfigValue,
  getAllConfig,
  validateConfig,
  configFilesExist,
  getConfigPaths,
  type CLIConfig,
} from './config.js';
import { withErrorHandler, CLIError } from './utils/errorHandler.js';
import { formatJson } from './utils/formatter.js';
import { registerEstimateCommands } from './commands/estimate.js';

// Package version (loaded from package.json in production)
const VERSION = '1.0.0';

// ============================================
// PROGRAM SETUP
// ============================================

const program = new Command();

program
  .name('rwa')
  .description(
    'CLI for RWA Lifecycle SDK - Manage tokenized Real-World Assets on Mantle L2'
  )
  .version(VERSION, '-v, --version', 'Show CLI version')
  .option('-d, --debug', 'Enable debug output')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('--json', 'Output in JSON format')
  .hook('preAction', (thisCommand) => {
    // Configure logger based on global options
    const opts = thisCommand.opts();
    logger.configure({
      debug: opts.debug,
      quiet: opts.quiet,
    });
  });

// ============================================
// INIT COMMAND
// ============================================

program
  .command('init')
  .description('Initialize RWA SDK configuration files')
  .option('-f, --force', 'Overwrite existing configuration files')
  .option('--env-only', 'Only create .env file')
  .option('--config-only', 'Only create .rwa-config.json file')
  .action(
    withErrorHandler(async (options) => {
      logger.header('Initialize RWA SDK');

      const { envExists, configExists } = configFilesExist();
      const paths = getConfigPaths();

      // Check for existing files
      if (!options.force) {
        if (envExists && !options.configOnly) {
          throw new CLIError(
            '.env file already exists',
            ['Use --force to overwrite', 'Or use --config-only to skip .env']
          );
        }
        if (configExists && !options.envOnly) {
          throw new CLIError(
            '.rwa-config.json already exists',
            ['Use --force to overwrite', 'Or use --env-only to skip config']
          );
        }
      }

      // Create files
      let createdEnv = false;
      let createdConfig = false;

      if (!options.configOnly) {
        try {
          if (options.force && envExists) {
            // Remove existing file if force
            const fs = await import('fs');
            fs.unlinkSync(paths.envFile);
          }
          createEnvTemplate(paths.envFile);
          createdEnv = true;
        } catch (error) {
          if (!options.force) throw error;
          logger.warn(`Could not create .env: ${(error as Error).message}`);
        }
      }

      if (!options.envOnly) {
        try {
          if (options.force && configExists) {
            // Remove existing file if force
            const fs = await import('fs');
            fs.unlinkSync(paths.configFile);
          }
          createConfigTemplate(paths.configFile);
          createdConfig = true;
        } catch (error) {
          if (!options.force) throw error;
          logger.warn(`Could not create .rwa-config.json: ${(error as Error).message}`);
        }
      }

      // Summary
      logger.newline();
      if (createdEnv || createdConfig) {
        logger.success('Configuration initialized successfully!');
        logger.newline();

        if (createdEnv) {
          logger.info(`Created: ${paths.envFile}`);
          logger.log(chalk.gray('  Edit this file to set your RPC URLs and private key'));
        }
        if (createdConfig) {
          logger.info(`Created: ${paths.configFile}`);
          logger.log(chalk.gray('  Edit this file to customize SDK settings'));
        }

        logger.newline();
        logger.log(chalk.yellow('Next steps:'));
        logger.log(chalk.gray('  1. Edit .env and set RWA_PRIVATE_KEY (for bridging)'));
        logger.log(chalk.gray('  2. Run: rwa config get (to verify settings)'));
        logger.log(chalk.gray('  3. Run: rwa --help (to see all commands)'));
      } else {
        logger.warn('No files were created');
      }
    })
  );

// ============================================
// CONFIG COMMAND
// ============================================

const configCmd = program
  .command('config')
  .description('Manage CLI configuration');

// config get [key]
configCmd
  .command('get [key]')
  .description('Show configuration value(s)')
  .action(
    withErrorHandler(async (key?: string) => {
      const rootOpts = program.opts();

      if (key) {
        // Get single value
        const value = getConfigValue(key);

        if (rootOpts.json) {
          console.log(formatJson({ [key]: value }));
        } else {
          logger.keyValue(key, value as string | number | boolean | undefined);
        }
      } else {
        // Get all values
        const config = getAllConfig();

        if (rootOpts.json) {
          console.log(formatJson(config));
        } else {
          logger.header('Current Configuration');

          logger.newline();
          logger.log(chalk.bold('Network'));
          logger.keyValue('  network', config.network as string);
          logger.keyValue('  l1RpcUrl', config.l1RpcUrl as string);
          logger.keyValue('  l2RpcUrl', config.l2RpcUrl as string);

          logger.newline();
          logger.log(chalk.bold('Wallet'));
          logger.keyValue('  privateKey', config.privateKey as string);

          logger.newline();
          logger.log(chalk.bold('Gas Module'));
          logger.keyValue('  gasBufferPercentage', config.gasBufferPercentage as number);

          logger.newline();
          logger.log(chalk.bold('Indexer Module'));
          logger.keyValue('  indexerDbPath', config.indexerDbPath as string);
          logger.keyValue('  indexerPollInterval', `${config.indexerPollInterval}ms`);

          logger.newline();
          logger.log(chalk.bold('CLI Settings'));
          logger.keyValue('  outputFormat', config.outputFormat as string);
          logger.keyValue('  debug', config.debug as boolean);
          logger.keyValue('  quiet', config.quiet as boolean);

          logger.newline();
        }
      }
    })
  );

// config set <key> <value>
configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(
    withErrorHandler(async (key: string, value: string) => {
      setConfigValue(key, value);
      logger.success(`Set ${key} = ${value}`);
    })
  );

// config validate
configCmd
  .command('validate')
  .description('Validate current configuration')
  .action(
    withErrorHandler(async () => {
      const config = loadConfig();
      const errors = validateConfig(config);
      const rootOpts = program.opts();

      if (rootOpts.json) {
        console.log(
          formatJson({
            valid: errors.length === 0,
            errors,
          })
        );
        return;
      }

      logger.header('Configuration Validation');

      if (errors.length === 0) {
        logger.success('Configuration is valid!');
        logger.newline();

        // Show what's configured
        logger.log(chalk.bold('Ready for:'));
        logger.log(chalk.green('  ✔ Gas estimation'));
        logger.log(chalk.green('  ✔ Compliance checking'));
        logger.log(chalk.green('  ✔ Transaction indexing'));

        if (config.privateKey) {
          logger.log(chalk.green('  ✔ Bridging operations'));
        } else {
          logger.log(chalk.yellow('  ⚠ Bridging (requires private key)'));
        }
      } else {
        logger.error('Configuration has errors:');
        logger.newline();
        for (const error of errors) {
          logger.log(chalk.red(`  ✖ ${error}`));
        }
        logger.newline();
        logger.log(chalk.yellow('Run: rwa init (to create default configuration)'));
      }

      logger.newline();
    })
  );

// config path
configCmd
  .command('path')
  .description('Show configuration file paths')
  .action(
    withErrorHandler(async () => {
      const paths = getConfigPaths();
      const { envExists, configExists } = configFilesExist();
      const rootOpts = program.opts();

      if (rootOpts.json) {
        console.log(
          formatJson({
            envFile: paths.envFile,
            envExists,
            configFile: paths.configFile,
            configExists,
          })
        );
        return;
      }

      logger.header('Configuration Paths');
      logger.newline();

      logger.log(chalk.bold('.env file:'));
      logger.log(`  ${paths.envFile}`);
      logger.log(envExists ? chalk.green('  (exists)') : chalk.gray('  (not found)'));

      logger.newline();
      logger.log(chalk.bold('.rwa-config.json:'));
      logger.log(`  ${paths.configFile}`);
      logger.log(configExists ? chalk.green('  (exists)') : chalk.gray('  (not found)'));

      logger.newline();
    })
  );

// ============================================
// STATUS COMMAND
// ============================================

program
  .command('status')
  .description('Show SDK status and readiness')
  .action(
    withErrorHandler(async () => {
      const config = loadConfig();
      const errors = validateConfig(config);
      const { envExists, configExists } = configFilesExist();
      const rootOpts = program.opts();

      if (rootOpts.json) {
        console.log(
          formatJson({
            version: VERSION,
            configValid: errors.length === 0,
            configErrors: errors,
            files: { envExists, configExists },
            network: config.network,
            hasWallet: !!config.privateKey,
            ready: {
              gasEstimation: errors.length === 0,
              compliance: errors.length === 0,
              indexer: errors.length === 0,
              bridging: errors.length === 0 && !!config.privateKey,
            },
          })
        );
        return;
      }

      logger.header('RWA Lifecycle SDK Status');
      logger.newline();

      // Version
      logger.log(chalk.bold('Version:'), VERSION);
      logger.log(chalk.bold('Network:'), config.network ?? 'not configured');
      logger.newline();

      // Configuration files
      logger.log(chalk.bold('Configuration Files:'));
      logger.log(envExists ? chalk.green('  ✔ .env') : chalk.gray('  ✖ .env (not found)'));
      logger.log(
        configExists
          ? chalk.green('  ✔ .rwa-config.json')
          : chalk.gray('  ✖ .rwa-config.json (not found)')
      );
      logger.newline();

      // Validation
      if (errors.length > 0) {
        logger.log(chalk.bold('Configuration Issues:'));
        for (const error of errors) {
          logger.log(chalk.red(`  ✖ ${error}`));
        }
        logger.newline();
      }

      // Readiness
      logger.log(chalk.bold('Module Readiness:'));
      const isReady = errors.length === 0;
      logger.log(isReady ? chalk.green('  ✔ Gas Estimation') : chalk.red('  ✖ Gas Estimation'));
      logger.log(isReady ? chalk.green('  ✔ Compliance') : chalk.red('  ✖ Compliance'));
      logger.log(isReady ? chalk.green('  ✔ Indexer') : chalk.red('  ✖ Indexer'));
      logger.log(
        isReady && config.privateKey
          ? chalk.green('  ✔ Bridging')
          : chalk.yellow('  ⚠ Bridging (needs private key)')
      );
      logger.newline();

      // Next steps
      if (!isReady || !envExists) {
        logger.log(chalk.yellow('To get started:'));
        if (!envExists) {
          logger.log(chalk.gray('  1. Run: rwa init'));
        }
        if (errors.length > 0) {
          logger.log(chalk.gray('  2. Fix configuration issues above'));
        }
        if (!config.privateKey) {
          logger.log(chalk.gray('  3. Set RWA_PRIVATE_KEY in .env (for bridging)'));
        }
        logger.newline();
      }
    })
  );

// ============================================
// REGISTER COMMAND MODULES
// ============================================

// Gas estimation commands (Phase 6.2)
registerEstimateCommands(program);

// ============================================
// HELP ENHANCEMENTS
// ============================================

program.addHelpText(
  'after',
  `
${chalk.bold('Examples:')}
  ${chalk.gray('# Initialize configuration')}
  $ rwa init

  ${chalk.gray('# Show all configuration')}
  $ rwa config get

  ${chalk.gray('# Estimate gas for deposit')}
  $ rwa estimate-deposit-erc20 0x1234... 1000000000000000000

  ${chalk.gray('# Estimate gas for withdrawal (full 3-phase cost)')}
  $ rwa estimate-withdrawal-erc20 0x1234... 1000000000000000000 --full

  ${chalk.gray('# Check SDK status')}
  $ rwa status

${chalk.bold('More commands coming in Phase 6.3-6.6:')}
  ${chalk.gray('deposit-*')}     Bridge deposit commands
  ${chalk.gray('withdraw-*')}    Bridge withdrawal commands
  ${chalk.gray('compliance')}    Compliance check commands
  ${chalk.gray('indexer')}       Transaction query commands

${chalk.bold('Documentation:')}
  ${chalk.blue('https://github.com/your-org/rwa-lifecycle-sdk')}
`
);

// ============================================
// PARSE & RUN
// ============================================

// Handle unknown commands
program.on('command:*', () => {
  logger.error(`Unknown command: ${program.args.join(' ')}`);
  logger.log('');
  logger.log('Run: rwa --help (to see all commands)');
  process.exit(1);
});

// Run CLI
program.parse();

// Show help if no command specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
