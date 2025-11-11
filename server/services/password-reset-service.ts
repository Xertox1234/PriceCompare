import * as crypto from 'crypto';
import { db } from '../db';
import { passwordResetTokens, users } from '@shared/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import type { PasswordResetToken } from '@shared/schema';

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

  // Invalidate any existing unused tokens for this user (optional security measure)
  await db
    .delete(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        eq(passwordResetTokens.isUsed, false)
      )
    );

  // Create the new token
  await db.insert(passwordResetTokens).values({
    userId,
    token,
    expiresAt,
    isUsed: false,
    ipAddress: ipAddress?.substring(0, 45), // Ensure it fits in VARCHAR(45)
    userAgent: userAgent?.substring(0, 500), // Ensure it fits in VARCHAR(500)
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
  const tokenRecord = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, token),
      eq(passwordResetTokens.isUsed, false),
      gt(passwordResetTokens.expiresAt, new Date())
    ),
  });

  return tokenRecord || null;
}

/**
 * Mark a password reset token as used
 * @param token - The token to mark as used
 */
export async function markTokenAsUsed(token: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({
      isUsed: true,
      usedAt: new Date(),
    })
    .where(eq(passwordResetTokens.token, token));
}

/**
 * Get the user associated with a valid token
 * @param token - The password reset token
 * @returns The user record if the token is valid, null otherwise
 */
export async function getUserByResetToken(token: string) {
  const tokenRecord = await validatePasswordResetToken(token);

  if (!tokenRecord) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, tokenRecord.userId),
  });

  return user || null;
}

/**
 * Clean up expired tokens (should be run periodically)
 * Removes tokens that have expired or been used
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db
    .delete(passwordResetTokens)
    .where(
      lt(passwordResetTokens.expiresAt, new Date())
    );

  return result.rowCount || 0;
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
  windowMinutes: number = 15,
  maxAttempts: number = 3
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const recentTokens = await db.query.passwordResetTokens.findMany({
    where: and(
      eq(passwordResetTokens.userId, userId),
      gt(passwordResetTokens.createdAt, since)
    ),
  });

  return recentTokens.length >= maxAttempts;
}

/**
 * Get the number of password reset attempts for a user in a time window
 * @param userId - The user ID
 * @param windowMinutes - The time window in minutes (default: 15)
 * @returns The number of attempts
 */
export async function getResetAttemptCount(
  userId: number,
  windowMinutes: number = 15
): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const recentTokens = await db.query.passwordResetTokens.findMany({
    where: and(
      eq(passwordResetTokens.userId, userId),
      gt(passwordResetTokens.createdAt, since)
    ),
  });

  return recentTokens.length;
}
