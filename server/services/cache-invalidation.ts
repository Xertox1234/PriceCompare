/**
 * Smart Cache Invalidation Service
 *
 * Handles intelligent cache invalidation when data changes:
 * - Price updates trigger related cache invalidations
 * - Tag-based invalidation for related data
 * - Event-driven invalidation via Redis pub/sub
 * - Batch invalidation for efficiency
 */

import { advancedCache, CachePrefix } from './advanced-cache';
import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

/**
 * Extract error message for logging
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Invalidate all analytics cache for a product
 * (Inlined from analytics-cache.ts to reduce coupling)
 */
async function invalidateProductAnalytics(productId: number): Promise<void> {
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

    await Promise.all(patterns.map((pattern) => advancedCache.invalidatePattern(pattern)));

    logger.info(`Invalidated analytics cache for product ${productId}`);
  } catch (error: unknown) {
    logger.error(
      `Error invalidating analytics cache for product ${productId}:`,
      getErrorMessage(error)
    );
  }
}

/**
 * Invalidation event types
 */
export enum InvalidationEvent {
  PRICE_UPDATE = 'price_update',
  PRODUCT_UPDATE = 'product_update',
  PRODUCT_DELETE = 'product_delete',
  OFFER_UPDATE = 'offer_update',
  RETAILER_UPDATE = 'retailer_update',
  SEARCH_INDEX_UPDATE = 'search_index_update',
}

/**
 * Invalidation event payload
 */
export interface InvalidationPayload {
  event: InvalidationEvent;
  productId?: number;
  productIds?: number[];
  retailerId?: number;
  timestamp: number;
}

/**
 * Smart cache invalidation service
 */
export class CacheInvalidationService {
  private readonly INVALIDATION_CHANNEL = 'cache:invalidation:events';

  constructor() {
    // Subscribe to invalidation events
    this.subscribeToInvalidationEvents();
  }

