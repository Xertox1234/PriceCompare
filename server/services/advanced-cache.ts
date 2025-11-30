/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
/**
 * Advanced Multi-Tier Caching Service
 *
 * Implements a sophisticated caching strategy with:
 * - L1 Cache: In-memory LRU cache for ultra-hot data
 * - L2 Cache: Redis for distributed caching
 * - Tiered TTL based on data popularity
 * - Smart cache invalidation with pub/sub
 * - Cache warming for frequently accessed items
 *
 * @see GitHub Issue #89 for the caching layer consolidation roadmap.
 *
 * Architecture Notes:
 * This is the primary caching service. Related cache files use this as their backend:
 * - analytics-cache.ts - Thin wrapper providing analytics-specific caching methods
 * - cache-invalidation.ts - Event-driven invalidation coordinated through this service
 *
 * Remaining consolidation opportunity:
 * - redis-cache.ts maintains a separate Redis connection and could be migrated
 *   to use AdvancedCacheService for unified connection management
 */

import type { Redis } from 'ioredis';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * In-memory LRU cache for ultra-hot data
 *
 * Design Decision (TODO #039): Custom implementation retained over lru-cache npm package.
 *
 * Rationale:
 * 1. Simplicity: This 57-line implementation is purpose-built for our specific use case
 *    (1000 items, 60-second TTL L1 cache) without unnecessary complexity.
 *
 * 2. Minimal Dependencies: Avoiding additional npm dependencies reduces supply chain risk,
 *    bundle size, and version management overhead.
 *
 * 3. Sufficient Features: Our use case doesn't require lru-cache's advanced features
 *    (sizeCalculation, fetchMethod, dispose callbacks, ttlAutopurge, etc.).
 *
 * 4. Performance: For a small L1 cache (1000 items, 60s TTL), the performance difference
 *    is negligible. The heavy lifting is done by L2 (Redis).
 *
 * 5. Behavior Parity: Both implementations use lazy TTL expiration (checking on access),
 *    which is appropriate for our short-lived cache entries.
 *
 * When to reconsider:
 * - If we need size-based eviction (memory limits instead of item count)
 * - If we need proactive TTL purging (ttlAutopurge)
 * - If we need dispose callbacks for cleanup
 * - If the cache grows significantly larger (10k+ items)
 *
 * @see https://www.npmjs.com/package/lru-cache for the alternative package
 */
class LRUCache<T> {
  private cache: Map<string, { value: T; timestamp: number }>;
  private maxSize: number;
  private ttl: number; // milliseconds

  constructor(maxSize = 1000, ttlSeconds = 60) {
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
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all cache entries matching a glob-style pattern
   *
   * Converts glob patterns (e.g., "product:123:*") to regex and deletes matching keys.
   * This enables targeted invalidation instead of clearing the entire cache.
   *
   * @param pattern - Glob pattern where * matches any characters
   * @returns Number of entries deleted
   */
  deletePattern(pattern: string): number {
    // Convert glob pattern to regex: escape special chars, then convert * to .*
    const escapedPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars (except *)
      .replace(/\*/g, '.*'); // Convert glob * to regex .*
    const regex = new RegExp(`^${escapedPattern}$`);

    let deleted = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Get all keys in the cache (for debugging/testing)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
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
  patternInvalidations: number; // Number of pattern-based invalidation operations
  patternKeysDeleted: number;   // Total keys deleted via pattern matching
  errors: number;
}

/**
 * Advanced caching service with multi-tier support
 */
export class AdvancedCacheService {
  private l1Cache: LRUCache<unknown>;
  private stats: CacheStats;
  private readonly PUBSUB_CHANNEL = 'cache:invalidate';
  /** Pub/sub subscriber client - stored for cleanup during graceful shutdown */
  private subscriber: Redis | null = null;

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
      patternInvalidations: 0,
      patternKeysDeleted: 0,
      errors: 0,
    };

    // Subscribe to invalidation events
    this.subscribeToInvalidations();
  }

  /**
   * Get Redis client with null check
   * Throws if Redis is not available (should not happen in production)
   */
  private getRedis(): NonNullable<typeof redisClient> {
    if (!redisClient) {
      throw new Error('Redis client not available');
    }
    return redisClient;
  }

  /**
   * Extract error message for logging
   */
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Get value from cache with L1 -> L2 fallback
   */
  async get<T>(key: string, useL1 = true): Promise<T | null> {
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
      const redis = this.getRedis();
      const l2Value = await redis.get(key);
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
      logger.error('Cache get error:', { error: this.getErrorMessage(error) });
      return null;
    }
  }

  /**
   * Set value in cache with automatic tier-based TTL
   */
  async set(
    key: string,
    value: unknown,
    tier: CacheTier = CacheTier.WARM,
    useL1 = true
  ): Promise<void> {
    try {
      const ttl = TIER_TTL[tier];

      // Set in L2 (Redis)
      const redis = this.getRedis();
      await redis.setex(key, ttl, JSON.stringify(value));

      // Set in L1 (in-memory)
      if (useL1) {
        this.l1Cache.set(key, value);
      }

      this.stats.sets++;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error:', { error: this.getErrorMessage(error) });
    }
  }

  /**
   * Get or set pattern (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    tier: CacheTier = CacheTier.WARM,
    useL1 = true
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
      const redis = this.getRedis();
      await redis.del(key);

      // Publish invalidation event to other instances
      await this.publishInvalidation(key);

      this.stats.invalidations++;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache invalidate error:', { error: this.getErrorMessage(error) });
    }
  }

  /**
   * Invalidate multiple keys by pattern using SCAN (non-blocking)
   *
   * Uses SCAN instead of KEYS command to avoid blocking Redis.
   * KEYS is O(n) on all keys and blocks the server, while SCAN
   * iterates incrementally in batches.
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const redis = this.getRedis();
      let cursor = '0';
      let deletedCount = 0;

      // Use SCAN to iterate through keys matching pattern (non-blocking)
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          // Remove from L1
          keys.forEach(key => this.l1Cache.delete(key));

          // Remove from L2
          await redis.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');

      // Publish invalidation event
      if (deletedCount > 0) {
        await this.publishInvalidation(pattern, true);
      }

      this.stats.invalidations += deletedCount;
      return deletedCount;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache invalidate pattern error:', { error: this.getErrorMessage(error) });
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
      const redis = this.getRedis();
      await redis.flushdb();
      logger.info('All caches cleared');
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear error:', { error: this.getErrorMessage(error) });
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
      patternInvalidation: {
        operations: this.stats.patternInvalidations,
        keysDeleted: this.stats.patternKeysDeleted,
        avgKeysPerOperation: this.stats.patternInvalidations > 0
          ? (this.stats.patternKeysDeleted / this.stats.patternInvalidations).toFixed(2)
          : '0.00',
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
      patternInvalidations: 0,
      patternKeysDeleted: 0,
      errors: 0,
    };
  }

  /**
   * Publish cache invalidation event to other instances
   */
  private async publishInvalidation(key: string, isPattern = false): Promise<void> {
    try {
      const redis = this.getRedis();
      await redis.publish(
        this.PUBSUB_CHANNEL,
        JSON.stringify({ key, isPattern, timestamp: Date.now() })
      );
    } catch (error) {
      logger.error('Failed to publish invalidation:', { error: this.getErrorMessage(error) });
    }
  }

  /**
   * Subscribe to cache invalidation events
   *
   * Creates a duplicate Redis client for pub/sub and stores it as a class property
   * for proper cleanup during graceful shutdown.
   */
  private subscribeToInvalidations(): void {
    // Create a separate Redis client for pub/sub and store for cleanup
    const redis = this.getRedis();
    this.subscriber = redis.duplicate();

    void this.subscriber.subscribe(this.PUBSUB_CHANNEL, (err) => {
      if (err) {
        logger.error('Failed to subscribe to cache invalidations:', { error: err instanceof Error ? err.message : String(err) });
      } else {
        logger.info('Subscribed to cache invalidation channel');
      }
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel === this.PUBSUB_CHANNEL) {
        try {
          const { key, isPattern = false } = JSON.parse(message);

          // Only invalidate L1 cache (L2 is already invalidated by publisher)
          if (isPattern) {
            // Delete only matching keys instead of clearing entire cache
            // This preserves unrelated hot data and improves L1 hit rate
            const deleted = this.l1Cache.deletePattern(key);
            this.stats.patternInvalidations++;
            this.stats.patternKeysDeleted += deleted;
            if (deleted > 0) {
              logger.debug(`L1 cache pattern invalidation: ${key} deleted ${deleted} keys`);
            }
          } else {
            this.l1Cache.delete(key);
          }
        } catch (error) {
          logger.error('Error processing invalidation message:', { error: this.getErrorMessage(error) });
        }
      }
    });
  }

  /**
   * Close the cache service and clean up resources
   *
   * This method properly closes the pub/sub subscriber connection to prevent
   * memory leaks and orphaned Redis connections during graceful shutdown.
   */
  async close(): Promise<void> {
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
        logger.info('Advanced cache pub/sub subscriber closed');
      } catch (error) {
        logger.error('Error closing advanced cache subscriber:', { error: this.getErrorMessage(error) });
      }
      this.subscriber = null;
    }
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
export async function cacheProductDetail(productId: number, data: unknown, isPopular = false) {
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
  params: Record<string, unknown>,
  data: unknown
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
  params: Record<string, unknown>
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
export async function cacheSearchResults(query: string, filters: unknown, data: unknown) {
  const filterStr = JSON.stringify(filters);
  const key = AdvancedCacheService.generateKey(CachePrefix.PRODUCT_SEARCH, query, filterStr);
  await advancedCache.set(key, data, CacheTier.WARM, false);
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults(query: string, filters: unknown) {
  const filterStr = JSON.stringify(filters);
  const key = AdvancedCacheService.generateKey(CachePrefix.PRODUCT_SEARCH, query, filterStr);
  return advancedCache.get(key, false);
}
