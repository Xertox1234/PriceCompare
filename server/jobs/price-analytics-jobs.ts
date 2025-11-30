import cron, { type ScheduledTask } from 'node-cron';
import { priceAggregationService } from '../services/price-aggregation-service';
import { trendAnalysisService } from '../services/trend-analysis-service';
import { jobLockService } from '../services/job-lock-service';
import { logger } from '../utils/logger';

/**
 * Price Analytics Scheduled Jobs
 * Contains all scheduled tasks related to price aggregation and trend analysis
 *
 * LOCKING: All jobs use distributed locks to prevent duplicate execution
 * in multi-server deployments
 */

let weeklyAggregationJob: ScheduledTask | null = null;
let monthlyAggregationJob: ScheduledTask | null = null;
let trendAnalysisJob: ScheduledTask | null = null;

/**
 * Start all price analytics scheduled jobs
 */
export function startPriceAnalyticsJobs(): void {
  logger.info('Starting price analytics scheduled jobs...');

  // Weekly aggregation - runs every Sunday at 11:00 PM
  weeklyAggregationJob = cron.schedule('0 23 * * 0', async () => {
    // Use distributed lock to prevent duplicate execution (1 hour TTL)
    const result = await jobLockService.withLock(
      'price-analytics:weekly-aggregation',
      async () => {
        logger.info('Starting weekly price aggregation...');
        const count = await priceAggregationService.calculateWeeklyAggregates();
        logger.info(`Weekly price aggregation completed: ${count} aggregates calculated`);
        return count;
      },
      3600 // 1 hour lock
    );

    if (result === null) {
      logger.info('Weekly aggregation skipped - already running on another server');
    }
  }, {
    timezone: 'America/New_York'
  });

  // Monthly aggregation - runs on the last day of every month at 11:30 PM
  monthlyAggregationJob = cron.schedule('30 23 28-31 * *', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Only run if tomorrow is the first day of the month
    if (tomorrow.getDate() === 1) {
      // Use distributed lock to prevent duplicate execution (1 hour TTL)
      const result = await jobLockService.withLock(
        'price-analytics:monthly-aggregation',
        async () => {
          logger.info('Starting monthly price aggregation...');
          const count = await priceAggregationService.calculateMonthlyAggregates();
          logger.info(`Monthly price aggregation completed: ${count} aggregates calculated`);
          return count;
        },
        3600 // 1 hour lock
      );

      if (result === null) {
        logger.info('Monthly aggregation skipped - already running on another server');
      }
    }
  }, {
    timezone: 'America/New_York'
  });

  // Trend analysis - runs daily at 3:00 AM
  trendAnalysisJob = cron.schedule('0 3 * * *', async () => {
    // Use distributed lock to prevent duplicate execution (2 hour TTL for longer analysis)
    const result = await jobLockService.withLock(
      'price-analytics:trend-analysis',
      async () => {
        logger.info('Starting daily trend analysis...');
        const count = await trendAnalysisService.analyzeTrendsForAllProducts(30);
        logger.info(`Daily trend analysis completed: ${count} trends analyzed`);
        return count;
      },
      7200 // 2 hour lock (trend analysis may take longer)
    );

    if (result === null) {
      logger.info('Trend analysis skipped - already running on another server');
    }
  }, {
    timezone: 'America/New_York'
  });

  logger.info('Price analytics jobs scheduled:');
  logger.info('- Weekly aggregation: 11:00 PM every Sunday');
  logger.info('- Monthly aggregation: 11:30 PM on last day of month');
  logger.info('- Trend analysis: 3:00 AM every day');
}

/**
 * Stop all price analytics scheduled jobs
 */
export function stopPriceAnalyticsJobs(): void {
  logger.info('Stopping price analytics scheduled jobs...');

  if (weeklyAggregationJob) {
    void weeklyAggregationJob.stop();
    weeklyAggregationJob = null;
  }

  if (monthlyAggregationJob) {
    void monthlyAggregationJob.stop();
    monthlyAggregationJob = null;
  }

  if (trendAnalysisJob) {
    void trendAnalysisJob.stop();
    trendAnalysisJob = null;
  }

  logger.info('Price analytics jobs stopped');
}

/**
 * Get the status of scheduled jobs
 */
export function getPriceAnalyticsJobsStatus(): {
  weeklyAggregationJob: boolean;
  monthlyAggregationJob: boolean;
  trendAnalysisJob: boolean;
} {
  return {
    weeklyAggregationJob: weeklyAggregationJob !== null,
    monthlyAggregationJob: monthlyAggregationJob !== null,
    trendAnalysisJob: trendAnalysisJob !== null
  };
}

/**
 * Manually trigger weekly aggregation (for testing)
 */
export async function triggerWeeklyAggregation(): Promise<number> {
  logger.info('Manually triggering weekly aggregation...');
  const count = await priceAggregationService.calculateWeeklyAggregates();
  logger.info(`Manual weekly aggregation completed: ${count} aggregates`);
  return count;
}

/**
 * Manually trigger monthly aggregation (for testing)
 */
export async function triggerMonthlyAggregation(): Promise<number> {
  logger.info('Manually triggering monthly aggregation...');
  const count = await priceAggregationService.calculateMonthlyAggregates();
  logger.info(`Manual monthly aggregation completed: ${count} aggregates`);
  return count;
}

/**
 * Manually trigger trend analysis (for testing)
 */
export async function triggerTrendAnalysis(analysisPeriodDays = 30): Promise<number> {
  logger.info(`Manually triggering trend analysis (${analysisPeriodDays} days)...`);
  const count = await trendAnalysisService.analyzeTrendsForAllProducts(analysisPeriodDays);
  logger.info(`Manual trend analysis completed: ${count} trends analyzed`);
  return count;
}