  /**
   * Invalidate cache when product price is updated
   */
  async onPriceUpdate(productId: number): Promise<void> {
    try {
      logger.info(`Invalidating cache for product ${productId} due to price update`);

      // Invalidate product-specific caches
      await Promise.all([
        // Product detail cache
        advancedCache.invalidatePattern(`${CachePrefix.PRODUCT_DETAIL}:${productId}*`),

        // Product offers cache
        advancedCache.invalidatePattern(`${CachePrefix.PRODUCT_OFFERS}:${productId}*`),

        // Price history cache
        advancedCache.invalidatePattern(`${CachePrefix.PRICE_HISTORY}:${productId}*`),

        // Analytics cache (trends, volatility, etc.)
        invalidateProductAnalytics(productId),

        // Search results that might include this product
        // Note: We invalidate all search results as they might include this product
        advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH),
      ]);

      // Publish invalidation event
      await this.publishInvalidationEvent({
        event: InvalidationEvent.PRICE_UPDATE,
        productId,
        timestamp: Date.now(),
      });

      logger.info(`Cache invalidation completed for product ${productId}`);
    } catch (error) {
      logger.error(`Error invalidating cache for product ${productId}:`, {
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Invalidate cache when product details are updated
   */
  async onProductUpdate(productId: number): Promise<void> {
    try {
      logger.info(`Invalidating cache for product ${productId} due to product update`);

      await Promise.all([
        advancedCache.invalidatePattern(`${CachePrefix.PRODUCT_DETAIL}:${productId}*`),
        advancedCache.invalidatePattern(`${CachePrefix.PRODUCT_OFFERS}:${productId}*`),
        advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH),
      ]);

      await this.publishInvalidationEvent({
        event: InvalidationEvent.PRODUCT_UPDATE,
        productId,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Error invalidating cache for product ${productId}:`, {
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Invalidate cache when product is deleted
   */
  async onProductDelete(productId: number): Promise<void> {
    try {
      logger.info(`Invalidating cache for deleted product ${productId}`);

      await Promise.all([
        advancedCache.invalidatePattern(`${CachePrefix.PRODUCT}:${productId}*`),
        advancedCache.invalidatePattern(`${CachePrefix.PRODUCT_DETAIL}:${productId}*`),
        advancedCache.invalidatePattern(`${CachePrefix.PRODUCT_OFFERS}:${productId}*`),
        advancedCache.invalidatePattern(`${CachePrefix.PRICE_HISTORY}:${productId}*`),
        advancedCache.invalidatePattern(`${CachePrefix.ANALYTICS}:*:${productId}*`),
        advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH),
      ]);

      await this.publishInvalidationEvent({
        event: InvalidationEvent.PRODUCT_DELETE,
        productId,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Error invalidating cache for deleted product ${productId}:`, {
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Invalidate cache when offer is updated
   */
  async onOfferUpdate(productId: number): Promise<void> {
    try {
      logger.info(`Invalidating cache for product ${productId} due to offer update`);

      await Promise.all([
        advancedCache.invalidatePattern(`${CachePrefix.PRODUCT_DETAIL}:${productId}*`),
        advancedCache.invalidatePattern(`${CachePrefix.PRODUCT_OFFERS}:${productId}*`),
        advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH),
      ]);

      await this.publishInvalidationEvent({
        event: InvalidationEvent.OFFER_UPDATE,
        productId,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Error invalidating cache for product ${productId}:`, {
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Invalidate cache when retailer is updated
   */
  async onRetailerUpdate(retailerId: number): Promise<void> {
    try {
      logger.info(`Invalidating cache for retailer ${retailerId}`);

      await Promise.all([
        advancedCache.invalidatePattern(`${CachePrefix.RETAILER}:${retailerId}*`),
        advancedCache.invalidatePattern(`${CachePrefix.RETAILER}:list*`),
        advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH),
      ]);

      await this.publishInvalidationEvent({
        event: InvalidationEvent.RETAILER_UPDATE,
        retailerId,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Error invalidating cache for retailer ${retailerId}:`, {
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Batch invalidate multiple products
   */
  async batchInvalidateProducts(productIds: number[]): Promise<void> {
    try {
      logger.info(`Batch invalidating cache for ${productIds.length} products`);

      // Invalidate in parallel batches
      const batchSize = 10;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        await Promise.all(batch.map((productId) => this.onPriceUpdate(productId)));
      }

      logger.info(`Batch invalidation completed for ${productIds.length} products`);
    } catch (error) {
      logger.error('Error during batch invalidation:', { error: getErrorMessage(error) });
    }
  }

  /**
   * Invalidate all search-related caches
   */
  async invalidateSearchCaches(): Promise<void> {
    try {
      await advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH);

      await this.publishInvalidationEvent({
        event: InvalidationEvent.SEARCH_INDEX_UPDATE,
        timestamp: Date.now(),
      });

      logger.info('Search caches invalidated');
    } catch (error) {
      logger.error('Error invalidating search caches:', { error: getErrorMessage(error) });
    }
  }

  /**
   * Publish invalidation event to Redis pub/sub
   */
  private async publishInvalidationEvent(payload: InvalidationPayload): Promise<void> {
    const redisClient = getRedisClient();
    if (!redisClient) {
      logger.warn('Redis not available, skipping invalidation event publication');
      return;
    }

    try {
      await redisClient.publish(this.INVALIDATION_CHANNEL, JSON.stringify(payload));
    } catch (error) {
      logger.error('Error publishing invalidation event:', { error: getErrorMessage(error) });
    }
  }

  /**
   * Subscribe to invalidation events
   */
  private subscribeToInvalidationEvents(): void {
    const redisClient = getRedisClient();
    if (!redisClient) {
      logger.warn('Redis not available, skipping invalidation event subscription');
      return;
    }
    const subscriber = redisClient.duplicate();

    void subscriber.subscribe(this.INVALIDATION_CHANNEL, (err) => {
      if (err) {
        logger.error('Failed to subscribe to invalidation events:', { error: err.message });
      } else {
        logger.info('Subscribed to cache invalidation events channel');
      }
    });

    subscriber.on('message', (channel, message) => {
      if (channel === this.INVALIDATION_CHANNEL) {
        try {
          const parsed: unknown = JSON.parse(message);
          const payload = parsed as InvalidationPayload;
          logger.debug('Received invalidation event:', {
            event: payload.event,
            productId: payload.productId,
          });

          // Additional processing can be added here
          // For example, updating metrics, logging, etc.
        } catch (error) {
          logger.error('Error processing invalidation event:', { error: getErrorMessage(error) });
        }
      }
    });
  }

  /**
   * Get invalidation statistics
   */
  getStats() {
    const cacheStats = advancedCache.getStats();
    return {
      cacheStats,
      invalidationChannel: this.INVALIDATION_CHANNEL,
    };
  }
}

// Export singleton instance
export const cacheInvalidation = new CacheInvalidationService();

/**
 * Middleware to automatically invalidate cache on price updates
 * Can be used in Bull job processors
 */
export function withCacheInvalidation<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  eventType: InvalidationEvent
): T {
  return (async (...args: unknown[]) => {
    const result = await fn(...args);

    // Extract productId from result or args (safely handle unknown types)
    const resultObj = result as Record<string, unknown> | null | undefined;
    const firstArg = args[0] as Record<string, unknown> | null | undefined;
    const rawProductId = resultObj?.productId || firstArg?.productId;

    if (rawProductId && typeof rawProductId === 'number') {
      const productId: number = rawProductId;
      switch (eventType) {
        case InvalidationEvent.PRICE_UPDATE:
          await cacheInvalidation.onPriceUpdate(productId);
          break;
        case InvalidationEvent.PRODUCT_UPDATE:
          await cacheInvalidation.onProductUpdate(productId);
          break;
        case InvalidationEvent.OFFER_UPDATE:
          await cacheInvalidation.onOfferUpdate(productId);
          break;
      }
    }

    return result;
  }) as T;
}
