import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

interface CacheEntry {
  data?: unknown;
  timestamp: number;
  etag: string;
}

/**
 * In-memory cache for chart data
 * In production, this should be replaced with Redis or similar
 */
class ChartCache {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTTL = 60 * 60 * 1000; // 1 hour
  private readonly maxSize = 1000; // Maximum cache entries

  /**
   * Generate cache key from request parameters
   */
  private getCacheKey(req: Request): string {
    const { productId } = req.params;
    const { days, retailerId } = req.query;
    return `price-history:${productId}:${days || '30'}:${retailerId || 'all'}`;
  }

  /**
   * Generate ETag for data
   */
  private generateETag(data?: unknown): string {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Get cached data
   */
  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Set cached data
   */
  set(key: string, data?: unknown, ttl?: number): void {
    const etag = this.generateETag(data);

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag,
    });

    // Cleanup if cache gets too large
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Find oldest cache entry
   */
  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });

    return oldestKey;
  }

  /**
   * Invalidate cache entries for a product
   */
  invalidateProduct(productId: number): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (key.includes(`price-history:${productId}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.defaultTTL,
    };
  }
}

export const chartCache = new ChartCache();

/**
 * Middleware to cache price history chart data
 */
export function cacheChartData(ttl?: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `price-history:${req.params.productId}:${req.query.days || '30'}:${req.query.retailerId || 'all'}`;

    // Check cache
    const cached = chartCache.get(cacheKey);

    if (cached) {
      // Check if client has cached version (ETag)
      const clientETag = req.headers['if-none-match'];

      if (clientETag === cached.etag) {
        // Client has up-to-date version
        return res.status(304).end();
      }

      // Send cached data
      res.setHeader('ETag', cached.etag);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttl || 3600}`);
      return res.json(cached.data);
    }

    // Cache miss - intercept json() to cache the response
    const originalJson = res.json.bind(res);

    res.json = function (data?: unknown) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        chartCache.set(cacheKey, data, ttl);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', `public, max-age=${ttl || 3600}`);

        const etag = chartCache.get(cacheKey)?.etag;
        if (etag) {
          res.setHeader('ETag', etag);
        }
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Middleware to invalidate cache when price data is updated
 */
export function invalidateCacheOnUpdate(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function (data?: unknown) {
    // If successful update/create, invalidate cache
    if (res.statusCode === 200 || res.statusCode === 201) {
      const { productId } = req.params;
      if (productId) {
        chartCache.invalidateProduct(parseInt(productId));
      }
    }

    return originalJson(data);
  };

  next();
}

/**
 * Endpoint to get cache statistics (for monitoring)
 */
export function getCacheStats(req: Request, res: Response) {
  const stats = chartCache.getStats();
  res.json({
    cache: stats,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Endpoint to manually clear cache (admin only)
 */
export function clearCache(req: Request, res: Response) {
  chartCache.clear();
  res.json({
    message: 'Cache cleared successfully',
    timestamp: new Date().toISOString(),
  });
}
