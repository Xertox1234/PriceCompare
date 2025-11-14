/**
 * Cache Warming Service
 *
 * Pre-populates cache with frequently accessed data to ensure
 * hot data is always available and minimize cache misses.
 *
 * Strategies:
 * - Warm top N products based on popularity
 * - Warm products with active price alerts
 * - Warm common search queries
 * - Schedule periodic warming for hot data
 */

import { advancedCache, CacheTier, CachePrefix } from './advanced-cache';
import { popularityTracker } from './popularity-tracker';
import { logger } from '../utils/logger';
import type { IStorage } from '../storage';

interface CacheWarmingOptions {
  topProductsCount?: number;
  includeAnalytics?: boolean;
  includeSearches?: boolean;
}

export class CacheWarmingService {
  private storage: IStorage;
  private isWarming: boolean = false;
  private lastWarmingTime: number = 0;
  private warmingIntervalMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Warm cache with top products and their analytics
   */
  async warmTopProducts(options: CacheWarmingOptions = {}): Promise<number> {
    const {
      topProductsCount = 100,
      includeAnalytics = true,
      includeSearches = false,
    } = options;

    if (this.isWarming) {
      logger.info('Cache warming already in progress, skipping...');
      return 0;
    }

    this.isWarming = true;
    let warmedCount = 0;

    try {
      logger.info(`Starting cache warming for top ${topProductsCount} products...`);

      // Get top products from popularity tracker
      const topProductIds = await popularityTracker.getTopProducts(topProductsCount, 'HOURLY');

      if (topProductIds.length === 0) {
        logger.info('No popular products to warm');
        this.isWarming = false;
        return 0;
      }

      // Warm products in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < topProductIds.length; i += batchSize) {
        const batch = topProductIds.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (productId) => {
            try {
              // Warm product detail
              await this.warmProductDetail(productId);

              // Warm product offers
              await this.warmProductOffers(productId);

              // Warm analytics if enabled
              if (includeAnalytics) {
                await this.warmProductAnalytics(productId);
              }

              warmedCount++;
            } catch (error) {
              logger.error(`Error warming product ${productId}:`, error);
            }
          })
        );

