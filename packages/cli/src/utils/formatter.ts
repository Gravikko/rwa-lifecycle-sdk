/**
 * CLI Output Formatter
 *
 * Utilities for formatting data for CLI output.
 */

import chalk from 'chalk';

// ============================================
// ADDRESS FORMATTING
// ============================================

/**
 * Shorten an Ethereum address for display
 */
export function shortenAddress(address: string, chars = 6): string {
  if (!address || address.length < chars * 2 + 2) {
    return address;
  }
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// ============================================
// NUMBER FORMATTING
// ============================================

/**
 * Format wei to ETH string
 */
export function formatEth(wei: bigint, decimals = 6): string {
  const eth = Number(wei) / 1e18;
  return `${eth.toFixed(decimals)} ETH`;
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: bigint, decimals = 18, symbol = ''): string {
  const value = Number(amount) / Math.pow(10, decimals);
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number | bigint): string {
  return Number(num).toLocaleString();
}

// ============================================
// TIME FORMATTING
// ============================================

/**
 * Format timestamp to human-readable string
 */
export function formatTimestamp(timestamp: number | bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString();
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number | bigint): string {
  const now = Date.now();
  const then = Number(timestamp) * 1000;
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/**
 * Format duration in milliseconds to human-readable
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

// ============================================
// STATUS FORMATTING
// ============================================

/**
 * Format status with color and icon
 */
export function formatStatus(
  status: 'success' | 'pending' | 'failed' | 'warning'
): string {
  switch (status) {
    case 'success':
      return chalk.green('✔ Success');
    case 'pending':
      return chalk.yellow('⏳ Pending');
    case 'failed':
      return chalk.red('✖ Failed');
    case 'warning':
      return chalk.yellow('⚠ Warning');
  }
}

/**
 * Format withdrawal phase
 */
export function formatWithdrawalPhase(
  phase: 'initiated' | 'proven' | 'finalized'
): string {
  switch (phase) {
    case 'initiated':
      return chalk.yellow('Phase 1: Initiated');
    case 'proven':
      return chalk.blue('Phase 2: Proven');
    case 'finalized':
      return chalk.green('Phase 3: Finalized');
  }
}

// ============================================
// TRANSACTION FORMATTING
// ============================================

/**
 * Format transaction hash (shortened)
 */
export function formatTxHash(hash: string, chars = 10): string {
  if (!hash || hash.length < chars * 2 + 2) {
    return hash;
  }
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

/**
 * Get Etherscan URL for transaction
 */
export function getEtherscanTxUrl(
  hash: string,
  network: 'mainnet' | 'testnet',
  layer: 'l1' | 'l2'
): string {
  if (layer === 'l1') {
    const base = network === 'mainnet' ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
    return `${base}/tx/${hash}`;
  } else {
    const base = network === 'mainnet' ? 'https://explorer.mantle.xyz' : 'https://sepolia.mantlescan.xyz';
    return `${base}/tx/${hash}`;
  }
}

/**
 * Get Etherscan URL for address
 */
export function getEtherscanAddressUrl(
  address: string,
  network: 'mainnet' | 'testnet',
  layer: 'l1' | 'l2'
): string {
  if (layer === 'l1') {
    const base = network === 'mainnet' ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
    return `${base}/address/${address}`;
  } else {
    const base = network === 'mainnet' ? 'https://explorer.mantle.xyz' : 'https://sepolia.mantlescan.xyz';
    return `${base}/address/${address}`;
  }
}

// ============================================
// TABLE FORMATTING
// ============================================

/**
 * Simple table formatter
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options?: { columnWidths?: number[] }
): string {
  // Calculate column widths
  const widths =
    options?.columnWidths ??
    headers.map((header, i) => {
      const maxRowWidth = Math.max(...rows.map((row) => (row[i] ?? '').length));
      return Math.max(header.length, maxRowWidth);
    });

  // Format header
  const headerLine = headers
    .map((h, i) => chalk.bold(h.padEnd(widths[i])))
    .join('  ');

  // Format separator
  const separator = widths.map((w) => '─'.repeat(w)).join('──');

  // Format rows
  const formattedRows = rows.map((row) =>
    row.map((cell, i) => (cell ?? '').padEnd(widths[i])).join('  ')
  );

  return [headerLine, separator, ...formattedRows].join('\n');
}

// ============================================
// JSON FORMATTING
// ============================================

/**
 * Format object as JSON with BigInt support
 */
export function formatJson(obj: unknown, indent = 2): string {
  return JSON.stringify(
    obj,
    (_, value) => (typeof value === 'bigint' ? value.toString() : value),
    indent
  );
}

// ============================================
// BOX FORMATTING
// ============================================

/**
 * Format content in a box
 */
export function formatBox(title: string, content: string[]): string {
  const maxWidth = Math.max(title.length, ...content.map((c) => c.length)) + 4;

  const top = `╭${'─'.repeat(maxWidth)}╮`;
  const titleLine = `│ ${chalk.bold(title.padEnd(maxWidth - 2))} │`;
  const separator = `├${'─'.repeat(maxWidth)}┤`;
  const contentLines = content.map((c) => `│ ${c.padEnd(maxWidth - 2)} │`);
  const bottom = `╰${'─'.repeat(maxWidth)}╯`;

  return [top, titleLine, separator, ...contentLines, bottom].join('\n');
}
