/**
 * Price Refresh Queue - Scheduled Daily Price Updates
 *
 * Refreshes stale product offers by re-scraping Canadian retailers.
 * Runs nightly to keep prices up-to-date for tracked products.
 *
 * Schedule: 3 AM EST daily (configurable via PRICE_REFRESH_CRON env var)
 *
 * PATTERN: Bull queue with lazy initialization + distributed locking
 * @see server/jobs/price-snapshot-queue.ts - Reference implementation
 * @see server/agents/monitoring-agent.ts - Uses same extraction patterns
 */

import Queue from 'bull';
import cron from 'node-cron';
import { dataExtractionAgent } from '../agents/extraction-agent';
import { storage } from '../storage';
import { jobLockService } from '../services/job-lock-service';
import { ScraperUtils } from '../utils/scraper-utils';
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
    delay: 10000, // 10s → 20s → 40s progression (longer for scraping)
  },
  removeOnComplete: 100, // Keep last 100 completed jobs for monitoring
  removeOnFail: 500, // Keep last 500 failed jobs for analysis
} as const;

// LAZY INITIALIZATION: Queue is only created when first accessed
// This prevents the Bull queue from connecting to Redis at module import time,
// which would block the server startup if Redis is not yet ready.
let _priceRefreshQueue: Queue.Queue | null = null;
let _queueInitialized = false;

/**
 * Get the price refresh queue (lazy initialization)
 * The queue is created on first access, not at module load time.
 */
function getPriceRefreshQueue(): Queue.Queue {
  if (!_priceRefreshQueue) {
    _priceRefreshQueue =
      typeof redisConfig === 'string'
        ? new Queue('price-refresh', redisConfig, {
            defaultJobOptions: JOB_OPTIONS,
          })
        : new Queue('price-refresh', {
            redis: redisConfig,
            defaultJobOptions: JOB_OPTIONS,
          });
  }
  return _priceRefreshQueue;
}

/**
 * Refresh stale offers - core job logic
 * Re-scrapes product offers that haven't been checked in the specified hours
 */
