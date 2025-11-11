import Queue from "bull";
import cron from "node-cron";
import { priceSnapshotService } from "../services/price-snapshot-service";

// Initialize Redis connection for Bull
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    };

// Create Bull queue for price snapshots
export const priceSnapshotQueue = new Queue("price-snapshots", redisConfig);

// Process price snapshot jobs
priceSnapshotQueue.process(async (job) => {
  console.log(`[PriceSnapshotQueue] Processing job ${job.id} at ${new Date().toISOString()}`);

  try {
    const count = await priceSnapshotService.snapshotAllPrices();
    console.log(`[PriceSnapshotQueue] Successfully snapshotted ${count} prices`);

    return { success: true, count };
  } catch (error) {
    console.error("[PriceSnapshotQueue] Error processing snapshot job:", error);
    throw error;
  }
});

// Handle job completion
priceSnapshotQueue.on("completed", (job, result) => {
  console.log(`[PriceSnapshotQueue] Job ${job.id} completed successfully:`, result);
});

// Handle job failures
priceSnapshotQueue.on("failed", (job, err) => {
  console.error(`[PriceSnapshotQueue] Job ${job?.id} failed:`, err.message);
});

// Handle job stalling
priceSnapshotQueue.on("stalled", (job) => {
  console.warn(`[PriceSnapshotQueue] Job ${job.id} stalled`);
});

/**
 * Initialize the price snapshot scheduler
 * Runs twice daily: at 8 AM and 8 PM
 */
export function initializePriceSnapshotScheduler() {
  // Schedule price snapshots twice a day
  // Cron format: minute hour * * *
  // "0 8,20 * * *" = At 8:00 AM and 8:00 PM every day

  const cronSchedule = process.env.PRICE_SNAPSHOT_CRON || "0 8,20 * * *";

  console.log(`[PriceSnapshotScheduler] Initializing with schedule: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    console.log(`[PriceSnapshotScheduler] Triggering scheduled price snapshot at ${new Date().toISOString()}`);

    try {
      await priceSnapshotQueue.add(
        {
          type: "scheduled",
          timestamp: new Date().toISOString(),
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    } catch (error) {
      console.error("[PriceSnapshotScheduler] Error adding snapshot job to queue:", error);
    }
  });

  console.log("[PriceSnapshotScheduler] Scheduler initialized successfully");
}

/**
 * Manually trigger a price snapshot
 * Useful for testing or immediate snapshots
 */
export async function triggerManualSnapshot(): Promise<void> {
  console.log("[PriceSnapshotQueue] Manually triggering price snapshot");

  await priceSnapshotQueue.add(
    {
      type: "manual",
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
  await priceSnapshotQueue.clean(24 * 60 * 60 * 1000, "completed");
  // Remove failed jobs older than 7 days
  await priceSnapshotQueue.clean(7 * 24 * 60 * 60 * 1000, "failed");

  console.log("[PriceSnapshotQueue] Cleaned up old jobs");
}
