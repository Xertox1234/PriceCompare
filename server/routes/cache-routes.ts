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

/**
 * Register cache management routes
 */
export function registerCacheRoutes(app: Express): void {
  /**
   * Get cache statistics and metrics
   * GET /api/admin/cache/stats
   */
  app.get('/api/admin/cache/stats', async (req, res) => {
    try {
      const stats = await getCacheStatistics();
      res.json(stats);
    } catch (error) {
      logger.error('Error getting cache statistics:', error);
      res.status(500).json({
        error: 'Failed to retrieve cache statistics',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Get top products by popularity
   * GET /api/admin/cache/popularity/products
   */
  app.get('/api/admin/cache/popularity/products', async (req, res) => {
    try {
      const limit = req.query.limit
        ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 1000 })
        : 100;
      const window = (req.query.window as 'HOURLY' | 'DAILY' | 'WEEKLY') || 'HOURLY';

      const topProducts = await popularityTracker.getTopProducts(limit, window);

      res.json({
        window,
        limit,
        count: topProducts.length,
        products: topProducts,
      });
    } catch (error) {
      logger.error('Error getting top products:', error);
      res.status(500).json({
        error: 'Failed to retrieve top products',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Get top search queries
   * GET /api/admin/cache/popularity/searches
   */
  app.get('/api/admin/cache/popularity/searches', async (req, res) => {
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
    } catch (error) {
      logger.error('Error getting top searches:', error);
      res.status(500).json({
        error: 'Failed to retrieve top searches',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Get popularity tier for a product
   * GET /api/admin/cache/popularity/product/:id
   */
  app.get('/api/admin/cache/popularity/product/:id', async (req, res) => {
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
    } catch (error) {
      logger.error('Error getting product popularity:', error);
      res.status(500).json({
        error: 'Failed to retrieve product popularity',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Trigger manual cache warming
   * POST /api/admin/cache/warm
   */
  app.post('/api/admin/cache/warm', async (req, res) => {
    try {
      const options = {
        topProductsCount: req.body.topProductsCount || 100,
        includeAnalytics: req.body.includeAnalytics !== false,
        includeSearches: req.body.includeSearches !== false,
      };

      const count = await triggerCacheWarming(options);

      res.json({
        success: true,
        warmedProducts: count,
        options,
      });
    } catch (error) {
      logger.error('Error triggering cache warming:', error);
      res.status(500).json({
        error: 'Failed to trigger cache warming',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Invalidate cache for a specific product
   * POST /api/admin/cache/invalidate/product/:id
   */
  app.post('/api/admin/cache/invalidate/product/:id', async (req, res) => {
    try {
      const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

      await cacheInvalidation.onProductUpdate(productId);

      res.json({
        success: true,
        productId,
        message: 'Product cache invalidated',
      });
    } catch (error) {
      logger.error('Error invalidating product cache:', error);
      res.status(500).json({
        error: 'Failed to invalidate product cache',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Invalidate all search caches
   * POST /api/admin/cache/invalidate/search
   */
  app.post('/api/admin/cache/invalidate/search', async (req, res) => {
    try {
      await cacheInvalidation.invalidateSearchCaches();

      res.json({
        success: true,
        message: 'Search caches invalidated',
      });
    } catch (error) {
      logger.error('Error invalidating search caches:', error);
      res.status(500).json({
        error: 'Failed to invalidate search caches',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Trigger popularity cleanup
   * POST /api/admin/cache/cleanup/popularity
   */
  app.post('/api/admin/cache/cleanup/popularity', async (req, res) => {
    try {
      await triggerPopularityCleanup();

      res.json({
        success: true,
        message: 'Popularity data cleaned up',
      });
    } catch (error) {
      logger.error('Error cleaning up popularity data:', error);
      res.status(500).json({
        error: 'Failed to clean up popularity data',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Reset cache statistics
   * POST /api/admin/cache/stats/reset
   */
  app.post('/api/admin/cache/stats/reset', async (req, res) => {
    try {
      resetCacheStats();

      res.json({
        success: true,
        message: 'Cache statistics reset',
      });
    } catch (error) {
      logger.error('Error resetting cache statistics:', error);
      res.status(500).json({
        error: 'Failed to reset cache statistics',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Clear all caches (use with caution!)
   * POST /api/admin/cache/clear
   */
  app.post('/api/admin/cache/clear', async (req, res) => {
    try {
      // Require confirmation
      if (req.body.confirm !== true) {
        return res.status(400).json({
          error: 'Confirmation required',
          message: 'Set "confirm": true in request body to clear all caches',
        });
      }

      await clearAllCaches();

      res.json({
        success: true,
        message: 'All caches cleared',
      });
    } catch (error) {
      logger.error('Error clearing caches:', error);
      res.status(500).json({
        error: 'Failed to clear caches',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Get cache health status
   * GET /api/admin/cache/health
   */
  app.get('/api/admin/cache/health', async (req, res) => {
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
    } catch (error) {
      logger.error('Error getting cache health:', error);
      res.status(500).json({
        status: 'error',
        error: 'Failed to retrieve cache health',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  logger.info('Cache management routes registered');
}
