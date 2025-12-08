/**
 * Cleanup Manager
 *
 * Centralized resource cleanup for timers, intervals, and async resources.
 * Provides a single point of control for graceful shutdown handling.
 *
 * Features:
 * - Track all setInterval timers
 * - Register custom cleanup handlers
 * - Coordinated shutdown sequence
 * - Resource leak prevention
 */

import { createLogger } from './logger';

const log = createLogger('CleanupManager');

export class CleanupManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private cleanupHandlers: Array<{
    name: string;
    handler: () => Promise<void>;
  }> = [];
  private isShuttingDown = false;

  /**
   * Register a setInterval timer for cleanup
   *
   * @param name - Descriptive name for this interval (for logging)
   * @param interval - The NodeJS.Timeout from setInterval
   */
  addInterval(name: string, interval: NodeJS.Timeout): void {
    if (this.intervals.has(name)) {
      log.warn(`Interval '${name}' already registered, replacing...`);
      const existing = this.intervals.get(name);
      if (existing) {
        clearInterval(existing);
      }
    }

    this.intervals.set(name, interval);
    log.debug(`Registered interval: ${name} (total: ${this.intervals.size})`);
  }

  /**
   * Register an async cleanup handler
   *
   * @param name - Descriptive name for this handler (for logging)
   * @param handler - Async function to call during cleanup
   */
  addCleanupHandler(name: string, handler: () => Promise<void>): void {
    this.cleanupHandlers.push({ name, handler });
    log.debug(`Registered cleanup handler: ${name} (total: ${this.cleanupHandlers.length})`);
  }

  /**
   * Remove a specific interval by name
   *
   * @param name - Name of the interval to remove
   * @returns true if removed, false if not found
   */
  removeInterval(name: string): boolean {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
      log.debug(`Removed interval: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Execute cleanup sequence
   *
   * Clears all intervals and runs all registered cleanup handlers.
   * Safe to call multiple times (idempotent).
   */
  async cleanup(): Promise<void> {
    if (this.isShuttingDown) {
      log.warn('Cleanup already in progress, skipping duplicate call');
      return;
    }

    this.isShuttingDown = true;
    log.info('Starting cleanup sequence...');

    // Step 1: Clear all intervals
    log.info(`Clearing ${this.intervals.size} interval timers...`);
    const intervalEntries = Array.from(this.intervals.entries());
    for (const [name, interval] of intervalEntries) {
      clearInterval(interval);
      log.debug(`Cleared interval: ${name}`);
    }
    this.intervals.clear();

    // Step 2: Run all cleanup handlers
    log.info(`Running ${this.cleanupHandlers.length} cleanup handlers...`);
    const results = await Promise.allSettled(
      this.cleanupHandlers.map(async ({ name, handler }) => {
        try {
          log.debug(`Running cleanup handler: ${name}`);
          await handler();
          log.debug(`Completed cleanup handler: ${name}`);
        } catch (error) {
          log.error(`Cleanup handler '${name}' failed:`, error as Record<string, unknown>);
          throw error;
        }
      })
    );

    // Report failures
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      log.error(`${failures.length} cleanup handlers failed`);
      failures.forEach((result, index) => {
        if (result.status === 'rejected') {
          log.error(
            `Failed handler ${this.cleanupHandlers[index].name}:`,
            result.reason as Record<string, unknown>
          );
        }
      });
    }

    log.info('Cleanup sequence completed');
  }

  /**
   * Get current state of registered resources
   */
  getStats(): {
    intervals: number;
    cleanupHandlers: number;
    isShuttingDown: boolean;
  } {
    return {
      intervals: this.intervals.size,
      cleanupHandlers: this.cleanupHandlers.length,
      isShuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Reset the cleanup manager state (for testing)
   */
  reset(): void {
    this.intervals.clear();
    this.cleanupHandlers = [];
    this.isShuttingDown = false;
  }
}

// Singleton instance
export const cleanupManager = new CleanupManager();
