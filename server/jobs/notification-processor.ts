import Queue from "bull";
import cron from "node-cron";
import { db } from "../db";
import { productWatches } from "../../shared/schema";
import { storage } from "../storage";
import { createLogger } from "../utils/logger";
import { jobLockService } from "../services/job-lock-service";
import {
  analyzeNotificationTriggers,
  prioritizeNotifications,
  shouldNotifyUser,
  createSmartNotification,
  type NotificationTrigger
} from "../services/smart-notification-service";

const log = createLogger("NotificationProcessor");

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
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    };

// Create Bull queue for notification processing
export const notificationQueue = typeof redisConfig === 'string'
  ? new Queue("smart-notifications", redisConfig)
  : new Queue("smart-notifications", { redis: redisConfig });

/**
 * Process watched products and send notifications
 */
async function processWatchedProducts(): Promise<{ processed: number; notified: number }> {
  log.info('Starting notification processor');

  let processedCount = 0;
  let notifiedCount = 0;

  try {
    // Get all users with watched products (batch by user)
    // PERFORMANCE: Use GROUP BY to avoid N+1 query
    const usersWithWatches = await db
      .selectDistinct({ userId: productWatches.userId })
      .from(productWatches);

    log.info(`Processing notifications for ${usersWithWatches.length} users with watched products`);

    for (const { userId } of usersWithWatches) {
      try {
        // Get user's watched products with current pricing
        const watchedProducts = await storage.getWatchedProducts(userId, {
          sortBy: 'priceDropPercent',
          limit: 50 // Process top 50 products per user
        });

        log.debug(`User ${userId} has ${watchedProducts.length} watched products`);

        const triggers: NotificationTrigger[] = [];

        // Analyze each product for notification triggers
        for (const product of watchedProducts) {
          processedCount++;

          const trigger = await analyzeNotificationTriggers(
            product.productId,
            userId,
            {
              currentPrice: product.currentPrice,
              lowestPrice: product.lowestPrice,
              averagePrice: product.averagePrice,
              priceDropPercent: product.priceDropPercent,
              // NOTE: Stock status not yet implemented in getWatchedProducts
              // Defaulting to 'in_stock' - future enhancement to fetch from product offers
              stockStatus: 'in_stock',
              alertStatus: product.alertStatus
            }
          );

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
          error: userError instanceof Error ? userError.message : String(userError)
        });
        // Continue with next user
      }
    }

    log.info('Notification processor completed', { processedCount, notifiedCount });

    return { processed: processedCount, notified: notifiedCount };
  } catch (error) {
    log.error('Notification processor failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Process notification jobs
 */
notificationQueue.process('check-watched-products', async (job) => {
  log.info(`Processing notification job ${job.id} at ${new Date().toISOString()}`);

  try {
    const result = await processWatchedProducts();
    log.info(`Notification job ${job.id} completed successfully`, result);

    return { success: true, ...result };
  } catch (error) {
    log.error(`Notification job ${job.id} failed`, {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});

// Handle job completion
notificationQueue.on("completed", (job, result) => {
  log.info(`Notification job ${job.id} completed`, result);
});

// Handle job failures
notificationQueue.on("failed", (job, err) => {
  log.error('Notification job failed', {
    jobId: job?.id,
    error: err.message
  });
});

// Handle job stalling
notificationQueue.on("stalled", (job) => {
  log.warn(`Notification job ${job.id} stalled`);
});

/**
 * Initialize the notification processor scheduler
 * Runs every 15 minutes with distributed locking
 */
export function initializeNotificationProcessor() {
  const cronSchedule = process.env.NOTIFICATION_PROCESSOR_CRON || "*/15 * * * *";

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
          await notificationQueue.add(
            'check-watched-products',
            {
              type: 'scheduled',
              timestamp: new Date().toISOString()
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000
              },
              removeOnComplete: true,
              removeOnFail: false
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
        error: error instanceof Error ? error.message : String(error)
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

  await notificationQueue.add(
    'check-watched-products',
    {
      type: 'manual',
      timestamp: new Date().toISOString()
    },
    {
      attempts: 1,
      priority: 1 // High priority
    }
  );
}

/**
 * Get queue statistics
 */
export async function getNotificationQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
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
  // Remove completed jobs older than 24 hours
  await notificationQueue.clean(24 * 60 * 60 * 1000, "completed");
  // Remove failed jobs older than 7 days
  await notificationQueue.clean(7 * 24 * 60 * 60 * 1000, "failed");

  log.info('Cleaned up old notification jobs');
}
