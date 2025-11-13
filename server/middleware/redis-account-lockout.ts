/**
 * Redis-based Account Lockout
 *
 * Provides distributed account lockout protection with Redis fallback to in-memory.
 * Prevents brute force attacks by locking accounts after too many failed attempts.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisConnected, REDIS_KEYS } from '../config/redis';
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window

/**
 * In-memory fallback storage
 */
interface FailedLoginAttempt {
  email: string;
  attempts: number;
  lockedUntil: Date | null;
  lastAttempt: Date;
}

const inMemoryAttempts = new Map<string, FailedLoginAttempt>();
const MAX_MEMORY_ENTRIES = 10000;

// Cleanup expired entries
setInterval(() => {
  const now = new Date();
  let cleaned = 0;

  for (const [email, record] of inMemoryAttempts.entries()) {
    if (record.lockedUntil && record.lockedUntil < now) {
      inMemoryAttempts.delete(email);
      cleaned++;
    } else if (now.getTime() - record.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
      inMemoryAttempts.delete(email);
      cleaned++;
    }
  }

  if (inMemoryAttempts.size > MAX_MEMORY_ENTRIES) {
    const toRemove = inMemoryAttempts.size - MAX_MEMORY_ENTRIES;
    const keys = Array.from(inMemoryAttempts.keys()).slice(0, toRemove);
    keys.forEach(key => inMemoryAttempts.delete(key));
    cleaned += toRemove;
  }

  if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} expired lockout entries from memory`);
  }
}, 60 * 60 * 1000); // Every hour

/**
 * Check if account is locked using Redis
 */
async function isAccountLockedRedis(email: string): Promise<{
  locked: boolean;
  remainingTime?: number;
  attempts?: number;
}> {
  const redis = getRedisClient();
  if (!redis) {
    return isAccountLockedMemory(email);
  }

  try {
    const key = REDIS_KEYS.ACCOUNT_LOCKOUT(email);
    const data = await redis.get(key);

    if (!data) {
      return { locked: false };
    }

    const record = JSON.parse(data);
    const now = Date.now();

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

    return {
      locked: false,
      attempts: record.attempts,
    };
  } catch (error) {
    console.error('Redis lockout check error:', error);
    return isAccountLockedMemory(email);
  }
}

/**
 * Check if account is locked using in-memory storage
 */
function isAccountLockedMemory(email: string): {
  locked: boolean;
  remainingTime?: number;
  attempts?: number;
} {
  const record = inMemoryAttempts.get(email.toLowerCase());

  if (!record) {
    return { locked: false };
  }

  const now = new Date();

  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingTime = Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000);
    return {
      locked: true,
      remainingTime,
      attempts: record.attempts,
    };
  }

  if (record.lockedUntil && record.lockedUntil <= now) {
    inMemoryAttempts.delete(email.toLowerCase());
    return { locked: false };
  }

  return {
    locked: false,
    attempts: record.attempts,
  };
}

/**
 * Record failed login attempt using Redis
 */
async function recordFailedLoginRedis(email: string): Promise<{
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: Date;
}> {
  const redis = getRedisClient();
  if (!redis) {
    return recordFailedLoginMemory(email);
  }

  try {
    const key = REDIS_KEYS.ACCOUNT_LOCKOUT(email);
    const now = Date.now();

    const data = await redis.get(key);
    let record = data ? JSON.parse(data) : null;

    // Check if in new time window
    if (!record || (now - record.lastAttempt) > ATTEMPT_WINDOW_MS) {
      record = {
        email,
        attempts: 1,
        lockedUntil: null,
        lastAttempt: now,
      };
    } else {
      record.attempts++;
      record.lastAttempt = now;
    }

    // Lock if threshold exceeded
    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
    }

    // Store in Redis with expiration
    await redis.set(
      key,
      JSON.stringify(record),
      'PX',
      LOCKOUT_DURATION_MS + ATTEMPT_WINDOW_MS
    );

    return {
      locked: record.lockedUntil !== null,
      attempts: record.attempts,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts),
      lockedUntil: record.lockedUntil ? new Date(record.lockedUntil) : undefined,
    };
  } catch (error) {
    console.error('Redis record failed login error:', error);
    return recordFailedLoginMemory(email);
  }
}

/**
 * Record failed login attempt using in-memory storage
 */
function recordFailedLoginMemory(email: string): {
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: Date;
} {
  const normalizedEmail = email.toLowerCase();
  const now = new Date();
  const record = inMemoryAttempts.get(normalizedEmail);

  if (!record || (now.getTime() - record.lastAttempt.getTime()) > ATTEMPT_WINDOW_MS) {
    const newRecord: FailedLoginAttempt = {
      email: normalizedEmail,
      attempts: 1,
      lockedUntil: null,
      lastAttempt: now,
    };
    inMemoryAttempts.set(normalizedEmail, newRecord);

    return {
      locked: false,
      attempts: 1,
      remainingAttempts: MAX_FAILED_ATTEMPTS - 1,
    };
  }

  record.attempts++;
  record.lastAttempt = now;

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
  }

  return {
    locked: record.lockedUntil !== null,
    attempts: record.attempts,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts),
    lockedUntil: record.lockedUntil || undefined,
  };
}

/**
 * Clear failed login attempts using Redis
 */
async function clearFailedLoginsRedis(email: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    clearFailedLoginsMemory(email);
    return;
  }

  try {
    const key = REDIS_KEYS.ACCOUNT_LOCKOUT(email);
    await redis.del(key);
  } catch (error) {
    console.error('Redis clear failed logins error:', error);
    clearFailedLoginsMemory(email);
  }
}

/**
 * Clear failed login attempts using in-memory storage
 */
function clearFailedLoginsMemory(email: string): void {
  inMemoryAttempts.delete(email.toLowerCase());
}

/**
 * Export public API
 */
export const accountLockout = {
  isLocked: isAccountLockedRedis,
  recordFailedLogin: recordFailedLoginRedis,
  clearFailedLogins: clearFailedLoginsRedis,
};

/**
 * Middleware to check account lockout before login
 */
export function checkAccountLockout(req: Request, res: Response, next: NextFunction) {
  // Only apply to login endpoint
  if (req.path !== '/api/auth/login' || req.method !== 'POST') {
    return next();
  }

  const { email } = req.body;

  if (!email) {
    return next();
  }

  isAccountLockedRedis(email)
    .then(lockStatus => {
      if (lockStatus.locked) {
        const minutes = Math.ceil((lockStatus.remainingTime || 0) / 60);

        // SECURITY: Log account lockout event
        logSecurityEvent(SecurityEventType.ACCOUNT_LOCKED, req, {
          email,
          success: false,
          message: 'Account locked due to too many failed attempts',
          metadata: {
            attempts: lockStatus.attempts,
            remainingTime: lockStatus.remainingTime,
            lockedMinutes: minutes,
          }
        });

        return res.status(429).json({
          error: 'Account temporarily locked due to too many failed login attempts',
          locked: true,
          remainingTime: lockStatus.remainingTime,
          message: `Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
          attempts: lockStatus.attempts,
        });
      }

      next();
    })
    .catch(error => {
      console.error('Lockout check error:', error);
      // On error, allow request (fail open)
      next();
    });
}
