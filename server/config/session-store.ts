/**
 * Session Store Configuration
 *
 * Provides Redis-based session storage with automatic fallback to in-memory.
 * Redis session store enables distributed sessions across multiple server instances.
 */

import type { RedisClientType } from 'redis';
import type session from 'express-session';
import { createLogger } from '../utils/logger';

const log = createLogger('SessionStore');

/**
 * Create session store (Redis or in-memory fallback)
 *
 * @param redisSessionClient Redis client instance from 'redis' package (or null if unavailable)
 * @returns Session store or undefined (express-session will use MemoryStore)
 */
export async function createSessionStore(
  redisSessionClient: RedisClientType | null
): Promise<session.Store | undefined> {
  if (!redisSessionClient) {
    log.warn('⚠️  Redis not available, using in-memory session store');
    log.warn('   Sessions will not persist across server restarts');
    log.warn('   Sessions will not work with multiple server instances');
    return undefined; // express-session will use MemoryStore
  }

  try {
    // Dynamically import connect-redis v9 (requires 'redis' package client)
    const { RedisStore } = await import('connect-redis');

    // Create and return RedisStore instance
    // connect-redis v9 requires RedisClientType from 'redis' package
    const store = new RedisStore({
      client: redisSessionClient,
      prefix: 'sess:',
      ttl: 86400, // 1 day in seconds
    });

    log.info('✅ Redis session store initialized successfully');
    return store;
  } catch (error) {
    log.error('Failed to initialize Redis session store:', {
      error: error instanceof Error ? error.message : String(error)
    });
    log.warn('Falling back to in-memory session store');
    return undefined;
  }
}
