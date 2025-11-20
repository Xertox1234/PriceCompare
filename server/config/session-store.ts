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
 * @throws Error in production if Redis is not available
 */
export async function createSessionStore(
  redisSessionClient: RedisClientType | null
): Promise<session.Store | undefined> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!redisSessionClient) {
    // CRITICAL: Fail fast in production if Redis unavailable
    if (isProduction) {
      log.error('❌ FATAL: Redis session client not available in production');
      log.error('   Production requires Redis for distributed session storage');
      log.error('   Sessions MUST persist across server restarts and multiple instances');
      throw new Error('Redis session client is required in production but not available');
    }

    // Development: Allow fallback with warnings
    log.warn('⚠️  Redis not available, using in-memory session store');
    log.warn('   ⚠️  WARNING: In-memory sessions are NOT suitable for production');
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
    const errorMsg = error instanceof Error ? error.message : String(error);

    // CRITICAL: Fail fast in production if Redis store creation fails
    if (isProduction) {
      log.error('❌ FATAL: Failed to initialize Redis session store in production');
      log.error(`   Error: ${errorMsg}`);
      throw new Error(`Redis session store initialization failed: ${errorMsg}`);
    }

    log.error('Failed to initialize Redis session store:', { error: errorMsg });
    log.warn('Falling back to in-memory session store');
    return undefined;
  }
}
