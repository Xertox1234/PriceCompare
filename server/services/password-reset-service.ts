import * as crypto from 'crypto';
import { storage } from '../storage';
import type { PasswordResetToken } from '@shared/schema';
import { logger } from '../utils/logger';
import { clearUserSessions } from '../utils/session-cleanup';

/**
 * Password Reset Token Service
 * Handles secure token generation, validation, and cleanup
 */

// Token expiration time: 1 hour
const TOKEN_EXPIRATION_TIME = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Generate a cryptographically secure random token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a password reset token for a user
 * @param userId - The ID of the user requesting password reset
 * @param ipAddress - The IP address of the requester (for security logging)
 * @param userAgent - The user agent of the requester (for security logging)
 * @returns The generated token string
 */
export async function createPasswordResetToken(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_TIME);

  await storage.createPasswordResetToken(userId, token, expiresAt, {
    ipAddress,
    userAgent,
  });

  return token;
}

/**
 * Validate a password reset token
 * @param token - The token to validate
 * @returns The token record if valid, null otherwise
 */
export async function validatePasswordResetToken(
  token: string
): Promise<PasswordResetToken | null> {
  return storage.validatePasswordResetToken(token);
}

/**
 * Mark a password reset token as used
 * @param token - The token to mark as used
 */
export async function markTokenAsUsed(token: string): Promise<void> {
  await storage.markPasswordResetTokenAsUsed(token);
}

/**
 * Get the user associated with a valid token
 * @param token - The password reset token
 * @returns The user record if the token is valid, null otherwise
 */
export async function getUserByResetToken(token: string) {
  const tokenRecord = await storage.validatePasswordResetToken(token);

  if (!tokenRecord) {
    return null;
  }

  // SECURITY: getUserByIdSafe() never exposes passwordHash
  return storage.getUserByIdSafe(tokenRecord.userId);
}

/**
 * Clean up expired tokens (should be run periodically)
 * Removes tokens that have expired or been used
 */
export async function cleanupExpiredTokens(): Promise<number> {
  return storage.cleanupExpiredPasswordResetTokens();
}

/**
 * Check if a user has requested too many password resets recently
 * This helps prevent abuse
 * @param userId - The user ID to check
 * @param windowMinutes - The time window to check (default: 15 minutes)
 * @param maxAttempts - Maximum number of attempts allowed (default: 3)
 * @returns true if rate limit exceeded, false otherwise
 */
export async function isRateLimitExceeded(
  userId: number,
  windowMinutes = 15,
  maxAttempts = 3
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await storage.getPasswordResetAttemptCount(userId, since);
  return count >= maxAttempts;
}

/**
 * Get the number of password reset attempts for a user in a time window
 * @param userId - The user ID
 * @param windowMinutes - The time window in minutes (default: 15)
 * @returns The number of attempts
 */
export async function getResetAttemptCount(userId: number, windowMinutes = 15): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  return storage.getPasswordResetAttemptCount(userId, since);
}

/**
 * Reset password atomically with token validation
 *
 * SECURITY: This method performs all password reset steps atomically:
 * 1. Atomically validate token AND mark as used (single UPDATE with optimistic locking)
 * 2. Update user password hash
 * 3. Invalidate ALL other reset tokens for this user
 * 4. Clear all active sessions (force re-login across all devices)
 *
 * This prevents the critical security vulnerability where a server crash between steps would
 * leave the token valid for reuse, allowing attackers to reset the password multiple times.
 *
 * PERFORMANCE: Uses READ COMMITTED isolation (default) instead of SERIALIZABLE. The atomic UPDATE
 * provides sufficient race condition protection without serialization conflicts or retry logic.
 *
 * @param token - The password reset token
 * @param newPasswordHash - The new password hash (SECURITY: write-only, never exposed)
 * @returns User ID of the password reset owner
 * @throws Error if token is invalid, expired, or already used
 *
 * @example
 * try {
 *   const userId = await resetPasswordAtomic(token, newPasswordHash);
 *   logger.info('Password reset successful', { userId });
 * } catch (error) {
 *   logger.error('Password reset failed', { error });
 *   throw error;
 * }
 */
export async function resetPasswordAtomic(token: string, newPasswordHash: string): Promise<number> {
  // Input validation (additional validation happens in storage layer)
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Invalid token: must be non-empty string');
  }

  if (!newPasswordHash || typeof newPasswordHash !== 'string') {
    throw new Error('Invalid password hash: must be non-empty string');
  }

  // Execute atomic password reset transaction
  const userId: number = await storage.resetPasswordAtomic(token, newPasswordHash);

  // Clear all active sessions for this user (force re-login)
  // SECURITY: Prevents stolen session cookie attack - attacker loses access immediately
  // This is done AFTER the transaction to avoid blocking database commit on Redis operations
  try {
    const sessionsCleared = await clearUserSessions(userId);
    logger.info('[PasswordReset] Cleared user sessions after password reset', { userId, sessionsCleared });
  } catch (sessionError) {
    // Session cleanup is a best-effort security enhancement
    // Log the error but don't fail the password reset
    logger.error('[PasswordReset] Failed to clear user sessions', {
      userId,
      error: sessionError instanceof Error ? sessionError.message : String(sessionError),
    });
  }

  return userId;
}
