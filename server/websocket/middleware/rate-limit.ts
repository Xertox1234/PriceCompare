/**
 * WebSocket Rate Limiting Middleware
 *
 * Provides reusable rate limiting for WebSocket events using Redis.
 * Falls back to in-memory tracking if Redis is unavailable.
 *
 * Usage:
 *   if (!await checkRateLimit('subscribe:watchlist', socket.userId, 10, 1)) {
 *     socket.emit('error', { message: 'Rate limit exceeded' });
 *     return;
 *   }
 */

import { getRedisClient } from '../../config/redis';
import { createLogger } from '../../utils/logger';

const log = createLogger('WebSocket:RateLimit');

// In-memory fallback for when Redis is unavailable
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if a WebSocket event is within rate limit
 *
 * @param eventType Event type identifier (e.g., 'subscribe:watchlist')
 * @param userId User ID making the request
 * @param maxRequests Maximum number of requests allowed
 * @param windowSeconds Time window in seconds
 * @returns true if within limit, false if exceeded
 */
export async function checkRateLimit(
  eventType: string,
  userId: number,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const key = `ws:ratelimit:${eventType}:${userId}`;
  const redisClient = getRedisClient();

  try {
    if (redisClient) {
      // Redis-based rate limiting (distributed)
      const current = await redisClient.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await redisClient.expire(key, windowSeconds);
      }

      const withinLimit = current <= maxRequests;

      if (!withinLimit) {
        log.warn('Rate limit exceeded (Redis)', {
          userId,
          eventType,
          count: current,
          limit: maxRequests,
        });
      }

      return withinLimit;
    } else {
      // In-memory rate limiting (single server fallback)
      const now = Date.now();
      const stored = memoryStore.get(key);

      // Clean up expired entries
      if (stored && stored.resetAt < now) {
        memoryStore.delete(key);
      }

      const current = stored && stored.resetAt >= now ? stored : null;

      if (current) {
        current.count++;

        if (current.count > maxRequests) {
          log.warn('Rate limit exceeded (in-memory)', {
            userId,
            eventType,
            count: current.count,
            limit: maxRequests,
          });
          return false;
        }
      } else {
        // Create new rate limit entry
        memoryStore.set(key, {
          count: 1,
          resetAt: now + windowSeconds * 1000,
        });
      }

      return true;
    }
  } catch (error) {
    log.error('Rate limit check failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      eventType,
    });

    // Allow request on error (fail open for availability)
    return true;
  }
}

/**
 * Clear rate limit for a specific user and event type
 *
 * Useful for testing or administrative resets
 */
export async function clearRateLimit(eventType: string, userId: number): Promise<void> {
  const key = `ws:ratelimit:${eventType}:${userId}`;
  const redisClient = getRedisClient();

  try {
    if (redisClient) {
      await redisClient.del(key);
    } else {
      memoryStore.delete(key);
    }

    log.debug('Rate limit cleared', { userId, eventType });
  } catch (error) {
    log.error('Failed to clear rate limit', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      eventType,
    });
  }
}

/**
 * Get current rate limit count for a user and event type
 *
 * Useful for monitoring and debugging
 */
export async function getRateLimitCount(eventType: string, userId: number): Promise<number> {
  const key = `ws:ratelimit:${eventType}:${userId}`;
  const redisClient = getRedisClient();

  try {
    if (redisClient) {
      const count = await redisClient.get(key);
      return count ? parseInt(count, 10) : 0;
    } else {
      const stored = memoryStore.get(key);
      if (!stored) return 0;

      const now = Date.now();
      if (stored.resetAt < now) {
        memoryStore.delete(key);
        return 0;
      }

      return stored.count;
    }
  } catch (error) {
    log.error('Failed to get rate limit count', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      eventType,
    });
    return 0;
  }
}

/**
 * Clean up expired in-memory rate limit entries
 *
 * Should be called periodically (e.g., every minute) to prevent memory leaks
 */
export function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt < now) {
      memoryStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    log.debug(`Cleaned up ${cleaned} expired rate limit entries`);
  }
}

// Run cleanup every minute if using in-memory storage
setInterval(cleanupExpiredRateLimits, 60000);
