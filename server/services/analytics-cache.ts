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
   * Cache price trend analysis
   */
  async cachePriceTrend<T>(productId: number, days: number, computeFn: () => Promise<T>): Promise<T> {
    return this.getCachedAnalytics(
      'trend',
      { productId, days },
      computeFn
    );
  }

  /**
   * Cache volatility analysis
   */
  async cacheVolatility<T>(productId: number, computeFn: () => Promise<T>): Promise<T> {
    return this.getCachedAnalytics(
      'volatility',
      { productId },
      computeFn
    );
  }

  /**
   * Cache seasonal patterns analysis
   */
  async cacheSeasonalPatterns<T>(productId: number, computeFn: () => Promise<T>): Promise<T> {
    return this.getCachedAnalytics(
      'seasonal',
      { productId },
      computeFn
    );
  }

  /**
   * Cache best time to buy prediction
   */
  async cacheBestTimeToBuy<T>(productId: number, computeFn: () => Promise<T>): Promise<T> {
    return this.getCachedAnalytics(
      'besttime',
      { productId },
      computeFn
    );
  }

  /**
   * Cache retailer reliability score
   */
  async cacheRetailerReliability<T>(
    productId: number,
    retailerId: number,
    computeFn: () => Promise<T>
  ): Promise<T> {
    return this.getCachedAnalytics(
      'reliability',
      { productId, retailerId },
      computeFn
    );
  }

  /**
   * Cache price predictions
   */
  async cachePricePredictions<T>(productId: number, computeFn: () => Promise<T>): Promise<T> {
    return this.getCachedAnalytics(
      'prediction',
      { productId },
      computeFn
    );
  }

  /**
   * Cache price history
   */
  async cachePriceHistory<T>(
    productId: number,
    days: number,
    retailerId: number | undefined,
    computeFn: () => Promise<T>
  ): Promise<T> {
    const params: AnalyticsParams = { productId, days };
    if (retailerId !== undefined) {
      params.retailerId = retailerId;
    }

    return this.getCachedAnalytics(
      'history',
      params,
      computeFn
    );
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
      tasks.push(this.cachePriceTrend(productId, 30, computeFunctions.trend));
    }

    if (computeFunctions.volatility) {
      tasks.push(this.cacheVolatility(productId, computeFunctions.volatility));
    }

    if (computeFunctions.seasonal) {
      tasks.push(this.cacheSeasonalPatterns(productId, computeFunctions.seasonal));
    }

    if (computeFunctions.bestTime) {
      tasks.push(this.cacheBestTimeToBuy(productId, computeFunctions.bestTime));
    }

    if (computeFunctions.predictions) {
      tasks.push(this.cachePricePredictions(productId, computeFunctions.predictions));
    }

    await Promise.all(tasks);
    logger.info(`Warmed analytics cache for product ${productId}`);
  }
}

// Export singleton instance
export const analyticsCacheService = new AnalyticsCacheService();

/**
 * Decorator function for automatic analytics caching
 *
 * Usage:
 * @cacheAnalytics('trend', 'productId', 'days')
 * async function calculatePriceTrend(productId: number, days: number) {
 *   // expensive calculation
 * }
 */
export function cacheAnalytics(type: string, ...paramNames: string[]) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // Build params object from argument names
      const params: AnalyticsParams = {} as AnalyticsParams;
      paramNames.forEach((name, index) => {
        params[name] = args[index];
      });

      // Use analytics cache service
      return analyticsCacheService.getCachedAnalytics(
        type,
        params,
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}
