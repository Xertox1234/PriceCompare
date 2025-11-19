/**
 * Advanced Cache Middleware
 *
 * Enhanced caching middleware that:
 * - Uses multi-tier caching (L1/L2)
 * - Tracks popularity for intelligent TTL selection
 * - Integrates with cache warming service
 * - Provides detailed cache headers
 */

import type { Request, Response, NextFunction } from 'express';
import { advancedCache, CacheTier, CachePrefix } from '../services/advanced-cache';
import { popularityTracker } from '../services/popularity-tracker';
import { logger } from '../utils/logger';

/**
 * Options for advanced cache middleware
 */
interface CacheOptions {
  prefix: string;
  tier?: CacheTier;
  useL1?: boolean;
  skipAuth?: boolean;
  trackPopularity?: boolean;
  varyBy?: string[];
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, prefix: string, varyBy?: string[]): string {
  const parts = [prefix];

  // Add URL path
  parts.push(req.path);

  // Add query parameters (sorted for consistency)
  const queryParams = Object.keys(req.query)
    .sort()
    .map(key => `${key}=${req.query[key]}`)
    .join('&');

  if (queryParams) {
    parts.push(queryParams);
  }

  // Add vary-by headers
  if (varyBy) {
    varyBy.forEach(header => {
      const value = req.get(header);
      if (value) {
        parts.push(`${header}:${value}`);
      }
    });
  }

  return parts.join(':');
}

/**
 * Advanced cache middleware factory
 */
export function advancedCacheMiddleware(options: CacheOptions) {
  const {
    prefix,
    tier = CacheTier.WARM,
    useL1 = true,
    skipAuth = true,
    trackPopularity = false,
    varyBy,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for authenticated users if configured
    if (skipAuth && req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = generateCacheKey(req, prefix, varyBy);

      // Try to get from cache
      const cached = await advancedCache.get(cacheKey, useL1);

      if (cached !== null) {
        // Cache hit
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        res.set('X-Cache-Tier', tier);
        return res.json(cached);
      }

      // Cache miss - intercept response
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data: Record<string, unknown> | unknown[] | null = {}) {
        // Cache the response
        advancedCache.set(cacheKey, data, tier, useL1).catch(error => {
          logger.error('Error caching response:', error);
        });

        // Track popularity if enabled
        if (trackPopularity && req.query.query) {
          popularityTracker.trackSearchQuery(req.query.query as string).catch(error => {
            logger.error('Error tracking search query:', error);
          });
        }

        // Call original json method
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Error in advanced cache middleware:', error);
      next();
    }
  };
}

/**
 * Product detail cache middleware with popularity tracking
 */
export function productDetailCacheMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for authenticated users
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const productId = parseInt(req.params.id);

      if (isNaN(productId)) {
        return next();
      }

      // Track product view
      await popularityTracker.trackProductView(productId);

      // Determine cache tier based on popularity
      const tier = await popularityTracker.getProductTier(productId);
      const cacheTier = tier === 'hot' ? CacheTier.HOT :
                       tier === 'warm' ? CacheTier.WARM : CacheTier.COLD;
      const useL1 = tier === 'hot';

      // Generate cache key
      const cacheKey = `${CachePrefix.PRODUCT_DETAIL}:${productId}`;

      // Try to get from cache
      const cached = await advancedCache.get(cacheKey, useL1);

      if (cached !== null) {
        // Cache hit
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        res.set('X-Cache-Tier', cacheTier);
        res.set('X-Popularity-Tier', tier);
        return res.json(cached);
      }

      // Cache miss
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);
      res.set('X-Popularity-Tier', tier);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data: Record<string, unknown> | unknown[] | null = {}) {
        // Cache the response
        advancedCache.set(cacheKey, data, cacheTier, useL1).catch(error => {
          logger.error('Error caching product detail:', error);
        });

        // Call original json method
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Error in product detail cache middleware:', error);
      next();
    }
  };
}

/**
 * Analytics cache middleware
 */
export function analyticsCacheMiddleware(analyticsType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const productId = parseInt(req.params.id);

      if (isNaN(productId)) {
        return next();
      }

      // Generate cache key including query parameters
      const queryParams = Object.keys(req.query)
        .sort()
        .map(key => `${key}=${req.query[key]}`)
        .join(':');

      const cacheKey = queryParams
        ? `${CachePrefix.ANALYTICS}:${analyticsType}:${productId}:${queryParams}`
        : `${CachePrefix.ANALYTICS}:${analyticsType}:${productId}`;

      // Try to get from cache
      const cached = await advancedCache.get(cacheKey, false);

      if (cached !== null) {
        // Cache hit
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        res.set('X-Cache-Tier', CacheTier.COMPUTED);
        return res.json(cached);
      }

      // Cache miss
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data: Record<string, unknown> | unknown[] | null = {}) {
        // Cache the response
        advancedCache.set(cacheKey, data, CacheTier.COMPUTED, false).catch(error => {
          logger.error('Error caching analytics:', error);
        });

        // Call original json method
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Error in analytics cache middleware:', error);
      next();
    }
  };
}

/**
 * Search cache middleware with popularity tracking
 */
export function searchCacheMiddleware() {
  return advancedCacheMiddleware({
    prefix: CachePrefix.PRODUCT_SEARCH,
    tier: CacheTier.WARM,
    useL1: false,
    skipAuth: true,
    trackPopularity: true,
  });
}

/**
 * Retailer list cache middleware (static data)
 */
export function retailerListCacheMiddleware() {
  return advancedCacheMiddleware({
    prefix: CachePrefix.RETAILER,
    tier: CacheTier.STATIC,
    useL1: true,
    skipAuth: false, // Cache for all users
  });
}
