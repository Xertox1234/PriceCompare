/**
 * Redis-based Rate Limiter
 *
 * Provides distributed rate limiting using Redis with fallback to in-memory storage.
 * Uses sliding window counter algorithm for accurate rate limiting.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisConnected, REDIS_KEYS } from '../config/redis';
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';
import { createLogger } from '../utils/logger';

const log = createLogger('RateLimiter');

interface RateLimitOptions {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window (for default/free tier)
  message?: string;     // Error message
  keyGenerator?: (req: Request) => string; // Custom key generator
  tiers?: RateLimitTiers; // Optional tiered limits based on user role
}

interface RateLimitInfo {
  remaining: number;
  reset: number;
  total: number;
  tier?: string; // Which tier was applied
}

interface RateLimitTiers {
  free?: number;      // Free tier limit
  user?: number;      // Basic user limit (default from maxRequests)
  premium?: number;   // Premium user limit
  moderator?: number; // Moderator limit
  admin?: number;     // Admin limit (set very high or 0 for unlimited)
}

/**
 * In-memory fallback storage
 * Used when Redis is not available
 */
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();
const MAX_MEMORY_ENTRIES = 10000; // Prevent memory exhaustion

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of Array.from(inMemoryStore.entries())) {
    if (value.resetTime < now) {
      inMemoryStore.delete(key);
      cleaned++;
    }
  }

  // If still over limit, remove oldest entries
  if (inMemoryStore.size > MAX_MEMORY_ENTRIES) {
    const toRemove = inMemoryStore.size - MAX_MEMORY_ENTRIES;
    const keys = Array.from(inMemoryStore.keys()).slice(0, toRemove);
    keys.forEach(key => inMemoryStore.delete(key));
    cleaned += toRemove;
  }

  if (cleaned > 0) {
    log.info(`Cleaned ${cleaned} expired rate limit entries from memory`);
  }
}, 60000);

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Get rate limit based on user tier
 */
function getRateLimitForUser(req: Request, options: RateLimitOptions): { limit: number; tier: string } {
  // If no tiers defined, use default
  if (!options.tiers) {
    return { limit: options.maxRequests, tier: 'default' };
  }

  // Get user role from request (set by auth middleware)
  const userRole = (req.user as any)?.role || 'free';

  // Map role to tier limit
  const tierLimits: { [key: string]: number } = {
    admin: options.tiers.admin || options.maxRequests * 100, // 100x default for admins
    moderator: options.tiers.moderator || options.maxRequests * 10, // 10x for moderators
    premium: options.tiers.premium || options.maxRequests * 5, // 5x for premium
    user: options.tiers.user || options.maxRequests,
    free: options.tiers.free || Math.floor(options.maxRequests * 0.5), // Half for free tier
  };

  const limit = tierLimits[userRole] || tierLimits.free;

  // If limit is 0, treat as unlimited (use maximum safe integer)
  return {
    limit: limit === 0 ? Number.MAX_SAFE_INTEGER : limit,
    tier: userRole
  };
}

/**
 * Check and increment rate limit using Redis
 */
async function checkRateLimitRedis(
  key: string,
  options: RateLimitOptions
): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const redis = getRedisClient();
  if (!redis) {
    return checkRateLimitMemory(key, options);
  }

  try {
    const redisKey = REDIS_KEYS.RATE_LIMIT(key);
    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Use Redis sorted set for sliding window
    const multi = redis.multi();

    // Remove old entries outside the window
    multi.zremrangebyscore(redisKey, 0, windowStart);

    // Count current requests in window
    multi.zcard(redisKey);

    // Add current request
    multi.zadd(redisKey, now, `${now}-${Math.random()}`);

    // Set expiration
    multi.expire(redisKey, Math.ceil(options.windowMs / 1000));

    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis multi exec returned null');
    }

    // Get count after removing old entries (index 1)
    const count = (results[1][1] as number) || 0;

    const allowed = count < options.maxRequests;
    const remaining = Math.max(0, options.maxRequests - count - 1);
    const reset = now + options.windowMs;

    return {
      allowed,
      info: {
        remaining,
        reset,
        total: options.maxRequests,
      },
    };
  } catch (error) {
    log.error('Redis rate limit error:', { error });
    // Fallback to in-memory
    return checkRateLimitMemory(key, options);
  }
}

/**
 * Check and increment rate limit using in-memory storage
 */
function checkRateLimitMemory(
  key: string,
  options: RateLimitOptions
): { allowed: boolean; info: RateLimitInfo } {
  const now = Date.now();
  const record = inMemoryStore.get(key);

  // Check if we need to reset
  if (!record || record.resetTime < now) {
    const resetTime = now + options.windowMs;
    inMemoryStore.set(key, { count: 1, resetTime });

    return {
      allowed: true,
      info: {
        remaining: options.maxRequests - 1,
        reset: resetTime,
        total: options.maxRequests,
      },
    };
  }

  // Increment count
  record.count++;

  const allowed = record.count <= options.maxRequests;
  const remaining = Math.max(0, options.maxRequests - record.count);

  return {
    allowed,
    info: {
      remaining,
      reset: record.resetTime,
      total: options.maxRequests,
    },
  };
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(options: RateLimitOptions) {
  const keyGen = options.keyGenerator || defaultKeyGenerator;
  const message = options.message || 'Too many requests, please try again later';

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGen(req);

      // Get tier-based rate limit for this user
      const { limit, tier } = getRateLimitForUser(req, options);

      // Create options with the user's specific limit
      const userOptions = { ...options, maxRequests: limit };

      const { allowed, info } = await checkRateLimitRedis(key, userOptions);

      // Add rate limit headers (including tier information)
      res.setHeader('X-RateLimit-Limit', info.total);
      res.setHeader('X-RateLimit-Remaining', info.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.reset / 1000));
      res.setHeader('X-RateLimit-Tier', tier);

      if (!allowed) {
        // SECURITY: Log rate limit exceeded
        logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, req, {
          success: false,
          message: 'Rate limit exceeded',
          metadata: {
            method: req.method,
            path: req.path,
            limit: info.total,
            remaining: info.remaining,
            resetTime: new Date(info.reset).toISOString(),
          }
        });

        res.status(429).json({
          error: message,
          retryAfter: Math.ceil((info.reset - Date.now()) / 1000),
        });
        return;
      }

      next();
    } catch (error) {
      log.error('Rate limiter error:', { error });
      // On error, allow request to proceed (fail open)
      next();
    }
  };
}

/**
 * Helper to create common rate limiters
 */
export const RateLimiters = {
  /**
   * Strict rate limiter for authentication endpoints
   */
  auth: () => createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    message: 'Too many authentication attempts, please try again later',
  }),

  /**
   * General API rate limiter
   */
  api: () => createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests from this IP, please try again later',
  }),

  /**
   * Strict rate limiter for sensitive operations
   */
  sensitive: () => createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    message: 'Rate limit exceeded for this operation',
  }),
};
