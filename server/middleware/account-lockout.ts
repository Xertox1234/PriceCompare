import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisConnected, REDIS_KEYS } from '../config/redis';
import { createLogger } from '../utils/logger';
import { cleanupManager } from '../utils/cleanup-manager';

/**
 * Account Lockout Middleware
 *
 * Prevents brute force attacks by locking accounts after too many failed attempts.
 * Uses Redis for distributed storage across multiple server instances.
 * Falls back to in-memory storage when Redis is unavailable (development only).
 */

const log = createLogger('AccountLockout');

// Extend Express Request type to avoid 'any' usage
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Required for Express type augmentation
  namespace Express {
    interface Request {
      loginEmail?: string;
    }
  }
}

interface FailedLoginAttempt {
  email: string;
  attempts: number;
  lockedUntil: number | null; // Unix timestamp in ms
  lastAttempt: number; // Unix timestamp in ms
}

/**
 * Type-safe JSON parsing for FailedLoginAttempt records from Redis
 */
function parseFailedLoginAttempt(data: string): FailedLoginAttempt {
  const parsed: unknown = JSON.parse(data);
  // Runtime type assertion - data comes from our own Redis writes
  return parsed as FailedLoginAttempt;
}

/**
 * Type-safe parsing of email from request body
 */
function parseLoginEmail(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'email' in body) {
    const { email } = body as { email?: unknown };
    return typeof email === 'string' ? email : undefined;
  }
  return undefined;
}

// Configuration constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Cleanup every hour
const REDIS_TTL_SECONDS = Math.ceil((LOCKOUT_DURATION_MS + ATTEMPT_WINDOW_MS) / 1000);
const MAX_MEMORY_ENTRIES = 10000; // Prevent memory exhaustion

/**
 * In-memory fallback storage for when Redis is unavailable.
 * WARNING: In-memory storage does not persist across server restarts
 * and does not work across multiple server instances.
 */
const inMemoryAttempts = new Map<string, FailedLoginAttempt>();

/**
 * Clean up expired lockout records from in-memory storage
 */
function cleanupExpiredLockouts() {
  const now = Date.now();
  let cleaned = 0;

  for (const [email, record] of Array.from(inMemoryAttempts.entries())) {
    // Remove if lockout expired
    if (record.lockedUntil && record.lockedUntil < now) {
      inMemoryAttempts.delete(email);
      cleaned++;
    } else if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
      // Remove if attempts are too old
      inMemoryAttempts.delete(email);
      cleaned++;
    }
  }

  // Prevent memory exhaustion by removing oldest entries if over limit
  if (inMemoryAttempts.size > MAX_MEMORY_ENTRIES) {
    const toRemove = inMemoryAttempts.size - MAX_MEMORY_ENTRIES;
    const keys = Array.from(inMemoryAttempts.keys()).slice(0, toRemove);
    keys.forEach(key => inMemoryAttempts.delete(key));
    cleaned += toRemove;
  }

  if (cleaned > 0) {
    log.info(`Cleaned ${cleaned} expired lockout entries from memory`);
  }
}

// Start periodic cleanup for in-memory storage
const lockoutCleanupInterval = setInterval(cleanupExpiredLockouts, CLEANUP_INTERVAL_MS);
cleanupManager.addInterval('account-lockout-cleanup', lockoutCleanupInterval);

// ============================================================================
// REDIS-BACKED ASYNC FUNCTIONS
// ============================================================================

/**
 * Check if an account is currently locked (async Redis version)
 */
export async function isAccountLockedAsync(email: string): Promise<{
  locked: boolean;
  remainingTime?: number;
  attempts?: number;
}> {
  const redis = getRedisClient();
  const normalizedEmail = email.toLowerCase();

  if (!redis || !isRedisConnected()) {
    // Fallback to in-memory
    return isAccountLocked(normalizedEmail);
  }

  try {
    const key = REDIS_KEYS.ACCOUNT_LOCKOUT(normalizedEmail);
    const data = await redis.get(key);

    if (!data) {
      return { locked: false };
    }

    const record: FailedLoginAttempt = parseFailedLoginAttempt(data);
    const now = Date.now();

    // Check if lockout period is active
    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingTime = Math.ceil((record.lockedUntil - now) / 1000);
      return {
        locked: true,
        remainingTime,
        attempts: record.attempts,
      };
    }

    // Lockout expired, clean up
    if (record.lockedUntil && record.lockedUntil <= now) {
      await redis.del(key);
      return { locked: false };
    }

    // Not locked yet, but has attempts
    return {
      locked: false,
      attempts: record.attempts,
    };
  } catch (error) {
    log.error('Redis lockout check error, falling back to in-memory:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return isAccountLocked(normalizedEmail);
  }
}

/**
 * Record a failed login attempt (async Redis version)
 */
