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
  // TEMPORARY: Disable Redis session store due to compatibility issues
  // TODO: Fix connect-redis v9 + ioredis integration
  log.warn('⚠️  Using in-memory session store (Redis session store temporarily disabled)');
  log.warn('   Sessions will not persist across server restarts');
  log.warn('   Sessions will not work with multiple server instances');
  return undefined;

  /* Disabled for now - causing Redis syntax errors
  if (!redisClient) {
    log.warn('⚠️  Redis not available, using in-memory session store');
    log.warn('   Sessions will not persist across server restarts');
    log.warn('   Sessions will not work with multiple server instances');
    return undefined; // express-session will use MemoryStore
  }

  try {
    // Dynamically import connect-redis (compatible with ioredis and v9+)
    // connect-redis v9 exports RedisStore as a named export
    const { RedisStore } = await import('connect-redis');

    // Create and return RedisStore instance
    // connect-redis v9 works with ioredis directly
    const store = new RedisStore({
      client: redisClient,
      prefix: 'session:',
      ttl: 86400, // 1 day in seconds
    });

    log.info('✅ Redis session store initialized successfully');
    return store;
  } catch (error) {
    log.error('Failed to initialize Redis session store:', error);
    log.warn('Falling back to in-memory session store');
    return undefined;
  }
  */
}
