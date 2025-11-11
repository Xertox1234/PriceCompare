/**
 * Redis Configuration
 *
 * Provides Redis connection for distributed rate limiting and session storage.
 * Falls back to in-memory storage if Redis is not available.
 */

import type { Redis } from 'ioredis';

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
    console.log('✅ Redis connected successfully');

    // Handle connection errors
    redisClient.on('error', (error) => {
      console.error('Redis error:', error.message);
      isRedisAvailable = false;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis reconnected');
      isRedisAvailable = true;
    });

    return redisClient;
  } catch (error) {
    console.warn('⚠️  Redis not available, falling back to in-memory storage');
    console.warn('   To enable Redis: npm install ioredis && start Redis server');
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
