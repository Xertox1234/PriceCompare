import Queue from 'bull';
import cron from 'node-cron';
import { priceSnapshotService } from '../services/price-snapshot-service';
import { logger } from '../utils/logger';

// Initialize Redis connection for Bull
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    };

// Create Bull queue for price snapshots
export const priceSnapshotQueue =
  typeof redisConfig === 'string'
    ? new Queue('price-snapshots', redisConfig)
    : new Queue('price-snapshots', { redis: redisConfig });

// Process price snapshot jobs with explicit concurrency limit
// Concurrency of 5 balances throughput with resource usage
void priceSnapshotQueue.process(5, async (job) => {
  logger.info(`[PriceSnapshotQueue] Processing job ${job.id} at ${new Date().toISOString()}`);

  try {
    const count = await priceSnapshotService.snapshotAllPrices();
    logger.info(`[PriceSnapshotQueue] Successfully snapshotted ${count} prices`);

    return { success: true, count };
  } catch (error) {
    logger.error('[PriceSnapshotQueue] Error processing snapshot job:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});

// Handle job completion
priceSnapshotQueue.on('completed', (job, result: unknown) => {
  const resultInfo = result as { success?: boolean; count?: number } | undefined;
  logger.info(`[PriceSnapshotQueue] Job ${job.id} completed successfully:`, resultInfo);
});

// Handle job failures
priceSnapshotQueue.on('failed', (job, err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  logger.error('PriceSnapshotQueue job failed', { jobId: job?.id, error: errorMessage });
});

// Handle job stalling
priceSnapshotQueue.on('stalled', (job) => {
  logger.warn(`[PriceSnapshotQueue] Job ${job.id} stalled`);
});

/**
 * Initialize the price snapshot scheduler
 * Runs twice daily: at 8 AM and 8 PM
 */
export function initializePriceSnapshotScheduler() {
  // Schedule price snapshots twice a day
  // Cron format: minute hour * * *
  // "0 8,20 * * *" = At 8:00 AM and 8:00 PM every day

  const cronSchedule = process.env.PRICE_SNAPSHOT_CRON || '0 8,20 * * *';

  logger.info(`[PriceSnapshotScheduler] Initializing with schedule: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    logger.info(
      `[PriceSnapshotScheduler] Triggering scheduled price snapshot at ${new Date().toISOString()}`
    );

    try {
      await priceSnapshotQueue.add(
        {
          type: 'scheduled',
          timestamp: new Date().toISOString(),
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    } catch (error) {
      logger.error('[PriceSnapshotScheduler] Error adding snapshot job to queue:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  logger.info('[PriceSnapshotScheduler] Scheduler initialized successfully');
}

/**
 * Manually trigger a price snapshot
 * Useful for testing or immediate snapshots
 */
export async function triggerManualSnapshot(): Promise<void> {
  logger.info('[PriceSnapshotQueue] Manually triggering price snapshot');

  await priceSnapshotQueue.add(
    {
      type: 'manual',
      timestamp: new Date().toISOString(),
    },
    {
      attempts: 1,
      priority: 1, // High priority
    }
  );
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    priceSnapshotQueue.getWaitingCount(),
    priceSnapshotQueue.getActiveCount(),
    priceSnapshotQueue.getCompletedCount(),
    priceSnapshotQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  };
}

/**
 * Clean up old completed jobs
 */
export async function cleanupOldJobs() {
  // Remove completed jobs older than 24 hours
  await priceSnapshotQueue.clean(24 * 60 * 60 * 1000, 'completed');
  // Remove failed jobs older than 7 days
  await priceSnapshotQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');

  logger.info('[PriceSnapshotQueue] Cleaned up old jobs');
}
