/**
 * Advanced Multi-Tier Caching Service
 *
 * Implements a sophisticated caching strategy with:
 * - L1 Cache: In-memory LRU cache for ultra-hot data
 * - L2 Cache: Redis for distributed caching
 * - Tiered TTL based on data popularity
 * - Smart cache invalidation with pub/sub
 * - Cache warming for frequently accessed items
 */

import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * In-memory LRU cache for ultra-hot data
 */
class LRUCache<T> {
  private cache: Map<string, { value: T; timestamp: number }>;
  private maxSize: number;
  private ttl: number; // milliseconds

  constructor(maxSize: number = 1000, ttlSeconds: number = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlSeconds * 1000;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl / 1000,
    };
  }
}

/**
 * Cache tier definitions based on data access patterns
 */
export enum CacheTier {
  HOT = 'hot',       // Frequently accessed - 30 min TTL
  WARM = 'warm',     // Moderately accessed - 10 min TTL
  COLD = 'cold',     // Rarely accessed - 3 min TTL
  STATIC = 'static', // Rarely changes - 1 hour TTL
  COMPUTED = 'computed', // Expensive calculations - 30 min TTL
}

/**
 * TTL configurations for different cache tiers (in seconds)
 */
const TIER_TTL: Record<CacheTier, number> = {
  [CacheTier.HOT]: 1800,      // 30 minutes
  [CacheTier.WARM]: 600,      // 10 minutes
  [CacheTier.COLD]: 180,      // 3 minutes
  [CacheTier.STATIC]: 3600,   // 1 hour
  [CacheTier.COMPUTED]: 1800, // 30 minutes
};

/**
 * Cache key prefixes for organization
 */
export const CachePrefix = {
  PRODUCT: 'product',
  PRODUCT_DETAIL: 'product:detail',
  PRODUCT_OFFERS: 'product:offers',
  PRODUCT_SEARCH: 'product:search',
  PRICE_HISTORY: 'price:history',
  ANALYTICS: 'analytics',
  TREND: 'analytics:trend',
  VOLATILITY: 'analytics:volatility',
  SEASONAL: 'analytics:seasonal',
  BEST_TIME: 'analytics:besttime',
  RELIABILITY: 'analytics:reliability',
  PREDICTION: 'analytics:prediction',
  RETAILER: 'retailer',
  POPULARITY: 'popularity',
} as const;

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  sets: number;
  invalidations: number;
  errors: number;
}

/**
 * Advanced caching service with multi-tier support
 */
export class AdvancedCacheService {
  private l1Cache: LRUCache<any>;
  private stats: CacheStats;
  private readonly PUBSUB_CHANNEL = 'cache:invalidate';

  constructor() {
    // L1 cache: 1000 items, 60 second TTL
    this.l1Cache = new LRUCache(1000, 60);
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      sets: 0,
      invalidations: 0,
      errors: 0,
    };

