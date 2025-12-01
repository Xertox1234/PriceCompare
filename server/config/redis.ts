/**
 * Redis Configuration
 *
 * Provides Redis connection for distributed rate limiting and session storage.
 * Falls back to in-memory storage if Redis is not available.
 */

import type { Redis } from 'ioredis';
import type { RedisClientType } from 'redis';
import { createLogger } from '../utils/logger';

const log = createLogger('Redis');

let redisClient: Redis | null = null;
let redisSessionClient: RedisClientType | null = null;
let isRedisAvailable = false;

/**
 * Initialize Redis connection
 *
 * @param redisUrl Optional Redis connection URL (default: redis://localhost:6379)
 * @returns Redis client or null if unavailable
 * @throws Error in production if Redis connection fails
 */
export async function initializeRedis(redisUrl?: string): Promise<Redis | null> {
  const isProduction = process.env.NODE_ENV === 'production';

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
    log.info('✅ Redis (ioredis) connected successfully');

    // Handle connection errors
    redisClient.on('error', (error) => {
      log.error('Redis error:', { message: error.message });
      isRedisAvailable = false;

      // CRITICAL: In production, Redis errors are fatal
      if (isProduction) {
        log.error('❌ FATAL: Redis connection lost in production environment');
        log.error('   Production requires Redis for distributed operations');
        process.exit(1);
      }
    });

    redisClient.on('reconnecting', () => {
      log.info('🔄 Redis reconnecting...');
    });

    redisClient.on('connect', () => {
      log.info('✅ Redis reconnected');
      isRedisAvailable = true;
    });

    // Also initialize redis client for session storage (connect-redis v9 requires 'redis' package)
    try {
      const { createClient } = await import('redis');
      redisSessionClient = createClient({ url });

      redisSessionClient.on('error', (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Redis session client error:', { message: errorMessage });

        // CRITICAL: In production, session client errors are fatal
        if (isProduction) {
          log.error('❌ FATAL: Redis session client connection lost in production');
          process.exit(1);
        }
      });

      await redisSessionClient.connect();
      log.info('✅ Redis session client connected successfully');
    } catch (sessionError) {
      const errorMsg = sessionError instanceof Error ? sessionError.message : String(sessionError);

      // CRITICAL: Fail fast in production if session client unavailable
      if (isProduction) {
        log.error('❌ FATAL: Redis session client failed to initialize in production');
        log.error(`   Error: ${errorMsg}`);
        log.error('   Production requires Redis for distributed session storage');
        throw new Error(`Redis session client initialization failed: ${errorMsg}`);
      }

      log.warn('⚠️  Redis session client failed to initialize:', { error: errorMsg });
      redisSessionClient = null;
    }

    return redisClient;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // CRITICAL: Fail fast in production if Redis is unavailable
    if (isProduction) {
      log.error('❌ FATAL: Redis connection failed in production environment');
      log.error(`   Error: ${errorMsg}`);
      log.error('   Redis URL: ' + (redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'));
      log.error('\n   Production requires Redis for:');
      log.error('   - Distributed rate limiting across multiple instances');
      log.error('   - Session storage and management');
      log.error('   - Account lockout tracking');
      log.error('   - Caching and performance optimization');
      log.error('   - Job queue coordination\n');
      throw new Error(`Redis initialization failed: ${errorMsg}`);
    }

    // Development: Allow fallback to in-memory with clear warnings
    log.warn('⚠️  Redis not available, falling back to in-memory storage');
    log.warn('   ⚠️  WARNING: In-memory storage is NOT suitable for production');
    log.warn('   ⚠️  Sessions will not persist across server restarts');
    log.warn('   ⚠️  Rate limiting will not work across multiple instances');
    log.warn('   To enable Redis: npm install ioredis redis && start Redis server');
    isRedisAvailable = false;
    return null;
  }
}

/**
 * Get Redis client instance (ioredis)
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Get Redis session client instance (redis package for connect-redis)
 */
export function getRedisSessionClient(): RedisClientType | null {
  return redisSessionClient;
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
  if (redisSessionClient) {
    await redisSessionClient.quit();
    redisSessionClient = null;
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
class _InMemoryRedis {
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