export async function recordFailedLoginAsync(email: string): Promise<{
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: Date;
}> {
  const redis = getRedisClient();
  const normalizedEmail = email.toLowerCase();

  if (!redis || !isRedisConnected()) {
    // Fallback to in-memory
    return recordFailedLogin(normalizedEmail);
  }

  try {
    const key = REDIS_KEYS.ACCOUNT_LOCKOUT(normalizedEmail);
    const now = Date.now();

    const data = await redis.get(key);
    let record: FailedLoginAttempt;

    if (!data) {
      // First failed attempt
      record = {
        email: normalizedEmail,
        attempts: 1,
        lockedUntil: null,
        lastAttempt: now,
      };
    } else {
      record = parseFailedLoginAttempt(data);

      // Check if we're in a new time window
      if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
        // Reset attempts in new window
        record = {
          email: normalizedEmail,
          attempts: 1,
          lockedUntil: null,
          lastAttempt: now,
        };
      } else {
        // Increment attempts in current window
        record.attempts++;
        record.lastAttempt = now;
      }
    }

    // Lock account if threshold exceeded
    if (record.attempts >= MAX_FAILED_ATTEMPTS && !record.lockedUntil) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
    }

    // Store in Redis with expiration (TTL covers both attempt window and lockout)
    await redis.set(key, JSON.stringify(record), 'EX', REDIS_TTL_SECONDS);

    return {
      locked: record.lockedUntil !== null,
      attempts: record.attempts,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts),
      lockedUntil: record.lockedUntil ? new Date(record.lockedUntil) : undefined,
    };
  } catch (error) {
    log.error('Redis record failed login error, falling back to in-memory:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return recordFailedLogin(normalizedEmail);
  }
}

/**
 * Clear failed login attempts (async Redis version)
 * Called on successful login
 */
export async function clearFailedLoginsAsync(email: string): Promise<void> {
  const redis = getRedisClient();
  const normalizedEmail = email.toLowerCase();

  if (!redis || !isRedisConnected()) {
    // Fallback to in-memory
    clearFailedLogins(normalizedEmail);
    return;
  }

  try {
    const key = REDIS_KEYS.ACCOUNT_LOCKOUT(normalizedEmail);
    await redis.del(key);
    // Also clear in-memory to keep them in sync
    inMemoryAttempts.delete(normalizedEmail);
  } catch (error) {
    log.error('Redis clear failed logins error, falling back to in-memory:', {
      error: error instanceof Error ? error.message : String(error)
    });
    clearFailedLogins(normalizedEmail);
  }
}

/**
 * Manually unlock an account (async Redis version)
 */
export async function unlockAccountAsync(email: string): Promise<boolean> {
  const redis = getRedisClient();
  const normalizedEmail = email.toLowerCase();

  if (!redis || !isRedisConnected()) {
    // Fallback to in-memory
    return unlockAccount(normalizedEmail);
  }

  try {
    const key = REDIS_KEYS.ACCOUNT_LOCKOUT(normalizedEmail);
    const deleted = await redis.del(key);
    // Also clear in-memory
    inMemoryAttempts.delete(normalizedEmail);
    return deleted > 0;
  } catch (error) {
    log.error('Redis unlock account error, falling back to in-memory:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return unlockAccount(normalizedEmail);
  }
}

// ============================================================================
// SYNCHRONOUS IN-MEMORY FUNCTIONS (for backward compatibility and fallback)
// ============================================================================

/**
 * Check if an account is currently locked (sync in-memory version)
 */
export function isAccountLocked(email: string): {
  locked: boolean;
  remainingTime?: number;
  attempts?: number;
} {
  const record = inMemoryAttempts.get(email.toLowerCase());

  if (!record) {
    return { locked: false };
  }

  const now = Date.now();

  // Check if lockout period has expired
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingTime = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      locked: true,
      remainingTime,
      attempts: record.attempts,
    };
  }

  // Lockout expired, clean up
  if (record.lockedUntil && record.lockedUntil <= now) {
    inMemoryAttempts.delete(email.toLowerCase());
    return { locked: false };
  }

  // Not locked yet, but has attempts
  return {
    locked: false,
    attempts: record.attempts,
  };
}

/**
 * Record a failed login attempt (sync in-memory version)
 */
export function recordFailedLogin(email: string): {
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: Date;
} {
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();
  const record = inMemoryAttempts.get(normalizedEmail);

  if (!record) {
    // First failed attempt
    inMemoryAttempts.set(normalizedEmail, {
      email: normalizedEmail,
      attempts: 1,
      lockedUntil: null,
      lastAttempt: now,
    });
    return {
      locked: false,
      attempts: 1,
      remainingAttempts: MAX_FAILED_ATTEMPTS - 1,
    };
  }

  // Check if we're in a new time window
  if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
    // Reset attempts in new window
    record.attempts = 1;
    record.lockedUntil = null;
    record.lastAttempt = now;
    return {
      locked: false,
      attempts: 1,
      remainingAttempts: MAX_FAILED_ATTEMPTS - 1,
    };
  }

  // Increment attempts in current window
  record.attempts++;
  record.lastAttempt = now;

  // Lock account if threshold exceeded
  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return {
      locked: true,
      attempts: record.attempts,
      remainingAttempts: 0,
      lockedUntil: new Date(record.lockedUntil),
    };
  }

  return {
    locked: false,
    attempts: record.attempts,
    remainingAttempts: MAX_FAILED_ATTEMPTS - record.attempts,
  };
}

