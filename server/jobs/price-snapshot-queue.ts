import Queue from 'bull';
import cron from 'node-cron';
import { priceSnapshotService } from '../services/price-snapshot-service';
import { jobLockService } from '../services/job-lock-service';
import { logger } from '../utils/logger';
import { isRetryableError, isNonRetryableError } from '../utils/retry';

// Initialize Redis connection for Bull
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    };

// Centralized job options configuration (DRY principle)
const JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // 5s → 10s → 20s progression
  },
  removeOnComplete: 100, // Keep last 100 completed jobs for monitoring
  removeOnFail: 1000, // Keep last 1000 failed jobs for analysis
} as const;

// Create Bull queue for price snapshots with default retry configuration
export const priceSnapshotQueue =
  typeof redisConfig === 'string'
    ? new Queue('price-snapshots', redisConfig, {
        defaultJobOptions: JOB_OPTIONS,
      })
    : new Queue('price-snapshots', {
        redis: redisConfig,
        defaultJobOptions: JOB_OPTIONS,
      });

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
  // Type guard instead of unsafe assertion
  let itemsProcessed = 0;

  if (typeof result === 'object' && result !== null && 'count' in result) {
    const data = result as Record<string, unknown>;
    if (typeof data.count === 'number') {
      itemsProcessed = data.count;
    }
  }

  // Extract type safely with progressive narrowing
  let jobType: string | undefined;
  if (job.data && typeof job.data === 'object' && 'type' in job.data) {
    const data = job.data as Record<string, unknown>;
    jobType = typeof data.type === 'string' ? data.type : String(data.type);
  }

  logger.info('[PriceSnapshotQueue] Job completed successfully', {
    jobId: job.id,
    jobName: job.name,
    type: jobType,
    itemsProcessed,
    timestamp: new Date().toISOString(),
  });
});

// Handle job failures
priceSnapshotQueue.on('failed', (job, err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);

  // Classify error for alerting and debugging
  const error = err instanceof Error ? err : new Error(String(err));
  const isRetryableFailure = isRetryableError(error);
  const isNonRetryableFailure = isNonRetryableError(error);
  const retriesExhausted = job?.attemptsMade === job?.opts.attempts;

  // Extract type safely with progressive narrowing
  let jobType: string | undefined;
  if (job?.data && typeof job.data === 'object' && 'type' in job.data) {
    const data = job.data as Record<string, unknown>;
    jobType = typeof data.type === 'string' ? data.type : String(data.type);
  }

  logger.error('[PriceSnapshotQueue] Job permanently failed', {
    jobId: job?.id,
    jobName: job?.name,
    type: jobType,
    attempts: job?.attemptsMade,
    maxAttempts: job?.opts.attempts,
    error: errorMessage,
    errorClassification: isNonRetryableFailure
      ? 'permanent'
      : (isRetryableFailure ? 'transient_exhausted' : 'unknown'),
    failureMode: retriesExhausted ? 'retries_exhausted' : 'initial_failure',
  });
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
    // Use distributed lock to prevent duplicate execution across multiple servers
    const result = await jobLockService.withLock(
      'price-snapshot:scheduler',
      async () => {
        logger.info(
          `[PriceSnapshotScheduler] Triggering scheduled price snapshot at ${new Date().toISOString()} (lock acquired)`
        );

        await priceSnapshotQueue.add(
          {
            type: 'scheduled',
            timestamp: new Date().toISOString(),
          },
          JOB_OPTIONS
        );

        return { triggered: true };
      },
      60 // 60 second lock (job add is fast)
    );

    if (result === null) {
      // Another server already triggered this schedule
      logger.debug('[PriceSnapshotScheduler] Skipped - already triggered by another server');
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
      ...JOB_OPTIONS,
      priority: 1, // High priority for manual triggers
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