    // Subscribe to invalidation events
    this.subscribeToInvalidations();
  }

  /**
   * Get value from cache with L1 -> L2 fallback
   */
  async get<T>(key: string, useL1: boolean = true): Promise<T | null> {
    try {
      // Try L1 cache first
      if (useL1) {
        const l1Value = this.l1Cache.get(key);
        if (l1Value !== null) {
          this.stats.l1Hits++;
          return l1Value as T;
        }
        this.stats.l1Misses++;
      }

      // Try L2 cache (Redis)
      const l2Value = await redisClient.get(key);
      if (l2Value) {
        this.stats.l2Hits++;
        const parsed = JSON.parse(l2Value) as T;

        // Populate L1 cache for next time
        if (useL1) {
          this.l1Cache.set(key, parsed);
        }

        return parsed;
      }

      this.stats.l2Misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with automatic tier-based TTL
   */
  async set(
    key: string,
    value: any,
    tier: CacheTier = CacheTier.WARM,
    useL1: boolean = true
  ): Promise<void> {
    try {
      const ttl = TIER_TTL[tier];

      // Set in L2 (Redis)
      await redisClient.setex(key, ttl, JSON.stringify(value));

      // Set in L1 (in-memory)
      if (useL1) {
        this.l1Cache.set(key, value);
      }

      this.stats.sets++;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Get or set pattern (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    tier: CacheTier = CacheTier.WARM,
    useL1: boolean = true
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, useL1);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const value = await fetchFn();

    // Store in cache
    await this.set(key, value, tier, useL1);

    return value;
  }

  /**
   * Invalidate specific cache key
   */
  async invalidate(key: string): Promise<void> {
    try {
      // Remove from L1
      this.l1Cache.delete(key);

      // Remove from L2
      await redisClient.del(key);

      // Publish invalidation event to other instances
      await this.publishInvalidation(key);

      this.stats.invalidations++;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache invalidate error:', error);
    }
  }

  /**
   * Invalidate multiple keys by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await redisClient.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      // Remove from L1
      keys.forEach(key => this.l1Cache.delete(key));

      // Remove from L2
      await redisClient.del(...keys);

      // Publish invalidation event
      await this.publishInvalidation(pattern, true);

      this.stats.invalidations += keys.length;
      return keys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache invalidate pattern error:', error);
      return 0;
    }
  }

  /**
   * Invalidate all cache keys with a given prefix
   */
  async invalidatePrefix(prefix: string): Promise<number> {
    return this.invalidatePattern(`${prefix}:*`);
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    try {
      this.l1Cache.clear();
      await redisClient.flushdb();
      logger.info('All caches cleared');
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const l1Stats = this.l1Cache.getStats();
    const totalRequests = this.stats.l1Hits + this.stats.l1Misses +
                         this.stats.l2Hits + this.stats.l2Misses;
    const l1HitRate = totalRequests > 0
      ? (this.stats.l1Hits / totalRequests * 100).toFixed(2)
      : '0.00';
    const l2HitRate = totalRequests > 0
      ? ((this.stats.l1Hits + this.stats.l2Hits) / totalRequests * 100).toFixed(2)
      : '0.00';

    return {
      l1: {
        ...l1Stats,
        hits: this.stats.l1Hits,
        misses: this.stats.l1Misses,
        hitRate: `${l1HitRate}%`,
      },
      l2: {
        hits: this.stats.l2Hits,
        misses: this.stats.l2Misses,
        hitRate: `${l2HitRate}%`,
      },
      overall: {
        totalRequests,
        sets: this.stats.sets,
        invalidations: this.stats.invalidations,
        errors: this.stats.errors,
      },
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      sets: 0,
      invalidations: 0,
      errors: 0,
    };
  }

  /**
   * Publish cache invalidation event to other instances
   */
  private async publishInvalidation(key: string, isPattern: boolean = false): Promise<void> {
    try {
      await redisClient.publish(
        this.PUBSUB_CHANNEL,
        JSON.stringify({ key, isPattern, timestamp: Date.now() })
      );
    } catch (error) {
      logger.error('Failed to publish invalidation:', error);
    }
  }

  /**
   * Subscribe to cache invalidation events
   */
  private subscribeToInvalidations(): void {
    // Create a separate Redis client for pub/sub
    const subscriber = redisClient.duplicate();

    subscriber.subscribe(this.PUBSUB_CHANNEL, (err) => {
      if (err) {
        logger.error('Failed to subscribe to cache invalidations:', err);
      } else {
        logger.info('Subscribed to cache invalidation channel');
      }
    });

    subscriber.on('message', (channel, message) => {
      if (channel === this.PUBSUB_CHANNEL) {
        try {
          const { key, isPattern } = JSON.parse(message);

          // Only invalidate L1 cache (L2 is already invalidated by publisher)
          if (isPattern) {
            // For patterns, clear entire L1 cache to be safe
            this.l1Cache.clear();
          } else {
            this.l1Cache.delete(key);
          }
        } catch (error) {
          logger.error('Error processing invalidation message:', error);
        }
      }
    });
  }

  /**
   * Generate cache key from prefix and parameters
   */
  static generateKey(prefix: string, ...params: (string | number | boolean | undefined)[]): string {
    const filteredParams = params.filter(p => p !== undefined).join(':');
    return filteredParams ? `${prefix}:${filteredParams}` : prefix;
  }
}

// Export singleton instance
export const advancedCache = new AdvancedCacheService();

/**
 * Helper functions for common cache operations
 */

/**
 * Cache product details with automatic tier selection
 */
export async function cacheProductDetail(productId: number, data: any, isPopular: boolean = false) {
  const key = AdvancedCacheService.generateKey(CachePrefix.PRODUCT_DETAIL, productId);
  const tier = isPopular ? CacheTier.HOT : CacheTier.WARM;
  await advancedCache.set(key, data, tier, isPopular);
}

/**
 * Get cached product details
 */
export async function getCachedProductDetail(productId: number) {
  const key = AdvancedCacheService.generateKey(CachePrefix.PRODUCT_DETAIL, productId);
  return advancedCache.get(key);
}

/**
 * Invalidate product cache
 */
export async function invalidateProductCache(productId: number) {
  await advancedCache.invalidatePrefix(`${CachePrefix.PRODUCT}:${productId}`);
  await advancedCache.invalidatePrefix(`${CachePrefix.PRODUCT_DETAIL}:${productId}`);
  await advancedCache.invalidatePrefix(`${CachePrefix.PRODUCT_OFFERS}:${productId}`);
  await advancedCache.invalidatePrefix(`${CachePrefix.ANALYTICS}:${productId}`);
}

/**
 * Cache analytics results
 */
export async function cacheAnalytics(
  type: string,
  productId: number,
  params: Record<string, any>,
  data: any
) {
  const paramStr = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(':');

  const key = AdvancedCacheService.generateKey(
    `${CachePrefix.ANALYTICS}:${type}`,
    productId,
    paramStr
  );

  await advancedCache.set(key, data, CacheTier.COMPUTED, false);
}

/**
 * Get cached analytics results
 */
export async function getCachedAnalytics(
  type: string,
  productId: number,
  params: Record<string, any>
) {
  const paramStr = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(':');

  const key = AdvancedCacheService.generateKey(
    `${CachePrefix.ANALYTICS}:${type}`,
    productId,
    paramStr
  );

  return advancedCache.get(key, false);
}

/**
 * Cache search results
 */
export async function cacheSearchResults(query: string, filters: any, data: any) {
  const filterStr = JSON.stringify(filters);
  const key = AdvancedCacheService.generateKey(CachePrefix.PRODUCT_SEARCH, query, filterStr);
  await advancedCache.set(key, data, CacheTier.WARM, false);
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults(query: string, filters: any) {
  const filterStr = JSON.stringify(filters);
  const key = AdvancedCacheService.generateKey(CachePrefix.PRODUCT_SEARCH, query, filterStr);
  return advancedCache.get(key, false);
}
