import cron, { type ScheduledTask } from 'node-cron';
import { generateDailySnapshots, cleanupOldPriceHistory } from '../services/price-history-service';

/**
 * Price History Scheduled Jobs
 * Contains all scheduled tasks related to price history tracking
 */

let snapshotJob: ScheduledTask | null = null;
let cleanupJob: ScheduledTask | null = null;

/**
 * Start all price history scheduled jobs
 */
export function startPriceHistoryJobs(): void {
  console.log('Starting price history scheduled jobs...');

  // Daily snapshot generation - runs at 1:00 AM every day
  snapshotJob = cron.schedule('0 1 * * *', async () => {
    try {
      console.log('Starting daily price snapshot generation...');
      const count = await generateDailySnapshots();
      console.log(`Daily price snapshots completed: ${count} snapshots generated`);
    } catch (error) {
      console.error('Error in daily snapshot generation:', error);
    }
  }, {
    timezone: 'America/New_York' // Adjust to your timezone
  });

  // Weekly cleanup - runs every Sunday at 2:00 AM
  cleanupJob = cron.schedule('0 2 * * 0', async () => {
    try {
      console.log('Starting price history cleanup...');
      const deletedCount = await cleanupOldPriceHistory(90); // Keep 90 days
      console.log(`Price history cleanup completed: ${deletedCount} records removed`);
    } catch (error) {
      console.error('Error in price history cleanup:', error);
    }
  }, {
    timezone: 'America/New_York' // Adjust to your timezone
  });

  console.log('Price history jobs scheduled:');
  console.log('- Daily snapshots: 1:00 AM every day');
  console.log('- Weekly cleanup: 2:00 AM every Sunday');
}

/**
 * Stop all price history scheduled jobs
 */
export function stopPriceHistoryJobs(): void {
  console.log('Stopping price history scheduled jobs...');

  if (snapshotJob) {
    snapshotJob.stop();
    snapshotJob = null;
  }

  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
  }

  console.log('Price history jobs stopped');
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
  console.log('Manually triggering snapshot generation...');
  const count = await generateDailySnapshots();
  console.log(`Manual snapshot generation completed: ${count} snapshots`);
  return count;
}

/**
 * Manually trigger cleanup (for testing)
 */
export async function triggerCleanup(daysToKeep: number = 90): Promise<number> {
  console.log(`Manually triggering cleanup (keeping ${daysToKeep} days)...`);
  const deletedCount = await cleanupOldPriceHistory(daysToKeep);
  console.log(`Manual cleanup completed: ${deletedCount} records removed`);
  return deletedCount;
}
