/**
 * Cache Management Routes
 *
 * Admin routes for monitoring and managing the advanced caching system:
 * - Cache statistics and metrics
 * - Manual cache warming
 * - Cache invalidation
 * - Popularity tracking data
 */

import { Express } from 'express';
import { advancedCache } from '../services/advanced-cache';
import { popularityTracker } from '../services/popularity-tracker';
import { cacheInvalidation } from '../services/cache-invalidation';
import {
  getCacheStatistics,
  triggerCacheWarming,
  triggerPopularityCleanup,
  resetCacheStats,
  clearAllCaches,
} from '../jobs/cache-maintenance-jobs';
import { logger } from '../utils/logger';
import { parseIntSafe } from '../utils/validation-helpers';
import { withAdmin } from './helpers';
import { createErrorResponse } from '../utils/error-sanitizer';
import { z } from 'zod';

// Validation schema for cache warming options
const cacheWarmingSchema = z.object({
  topProductsCount: z.number().int().positive().max(10000, 'Top products count must be at most 10000').optional().default(100),
  includeAnalytics: z.boolean().optional().default(true),
  includeSearches: z.boolean().optional().default(true),
});

// Validation schema for clearing all caches
const clearCachesSchema = z.object({
  confirm: z.literal(true).refine(val => val === true, {
    message: 'Confirmation required: set "confirm": true',
  }),
});

// Validation schema for window query parameter
const windowSchema = z.enum(['HOURLY', 'DAILY', 'WEEKLY']).optional().default('HOURLY');

/**
 * Register cache management routes
 */
