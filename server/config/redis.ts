/**
 * Redis Configuration
 *
 * Provides Redis connection for distributed rate limiting and session storage.
 * Falls back to in-memory storage if Redis is not available.
 */

import type { Redis } from 'ioredis';
import { createLogger } from '../utils/logger';

const log = createLogger('Redis');

let redisClient: Redis | null = null;
let isRedisAvailable = false;

/**
 * Initialize Redis connection
 *
 * @param redisUrl Optional Redis connection URL (default: redis://localhost:6379)
 * @returns Redis client or null if unavailable
 */
export async function initializeRedis(redisUrl?: string): Promise<Redis | null> {
  try {
    // Dynamically import ioredis to avoid errors if not installed
    const { default: IORedis } = await import('ioredis');

    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = new IORedis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    // Test connection
    await redisClient.connect();
    await redisClient.ping();

    isRedisAvailable = true;
    log.info('✅ Redis connected successfully');

    // Handle connection errors
    redisClient.on('error', (error) => {
      log.error('Redis error:', { message: error.message });
      isRedisAvailable = false;
    });

    redisClient.on('reconnecting', () => {
      log.info('🔄 Redis reconnecting...');
    });

    redisClient.on('connect', () => {
      log.info('✅ Redis reconnected');
      isRedisAvailable = true;
    });

    return redisClient;
  } catch (error) {
    log.warn('⚠️  Redis not available, falling back to in-memory storage');
    log.warn('   To enable Redis: npm install ioredis && start Redis server');
    isRedisAvailable = false;
    return null;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Check if Redis is available
 */
export function isRedisConnected(): boolean {
  return isRedisAvailable && redisClient !== null;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isRedisAvailable = false;
  }
}

/**
 * Redis key prefixes for different data types
 */
export const REDIS_KEYS = {
  RATE_LIMIT: (identifier: string) => `ratelimit:${identifier}`,
  ACCOUNT_LOCKOUT: (email: string) => `lockout:${email}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
  CACHE: (key: string) => `cache:${key}`,
} as const;

/**
 * Mock Redis client for when Redis is not available
 * Provides same interface but stores in memory
 */
class InMemoryRedis {
  private store = new Map<string, { value: string; expiry: number | null }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
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

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }
}

/**
 * Export redisClient for services that need direct access
 *
 * IMPORTANT: Do not use the module-level redisClient directly.
 * Always call getRedisClient() to ensure Redis is initialized.
 */
export { redisClient };
