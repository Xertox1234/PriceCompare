import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq, and, gt } from 'drizzle-orm';

/**
 * Account Lockout Middleware
 * Prevents brute force attacks by locking accounts after too many failed attempts
 */

interface FailedLoginAttempt {
  email: string;
  attempts: number;
  lockedUntil: Date | null;
  lastAttempt: Date;
}

// In-memory storage for failed login attempts
// In production, this should be Redis-based for scalability
const failedAttempts = new Map<string, FailedLoginAttempt>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Cleanup every hour

/**
 * Clean up expired lockout records
 */
function cleanupExpiredLockouts() {
  const now = new Date();
  for (const [email, record] of failedAttempts.entries()) {
    // Remove if lockout expired or attempts are too old
    if (record.lockedUntil && record.lockedUntil < now) {
      failedAttempts.delete(email);
    } else if (now.getTime() - record.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
      failedAttempts.delete(email);
    }
  }
}

// Start periodic cleanup
setInterval(cleanupExpiredLockouts, CLEANUP_INTERVAL_MS);

/**
 * Check if an account is currently locked
 */
export function isAccountLocked(email: string): {
  locked: boolean;
  remainingTime?: number;
  attempts?: number;
} {
  const record = failedAttempts.get(email.toLowerCase());

  if (!record) {
    return { locked: false };
  }

  const now = new Date();

  // Check if lockout period has expired
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingTime = Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000);
    return {
      locked: true,
      remainingTime,
      attempts: record.attempts
    };
  }

  // Lockout expired, clean up
  if (record.lockedUntil && record.lockedUntil <= now) {
    failedAttempts.delete(email.toLowerCase());
    return { locked: false };
  }

  // Not locked yet, but has attempts
  return {
    locked: false,
    attempts: record.attempts
  };
}

/**
 * Record a failed login attempt
 */
export function recordFailedLogin(email: string): {
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: Date;
} {
  const normalizedEmail = email.toLowerCase();
  const now = new Date();
  const record = failedAttempts.get(normalizedEmail);

  if (!record) {
    // First failed attempt
    failedAttempts.set(normalizedEmail, {
      email: normalizedEmail,
      attempts: 1,
      lockedUntil: null,
      lastAttempt: now
    });
    return {
      locked: false,
      attempts: 1,
      remainingAttempts: MAX_FAILED_ATTEMPTS - 1
    };
  }

  // Check if we're in a new time window
  if (now.getTime() - record.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
    // Reset attempts in new window
    record.attempts = 1;
    record.lockedUntil = null;
    record.lastAttempt = now;
    return {
      locked: false,
      attempts: 1,
      remainingAttempts: MAX_FAILED_ATTEMPTS - 1
    };
  }

  // Increment attempts in current window
  record.attempts++;
  record.lastAttempt = now;

  // Lock account if threshold exceeded
  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
    return {
      locked: true,
      attempts: record.attempts,
      remainingAttempts: 0,
      lockedUntil: record.lockedUntil
    };
  }

  return {
    locked: false,
    attempts: record.attempts,
    remainingAttempts: MAX_FAILED_ATTEMPTS - record.attempts
  };
}

/**
 * Clear failed login attempts (called on successful login)
 */
export function clearFailedLogins(email: string): void {
  failedAttempts.delete(email.toLowerCase());
}

/**
 * Middleware to check if account is locked before processing login
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

  const lockStatus = isAccountLocked(email);

  if (lockStatus.locked) {
    const minutes = Math.ceil((lockStatus.remainingTime || 0) / 60);
    return res.status(429).json({
      error: 'Account temporarily locked due to too many failed login attempts',
      locked: true,
      remainingTime: lockStatus.remainingTime,
      message: `Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
      attempts: lockStatus.attempts
    });
  }

  // Store email in request for use in login handler
  (req as any).loginEmail = email;
  next();
}

/**
 * Get lockout statistics (for monitoring/admin)
 */
export function getLockoutStats(): {
  totalLockedAccounts: number;
  totalAttempts: number;
  accountsWithAttempts: number;
} {
  const now = new Date();
  let totalLockedAccounts = 0;
  let totalAttempts = 0;
  let accountsWithAttempts = 0;

  for (const record of failedAttempts.values()) {
    accountsWithAttempts++;
    totalAttempts += record.attempts;
    if (record.lockedUntil && record.lockedUntil > now) {
      totalLockedAccounts++;
    }
  }

  return {
    totalLockedAccounts,
    totalAttempts,
    accountsWithAttempts
  };
}

/**
 * Manually unlock an account (admin function)
 */
export function unlockAccount(email: string): boolean {
  const normalizedEmail = email.toLowerCase();
  if (failedAttempts.has(normalizedEmail)) {
    failedAttempts.delete(normalizedEmail);
    return true;
  }
  return false;
}