async function refreshStaleOffers(maxAgeHours: number, batchSize: number): Promise<{
  refreshed: number;
  failed: number;
  skipped: number;
  totalProcessed: number;
}> {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  logger.info('[PriceRefreshQueue] Fetching stale offers', {
    maxAgeHours,
    cutoffTime: cutoffTime.toISOString(),
    batchSize,
  });

  // Get offers that need checking using storage layer
  const staleOffers = await storage.getPriceMonitoringOffers(cutoffTime, batchSize);

  logger.info('[PriceRefreshQueue] Found stale offers', {
    count: staleOffers.length,
  });

  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const offer of staleOffers) {
    // Skip offers without valid URLs
    if (!offer.productUrl || !offer.retailer?.website) {
      skipped++;
      logger.debug('[PriceRefreshQueue] Skipping offer - missing URL or retailer', {
        offerId: offer.id,
        hasUrl: !!offer.productUrl,
        hasRetailer: !!offer.retailer,
      });
      continue;
    }

    try {
      // Rate limiting between requests to avoid bot detection
      await ScraperUtils.delay(5000, true); // 5s delay with randomization

      const result = await dataExtractionAgent.processTask({
        action: 'extract_product_data',
        url: offer.productUrl,
        retailer: offer.retailer.website,
        productId: offer.productId,
      });

      if (result.success) {
        refreshed++;
        logger.debug('[PriceRefreshQueue] Offer refreshed successfully', {
          offerId: offer.id,
          productName: offer.product?.name,
          retailer: offer.retailer?.name,
          newPrice: result.data.price,
        });
      } else {
        failed++;
        logger.warn('[PriceRefreshQueue] Offer refresh failed', {
          offerId: offer.id,
          productName: offer.product?.name,
          reason: result.reason,
        });
      }
    } catch (error) {
      failed++;
      logger.error('[PriceRefreshQueue] Error refreshing offer', {
        offerId: offer.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Mark as checked to avoid infinite retries
      await storage.updateProductOffer(offer.id, {
        lastLinkCheck: new Date(),
      });
    }
  }

  return {
    refreshed,
    failed,
    skipped,
    totalProcessed: staleOffers.length,
  };
}

/**
 * Setup queue event handlers and processor
 * Must be called once after queue is ready
 */
function setupQueueHandlers() {
  if (_queueInitialized) return;

  const queue = getPriceRefreshQueue();

  // Process price refresh jobs with explicit concurrency limit
  // Concurrency of 1 for scraping to avoid overwhelming retailers
  void queue.process(1, async (job) => {
    logger.info(`[PriceRefreshQueue] Processing job ${job.id} at ${new Date().toISOString()}`);

    // SAFETY: Bull stores job.data as unknown; we narrow to expected shape matching queue.add() calls
    const jobData = job.data as {
      maxAgeHours?: number;
      batchSize?: number;
      type?: string;
    };

    const maxAgeHours = jobData.maxAgeHours ?? 24; // Default: offers older than 24 hours
    const batchSize = jobData.batchSize ?? 50; // Default: 50 offers per batch

    try {
      const result = await refreshStaleOffers(maxAgeHours, batchSize);
      logger.info('[PriceRefreshQueue] Job completed', result);

      return { success: true, ...result };
    } catch (error) {
      logger.error('[PriceRefreshQueue] Error processing refresh job:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

  // Handle job completion
  queue.on('completed', (job, result: unknown) => {
    const stats = { refreshed: 0, failed: 0, totalProcessed: 0 };

    if (typeof result === 'object' && result !== null) {
      // SAFETY: Narrowed by typeof check above; extracting typed properties
      const data = result as Record<string, unknown>;
      if (typeof data.refreshed === 'number') stats.refreshed = data.refreshed;
      if (typeof data.failed === 'number') stats.failed = data.failed;
      if (typeof data.totalProcessed === 'number') stats.totalProcessed = data.totalProcessed;
    }

    let jobType: string | undefined;
    if (job.data && typeof job.data === 'object' && 'type' in job.data) {
      // SAFETY: Narrowed by typeof check above; extracting type property
      const data = job.data as Record<string, unknown>;
      jobType = typeof data.type === 'string' ? data.type : String(data.type);
    }

    logger.info('[PriceRefreshQueue] Job completed successfully', {
      jobId: job.id,
      jobName: job.name,
      type: jobType,
      ...stats,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle job failures
  queue.on('failed', (job, err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : String(err);

    const error = err instanceof Error ? err : new Error(String(err));
    const isRetryableFailure = isRetryableError(error);
    const isNonRetryableFailure = isNonRetryableError(error);
    const retriesExhausted = job?.attemptsMade === job?.opts.attempts;

    let jobType: string | undefined;
    if (job?.data && typeof job.data === 'object' && 'type' in job.data) {
      const data = job.data as Record<string, unknown>;
      jobType = typeof data.type === 'string' ? data.type : String(data.type);
    }

    logger.error('[PriceRefreshQueue] Job failed', {
      jobId: job?.id,
      jobName: job?.name,
      type: jobType,
      attempts: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
      error: errorMessage,
      errorClassification: isNonRetryableFailure
        ? 'permanent'
        : isRetryableFailure
          ? 'transient_exhausted'
          : 'unknown',
      failureMode: retriesExhausted ? 'retries_exhausted' : 'initial_failure',
    });
  });

  // Handle job stalling
  queue.on('stalled', (job) => {
    logger.warn(`[PriceRefreshQueue] Job ${job.id} stalled`);
  });

  _queueInitialized = true;
}

/**
 * Initialize the price refresh scheduler
 * Runs daily at 3 AM EST (8 AM UTC during standard time)
 * Configurable via PRICE_REFRESH_CRON environment variable
 */
export function initializePriceRefreshScheduler() {
  // Setup queue handlers first
  setupQueueHandlers();

  // Schedule price refresh daily
  // Default: "0 8 * * *" = 8:00 AM UTC (3:00 AM EST)
  // Adjustable via PRICE_REFRESH_CRON env var
  const cronSchedule = process.env.PRICE_REFRESH_CRON || '0 8 * * *';

  logger.info(`[PriceRefreshScheduler] Initializing with schedule: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    // Use distributed lock to prevent duplicate execution across multiple servers
    const result = await jobLockService.withLock(
      'price-refresh:scheduler',
      async () => {
        logger.info(
          `[PriceRefreshScheduler] Triggering scheduled price refresh at ${new Date().toISOString()} (lock acquired)`
        );

        await getPriceRefreshQueue().add(
          {
            type: 'scheduled',
            timestamp: new Date().toISOString(),
            maxAgeHours: 24, // Refresh offers older than 24 hours
            batchSize: 100, // Process 100 offers per scheduled run
          },
          JOB_OPTIONS
        );

        return { triggered: true };
      },
      60 // 60 second lock (job add is fast)
    );

    if (result === null) {
      logger.debug('[PriceRefreshScheduler] Skipped - already triggered by another server');
    }
  });

  logger.info('[PriceRefreshScheduler] Scheduler initialized successfully');
}

/**
 * Manually trigger a price refresh
 * Useful for testing or immediate refresh needs
 */
export async function triggerManualPriceRefresh(options?: {
  maxAgeHours?: number;
  batchSize?: number;
}): Promise<void> {
  logger.info('[PriceRefreshQueue] Manually triggering price refresh', options);

  await getPriceRefreshQueue().add(
    {
      type: 'manual',
      timestamp: new Date().toISOString(),
      maxAgeHours: options?.maxAgeHours ?? 48, // Manual: refresh offers older than 48 hours
      batchSize: options?.batchSize ?? 20, // Manual: smaller batch for quick feedback
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
export async function getPriceRefreshQueueStats() {
  const queue = getPriceRefreshQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
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
export async function cleanupOldPriceRefreshJobs() {
  const queue = getPriceRefreshQueue();
  // Remove completed jobs older than 24 hours
  await queue.clean(24 * 60 * 60 * 1000, 'completed');
  // Remove failed jobs older than 7 days
  await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed');

  logger.info('[PriceRefreshQueue] Cleaned up old jobs');
}

/**
 * Legacy export for compatibility - provides lazy access to the queue
 */
export const priceRefreshQueue = {
  get process() {
    return getPriceRefreshQueue().process.bind(getPriceRefreshQueue());
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Bull queue has complex generic types for job data
  add: async (data: any, opts?: Queue.JobOptions) => {
    return getPriceRefreshQueue().add(data, opts);
  },
  on: (event: string, callback: (...args: unknown[]) => void) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- Bull queue event callbacks have dynamic signatures
    return getPriceRefreshQueue().on(event, callback as (...args: any[]) => void);
  },
  close: async () => {
    if (_priceRefreshQueue) {
      return _priceRefreshQueue.close();
    }
  },
  getWaitingCount: async () => {
    return getPriceRefreshQueue().getWaitingCount();
  },
  getActiveCount: async () => {
    return getPriceRefreshQueue().getActiveCount();
  },
  getCompletedCount: async () => {
    return getPriceRefreshQueue().getCompletedCount();
  },
  getFailedCount: async () => {
    return getPriceRefreshQueue().getFailedCount();
  },
  clean: async (grace: number, type?: Queue.JobStatusClean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- Bull queue clean method type param is complex union
    return getPriceRefreshQueue().clean(grace, type as any);
  },
};
