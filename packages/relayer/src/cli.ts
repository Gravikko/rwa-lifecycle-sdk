#!/usr/bin/env node

/**
 * Relayer CLI
 *
 * Command-line interface for running the relayer service.
 */

import { RelayerService } from './RelayerService.js';
import type { RelayerConfig } from './types.js';

// ASCII art banner
const BANNER = `
╔═══════════════════════════════════════════════════════════╗
║             RWA Lifecycle - Relayer Service               ║
║          Automated Withdrawal Finalization                ║
╚═══════════════════════════════════════════════════════════╝
`;

/**
 * Load configuration from environment variables
 */
function loadConfig(): RelayerConfig {
  const l1RpcUrl = process.env.RWA_L1_RPC_URL || process.env.L1_RPC_URL;
  const l2RpcUrl = process.env.RWA_L2_RPC_URL || process.env.L2_RPC_URL;
  const privateKey = process.env.RWA_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!l1RpcUrl) {
    console.error('Error: L1 RPC URL is required');
    console.error('Set RWA_L1_RPC_URL or L1_RPC_URL environment variable');
    process.exit(1);
  }

  if (!l2RpcUrl) {
    console.error('Error: L2 RPC URL is required');
    console.error('Set RWA_L2_RPC_URL or L2_RPC_URL environment variable');
    process.exit(1);
  }

  if (!privateKey) {
    console.error('Error: Private key is required');
    console.error('Set RWA_PRIVATE_KEY or PRIVATE_KEY environment variable');
    process.exit(1);
  }

  // Ensure private key has 0x prefix
  const normalizedPrivateKey = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`;

  return {
    l1RpcUrl,
    l2RpcUrl,
    privateKey: normalizedPrivateKey as `0x${string}`,
    network: (process.env.RWA_NETWORK || 'testnet') as 'mainnet' | 'testnet',
    pollInterval: parseInt(process.env.RWA_POLL_INTERVAL || '60000', 10),
    maxConcurrent: parseInt(process.env.RWA_MAX_CONCURRENT || '5', 10),
    gasBufferPercentage: parseInt(process.env.RWA_GAS_BUFFER || '10', 10),
    enableAutoProve: process.env.RWA_AUTO_PROVE !== 'false',
    enableAutoFinalize: process.env.RWA_AUTO_FINALIZE !== 'false',
    filterByUser: process.env.RWA_FILTER_USER as `0x${string}` | undefined,
    logLevel: (process.env.RWA_LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
    logFile: process.env.RWA_LOG_FILE,
  };
}

/**
 * Format uptime
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Main entry point
 */
async function main() {
  console.log(BANNER);

  // Load configuration
  const config = loadConfig();

  console.log('Configuration:');
  console.log(`  Network:        ${config.network}`);
  console.log(`  Poll Interval:  ${config.pollInterval}ms`);
  console.log(`  Max Concurrent: ${config.maxConcurrent}`);
  console.log(`  Auto Prove:     ${config.enableAutoProve}`);
  console.log(`  Auto Finalize:  ${config.enableAutoFinalize}`);
  if (config.filterByUser) {
    console.log(`  Filter User:    ${config.filterByUser}`);
  }
  console.log('');

  // Create relayer service
  const relayer = new RelayerService(config);

  // Register event listeners
  relayer.on((event) => {
    switch (event.type) {
      case 'started':
        console.log('[RELAYER] Service started');
        break;
      case 'stopped':
        console.log('[RELAYER] Service stopped');
        break;
      case 'withdrawal:proving':
        console.log(`[PROVE] Starting proof for ${(event.data as any)?.txHash}`);
        break;
      case 'withdrawal:proved':
        console.log(
          `[PROVE] Successfully proved ${(event.data as any)?.initiatedTxHash}`
        );
        console.log(`        Prove TX: ${(event.data as any)?.proveTxHash}`);
        break;
      case 'withdrawal:finalizing':
        console.log(`[FINALIZE] Starting finalization for ${(event.data as any)?.txHash}`);
        break;
      case 'withdrawal:finalized':
        console.log(
          `[FINALIZE] Successfully finalized ${(event.data as any)?.initiatedTxHash}`
        );
        console.log(`           Finalize TX: ${(event.data as any)?.finalizeTxHash}`);
        break;
      case 'withdrawal:failed':
        console.error(
          `[FAILED] ${(event.data as any)?.phase} failed for ${(event.data as any)?.txHash}`
        );
        console.error(`         Error: ${(event.data as any)?.error}`);
        break;
      case 'error':
        console.error(`[ERROR] ${(event.data as any)?.error}`);
        break;
    }
  });

  // Handle shutdown signals
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(`\nReceived ${signal}, shutting down...`);

    const stats = relayer.getStats();
    console.log('\nFinal Statistics:');
    console.log(`  Uptime:         ${formatUptime(stats.uptimeMs)}`);
    console.log(`  Total Proven:   ${stats.totalProven}`);
    console.log(`  Total Finalized: ${stats.totalFinalized}`);
    console.log(`  Total Failed:   ${stats.totalFailed}`);

    await relayer.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start the service
  console.log('Starting relayer service...\n');
  await relayer.start();

  // Print status periodically
  setInterval(() => {
    const stats = relayer.getStats();
    const monitorStats = relayer.getMonitorStats();

    console.log('\n--- Status ---');
    console.log(`  Uptime:           ${formatUptime(stats.uptimeMs)}`);
    console.log(`  Pending:          ${monitorStats.total}`);
    console.log(`  Ready to Prove:   ${monitorStats.readyToProve}`);
    console.log(`  Ready to Finalize: ${monitorStats.readyToFinalize}`);
    console.log(`  Total Proven:     ${stats.totalProven}`);
    console.log(`  Total Finalized:  ${stats.totalFinalized}`);
    console.log(`  Total Failed:     ${stats.totalFailed}`);
    console.log('--------------\n');
  }, 300000); // Every 5 minutes

  console.log('Relayer is now running. Press Ctrl+C to stop.\n');
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
