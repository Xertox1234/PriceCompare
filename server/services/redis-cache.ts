import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

/**
 * Redis Cache Service
 *
 * Provides a robust caching layer with:
 * - Automatic connection management
 * - Graceful degradation if Redis is unavailable
 * - Cache hit/miss metrics
 * - TTL support
 * - Batch operations
 */

export interface CacheOptions {
  keyPrefix?: string;
  defaultTTL?: number; // in milliseconds
  maxRetries?: number;
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
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private options: Required<CacheOptions>;

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
      maxRetries: options.maxRetries || 3
    };

    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  private initialize(): void {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: this.options.maxRetries,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        // Graceful handling of connection issues
        lazyConnect: true,
        enableOfflineQueue: false
      };

      this.client = new Redis(redisConfig);

      // Connection event handlers
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis cache connected', {
          host: redisConfig.host,
          port: redisConfig.port
        });
      });

      this.client.on('ready', () => {
        logger.info('Redis cache ready');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        this.stats.errors++;
        logger.error('Redis cache error', {
          error: error.message,
          errorCount: this.stats.errors
        });
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis cache connection closed');
      });

      // Attempt to connect
      this.client.connect().catch((error) => {
        logger.error('Failed to connect to Redis', {
          error: error.message,
          host: redisConfig.host,
          port: redisConfig.port
        });
      });

    } catch (error) {
      logger.error('Failed to initialize Redis cache', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get value from cache
   * @param key - Cache key (prefix will be added automatically)
   * @returns Cached value or null if not found
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      logger.debug('Redis not connected, cache miss', { key });
      this.stats.misses++;
      return null;
    }

    try {
      const fullKey = this.options.keyPrefix + key;
      const value = await this.client.get(fullKey);

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
    if (!this.isConnected || !this.client) {
      logger.debug('Redis not connected, skipping cache set', { key });
      return false;
    }

    try {
      const fullKey = this.options.keyPrefix + key;
      const serialized = JSON.stringify(value);
      const ttlSeconds = Math.floor((ttl || this.options.defaultTTL) / 1000);

      await this.client.setex(fullKey, ttlSeconds, serialized);

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
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.options.keyPrefix + key;
      await this.client.del(fullKey);

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
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.options.keyPrefix + key;
      const result = await this.client.exists(fullKey);
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

    if (!this.isConnected || !this.client || keys.length === 0) {
      return result;
    }

    try {
      const fullKeys = keys.map(key => this.options.keyPrefix + key);
      const values = await this.client.mget(...fullKeys);

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
   * Clear all keys with the configured prefix
   */
  async clear(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const pattern = this.options.keyPrefix + '*';
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info('Cache cleared', { keysDeleted: keys.length });
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
    return this.isConnected && this.client !== null;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis cache connection closed');
    }
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
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