export function registerCacheRoutes(app: Express): void {
  /**
   * Get cache statistics and metrics
   * GET /api/admin/cache/stats
   */
  app.get('/api/admin/cache/stats', withAdmin(async (req, res) => {
    try {
      const stats = await getCacheStatistics();
      res.json(stats);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetCacheStats');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * Get top products by popularity
   * GET /api/admin/cache/popularity/products
   */
  app.get('/api/admin/cache/popularity/products', withAdmin(async (req, res) => {
    try {
      const limit = req.query.limit
        ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 1000 })
        : 100;
      const window = windowSchema.parse(req.query.window);

      const topProducts = await popularityTracker.getTopProducts(limit, window);

      res.json({
        window,
        limit,
        count: topProducts.length,
        products: topProducts,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetTopProducts');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * Get top search queries
   * GET /api/admin/cache/popularity/searches
   */
  app.get('/api/admin/cache/popularity/searches', withAdmin(async (req, res) => {
    try {
      const limit = req.query.limit
        ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 1000 })
        : 100;

      const topSearches = await popularityTracker.getTopSearchQueries(limit);

      res.json({
        limit,
        count: topSearches.length,
        queries: topSearches,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetTopSearches');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * Get popularity tier for a product
   * GET /api/admin/cache/popularity/product/:id
   */
  app.get('/api/admin/cache/popularity/product/:id', withAdmin(async (req, res) => {
    try {
      const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

      const tier = await popularityTracker.getProductTier(productId);
      const hourlyViews = await popularityTracker.getProductViewCount(productId, 'HOURLY');
      const dailyViews = await popularityTracker.getProductViewCount(productId, 'DAILY');
      const weeklyViews = await popularityTracker.getProductViewCount(productId, 'WEEKLY');

      res.json({
        productId,
        tier,
        views: {
          hourly: hourlyViews,
          daily: dailyViews,
          weekly: weeklyViews,
        },
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetProductPopularity');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * Trigger manual cache warming
   * POST /api/admin/cache/warm
   */
  app.post('/api/admin/cache/warm', withAdmin(async (req, res) => {
    try {
      const validatedOptions = cacheWarmingSchema.parse(req.body);

      const count = await triggerCacheWarming(validatedOptions);

      res.json({
        success: true,
        warmedProducts: count,
        options: validatedOptions,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'TriggerCacheWarming');
      res.status(errorResponse.status).json({ error: errorResponse.error, details: errorResponse.details });
    }
  }));

  /**
   * Invalidate cache for a specific product
   * POST /api/admin/cache/invalidate/product/:id
   */
  app.post('/api/admin/cache/invalidate/product/:id', withAdmin(async (req, res) => {
    try {
      const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

      await cacheInvalidation.onProductUpdate(productId);

      res.json({
        success: true,
        productId,
        message: 'Product cache invalidated',
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'InvalidateProductCache');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * Invalidate all search caches
   * POST /api/admin/cache/invalidate/search
   */
  app.post('/api/admin/cache/invalidate/search', withAdmin(async (req, res) => {
    try {
      await cacheInvalidation.invalidateSearchCaches();

      res.json({
        success: true,
        message: 'Search caches invalidated',
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'InvalidateSearchCaches');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * Trigger popularity cleanup
   * POST /api/admin/cache/cleanup/popularity
   */
  app.post('/api/admin/cache/cleanup/popularity', withAdmin(async (req, res) => {
    try {
      await triggerPopularityCleanup();

      res.json({
        success: true,
        message: 'Popularity data cleaned up',
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'TriggerPopularityCleanup');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * Reset cache statistics
   * POST /api/admin/cache/stats/reset
   */
  app.post('/api/admin/cache/stats/reset', withAdmin(async (req, res) => {
    try {
      resetCacheStats();

      res.json({
        success: true,
        message: 'Cache statistics reset',
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'ResetCacheStats');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * Clear all caches (use with caution!)
   * POST /api/admin/cache/clear
   */
  app.post('/api/admin/cache/clear', withAdmin(async (req, res) => {
    try {
      // Validate confirmation with Zod
      clearCachesSchema.parse(req.body);

      await clearAllCaches();

      res.json({
        success: true,
        message: 'All caches cleared',
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'ClearAllCaches');
      res.status(errorResponse.status).json({ error: errorResponse.error, details: errorResponse.details });
    }
  }));

  /**
   * Get cache health status
   * GET /api/admin/cache/health
   */
  app.get('/api/admin/cache/health', withAdmin(async (req, res) => {
    try {
      const stats = await getCacheStatistics();

      // Calculate health metrics
      const l1HitRate = parseFloat(stats.cache.l1.hitRate);
      const l2HitRate = parseFloat(stats.cache.l2.hitRate);
      const errorRate = stats.cache.overall.totalRequests > 0
        ? (stats.cache.overall.errors / stats.cache.overall.totalRequests * 100).toFixed(2)
        : '0.00';

      const health = {
        status: 'healthy',
        checks: {
          l1Cache: {
            status: l1HitRate >= 20 ? 'healthy' : 'warning',
            hitRate: `${l1HitRate}%`,
            threshold: '20%',
          },
          l2Cache: {
            status: l2HitRate >= 50 ? 'healthy' : 'warning',
            hitRate: `${l2HitRate}%`,
            threshold: '50%',
          },
          errors: {
            status: parseFloat(errorRate) < 1 ? 'healthy' : 'warning',
            errorRate: `${errorRate}%`,
            threshold: '1%',
          },
          warming: {
            status: stats.warming.isWarming ? 'active' : 'idle',
            lastWarming: stats.warming.lastWarmingAgo
              ? `${Math.floor(stats.warming.lastWarmingAgo / 1000 / 60)} minutes ago`
              : 'never',
          },
        },
      };

      // Overall status
      const allHealthy = Object.values(health.checks).every(
        check => check.status === 'healthy' || check.status === 'idle' || check.status === 'active'
      );
      health.status = allHealthy ? 'healthy' : 'degraded';

      res.json(health);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetCacheHealth');
      res.status(500).json({
        status: 'error',
        error: errorResponse.error,
      });
    }
  }));

  logger.info('Cache management routes registered');
}
