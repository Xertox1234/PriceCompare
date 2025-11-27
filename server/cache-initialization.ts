/**
 * Advanced Cache System Initialization
 *
 * Centralizes initialization of all caching components:
 * - Advanced cache service
 * - Popularity tracking
 * - Cache warming
 * - Cache maintenance jobs
 * - Cache invalidation
 */

import { storage } from './storage';
import { registerCacheRoutes } from './routes/cache-routes';
import {
  initializeCacheJobs,
  startCacheMaintenanceJobs,
} from './jobs/cache-maintenance-jobs';
import { cacheInvalidation } from './services/cache-invalidation';
import { logger } from './utils/logger';
import type { Express } from 'express';

/**
 * Initialize the advanced caching system
 */
export async function initializeAdvancedCache(app: Express): Promise<void> {
  try {
    logger.info('Initializing advanced caching system...');

    // 1. Register cache management routes
    registerCacheRoutes(app);
    logger.info('✓ Cache management routes registered');

    // 2. Initialize cache jobs with storage
    initializeCacheJobs(storage);
    logger.info('✓ Cache warming service initialized');

    // 3. Start cache maintenance jobs
    startCacheMaintenanceJobs(storage);
    logger.info('✓ Cache maintenance jobs started');

    // 4. Ensure cache invalidation service is initialized
    // (it's already initialized via singleton, but we log for visibility)
    logger.info('✓ Cache invalidation service initialized');

    logger.info('Advanced caching system initialized successfully');
    logger.info('Cache features:');
    logger.info('  - Multi-tier caching (L1: in-memory, L2: Redis)');
    logger.info('  - Intelligent TTL based on popularity');
    logger.info('  - Automatic cache warming every 5 minutes');
    logger.info('  - Smart invalidation with pub/sub');
    logger.info('  - Popularity tracking for hot/warm/cold products');
    logger.info('  - Cache metrics and monitoring endpoints');
  } catch (error) {
    logger.error('Error initializing advanced cache system:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Perform initial cache warming on startup
 */
export async function performInitialCacheWarming(): Promise<void> {
  try {
    logger.info('Performing initial cache warming...');

    // Import cache warming service
    const { triggerCacheWarming } = await import('./jobs/cache-maintenance-jobs');

    // Warm top 50 products on startup (smaller initial warming)
    const count = await triggerCacheWarming({
      topProductsCount: 50,
      includeAnalytics: false, // Skip analytics on startup for speed
      includeSearches: false,
    });

    logger.info(`Initial cache warming completed: ${count} products warmed`);
  } catch (error) {
    // Don't fail startup if initial warming fails
    logger.error('Error during initial cache warming:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
