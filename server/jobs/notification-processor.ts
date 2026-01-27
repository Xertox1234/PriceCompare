import Queue from 'bull';
import cron from 'node-cron';
import { storage } from '../storage';
import { createLogger } from '../utils/logger';
import { jobLockService } from '../services/job-lock-service';
import {
  analyzeNotificationTriggers,
  prioritizeNotifications,
  shouldNotifyUser,
  createSmartNotification,
  type NotificationTrigger,
} from '../services/smart-notification-service';

const log = createLogger('NotificationProcessor');

/**
 * Notification Processor
 *
 * Background job that analyzes watched products for price drops and sends
 * smart notifications to users.
 */

// Initialize Redis connection for Bull
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    };

// LAZY INITIALIZATION: Queue is only created when first accessed
// This prevents the Bull queue from connecting to Redis at module import time,
// which would block the server startup if Redis is not yet ready.
let _notificationQueue: Queue.Queue | null = null;
let _queueInitialized = false;

/**
 * Get the notification queue (lazy initialization)
 * The queue is created on first access, not at module load time.
 */
function getNotificationQueue(): Queue.Queue {
  if (!_notificationQueue) {
    _notificationQueue =
      typeof redisConfig === 'string'
        ? new Queue('smart-notifications', redisConfig)
        : new Queue('smart-notifications', { redis: redisConfig });
  }
  return _notificationQueue;
}

/**
 * Legacy export for backward compatibility - provides lazy access to the queue
 * The queue is not created until one of these methods is called.
 */
export const notificationQueue = {
  get process() {
    return getNotificationQueue().process.bind(getNotificationQueue());
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Bull queue has complex generic types for job data
  add: async (name: string, data: any, opts?: Queue.JobOptions) => {
    return getNotificationQueue().add(name, data, opts);
  },
  on: (event: string, callback: (...args: unknown[]) => void) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- Bull queue event callbacks have dynamic signatures
    return getNotificationQueue().on(event, callback as (...args: any[]) => void);
  },
  close: async () => {
    if (_notificationQueue) {
      return _notificationQueue.close();
    }
  },
  getWaitingCount: async () => {
    return getNotificationQueue().getWaitingCount();
  },
  getActiveCount: async () => {
    return getNotificationQueue().getActiveCount();
  },
  getCompletedCount: async () => {
    return getNotificationQueue().getCompletedCount();
  },
  getFailedCount: async () => {
    return getNotificationQueue().getFailedCount();
  },
  clean: async (...args: Parameters<Queue.Queue['clean']>) => {
    return getNotificationQueue().clean(...args);
  },
};

/**
 * Process watched products and send notifications
 */
