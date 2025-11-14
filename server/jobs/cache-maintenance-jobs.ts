/**
 * Cache Maintenance Scheduled Jobs
 *
 * Handles periodic cache warming, cleanup, and optimization tasks:
 * - Cache warming for popular products
 * - Popularity data cleanup
 * - Cache statistics logging
 */

import cron, { type ScheduledTask } from 'node-cron';
import { advancedCache } from '../services/advanced-cache';
import { popularityTracker } from '../services/popularity-tracker';
import { CacheWarmingService } from '../services/cache-warming';
import { logger } from '../utils/logger';
import type { IStorage } from '../storage';

let warmingJob: ScheduledTask | null = null;
let cleanupJob: ScheduledTask | null = null;
let statsJob: ScheduledTask | null = null;
let cacheWarmingService: CacheWarmingService | null = null;

/**
 * Initialize cache maintenance jobs
 */
export function initializeCacheJobs(storage: IStorage): void {
  cacheWarmingService = new CacheWarmingService(storage);
}

/**
 * Start all cache maintenance scheduled jobs
 */
export function startCacheMaintenanceJobs(storage?: IStorage): void {
  logger.info('Starting cache maintenance scheduled jobs...');

  // Initialize cache warming service if not already done
  if (!cacheWarmingService && storage) {
    initializeCacheJobs(storage);
  }

  if (!cacheWarmingService) {
    logger.error('Cannot start cache jobs: CacheWarmingService not initialized');
    return;
  }

  // Cache warming - runs every 5 minutes
  warmingJob = cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('Starting scheduled cache warming...');
      const warmedCount = await cacheWarmingService!.warmTopProducts({
        topProductsCount: 100,
        includeAnalytics: true,
        includeSearches: true,
      });
      logger.info(`Cache warming completed: ${warmedCount} products warmed`);
    } catch (error) {
      logger.error('Error during cache warming:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

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
  logger.info('- Cache warming: Every 5 minutes');
  logger.info('- Popularity cleanup: Every hour');
  logger.info('- Statistics logging: Every 15 minutes');
}

/**
 * Stop all cache maintenance scheduled jobs
 */
export function stopCacheMaintenanceJobs(): void {
  logger.info('Stopping cache maintenance scheduled jobs...');

  if (warmingJob) {
    warmingJob.stop();
    warmingJob = null;
  }

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
  warmingJob: boolean;
  cleanupJob: boolean;
  statsJob: boolean;
  warmingServiceInitialized: boolean;
} {
  return {
    warmingJob: warmingJob !== null,
    cleanupJob: cleanupJob !== null,
    statsJob: statsJob !== null,
    warmingServiceInitialized: cacheWarmingService !== null,
  };
}

/**
 * Manually trigger cache warming (for testing)
 */
export async function triggerCacheWarming(options?: {
  topProductsCount?: number;
  includeAnalytics?: boolean;
  includeSearches?: boolean;
}): Promise<number> {
  if (!cacheWarmingService) {
    throw new Error('CacheWarmingService not initialized');
  }

  logger.info('Manually triggering cache warming...');
  const count = await cacheWarmingService.warmTopProducts(options || {});
  logger.info(`Manual cache warming completed: ${count} products warmed`);
  return count;
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

  const warmingStatus = cacheWarmingService?.getStatus() || {
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
