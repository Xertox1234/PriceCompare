import type { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import type { Redis } from 'ioredis';
import { CACHE_DURATION } from '../utils/constants';
import { createLogger } from '../utils/logger';

const log = createLogger('RedisCache');

/**
 * In-memory fallback cache for when Redis is unavailable
 */
class InMemoryCache {
  private store = new Map<string, { value: string; expiry: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    this.store.set(key, {
      value,
      expiry: Date.now() + seconds * 1000,
    });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted++;
    }
    return deleted;
  }

  /**
   * SCAN-like iteration for in-memory cache (non-blocking equivalent)
   *
   * Returns [nextCursor, keys] tuple matching Redis SCAN semantics.
   * For in-memory cache, we process in batches to maintain API compatibility.
   */
  async scan(
    cursor: string,
    _match: string,
    pattern: string,
    _count: string,
    batchSize: number
  ): Promise<[string, string[]]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const allKeys = Array.from(this.store.keys()).filter((key) => regex.test(key));
    const cursorNum = parseInt(cursor, 10);
    const batch = allKeys.slice(cursorNum, cursorNum + batchSize);
    const nextCursor =
      cursorNum + batchSize >= allKeys.length ? '0' : String(cursorNum + batchSize);
    return [nextCursor, batch];
  }
}

const memoryCache = new InMemoryCache();

/**
 * Get cache client (Redis or in-memory fallback)
 */
function getCacheClient(): Redis | InMemoryCache {
  return getRedisClient() || memoryCache;
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 300 = 5 minutes)
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
}

/**
 * Redis-based API response caching middleware
 * Caches GET requests to improve performance and reduce database load
 */
export function redisCacheMiddleware(options: CacheOptions = {}) {
  const {
    ttl = CACHE_DURATION.LONG, // Default 5 minutes
    keyGenerator = defaultKeyGenerator,
    skipCache = defaultSkipCache,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if custom skip function returns true
    if (skipCache(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator(req);

    try {
      const cache = getCacheClient();

      // Try to get cached response
      const cachedResponse = await cache.get(cacheKey);

      if (cachedResponse) {
        // Cache hit - return cached response
        const parsed: unknown = JSON.parse(cachedResponse);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.json(parsed);
      }

      // Cache miss - capture the response
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache the response
      res.json = function (body: unknown) {
        // Cache the response asynchronously (don't block response)
        cache.setex(cacheKey, ttl, JSON.stringify(body)).catch((err) => {
          log.error('Failed to cache response:', { error: err });
        });

        // Send response
        return originalJson(body);
      };

      next();
    } catch (error) {
      // On error, skip caching and proceed
      log.error('Cache middleware error:', { error });
      next();
    }
  };
}

/**
 * Default cache key generator
 * Uses full URL including query parameters
 */
function defaultKeyGenerator(req: Request): string {
  return `cache:${req.originalUrl}`;
}

/**
 * Default skip cache function
 * Skips caching for authenticated requests
 */
function defaultSkipCache(req: Request): boolean {
  // Don't cache authenticated requests
  return !!req.user;
}

/**
 * Invalidate cache by pattern using SCAN (non-blocking)
 *
 * Uses SCAN instead of KEYS command to avoid blocking Redis.
 * KEYS is O(n) on all keys and blocks the server, while SCAN
 * iterates incrementally in batches.
 *
 * @param pattern - Redis key pattern (e.g., 'cache:/api/products/*')
 */
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    const cache = getCacheClient();
    let cursor = '0';
    let deletedCount = 0;

    // Use SCAN to iterate through keys matching pattern (non-blocking)
    do {
      const [nextCursor, keys] = await cache.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deletedCount += await cache.del(...keys);
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch (error) {
    log.error('Failed to invalidate cache:', { error });
    return 0;
  }
}

/**
 * Invalidate cache for specific key
 * @param key - Exact cache key to invalidate
 */
export async function invalidateCacheKey(key: string): Promise<number> {
  try {
    const cache = getCacheClient();
    return await cache.del(key);
  } catch (error) {
    log.error('Failed to invalidate cache key:', { error });
    return 0;
  }
}

/**
 * Pre-configured cache middleware for product endpoints
 * Cache for 5 minutes
 */
export const productCacheMiddleware = redisCacheMiddleware({
  ttl: CACHE_DURATION.LONG,
  keyGenerator: (req) => `cache:products:${req.originalUrl}`,
});

/**
 * Pre-configured cache middleware for search endpoints
 * Cache for 3 minutes - shorter due to frequent updates
 */
export const searchCacheMiddleware = redisCacheMiddleware({
  ttl: CACHE_DURATION.MEDIUM,
  keyGenerator: (req) => `cache:search:${req.originalUrl}`,
});

/**
 * Pre-configured cache middleware for retailer endpoints
 * Cache for 10 minutes - retailers change infrequently
 */
export const retailerCacheMiddleware = redisCacheMiddleware({
  ttl: CACHE_DURATION.VERY_LONG,
  keyGenerator: (req) => `cache:retailers:${req.originalUrl}`,
});

/**
 * Pre-configured cache middleware for forum endpoints
 * Cache for 1 minute - forums are dynamic
 */
export const forumCacheMiddleware = redisCacheMiddleware({
  ttl: CACHE_DURATION.SHORT,
  keyGenerator: (req) => `cache:forum:${req.originalUrl}`,
});