async function processWatchedProducts(): Promise<{ processed: number; notified: number }> {
  log.info('Starting notification processor');

  let processedCount = 0;
  let notifiedCount = 0;

  try {
    // Get all users with watched products (batch by user)
    // PERFORMANCE: Use storage layer method (TODO 270: Fix storage layer violation)
    const userIds = await storage.getUserIdsWithWatchedProducts();
    const usersWithWatches = userIds.map((userId) => ({ userId }));

    log.info(`Processing notifications for ${usersWithWatches.length} users with watched products`);

    for (const { userId } of usersWithWatches) {
      try {
        // Get user's watched products with current pricing
        const result = await storage.getWatchedProducts(userId, {
          sortBy: 'priceDropPercent',
          limit: 50, // Process top 50 products per user
        });
        const watchedProducts = result.products;

        log.debug(`User ${userId} has ${watchedProducts.length} watched products`);

        const triggers: NotificationTrigger[] = [];

        // Analyze each product for notification triggers
        for (const product of watchedProducts) {
          processedCount++;

          const trigger = analyzeNotificationTriggers(product.productId, userId, {
            currentPrice: product.currentPrice,
            lowestPrice: product.lowestPrice,
            averagePrice: product.averagePrice,
            priceDropPercent: product.priceDropPercent,
            // NOTE: Stock status not yet implemented in getWatchedProducts
            // Defaulting to 'in_stock' - future enhancement to fetch from product offers
            stockStatus: 'in_stock',
            alertStatus: product.alertStatus,
          });

          if (trigger.shouldNotify) {
            triggers.push(trigger);
          }
        }

        // Prioritize triggers
        const prioritizedTriggers = prioritizeNotifications(triggers);

        log.debug(`User ${userId} has ${prioritizedTriggers.length} notification triggers`);

        // Process triggers (respecting daily limit AND per-run limit)
        const MAX_NOTIFICATIONS_PER_RUN = 5; // Prevent spam if urgency logic malfunctions
        let sentThisRun = 0;

        for (const trigger of prioritizedTriggers) {
          // Check per-run limit first (circuit breaker)
          if (sentThisRun >= MAX_NOTIFICATIONS_PER_RUN) {
            log.debug(`Reached per-run limit for user ${userId} (${MAX_NOTIFICATIONS_PER_RUN})`);
            break;
          }

          // Check if user should be notified (daily limit, quiet hours, deduplication)
          const { allowed, reason } = await shouldNotifyUser(userId, trigger);

          if (!allowed) {
            log.debug(`Skipping notification for user ${userId}`, { reason });
            continue;
          }

          // Create and deliver notification
          await createSmartNotification(userId, trigger);
          sentThisRun++;
          notifiedCount++;
        }
      } catch (userError) {
        log.error(`Error processing notifications for user ${userId}`, {
          error: userError instanceof Error ? userError.message : String(userError),
        });
        // Continue with next user
      }
    }

    log.info('Notification processor completed', { processedCount, notifiedCount });

    return { processed: processedCount, notified: notifiedCount };
  } catch (error) {
    log.error('Notification processor failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Setup queue event handlers and processor
 * Must be called once after queue is ready
 */
function setupQueueHandlers() {
  if (_queueInitialized) return;
  
  const queue = getNotificationQueue();
  
  // Process notification jobs
  void queue.process('check-watched-products', async (job) => {
    log.info(`Processing notification job ${job.id} at ${new Date().toISOString()}`);

    try {
      const result = await processWatchedProducts();
      log.info(`Notification job ${job.id} completed successfully`, result);

      return { success: true, ...result };
    } catch (error) {
      log.error(`Notification job ${job.id} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

  // Handle job completion
  queue.on('completed', (job, result: unknown) => {
    log.info(`Notification job ${job.id} completed`, result as Record<string, unknown>);
  });

  // Handle job failures
  queue.on('failed', (job, err) => {
    log.error('Notification job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  // Handle job stalling
  queue.on('stalled', (job) => {
    log.warn(`Notification job ${job.id} stalled`);
  });
  
  _queueInitialized = true;
}

/**
 * Initialize the notification processor scheduler
 * Runs every 15 minutes with distributed locking
 */
export function initializeNotificationProcessor() {
  // Setup queue handlers first
  setupQueueHandlers();
  
  const cronSchedule = process.env.NOTIFICATION_PROCESSOR_CRON || '*/15 * * * *';

  log.info(`Initializing notification processor with schedule: ${cronSchedule}`);

  // Schedule notification processing every 15 minutes
  cron.schedule(cronSchedule, async () => {
    log.info(`Triggering scheduled notification processor at ${new Date().toISOString()}`);

    try {
      // Use distributed locking to prevent multiple servers from processing simultaneously
      const result = await jobLockService.withLock(
        'smart-notifications:processor',
        async () => {
          // Add job to queue
          await getNotificationQueue().add(
            'check-watched-products',
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
          return true;
        },
        900 // 15 minutes TTL
      );

      if (result === null) {
        log.info('Notification processor already running on another server');
      }
    } catch (error) {
      log.error('Error triggering notification processor', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  log.info('Notification processor scheduler initialized successfully');
}

/**
 * Manually trigger notification processor
 * Useful for testing or immediate processing
 */
export async function triggerManualNotificationProcessor(): Promise<void> {
  log.info('Manually triggering notification processor');

  await getNotificationQueue().add(
    'check-watched-products',
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
export async function getNotificationQueueStats() {
  const queue = getNotificationQueue();
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
export async function cleanupNotificationJobs() {
  const queue = getNotificationQueue();
  // Remove completed jobs older than 24 hours
  await queue.clean(24 * 60 * 60 * 1000, 'completed');
  // Remove failed jobs older than 7 days
  await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed');

  log.info('Cleaned up old notification jobs');
}
