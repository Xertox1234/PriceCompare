/**
 * Session Store Configuration
 *
 * Provides Redis-based session storage with automatic fallback to in-memory.
 * Redis session store enables distributed sessions across multiple server instances.
 */

import type { Redis } from 'ioredis';
import type session from 'express-session';
import { createLogger } from '../utils/logger';

const log = createLogger('SessionStore');

/**
 * Create session store (Redis or in-memory fallback)
 *
 * @param redisClient Redis client instance (or null if unavailable)
 * @returns Session store or undefined (express-session will use MemoryStore)
 */
export async function createSessionStore(
  redisClient: Redis | null
): Promise<session.Store | undefined> {
  if (!redisClient) {
    log.warn('⚠️  Using in-memory session store (not suitable for production)');
    log.warn('   Sessions will not persist across server restarts');
    log.warn('   Sessions will not work with multiple server instances');
    log.warn('   To fix: Install Redis and set REDIS_URL in .env');
    return undefined; // express-session will use MemoryStore
  }

  try {
    // Dynamically import connect-redis to avoid errors if not installed
    // @ts-ignore - connect-redis is optional dependency
    const RedisStoreModule = await import('connect-redis');
    const RedisStore = RedisStoreModule.default;

    const store = new RedisStore({
      client: redisClient,
      prefix: 'session:',
      ttl: 24 * 60 * 60, // 24 hours (in seconds)
    });

    log.info('✅ Using Redis session store (distributed sessions enabled)');
    return store;
  } catch (error) {
    log.error('❌ Failed to create Redis session store:', { error });
    log.warn('⚠️  Falling back to in-memory session store');
    log.warn('   To fix: npm install connect-redis --save');
    return undefined;
  }
}
