/**
 * CLI Error Handler
 *
 * Provides user-friendly error handling with suggestions.
 */

import chalk from 'chalk';
import { logger } from '../logger.js';

// ============================================
// ERROR TYPES
// ============================================

/**
 * CLI-specific error with suggestions
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly suggestions: string[] = [],
    public readonly code?: string
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Configuration error
 */
export class ConfigError extends CLIError {
  constructor(message: string, suggestions: string[] = []) {
    super(message, suggestions, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/**
 * Network/RPC error
 */
export class NetworkError extends CLIError {
  constructor(message: string, suggestions: string[] = []) {
    super(message, suggestions, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * Wallet error
 */
export class WalletError extends CLIError {
  constructor(message: string, suggestions: string[] = []) {
    super(message, suggestions, 'WALLET_ERROR');
    this.name = 'WalletError';
  }
}

// ============================================
// ERROR PARSING
// ============================================

interface ParsedError {
  message: string;
  suggestions: string[];
  code?: string;
}

/**
 * Parse common error messages and provide suggestions
 */
export function parseError(error: unknown): ParsedError {
  // If it's already a CLIError with suggestions, use those
  if (error instanceof CLIError) {
    return {
      message: error.message,
      suggestions: error.suggestions,
      code: error.code,
    };
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Configuration errors
  if (errorMessage.includes('L1 RPC URL is required') || errorMessage.includes('l1RpcUrl is required')) {
    return {
      message: 'L1 RPC URL is not configured',
      suggestions: [
        'Run: rwa init (to create configuration files)',
        'Set RWA_L1_RPC_URL in .env file',
        'Use: rwa config set l1RpcUrl <url>',
      ],
      code: 'CONFIG_MISSING_L1_RPC',
    };
  }

  if (errorMessage.includes('L2 RPC URL is required') || errorMessage.includes('l2RpcUrl is required')) {
    return {
      message: 'L2 RPC URL is not configured',
      suggestions: [
        'Run: rwa init (to create configuration files)',
        'Set RWA_L2_RPC_URL in .env file',
        'Use: rwa config set l2RpcUrl <url>',
      ],
      code: 'CONFIG_MISSING_L2_RPC',
    };
  }

  // Wallet errors
  if (errorMessage.includes('No wallet') || errorMessage.includes('privateKey')) {
    return {
      message: 'No wallet configured',
      suggestions: [
        'Set RWA_PRIVATE_KEY in .env file',
        'Use: --private-key <key> flag',
        'Note: Never commit your private key to version control!',
      ],
      code: 'WALLET_MISSING',
    };
  }

  if (errorMessage.includes('insufficient funds') || errorMessage.includes('Insufficient balance')) {
    return {
      message: 'Insufficient balance for this operation',
      suggestions: [
        'Check your wallet balance',
        'Get testnet tokens from a faucet (testnet)',
        'Reduce the amount you are trying to bridge',
      ],
      code: 'INSUFFICIENT_FUNDS',
    };
  }

  // Network errors
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
    return {
      message: 'Could not connect to RPC endpoint',
      suggestions: [
        'Check your internet connection',
        'Verify RPC URLs are correct: rwa config get',
        'Try a different RPC provider',
        'The RPC endpoint may be down temporarily',
      ],
      code: 'NETWORK_CONNECT_FAILED',
    };
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return {
      message: 'RPC rate limit exceeded',
      suggestions: [
        'Wait a moment and try again',
        'Use a different RPC provider',
        'Consider using a paid RPC plan for higher limits',
      ],
      code: 'RATE_LIMIT',
    };
  }

  // Transaction errors
  if (errorMessage.includes('reverted') || errorMessage.includes('revert')) {
    return {
      message: 'Transaction reverted',
      suggestions: [
        'Check if you have approved the token for the bridge',
        'Verify the token address is correct',
        'Check if you have sufficient token balance',
        'The token may have compliance restrictions',
      ],
      code: 'TX_REVERTED',
    };
  }

  if (errorMessage.includes('nonce') || errorMessage.includes('replacement')) {
    return {
      message: 'Transaction nonce issue',
      suggestions: [
        'Wait for pending transactions to confirm',
        'Try again in a few seconds',
        'Check if you have other pending transactions',
      ],
      code: 'NONCE_ERROR',
    };
  }

  // Compliance errors
  if (errorMessage.includes('compliance') || errorMessage.includes('Compliance')) {
    return {
      message: 'Compliance check failed',
      suggestions: [
        'Check: rwa check-compliance <token> <from> <to> <amount>',
        'Verify both addresses are verified in the Identity Registry',
        'The token may restrict transfers between these addresses',
      ],
      code: 'COMPLIANCE_FAILED',
    };
  }

  // Generic error
  return {
    message: errorMessage,
    suggestions: [],
  };
}

// ============================================
// ERROR DISPLAY
// ============================================

/**
 * Display error with suggestions
 */
export function displayError(error: unknown): void {
  const parsed = parseError(error);

  logger.newline();
  logger.error(parsed.message);

  if (parsed.code) {
    logger.log(chalk.gray(`  Code: ${parsed.code}`));
  }

  if (parsed.suggestions.length > 0) {
    logger.newline();
    logger.log(chalk.yellow('Suggestions:'));
    for (const suggestion of parsed.suggestions) {
      logger.log(chalk.gray(`  - ${suggestion}`));
    }
  }

  logger.newline();
}

/**
 * Handle errors in command actions
 */
export function handleError(error: unknown): never {
  displayError(error);
  process.exit(1);
}

/**
 * Wrap async action with error handling
 */
export function withErrorHandler<T extends unknown[]>(
  action: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await action(...args);
    } catch (error) {
      handleError(error);
    }
  };
}
