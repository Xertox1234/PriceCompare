import type { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { CACHE_DURATION } from '../utils/constants';
import { createLogger } from '../utils/logger';

const log = createLogger('RedisCache');

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
      // Try to get cached response
      const cachedResponse = await redis.get(cacheKey);

      if (cachedResponse) {
        // Cache hit - return cached response
        const parsed = JSON.parse(cachedResponse);
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
        redis.setex(cacheKey, ttl, JSON.stringify(body)).catch(err => {
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
 * Invalidate cache by pattern
 * @param pattern - Redis key pattern (e.g., 'cache:/api/products/*')
 */
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    return await redis.del(...keys);
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
    return await redis.del(key);
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
