/**
 * Analytics Caching Service
 *
 * Provides caching layer for expensive analytics computations:
 * - Price trends
 * - Volatility calculations
 * - Seasonal patterns
 * - Best time to buy predictions
 * - Retailer reliability scores
 *
 * Automatically caches results and provides cache-aside pattern.
 */

import { advancedCache, CacheTier, CachePrefix } from './advanced-cache';
import { logger } from '../utils/logger';

export interface AnalyticsParams {
  productId: number;
  days?: number;
  retailerId?: number;
  [key: string]: unknown;
}

export class AnalyticsCacheService {
  /**
   * Generic wrapper for analytics functions with automatic caching
   */
  async getCachedAnalytics<T>(
    type: string,
    params: AnalyticsParams,
    computeFn: () => Promise<T>
  ): Promise<T> {
    // Generate cache key from params
    const cacheKey = this.generateCacheKey(type, params);

    // Try to get from cache
    const cached = await advancedCache.get<T>(cacheKey, false);
    if (cached !== null) {
      return cached;
    }

    // Compute the result
    const result = await computeFn();

    // Cache the result
    await advancedCache.set(cacheKey, result, CacheTier.COMPUTED, false);

    return result;
  }

  /**
   * Invalidate all analytics cache for a product
   */
  async invalidateProductAnalytics(productId: number): Promise<void> {
    try {
      // Invalidate all analytics types for this product
      const patterns = [
        `${CachePrefix.ANALYTICS}:trend:${productId}:*`,
        `${CachePrefix.ANALYTICS}:volatility:${productId}:*`,
        `${CachePrefix.ANALYTICS}:seasonal:${productId}:*`,
        `${CachePrefix.ANALYTICS}:besttime:${productId}:*`,
        `${CachePrefix.ANALYTICS}:reliability:${productId}:*`,
        `${CachePrefix.ANALYTICS}:prediction:${productId}:*`,
        `${CachePrefix.ANALYTICS}:history:${productId}:*`,
      ];

      await Promise.all(
        patterns.map(pattern => advancedCache.invalidatePattern(pattern))
      );

      logger.info(`Invalidated analytics cache for product ${productId}`);
    } catch (error) {
      logger.error(`Error invalidating analytics cache for product ${productId}:`, error);
    }
  }

  /**
   * Invalidate specific analytics type for a product
   */
  async invalidateAnalyticsType(type: string, productId: number): Promise<void> {
    try {
      const pattern = `${CachePrefix.ANALYTICS}:${type}:${productId}:*`;
      await advancedCache.invalidatePattern(pattern);
      logger.info(`Invalidated ${type} analytics cache for product ${productId}`);
    } catch (error) {
      logger.error(`Error invalidating ${type} analytics cache:`, error);
    }
  }

  /**
   * Generate cache key from analytics type and parameters
   */
  private generateCacheKey(type: string, params: AnalyticsParams): string {
    const { productId, ...rest } = params;

    // Sort params for consistent key generation
    const sortedParams = Object.entries(rest)
      .filter(([_, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(':');

    const baseKey = `${CachePrefix.ANALYTICS}:${type}:${productId}`;
    return sortedParams ? `${baseKey}:${sortedParams}` : baseKey;
  }

  /**
   * Pre-warm analytics cache for a product
   */
  async warmProductAnalytics(
    productId: number,
    computeFunctions: {
      trend?: () => Promise<unknown>;
      volatility?: () => Promise<unknown>;
      seasonal?: () => Promise<unknown>;
      bestTime?: () => Promise<unknown>;
      predictions?: () => Promise<unknown>;
    }
  ): Promise<void> {
    const tasks: Promise<unknown>[] = [];

    if (computeFunctions.trend) {
      tasks.push(this.getCachedAnalytics('trend', { productId, days: 30 }, computeFunctions.trend));
    }

    if (computeFunctions.volatility) {
      tasks.push(this.getCachedAnalytics('volatility', { productId }, computeFunctions.volatility));
    }

    if (computeFunctions.seasonal) {
      tasks.push(this.getCachedAnalytics('seasonal', { productId }, computeFunctions.seasonal));
    }

    if (computeFunctions.bestTime) {
      tasks.push(this.getCachedAnalytics('besttime', { productId }, computeFunctions.bestTime));
    }

    if (computeFunctions.predictions) {
      tasks.push(this.getCachedAnalytics('prediction', { productId }, computeFunctions.predictions));
    }

    await Promise.all(tasks);
    logger.info(`Warmed analytics cache for product ${productId}`);
  }
}

// Export singleton instance
export const analyticsCacheService = new AnalyticsCacheService();
