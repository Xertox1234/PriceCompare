/**
 * Redis-based Rate Limiter
 *
 * Provides distributed rate limiting using Redis with fallback to in-memory storage.
 * Uses sliding window counter algorithm for accurate rate limiting.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient, REDIS_KEYS } from '../config/redis';
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';
import { createLogger } from '../utils/logger';
import { cleanupManager } from '../utils/cleanup-manager';
import { RATE_LIMIT_TIERS } from '../utils/constants';
import { sendError } from '../utils/api-response';

const log = createLogger('RateLimiter');

/**
 * Configuration options for rate limiting
 */
interface RateLimitOptions {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window (for default/free tier)
  message?: string;     // Error message
  keyGenerator?: (req: Request) => string; // Custom key generator
  tiers?: RateLimitTiers; // Optional tiered limits based on user role
}

/**
 * Rate limit information returned to clients
 */
interface RateLimitInfo {
  remaining: number;
  reset: number;
  total: number;
  tier?: string; // Which tier was applied
}

/**
 * Rate limit tier configuration
 * Allows different limits based on user roles
 */
interface RateLimitTiers {
  /** Free tier users (no account or unauthenticated) */
  free?: number;
  /** Basic authenticated users */
  user?: number;
  /** Premium subscription users */
  premium?: number;
  /** Moderator users */
  moderator?: number;
  /** Admin users (can be 0 for unlimited) */
  admin?: number;
}

/**
 * In-memory fallback storage
 * Used when Redis is not available
 */
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();
const MAX_MEMORY_ENTRIES = 10000; // Prevent memory exhaustion