        // Small delay between batches to avoid overload
        if (i + batchSize < topProductIds.length) {
          await this.sleep(100);
        }
      }

      // Warm common searches if enabled
      if (includeSearches) {
        await this.warmCommonSearches();
      }

      this.lastWarmingTime = Date.now();
      logger.info(`Cache warming completed. Warmed ${warmedCount} products.`);

      return warmedCount;
    } catch (error) {
      logger.error('Error during cache warming:', error);
      return warmedCount;
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm a single product's detail page
   */
  async warmProductDetail(productId: number): Promise<void> {
    try {
      // Check if already cached
      const cacheKey = `${CachePrefix.PRODUCT_DETAIL}:${productId}`;
      const cached = await advancedCache.get(cacheKey, false);

      if (cached) {
        return; // Already cached
      }

      // Fetch from database
      const product = await this.storage.getProductById(productId);

      if (product) {
        // Determine tier based on popularity
        const tier = await popularityTracker.getProductTier(productId);
        const cacheTier = tier === 'hot' ? CacheTier.HOT :
                         tier === 'warm' ? CacheTier.WARM : CacheTier.COLD;

        // Cache the result
        await advancedCache.set(cacheKey, product, cacheTier, tier === 'hot');
      }
    } catch (error) {
      logger.error(`Error warming product detail ${productId}:`, error);
    }
  }

  /**
   * Warm a product's offers
   */
  async warmProductOffers(productId: number): Promise<void> {
    try {
      const cacheKey = `${CachePrefix.PRODUCT_OFFERS}:${productId}`;
      const cached = await advancedCache.get(cacheKey, false);

      if (cached) {
        return; // Already cached
      }

      // Fetch from database
      const offers = await this.storage.getProductOffers(productId);

      if (offers && offers.length > 0) {
        await advancedCache.set(cacheKey, offers, CacheTier.WARM, false);
      }
    } catch (error) {
      logger.error(`Error warming product offers ${productId}:`, error);
    }
  }

  /**
   * Warm product analytics data
   */
  async warmProductAnalytics(productId: number): Promise<void> {
    try {
      // Warm price history (most commonly accessed)
      const historyKey = `${CachePrefix.PRICE_HISTORY}:${productId}:30`;
      const cachedHistory = await advancedCache.get(historyKey, false);

      if (!cachedHistory) {
        const history = await this.storage.getPriceHistory(productId, 30);
        if (history && history.length > 0) {
          await advancedCache.set(historyKey, history, CacheTier.COMPUTED, false);
        }
      }

      // Note: Other analytics (trend, volatility, etc.) are computed on-demand
      // and cached when first accessed. Pre-computing them would be too expensive.
    } catch (error) {
      logger.error(`Error warming product analytics ${productId}:`, error);
    }
  }

  /**
   * Warm cache for common search queries
   */
  async warmCommonSearches(): Promise<void> {
    try {
      const topQueries = await popularityTracker.getTopSearchQueries(20);

      for (const { query } of topQueries) {
        try {
          // Check if already cached
          const cacheKey = `${CachePrefix.PRODUCT_SEARCH}:${query}:{}`;
          const cached = await advancedCache.get(cacheKey, false);

          if (!cached) {
            // Fetch search results
            const results = await this.storage.searchProducts({
              query,
              page: 1,
              limit: 20,
            });

            if (results) {
              await advancedCache.set(cacheKey, results, CacheTier.WARM, false);
            }
          }
        } catch (error) {
          logger.error(`Error warming search query "${query}":`, error);
        }
      }

      logger.info(`Warmed ${topQueries.length} common search queries`);
    } catch (error) {
      logger.error('Error warming common searches:', error);
    }
  }

  /**
   * Warm cache for products with active price alerts
   */
  async warmAlertedProducts(): Promise<number> {
    try {
      // Get products with active price alerts
      // Note: This would need to be implemented in storage layer
      // For now, we'll skip this as it requires schema changes

      logger.info('Warming alerted products (not yet implemented)');
      return 0;
    } catch (error) {
      logger.error('Error warming alerted products:', error);
      return 0;
    }
  }

  /**
   * Warm cache for static data (retailers, categories)
   */
  async warmStaticData(): Promise<void> {
    try {
      // Warm retailers list
      const retailersKey = `${CachePrefix.RETAILER}:list`;
      const cachedRetailers = await advancedCache.get(retailersKey, false);

      if (!cachedRetailers) {
        const retailers = await this.storage.getRetailers();
        if (retailers && retailers.length > 0) {
          await advancedCache.set(retailersKey, retailers, CacheTier.STATIC, true);
        }
      }

      logger.info('Static data warming completed');
    } catch (error) {
      logger.error('Error warming static data:', error);
    }
  }

  /**
   * Start automatic cache warming on an interval
   */
  startAutoWarming(intervalMs?: number): void {
    if (intervalMs) {
      this.warmingIntervalMs = intervalMs;
    }

    logger.info(`Starting automatic cache warming every ${this.warmingIntervalMs / 1000 / 60} minutes`);

    // Initial warming
    this.warmTopProducts({ includeAnalytics: true }).catch(error => {
      logger.error('Error during initial cache warming:', error);
    });

    // Periodic warming
    setInterval(() => {
      this.warmTopProducts({ includeAnalytics: true }).catch(error => {
        logger.error('Error during periodic cache warming:', error);
      });
    }, this.warmingIntervalMs);
  }

  /**
   * Get warming status
   */
  getStatus() {
    return {
      isWarming: this.isWarming,
      lastWarmingTime: this.lastWarmingTime,
      lastWarmingAgo: this.lastWarmingTime > 0
        ? Date.now() - this.lastWarmingTime
        : null,
      warmingInterval: this.warmingIntervalMs,
    };
  }

  /**
   * Helper to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create cache warming service
 */
export function createCacheWarmingService(storage: IStorage): CacheWarmingService {
  return new CacheWarmingService(storage);
}
