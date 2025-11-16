import cron, { type ScheduledTask } from 'node-cron';
import { generateDailySnapshots, cleanupOldPriceHistory } from '../services/price-history-service';
import { jobLockService } from '../services/job-lock-service';
import { logger } from '../utils/logger';

/**
 * Price History Scheduled Jobs
 * Contains all scheduled tasks related to price history tracking
 *
 * LOCKING: All jobs use distributed locks to prevent duplicate execution
 * in multi-server deployments
 */

let snapshotJob: ScheduledTask | null = null;
let cleanupJob: ScheduledTask | null = null;

/**
 * Start all price history scheduled jobs
 */
export function startPriceHistoryJobs(): void {
  logger.info('Starting price history scheduled jobs...');

  // Daily snapshot generation - runs at 1:00 AM every day
  snapshotJob = cron.schedule('0 1 * * *', async () => {
    // Use distributed lock to prevent duplicate execution (1 hour TTL)
    const result = await jobLockService.withLock(
      'price-history:daily-snapshots',
      async () => {
        logger.info('Starting daily price snapshot generation...');
        const count = await generateDailySnapshots();
        logger.info(`Daily price snapshots completed: ${count} snapshots generated`);
        return count;
      },
      3600 // 1 hour lock
    );

    if (result === null) {
      logger.info('Snapshot generation skipped - already running on another server');
    }
  }, {
    timezone: 'America/New_York'
  });

  // Weekly cleanup - runs every Sunday at 2:00 AM
  cleanupJob = cron.schedule('0 2 * * 0', async () => {
    // Use distributed lock to prevent duplicate execution (1 hour TTL)
    const result = await jobLockService.withLock(
      'price-history:cleanup',
      async () => {
        logger.info('Starting price history cleanup...');
        const deletedCount = await cleanupOldPriceHistory(90); // Keep 90 days
        logger.info(`Price history cleanup completed: ${deletedCount} records removed`);
        return deletedCount;
      },
      3600 // 1 hour lock
    );

    if (result === null) {
      logger.info('Price history cleanup skipped - already running on another server');
    }
  }, {
    timezone: 'America/New_York'
  });

  logger.info('Price history jobs scheduled:');
  logger.info('- Daily snapshots: 1:00 AM every day');
  logger.info('- Weekly cleanup: 2:00 AM every Sunday');
}

/**
 * Stop all price history scheduled jobs
 */
export function stopPriceHistoryJobs(): void {
  logger.info('Stopping price history scheduled jobs...');

  if (snapshotJob) {
    snapshotJob.stop();
    snapshotJob = null;
  }

  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
  }

  logger.info('Price history jobs stopped');
}

/**
 * Get the status of scheduled jobs
 */
export function getPriceHistoryJobsStatus(): {
  snapshotJob: boolean;
  cleanupJob: boolean;
} {
  return {
    snapshotJob: snapshotJob !== null,
    cleanupJob: cleanupJob !== null
  };
}

/**
 * Manually trigger snapshot generation (for testing)
 */
export async function triggerSnapshotGeneration(): Promise<number> {
  logger.info('Manually triggering snapshot generation...');
  const count = await generateDailySnapshots();
  logger.info(`Manual snapshot generation completed: ${count} snapshots`);
  return count;
}

/**
 * Manually trigger cleanup (for testing)
 */
export async function triggerCleanup(daysToKeep: number = 90): Promise<number> {
  logger.info(`Manually triggering cleanup (keeping ${daysToKeep} days)...`);
  const deletedCount = await cleanupOldPriceHistory(daysToKeep);
  logger.info(`Manual cleanup completed: ${deletedCount} records removed`);
  return deletedCount;
}
