/**
 * RWA Lifecycle - Relayer Service
 *
 * Automated withdrawal finalization service for RWA bridge operations.
 * Includes state persistence, retry logic, and health monitoring.
 *
 * @example
 * ```typescript
 * import { RelayerService } from '@rwa-lifecycle/relayer';
 *
 * const relayer = new RelayerService({
 *   l1RpcUrl: 'https://eth-sepolia.public.blastapi.io',
 *   l2RpcUrl: 'https://rpc.sepolia.mantle.xyz',
 *   privateKey: '0x...',
 *   stateFilePath: './relayer-state.json', // Persist state across restarts
 *   maxRetries: 3,                         // Retry failed operations
 * });
 *
 * // Start the service
 * await relayer.start();
 *
 * // Listen to events
 * relayer.on((event) => {
 *   console.log(event.type, event.data);
 * });
 *
 * // Get health status
 * const health = relayer.getHealth();
 * console.log(`Status: ${health.status}`);
 *
 * // Get statistics
 * const stats = relayer.getStats();
 * console.log(`Proven: ${stats.totalProven}, Finalized: ${stats.totalFinalized}`);
 *
 * // Stop the service
 * await relayer.stop();
 * ```
 */

// Main service
export { RelayerService, type ExtendedRelayerConfig } from './RelayerService.js';

// Components
export { WithdrawalMonitor } from './WithdrawalMonitor.js';
export { WithdrawalProcessor } from './WithdrawalProcessor.js';
export { StateManager, type RelayerState } from './StateManager.js';
export { RetryHandler, type RetryConfig } from './RetryHandler.js';
export {
  HealthMonitor,
  type HealthCheckResult,
  type HealthStatus,
  type HealthMonitorConfig,
} from './HealthMonitor.js';

// Logger
export { createLogger, getLogger, setLogger, type Logger } from './logger.js';

// Types
export type {
  RelayerConfig,
  ResolvedRelayerConfig,
  TrackedWithdrawal,
  ProcessingResult,
  RelayerStats,
  RelayerEvent,
  RelayerEventType,
  RelayerEventListener,
} from './types.js';
