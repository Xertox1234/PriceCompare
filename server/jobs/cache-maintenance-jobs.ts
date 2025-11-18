/**
 * Cache Maintenance Scheduled Jobs
 *
 * Handles periodic cache cleanup and optimization tasks:
 * - Popularity data cleanup
 * - Cache statistics logging
 */

import cron, { type ScheduledTask } from 'node-cron';
import { advancedCache } from '../services/advanced-cache';
import { popularityTracker } from '../services/popularity-tracker';
import { logger } from '../utils/logger';
import type { IStorage } from '../storage';

let cleanupJob: ScheduledTask | null = null;
let statsJob: ScheduledTask | null = null;

/**
 * Initialize cache maintenance jobs
 */
export function initializeCacheJobs(_storage: IStorage): void {
  // No initialization needed currently
}

/**
 * Start all cache maintenance scheduled jobs
 */
export function startCacheMaintenanceJobs(_storage?: IStorage): void {
  logger.info('Starting cache maintenance scheduled jobs...');

  // Popularity cleanup - runs every hour
  cleanupJob = cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Starting popularity data cleanup...');
      await popularityTracker.cleanup();
      logger.info('Popularity cleanup completed');
    } catch (error) {
      logger.error('Error during popularity cleanup:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Cache statistics logging - runs every 15 minutes
  statsJob = cron.schedule('*/15 * * * *', async () => {
    try {
      const cacheStats = advancedCache.getStats();
      const popularityStats = await popularityTracker.getStats();

      logger.info('Cache Statistics:', {
        cache: cacheStats,
        popularity: popularityStats,
      });
    } catch (error) {
      logger.error('Error getting cache statistics:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  logger.info('Cache maintenance jobs scheduled:');
  logger.info('- Popularity cleanup: Every hour');
  logger.info('- Statistics logging: Every 15 minutes');
}

/**
 * Stop all cache maintenance scheduled jobs
 */
export function stopCacheMaintenanceJobs(): void {
  logger.info('Stopping cache maintenance scheduled jobs...');

  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
  }

  if (statsJob) {
    statsJob.stop();
    statsJob = null;
  }

  logger.info('Cache maintenance jobs stopped');
}

/**
 * Get the status of scheduled jobs
 */
export function getCacheJobsStatus(): {
  cleanupJob: boolean;
  statsJob: boolean;
} {
  return {
    cleanupJob: cleanupJob !== null,
    statsJob: statsJob !== null,
  };
}

/**
 * Manually trigger cache warming (for testing)
 * @deprecated Cache warming service has been removed as dead code
 */
export async function triggerCacheWarming(_options?: {
  topProductsCount?: number;
  includeAnalytics?: boolean;
  includeSearches?: boolean;
}): Promise<number> {
  logger.warn('Cache warming service has been removed - returning 0');
  return 0;
}

/**
 * Manually trigger popularity cleanup (for testing)
 */
export async function triggerPopularityCleanup(): Promise<void> {
  logger.info('Manually triggering popularity cleanup...');
  await popularityTracker.cleanup();
  logger.info('Manual popularity cleanup completed');
}

/**
 * Get cache statistics on demand
 */
export async function getCacheStatistics() {
  const cacheStats = advancedCache.getStats();
  const popularityStats = await popularityTracker.getStats();

  const warmingStatus = {
    isWarming: false,
    lastWarmingTime: 0,
    lastWarmingAgo: null,
    warmingInterval: 0,
  };

  return {
    cache: cacheStats,
    popularity: popularityStats,
    warming: warmingStatus,
    jobs: getCacheJobsStatus(),
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  advancedCache.resetStats();
  logger.info('Cache statistics reset');
}

/**
 * Clear all caches (use with caution)
 */
export async function clearAllCaches(): Promise<void> {
  logger.warn('Clearing all caches...');
  await advancedCache.clear();
  logger.info('All caches cleared');
}
