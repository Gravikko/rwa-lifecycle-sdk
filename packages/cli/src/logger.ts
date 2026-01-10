/**
 * CLI Logger Module
 *
 * Provides colored console output for the CLI with different log levels.
 * Uses chalk for terminal colors.
 */

import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export interface LoggerOptions {
  /** Enable debug output */
  debug?: boolean;
  /** Suppress all output except errors */
  quiet?: boolean;
}

/**
 * Logger class for CLI output
 */
class Logger {
  private debugEnabled = false;
  private quietMode = false;

  /**
   * Configure logger options
   */
  configure(options: LoggerOptions): void {
    this.debugEnabled = options.debug ?? false;
    this.quietMode = options.quiet ?? false;
  }

  /**
   * Debug message (only shown if debug mode enabled)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.debugEnabled && !this.quietMode) {
      console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
    }
  }

  /**
   * Info message
   */
  info(message: string, ...args: unknown[]): void {
    if (!this.quietMode) {
      console.log(chalk.blue('ℹ'), message, ...args);
    }
  }

  /**
   * Warning message
   */
  warn(message: string, ...args: unknown[]): void {
    if (!this.quietMode) {
      console.log(chalk.yellow('⚠'), chalk.yellow(message), ...args);
    }
  }

  /**
   * Error message (always shown)
   */
  error(message: string, ...args: unknown[]): void {
    console.error(chalk.red('✖'), chalk.red(message), ...args);
  }

  /**
   * Success message
   */
  success(message: string, ...args: unknown[]): void {
    if (!this.quietMode) {
      console.log(chalk.green('✔'), chalk.green(message), ...args);
    }
  }

  /**
   * Plain message (no prefix)
   */
  log(message: string, ...args: unknown[]): void {
    if (!this.quietMode) {
      console.log(message, ...args);
    }
  }

  /**
   * Print a blank line
   */
  newline(): void {
    if (!this.quietMode) {
      console.log();
    }
  }

  /**
   * Print a horizontal divider
   */
  divider(char = '─', length = 50): void {
    if (!this.quietMode) {
      console.log(chalk.gray(char.repeat(length)));
    }
  }

  /**
   * Print a header/title
   */
  header(title: string): void {
    if (!this.quietMode) {
      this.newline();
      console.log(chalk.bold.cyan(title));
      this.divider('═', title.length);
    }
  }

  /**
   * Print a key-value pair
   */
  keyValue(key: string, value: string | number | boolean | undefined, indent = 0): void {
    if (!this.quietMode) {
      const padding = ' '.repeat(indent);
      const formattedKey = chalk.gray(`${key}:`);
      const formattedValue = value !== undefined ? String(value) : chalk.gray('(not set)');
      console.log(`${padding}${formattedKey} ${formattedValue}`);
    }
  }

  /**
   * Print a table row
   */
  tableRow(columns: string[], widths: number[]): void {
    if (!this.quietMode) {
      const formatted = columns
        .map((col, i) => col.padEnd(widths[i] || 20))
        .join(' ');
      console.log(formatted);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
