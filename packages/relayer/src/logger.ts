/**
 * Relayer Logger
 *
 * Simple logging utility
 */

import type { RelayerConfig } from './types.js';

/**
 * Logger interface
 */
export interface Logger {
  debug: (obj: unknown, msg?: string) => void;
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

/**
 * Log levels
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

/**
 * Simple logger implementation
 */
class SimpleLogger implements Logger {
  private level: number;
  private prefix: string;

  constructor(
    level: 'debug' | 'info' | 'warn' | 'error' = 'info',
    prefix = ''
  ) {
    this.level = LOG_LEVELS[level];
    this.prefix = prefix;
  }

  private formatMessage(
    logLevel: string,
    obj: unknown,
    msg?: string
  ): string {
    const timestamp = new Date().toISOString();
    const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
    const message = msg || '';
    const data = typeof obj === 'object' && obj !== null
      ? JSON.stringify(obj)
      : String(obj);

    return `${timestamp} ${logLevel.toUpperCase().padEnd(5)} ${prefixStr}${message} ${data !== '{}' ? data : ''}`.trim();
  }

  debug(obj: unknown, msg?: string): void {
    if (this.level <= LOG_LEVELS.debug) {
      console.log(this.formatMessage('debug', obj, msg));
    }
  }

  info(obj: unknown, msg?: string): void {
    if (this.level <= LOG_LEVELS.info) {
      console.log(this.formatMessage('info', obj, msg));
    }
  }

  warn(obj: unknown, msg?: string): void {
    if (this.level <= LOG_LEVELS.warn) {
      console.warn(this.formatMessage('warn', obj, msg));
    }
  }

  error(obj: unknown, msg?: string): void {
    if (this.level <= LOG_LEVELS.error) {
      console.error(this.formatMessage('error', obj, msg));
    }
  }

  child(bindings: Record<string, unknown>): Logger {
    const module = bindings.module as string || '';
    return new SimpleLogger(
      Object.keys(LOG_LEVELS).find(
        (k) => LOG_LEVELS[k as keyof typeof LOG_LEVELS] === this.level
      ) as 'debug' | 'info' | 'warn' | 'error',
      module
    );
  }
}

/**
 * Create a logger instance
 */
export function createLogger(
  config: Pick<RelayerConfig, 'logLevel' | 'logFile'>
): Logger {
  return new SimpleLogger(config.logLevel ?? 'info');
}

/**
 * Default logger instance
 */
let defaultLogger: Logger = new SimpleLogger('info');

/**
 * Get the default logger
 */
export function getLogger(): Logger {
  return defaultLogger;
}

/**
 * Set the default logger
 */
export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}
