import type { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

/**
 * Redis Cache Service
 *
 * Provides a robust caching layer with:
 * - Uses shared Redis connection from server/config/redis.ts
 * - Graceful degradation if Redis is unavailable
 * - Cache hit/miss metrics
 * - TTL support
 * - Batch operations
 *
 * NOTE: This service now uses the shared Redis client to avoid
 * duplicate connections. Initialize Redis via initializeRedis()
 * before using this cache.
 */

export interface CacheOptions {
  keyPrefix?: string;
  defaultTTL?: number; // in milliseconds
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  connected: boolean;
}

export class RedisCache {
  private options: Required<Omit<CacheOptions, 'maxRetries'>>;

  // Metrics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  constructor(options: CacheOptions = {}) {
    this.options = {
      keyPrefix: options.keyPrefix || 'cache:',
      defaultTTL: options.defaultTTL || 604800000, // 7 days
    };
  }

  /**
   * Get the shared Redis client
   * Returns null if Redis is not available
   */
  private getClient(): Redis | null {
    return getRedisClient();
  }

  /**
   * Check if Redis is connected
   */
  private get isConnected(): boolean {
    const client = this.getClient();
    return client !== null && client.status === 'ready';
  }

  /**
   * Get value from cache
   * @param key - Cache key (prefix will be added automatically)
   * @returns Cached value or null if not found
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const client = this.getClient();
    if (!client) {
      logger.debug('Redis not connected, cache miss', { key });
      this.stats.misses++;
      return null;
    }

    try {
      const fullKey = this.options.keyPrefix + key;
      const value = await client.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        logger.debug('Cache miss', { key });
        return null;
      }

      this.stats.hits++;
      logger.debug('Cache hit', { key });

      return JSON.parse(value) as T;

    } catch (error) {
      this.stats.errors++;
      this.stats.misses++;
      logger.error('Cache get failed', {
        error: error instanceof Error ? error.message : String(error),
        key
      });
      return null;
    }
  }

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to cache (will be JSON serialized)
   * @param ttl - Time to live in milliseconds (optional)
   */
  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      logger.debug('Redis not connected, skipping cache set', { key });
      return false;
    }

    try {
      const fullKey = this.options.keyPrefix + key;
      const serialized = JSON.stringify(value);
      const ttlSeconds = Math.floor((ttl || this.options.defaultTTL) / 1000);

      await client.setex(fullKey, ttlSeconds, serialized);

      this.stats.sets++;
      logger.debug('Cache set', { key, ttlSeconds });

      return true;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set failed', {
        error: error instanceof Error ? error.message : String(error),
        key
      });
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param key - Cache key
   */
  async delete(key: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      const fullKey = this.options.keyPrefix + key;
      await client.del(fullKey);

      this.stats.deletes++;
      logger.debug('Cache delete', { key });

      return true;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete failed', {
        error: error instanceof Error ? error.message : String(error),
        key
      });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   * @param key - Cache key
   */
  async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      const fullKey = this.options.keyPrefix + key;
      const result = await client.exists(fullKey);
      return result === 1;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache exists check failed', {
        error: error instanceof Error ? error.message : String(error),
        key
      });
      return false;
    }
  }

  /**
   * Get multiple values from cache
   * @param keys - Array of cache keys
   * @returns Map of key -> value (only includes found keys)
   */
  async getMany<T = unknown>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const client = this.getClient();

    if (!client || keys.length === 0) {
      return result;
    }

    try {
      const fullKeys = keys.map(key => this.options.keyPrefix + key);
      const values = await client.mget(...fullKeys);

      keys.forEach((key, index) => {
        const value = values[index];
        if (value !== null) {
          try {
            result.set(key, JSON.parse(value) as T);
            this.stats.hits++;
          } catch {
            this.stats.errors++;
          }
        } else {
          this.stats.misses++;
        }
      });

      logger.debug('Cache getMany', {
        requested: keys.length,
        found: result.size,
        hitRate: result.size / keys.length
      });

      return result;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache getMany failed', {
        error: error instanceof Error ? error.message : String(error),
        keyCount: keys.length
      });
      return result;
    }
  }

  /**
   * Clear all keys with the configured prefix using SCAN (non-blocking)
   *
   * Uses SCAN instead of KEYS command to avoid blocking Redis.
   * KEYS is O(n) on all keys and blocks the server, while SCAN
   * iterates incrementally in batches.
   */
  async clear(): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      const pattern = this.options.keyPrefix + '*';
      let cursor = '0';
      let totalDeleted = 0;

      // Use SCAN to iterate through keys matching pattern (non-blocking)
      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await client.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      if (totalDeleted > 0) {
        logger.info('Cache cleared', { keysDeleted: totalDeleted });
      }

      return true;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      ...this.stats,
      hitRate,
      connected: this.isConnected
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
    logger.info('Cache statistics reset');
  }

  /**
   * Check if Redis is connected and ready
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Close Redis connection
   * Note: With shared client, this is a no-op. Use closeRedis() from config/redis.ts
   */
  async close(): Promise<void> {
    // No-op: Connection is managed by shared client in config/redis.ts
    // Call closeRedis() from config/redis.ts to close the shared connection
    logger.debug('RedisCache.close() called - connection managed by shared client');
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      const result = await client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

// Singleton instance for query caching
export const queryCache = new RedisCache({
  keyPrefix: 'query:',
  defaultTTL: 604800000 // 7 days
});

// Singleton instance for general caching
export const generalCache = new RedisCache({
  keyPrefix: 'general:',
  defaultTTL: 3600000 // 1 hour
});