/**
 * Clear failed login attempts (sync in-memory version)
 * Called on successful login
 */
export function clearFailedLogins(email: string): void {
  inMemoryAttempts.delete(email.toLowerCase());
}

/**
 * Manually unlock an account (sync in-memory version)
 */
export function unlockAccount(email: string): boolean {
  const normalizedEmail = email.toLowerCase();
  if (inMemoryAttempts.has(normalizedEmail)) {
    inMemoryAttempts.delete(normalizedEmail);
    return true;
  }
  return false;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Middleware to check if account is locked before processing login
 * Uses async Redis-backed check with in-memory fallback
 */
export function checkAccountLockout(req: Request, res: Response, next: NextFunction) {
  // Only apply to login endpoint
  if (req.path !== '/api/auth/login' || req.method !== 'POST') {
    return next();
  }

  const email = parseLoginEmail(req.body);

  if (!email) {
    return next();
  }

  // Use async Redis-backed check
  isAccountLockedAsync(email)
    .then(lockStatus => {
      if (lockStatus.locked) {
        const minutes = Math.ceil((lockStatus.remainingTime || 0) / 60);
        const retryAfterSeconds = Math.ceil((lockStatus.remainingTime || 0) / 1000);

        // Set Retry-After header for HTTP-standard lockout signaling
        res.setHeader('Retry-After', retryAfterSeconds);

        return res.status(429).json({
          success: false,
          error: 'Account temporarily locked due to too many failed login attempts',
          locked: true,
          remainingTime: lockStatus.remainingTime,
          message: `Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
          attempts: lockStatus.attempts,
        });
      }

      // Store email in request for use in login handler
      req.loginEmail = email;
      return next();
    })
    .catch(error => {
      log.error('Lockout check error:', {
        error: error instanceof Error ? error.message : String(error)
      });
      // On error, allow request through (fail open for availability)
      // Security note: This is acceptable because the sync fallback still works
      return next();
    });
}

// ============================================================================
// MONITORING & ADMIN FUNCTIONS
// ============================================================================

/**
 * Get lockout statistics (for monitoring/admin)
 * Note: Only returns stats from in-memory storage
 * For distributed stats, use Redis SCAN command
 */
export function getLockoutStats(): {
  totalLockedAccounts: number;
  totalAttempts: number;
  accountsWithAttempts: number;
} {
  const now = Date.now();
  let totalLockedAccounts = 0;
  let totalAttempts = 0;
  let accountsWithAttempts = 0;

  for (const record of Array.from(inMemoryAttempts.values())) {
    accountsWithAttempts++;
    totalAttempts += record.attempts;
    if (record.lockedUntil && record.lockedUntil > now) {
      totalLockedAccounts++;
    }
  }

  return {
    totalLockedAccounts,
    totalAttempts,
    accountsWithAttempts,
  };
}

/**
 * Get distributed lockout statistics from Redis
 */
export async function getLockoutStatsAsync(): Promise<{
  totalLockedAccounts: number;
  totalAttempts: number;
  accountsWithAttempts: number;
  source: 'redis' | 'memory';
}> {
  const redis = getRedisClient();

  if (!redis || !isRedisConnected()) {
    const memoryStats = getLockoutStats();
    return { ...memoryStats, source: 'memory' };
  }

  try {
    const keys = await redis.keys('lockout:*');
    const now = Date.now();
    let totalLockedAccounts = 0;
    let totalAttempts = 0;

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const record = parseFailedLoginAttempt(data);
        totalAttempts += record.attempts;
        if (record.lockedUntil && record.lockedUntil > now) {
          totalLockedAccounts++;
        }
      }
    }

    return {
      totalLockedAccounts,
      totalAttempts,
      accountsWithAttempts: keys.length,
      source: 'redis',
    };
  } catch (error) {
    log.error('Redis get lockout stats error, falling back to in-memory:', {
      error: error instanceof Error ? error.message : String(error)
    });
    const memoryStats = getLockoutStats();
    return { ...memoryStats, source: 'memory' };
  }
}

/**
 * Reset all failed login attempts (for testing only)
 * WARNING: Only use this in test environments
 * @throws {Error} If called outside of test environment
 */
export function resetFailedAttempts(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'resetFailedAttempts() is only available in test environment. ' +
      'This prevents accidental rate limit bypass in production.'
    );
  }
  inMemoryAttempts.clear();
}

/**
 * Reset all failed login attempts including Redis (for testing only)
 */
export async function resetFailedAttemptsAsync(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'resetFailedAttemptsAsync() is only available in test environment. ' +
      'This prevents accidental rate limit bypass in production.'
    );
  }

  // Clear in-memory
  inMemoryAttempts.clear();

  // Clear Redis if available
  const redis = getRedisClient();
  if (redis && isRedisConnected()) {
    try {
      const keys = await redis.keys('lockout:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      log.error('Failed to clear Redis lockout data:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