// Cleanup expired entries every 60 seconds
const redisRateLimitCleanupInterval = setInterval(() => {
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
cleanupManager.addInterval('redis-rate-limiter-cleanup', redisRateLimitCleanupInterval);

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Authenticated user interface for type safety
 */
interface AuthenticatedUser {
  id: number;
  role: string;
  username: string;
  email?: string;
}

/**
 * Get rate limit based on user tier
 *
 * Calculates the appropriate rate limit for a user based on their role/tier.
 * Uses tier multipliers from RATE_LIMIT_TIERS constant to scale the base limit.
 *
 * Tier calculation logic:
 * 1. If no tiers configured, use default maxRequests
 * 2. Extract user role from req.user (set by auth middleware)
 * 3. Apply tier multiplier to base maxRequests
 * 4. Allow custom tier overrides via options.tiers
 * 5. Default to 'free' tier if user not authenticated
 *
 * Security considerations:
 * - Validates role is a string with max length 20 to prevent injection
 * - Defaults to most restrictive tier (free) on invalid input
 * - Treats limit of 0 as unlimited (for admin overrides)
 *
 * @param req - Express request object with optional user property
 * @param options - Rate limit configuration with optional tier overrides
 * @returns Object containing calculated limit and applied tier name
 *
 * @example
 * // Anonymous user with base limit 100
 * getRateLimitForUser(req, { maxRequests: 100, tiers: {} })
 * // Returns: { limit: 50, tier: 'free' } (0.5x multiplier)
 *
 * @example
 * // Admin user with base limit 100
 * getRateLimitForUser(req, { maxRequests: 100, tiers: {} })
 * // Returns: { limit: 10000, tier: 'admin' } (100x multiplier)
 */
function getRateLimitForUser(req: Request, options: RateLimitOptions): { limit: number; tier: string } {
  // If no tiers defined, use default
  if (!options.tiers) {
    return { limit: options.maxRequests, tier: 'default' };
  }

  // Get user role from request (set by auth middleware)
  // Validate it's a safe string value
  let userRole = ((req.user as AuthenticatedUser)?.role || 'free').toLowerCase();
  if (typeof userRole !== 'string' || userRole.length > 20) {
    userRole = 'free';
  }

  // Calculate limit based on tier (custom or multiplier-based)
  let limit: number;

  switch (userRole) {
    case 'admin':
      limit = options.tiers.admin ?? options.maxRequests * RATE_LIMIT_TIERS.admin.multiplier;
      break;
    case 'moderator':
      limit = options.tiers.moderator ?? options.maxRequests * RATE_LIMIT_TIERS.moderator.multiplier;
      break;
    case 'premium':
      limit = options.tiers.premium ?? options.maxRequests * RATE_LIMIT_TIERS.premium.multiplier;
      break;
    case 'user':
      limit = options.tiers.user ?? options.maxRequests * RATE_LIMIT_TIERS.user.multiplier;
      break;
    case 'free':
    default:
      limit = options.tiers.free ?? Math.floor(options.maxRequests * RATE_LIMIT_TIERS.free.multiplier);
      break;
  }

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
 * Create a rate limiter middleware with tiered limits
 *
 * Creates an Express middleware that enforces rate limits based on user tier/role.
 * Uses Redis for distributed rate limiting (with in-memory fallback) and implements
 * a sliding window counter algorithm for accurate rate tracking.
 *
 * Tiered Rate Limiting:
 * - Automatically adjusts rate limits based on user authentication and role
 * - Uses tier multipliers from RATE_LIMIT_TIERS constant
 * - Anonymous/free users: 0.5x base limit (most restrictive)
 * - Standard users: 1x base limit (baseline)
 * - Premium users: 5x base limit
 * - Moderators: 10x base limit
 * - Admins: 100x base limit (least restrictive)
 *
 * Response Headers:
 * - X-RateLimit-Limit: Total requests allowed in window
 * - X-RateLimit-Remaining: Requests remaining in current window
 * - X-RateLimit-Reset: Timestamp when window resets (Unix seconds)
 * - X-RateLimit-Tier: Applied tier (free/user/premium/moderator/admin)
 *
 * Storage Strategy:
 * 1. Attempts Redis-based rate limiting (distributed, multi-server safe)
 * 2. Falls back to in-memory storage if Redis unavailable (single server only)
 * 3. Fails open on errors (allows request to proceed) to prevent DoS
 *
 * Security Features:
 * - Logs rate limit violations for security monitoring
 * - Validates user roles to prevent privilege escalation
 * - Returns 429 status with retry-after header when limit exceeded
 * - Uses IP address as fallback identifier for unauthenticated users
 *
 * @param options - Rate limit configuration
 * @param options.windowMs - Time window in milliseconds (e.g., 15 * 60 * 1000 for 15 minutes)
 * @param options.maxRequests - Maximum requests per window for baseline tier
 * @param options.message - Optional custom error message for rate limit exceeded
 * @param options.keyGenerator - Optional custom key generator function (defaults to IP address)
 * @param options.tiers - Optional custom tier limits (overrides multiplier-based calculation)
 *
 * @returns Express middleware function
 *
 * @example
 * // General API rate limiting with tiered limits
 * app.use('/api', createRateLimiter({
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   maxRequests: 100, // 100 for users, 50 for free, 500 for premium
 *   tiers: {}, // Enable tiered limits with default multipliers
 * }));
 *
 * @example
 * // Strict auth endpoint limiting (no tiers)
 * app.use('/api/auth', createRateLimiter({
 *   windowMs: 15 * 60 * 1000,
 *   maxRequests: 10, // Same for all users
 *   // No tiers = strict limit for security
 * }));
 *
 * @example
 * // Custom tier limits
 * app.use('/api/premium', createRateLimiter({
 *   windowMs: 60 * 1000,
 *   maxRequests: 100,
 *   tiers: {
 *     premium: 1000, // Override: premium gets 1000 instead of 500
 *     user: 0, // Override: block non-premium users
 *   },
 * }));
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

        const retryAfter = Math.ceil((info.reset - Date.now()) / 1000);

        // Set HTTP standard Retry-After header
        res.setHeader('Retry-After', retryAfter);

        sendError(res, message, 429, {
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter
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
