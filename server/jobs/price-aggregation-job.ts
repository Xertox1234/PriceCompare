import cron, { type ScheduledTask } from 'node-cron';
import { priceAggregationService } from '../services/price-aggregation-service';
import { priceSnapshotService } from '../services/price-snapshot-service';
import { jobLockService } from '../services/job-lock-service';
import { logger } from '../utils/logger';

/**
 * Price Aggregation Scheduled Jobs
 * Automatically aggregate price history data and clean up old records
 *
 * Schedule:
 * - Daily aggregation: 1:00 AM every day
 * - Weekly aggregation: 11:00 PM every Sunday
 * - Monthly aggregation: 11:00 PM last day of each month
 * - Cleanup: 3:00 AM every Monday
 *
 * LOCKING: All jobs use distributed locks to prevent duplicate execution
 * in multi-server deployments
 */

let dailyAggregationJob: ScheduledTask | null = null;
let weeklyAggregationJob: ScheduledTask | null = null;
let monthlyAggregationJob: ScheduledTask | null = null;
let cleanupJob: ScheduledTask | null = null;

/**
 * Start all price aggregation scheduled jobs
 */
export function startPriceAggregationJobs(): void {
  logger.info('Starting price aggregation scheduled jobs...');

  // Daily aggregation at 1:00 AM
  dailyAggregationJob = cron.schedule('0 1 * * *', async () => {
    // Use distributed lock to prevent duplicate execution (2 hour TTL)
    const result = await jobLockService.withLock(
      'price-aggregation:daily',
      async () => {
        logger.info('[PriceAggregationJob] Starting daily aggregation');
        const count = await priceAggregationService.calculateDailyAggregates();
        logger.info(`[PriceAggregationJob] Daily aggregation complete: ${count} aggregates created`);
        return count;
      },
      7200 // 2 hour lock
    );

    if (result === null) {
      logger.info('[PriceAggregationJob] Daily aggregation skipped - already running on another server');
    }
  }, {
    timezone: 'America/New_York'
  });

  // Weekly aggregation on Sunday at 11:00 PM
  weeklyAggregationJob = cron.schedule('0 23 * * 0', async () => {
    // Use distributed lock to prevent duplicate execution (2 hour TTL)
    const result = await jobLockService.withLock(
      'price-aggregation:weekly',
      async () => {
        logger.info('[PriceAggregationJob] Starting weekly aggregation');
        const count = await priceAggregationService.calculateWeeklyAggregates();
        logger.info(`[PriceAggregationJob] Weekly aggregation complete: ${count} aggregates created`);
        return count;
      },
      7200 // 2 hour lock
    );

    if (result === null) {
      logger.info('[PriceAggregationJob] Weekly aggregation skipped - already running on another server');
    }
  }, {
    timezone: 'America/New_York'
  });

  // Monthly aggregation on last day of month at 11:00 PM
  monthlyAggregationJob = cron.schedule('0 23 28-31 * *', async () => {
    // Check if tomorrow is the 1st (meaning today is last day of month)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (tomorrow.getDate() === 1) {
      // Use distributed lock to prevent duplicate execution (2 hour TTL)
      const result = await jobLockService.withLock(
        'price-aggregation:monthly',
        async () => {
          logger.info('[PriceAggregationJob] Starting monthly aggregation');
          const count = await priceAggregationService.calculateMonthlyAggregates();
          logger.info(`[PriceAggregationJob] Monthly aggregation complete: ${count} aggregates created`);
          return count;
        },
        7200 // 2 hour lock
      );

      if (result === null) {
        logger.info('[PriceAggregationJob] Monthly aggregation skipped - already running on another server');
      }
    }
  }, {
    timezone: 'America/New_York'
  });

  // Cleanup weekly on Monday at 3:00 AM
  cleanupJob = cron.schedule('0 3 * * 1', async () => {
    // Use distributed lock to prevent duplicate execution (3 hour TTL)
    const result = await jobLockService.withLock(
      'price-aggregation:cleanup',
      async () => {
        logger.info('[PriceAggregationJob] Starting cleanup job');
        await priceSnapshotService.cleanupOldData();
        logger.info('[PriceAggregationJob] Cleanup complete');
        return true;
      },
      10800 // 3 hour lock
    );

    if (result === null) {
      logger.info('[PriceAggregationJob] Cleanup skipped - already running on another server');
    }
  }, {
    timezone: 'America/New_York'
  });

  logger.info('Price aggregation jobs scheduled:');
  logger.info('- Daily aggregation: 1:00 AM every day');
  logger.info('- Weekly aggregation: 11:00 PM every Sunday');
  logger.info('- Monthly aggregation: 11:00 PM last day of month');
  logger.info('- Cleanup: 3:00 AM every Monday');
}

/**
 * Stop all price aggregation scheduled jobs
 */
export function stopPriceAggregationJobs(): void {
  logger.info('Stopping price aggregation scheduled jobs...');

  if (dailyAggregationJob) {
    dailyAggregationJob.stop();
    dailyAggregationJob = null;
  }

  if (weeklyAggregationJob) {
    weeklyAggregationJob.stop();
    weeklyAggregationJob = null;
  }

  if (monthlyAggregationJob) {
    monthlyAggregationJob.stop();
    monthlyAggregationJob = null;
  }

  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
  }

  logger.info('Price aggregation jobs stopped');
}

/**
 * Get the status of scheduled jobs
 */
export function getPriceAggregationJobsStatus(): {
  dailyAggregationJob: boolean;
  weeklyAggregationJob: boolean;
  monthlyAggregationJob: boolean;
  cleanupJob: boolean;
} {
  return {
    dailyAggregationJob: dailyAggregationJob !== null,
    weeklyAggregationJob: weeklyAggregationJob !== null,
    monthlyAggregationJob: monthlyAggregationJob !== null,
    cleanupJob: cleanupJob !== null
  };
}

/**
 * Manually trigger daily aggregation (for testing)
 */
export async function triggerDailyAggregation(): Promise<number> {
  logger.info('Manually triggering daily aggregation...');
  const count = await priceAggregationService.calculateDailyAggregates();
  logger.info(`Manual daily aggregation completed: ${count} aggregates created`);
  return count;
}

/**
 * Manually trigger weekly aggregation (for testing)
 */
export async function triggerWeeklyAggregation(): Promise<number> {
  logger.info('Manually triggering weekly aggregation...');
  const count = await priceAggregationService.calculateWeeklyAggregates();
  logger.info(`Manual weekly aggregation completed: ${count} aggregates created`);
  return count;
}

/**
 * Manually trigger monthly aggregation (for testing)
 */
export async function triggerMonthlyAggregation(): Promise<number> {
  logger.info('Manually triggering monthly aggregation...');
  const count = await priceAggregationService.calculateMonthlyAggregates();
  logger.info(`Manual monthly aggregation completed: ${count} aggregates created`);
  return count;
}

/**
 * Manually trigger cleanup (for testing)
 */
export async function triggerCleanup(): Promise<void> {
  logger.info('Manually triggering cleanup...');
  await priceSnapshotService.cleanupOldData();
  logger.info('Manual cleanup completed');
}
