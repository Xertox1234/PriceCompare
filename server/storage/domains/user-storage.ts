/**
 * User Storage Domain
 *
 * Handles all user-related database operations including authentication, profile management,
 * and admin user operations.
 *
 * SECURITY REQUIREMENTS:
 * - **NEVER expose passwordHash**: All user queries use explicit field selection
 * - **SafeUser type**: Return type excludes passwordHash for all public methods
 * - **Transaction boundaries**: Multi-step operations (suspend, register, reset) use transactions
 *
 * Phase 2: User Domain Extraction - Migrated from monolithic storage.ts
 */

import { eq, sql, and } from 'drizzle-orm';
import {
  users,
  notifications,
  passwordResetTokens,
  products,
  retailers,
  priceAlerts,
  type User,
} from '@shared/schema';
import { BaseStorage } from '../base-storage';
import type { SafeUser, AdminUser, AdminAnalyticsOverview, UserGrowthData } from '../types';
import { retryWithBackoff, isTransientDatabaseError } from '../../utils/retry-with-backoff';
import { USER_CONSTANTS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { storageCache } from '../../services/storage-cache';
import { hashEmail } from '../../utils/encryption';

/**
 * UserStorage - Domain repository for user operations
 *
 * Extends BaseStorage to inherit error handling and logging utilities.
 * Implements the 7-point implementation guidance from base-storage.ts:
 * 1. Input Validation - validateUserId, validateTrustLevel, validateProfileField
 * 2. N+1 Prevention - Uses explicit field selection, no queries in loops
 * 3. Security - NEVER exposes passwordHash, always uses SafeUser type
 * 4. Error Handling - Uses handleError() for storage errors
 * 5. Transactions - Wraps multi-step operations (suspend, reset password, createUserWithTransaction)
 * 6. Retry Logic - Uses retryWithBackoff for transient errors
 * 7. Logging - Uses logSuccess() for completed operations
 */
export class UserStorage extends BaseStorage {
  /**
   * Validate user ID is positive integer
   * Used by: getUserByIdSafe, updateUserProfile, updateUserTrustLevel, suspendUser
   * @private
   */
  private validateUserId(userId: number): void {
    if (!userId || userId < 1 || !Number.isInteger(userId)) {
      throw new Error(`Invalid userId: ${userId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate trust level is within allowed range
   * @private
   */
  private validateTrustLevel(level: number): void {
    if (level < USER_CONSTANTS.TRUST_LEVEL.MIN || level > USER_CONSTANTS.TRUST_LEVEL.MAX) {
      throw new Error(
        `Trust level must be between ${USER_CONSTANTS.TRUST_LEVEL.MIN} and ${USER_CONSTANTS.TRUST_LEVEL.MAX}`
      );
    }
  }

  /**
   * Validate active status is boolean type
   * @private
   */
  private validateActiveStatus(active: unknown): asserts active is boolean {
    if (typeof active !== 'boolean') {
      throw new Error(`Invalid active parameter: ${active}. Must be boolean.`);
    }
  }

  /**
   * Validate profile field length
   * @private
   */
  private validateProfileField(
    value: string | undefined,
    fieldName: string,
    maxLength: number
  ): void {
    if (value && value.length > maxLength) {
      throw new Error(`${fieldName} cannot exceed ${maxLength} characters`);
    }
  }

  // ============================================================================
  // Basic User Operations
  // ============================================================================

  /**
   * Get total user count
   * Used for: Admin analytics, first-user detection
   */
  async getUserCount(): Promise<number> {
    try {
      const [result] = await this.db.select({ count: sql<number>`count(*)::int` }).from(users);
      return result?.count ?? 0;
    } catch (error) {
      this.handleError(error, 'getUserCount');
    }
  }

  /**
   * Get user by ID without passwordHash
   * SECURITY: Uses explicit field selection, NEVER exposes passwordHash
   *
   * @param id - User ID (validated as positive integer)
   * @returns SafeUser without passwordHash, or null if not found
   */
  async getUserByIdSafe(id: number): Promise<SafeUser | null> {
    try {
      // Validate inputs
      this.validateUserId(id);

      // SECURITY: Never expose passwordHash - explicit field selection
      const [user] = await this.db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          trustLevel: users.trustLevel,
          isActive: users.isActive,
          isSuspended: users.isSuspended,
          preferredCountry: users.preferredCountry, // User preference (TODO 258)
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return user || null;
    } catch (error) {
      this.handleError(error, 'getUserByIdSafe');
    }
  }

  /**
   * Get user by username with passwordHash for authentication
   * SECURITY: Returns passwordHash for password verification ONLY
   * Used by: HTTP Basic Auth middleware
   *
   * @param username - Username (case-sensitive)
   * @returns User with passwordHash for verification, or null if not found
   */
  async getUserByUsername(username: string): Promise<User | null> {
    try {
      // SECURITY: This method returns passwordHash for password verification
      // NEVER use this for API responses - use getUserByIdSafe instead
      const [user] = await this.db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          emailHash: users.emailHash,
          passwordHash: users.passwordHash, // SECURITY: For password verification only
          role: users.role,
          trustLevel: users.trustLevel,
          isActive: users.isActive,
          isSuspended: users.isSuspended,
          reputation: users.reputation,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          location: users.location,
          website: users.website,
          lastSeenAt: users.lastSeenAt,
          postCount: users.postCount,
          topicCount: users.topicCount,
          likesGiven: users.likesGiven,
          likesReceived: users.likesReceived,
          timeReadPosts: users.timeReadPosts,
          daysVisited: users.daysVisited,
          preferredCountry: users.preferredCountry, // User preference (TODO 258)
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      return user || null;
    } catch (error) {
      this.handleError(error, 'getUserByUsername');
    }
  }

  /**
   * Get user by ID with passwordHash for password verification
   * SECURITY: Returns passwordHash for password verification ONLY
   * Used by: Password change endpoint to verify current password
   *
   * @param userId - User ID (validated as positive integer)
   * @returns User with minimal fields including passwordHash, or null if not found
   */
  async getUserWithPassword(userId: number): Promise<{ id: number; email: string; username: string; passwordHash: string } | null> {
    try {
      // Validate inputs
      this.validateUserId(userId);

      // SECURITY: This method returns passwordHash for password verification
      // NEVER use this for API responses - use getUserByIdSafe instead
      const [user] = await this.db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          passwordHash: users.passwordHash, // SECURITY: For password verification only
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user || null;
    } catch (error) {
      this.handleError(error, 'getUserWithPassword');
    }
  }

  // ============================================================================
  // User Registration and Authentication
  // ============================================================================

  /**
   * Register a new user
   * SECURITY: passwordHash is write-only, NEVER returned in response
   *
   * @param userData - User registration data including passwordHash
   * @returns SafeUser without passwordHash
   */
  async registerUser(userData: {
    username: string;
    email: string;
    passwordHash: string; // SECURITY: NEVER expose - write-only parameter
  }): Promise<SafeUser> {
    try {
      // SECURITY: passwordHash handled internally, NEVER exposed in SELECT queries
      const [user] = await this.db
        .insert(users)
        .values({
          ...userData,
          emailHash: hashEmail(userData.email), // SHA-256 hash for indexed lookups
        })
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          emailHash: users.emailHash, // Include for SafeUser type compatibility
          role: users.role,
          trustLevel: users.trustLevel,
          isActive: users.isActive,
          isSuspended: users.isSuspended,
          preferredCountry: users.preferredCountry, // User preference (TODO 258)
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          // SECURITY: Never expose passwordHash
        });
      return user;
    } catch (error) {
      this.handleError(error, 'registerUser');
    }
  }

  /**
   * Reset user password (with transaction)
   * SECURITY: passwordHash is write-only, NEVER exposed in queries
   *
   * DEPRECATED: Use resetPasswordAtomic() instead for better security.
   * This method is kept for backward compatibility but should not be used.
   *
   * @param userId - User ID to reset password for
   * @param newPasswordHash - New password hash (write-only)
   * @param token - Reset token to mark as used
   */
  async resetPassword(
    userId: number,
    newPasswordHash: string, // SECURITY: NEVER expose - write-only parameter
    token: string
  ): Promise<void> {
    try {
      // SECURITY: passwordHash handled internally, NEVER exposed in queries
      await this.db.transaction(async (tx) => {
        // Update password hash (write operation, not a query)
        await tx
          .update(users)
          .set({
            passwordHash: newPasswordHash, // SECURITY: NEVER expose passwordHash in SELECT queries
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        // Mark token as used
        await tx
          .update(passwordResetTokens)
          .set({ isUsed: true, usedAt: new Date() })
          .where(eq(passwordResetTokens.token, token));
      });
    } catch (error) {
      this.handleError(error, 'resetPassword');
    }
  }

  /**
   * Reset password atomically with token validation
   *
   * SECURITY: This method wraps all password reset steps in a single READ COMMITTED transaction:
   * 1. Atomically validate token AND mark as used (single UPDATE query with optimistic locking)
   * 2. Update user password hash
   * 3. Invalidate ALL other reset tokens for this user
   * 4. Clear all active sessions (force re-login)
   *
   * This prevents the critical security vulnerability where a server crash between steps would
   * leave the token valid for reuse, allowing attackers to reset the password multiple times.
   *
   * The atomic UPDATE with WHERE clause provides optimistic locking - if another request already
   * marked the token as used, this UPDATE matches zero rows and the operation fails safely.
   *
   * PERFORMANCE: Uses READ COMMITTED (default) instead of SERIALIZABLE. The atomic UPDATE provides
   * sufficient race condition protection without the overhead of serialization conflicts.
   *
   * @param token - The password reset token
   * @param newPasswordHash - The new password hash (SECURITY: write-only, never exposed)
   * @returns User ID of the password reset owner
   * @throws Error if token is invalid, expired, or already used
   */
  async resetPasswordAtomic(
    token: string,
    newPasswordHash: string // SECURITY: NEVER expose - write-only parameter
  ): Promise<number> {
    try {
      // Pre-transaction input validation (avoid locking for invalid input)
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        throw new Error('Invalid token: must be non-empty string');
      }

      if (token.length > 255) {
        throw new Error('Invalid token: exceeds maximum length');
      }

      // SECURITY: Validate password hash format (bcrypt hashes are 60 chars)
      if (!newPasswordHash || typeof newPasswordHash !== 'string' || newPasswordHash.length < 60) {
        throw new Error('Invalid password hash format');
      }

      // Execute all steps in a single READ COMMITTED transaction (default isolation level)
      const userId = await this.db.transaction(async (tx) => {
        // Step 1: Atomically validate token AND mark as used (single UPDATE query)
        // The WHERE clause acts as optimistic locking - if another request already marked it used,
        // this UPDATE matches zero rows and we fail safely with "Invalid or expired reset token"
        // Using raw SQL for consistent timezone handling (matches validatePasswordResetToken pattern)
        const result = await tx.execute(
          sql`
            UPDATE password_reset_tokens
            SET is_used = true, used_at = NOW()
            WHERE token = ${token}
              AND is_used = false
              AND (expires_at AT TIME ZONE 'UTC') > NOW()
            RETURNING id, user_id
          `
        );

        // Type assertion: Drizzle sql.execute() returns unknown rows, must check existence before narrowing type
        const row = result.rows[0] as unknown;
        if (!row) {
          // Same error message for all failure modes (prevent information leakage)
          // Could be: token doesn't exist, already used, or expired
          throw new Error('Invalid or expired reset token');
        }

        // Type assertion: Map PostgreSQL snake_case to camelCase
        const tokenData = row as { id: number; user_id: number };

        // Step 2: Update password hash
        // SECURITY: passwordHash is write-only parameter, NEVER exposed in SELECT queries
        await tx
          .update(users)
          .set({
            passwordHash: newPasswordHash, // Write-only operation
            updatedAt: new Date(), // Audit trail
          })
          .where(eq(users.id, tokenData.user_id));

        // Step 3: Invalidate ALL other reset tokens for this user
        // SECURITY: If user requested reset twice, using token #1 invalidates token #2
        // This prevents multi-token attack where attacker has multiple valid reset tokens
        await tx
          .update(passwordResetTokens)
          .set({ isUsed: true })
          .where(and(eq(passwordResetTokens.userId, tokenData.user_id), eq(passwordResetTokens.isUsed, false)));

        // Step 4: Clear all active sessions (force re-login)
        // SECURITY: Prevents stolen session cookie attack - attacker loses access immediately
        // This is handled by calling clearUserSessions() after the transaction completes
        // (see password-reset-service.ts which wraps this method)

        return tokenData.user_id;
      }); // Default READ COMMITTED isolation is correct

      // Cache invalidation after transaction commits (non-critical, won't rollback if it fails)
      try {
        await storageCache.invalidateUserCache(userId);
      } catch (cacheError) {
        logger.warn('[Storage] Cache invalidation failed after password reset', {
          userId,
          error: cacheError instanceof Error ? cacheError.message : String(cacheError)
        });
        // Cache TTL will expire stale data eventually - this is acceptable
      }

      return userId;
    } catch (error) {
      this.handleError(error, 'resetPasswordAtomic');
    }
  }

  /**
   * Create user with transaction (first user becomes admin)
   * Uses SERIALIZABLE isolation to prevent race condition where multiple concurrent
   * requests could both see zero users and both create admin accounts.
   *
   * SECURITY: passwordHash handled internally, NEVER exposed in return value
   *
   * @param username - Username for new user
   * @param email - Email for new user
   * @param passwordHash - Password hash (write-only, never returned)
   * @returns Object with SafeUser (no passwordHash) and isFirstUser flag
   */
  async createUserWithTransaction(
    username: string,
    email: string,
    passwordHash: string // SECURITY: NEVER expose
  ): Promise<{ user: SafeUser; isFirstUser: boolean }> {
    let user: SafeUser | undefined;
    let isFirstUser = false;

    try {
      await retryWithBackoff(
        async () =>
          this.db.transaction(
            async (tx) => {
              // Check if this is the first user (make them admin)
              const userCount = await tx.select({ count: sql`count(*)` }).from(users);
              // Safe integer conversion: SQL count() returns string|number, ensure valid integer
              const count = userCount[0]?.count;
              const userCountNum = typeof count === 'number' ? count : count ? Number(count) : 0;
              isFirstUser = userCountNum === 0;

              // Create user - must be in same transaction as count check (serializable isolation)
              // SECURITY: passwordHash stored securely, NEVER exposed in return value
              const newUserResult = await tx
                .insert(users)
                .values({
                  username,
                  email,
                  emailHash: hashEmail(email), // SHA-256 hash for indexed lookups (uniqueness enforced here)
                  passwordHash, // SECURITY: NEVER expose - only used internally
                  role: isFirstUser ? 'admin' : 'user',
                })
                .returning();

              // SECURITY: Explicitly extract safe fields, never expose passwordHash
              user = {
                id: newUserResult[0].id,
                username: newUserResult[0].username,
                email: newUserResult[0].email,
                role: newUserResult[0].role,
                trustLevel: newUserResult[0].trustLevel,
                isActive: newUserResult[0].isActive,
                isSuspended: newUserResult[0].isSuspended,
                preferredCountry: newUserResult[0].preferredCountry, // User preference (TODO 258)
                createdAt: newUserResult[0].createdAt,
                updatedAt: newUserResult[0].updatedAt,
              };
            },
            {
              isolationLevel: 'serializable', // Prevent concurrent first-user race condition
            }
          ),
        {
          maxAttempts: 3,
          initialDelayMs: 100,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'createUserWithTransaction', username, email },
          onRetry: (error, attempt, delayMs) => {
            logger.warn('[Storage] Retrying user registration after serialization error', {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              username,
            });
          },
        }
      );

      if (!user) {
        throw new Error('User was not created successfully');
      }
      return { user, isFirstUser };
    } catch (error) {
      this.handleError(error, 'createUserWithTransaction');
    }
  }

  // ============================================================================
  // User Profile Management
  // ============================================================================

  /**
   * Update user profile fields
   * Validates field lengths against USER_CONSTANTS
   *
   * @param userId - User ID (validated as positive integer)
   * @param data - Profile fields to update (all optional)
   */
  async updateUserProfile(
    userId: number,
    data: { bio?: string; location?: string; website?: string; avatarUrl?: string }
  ): Promise<void> {
    try {
      // Validate inputs
      this.validateUserId(userId);
      this.validateProfileField(data.bio, 'Bio', USER_CONSTANTS.PROFILE.MAX_BIO_LENGTH);
      this.validateProfileField(
        data.location,
        'Location',
        USER_CONSTANTS.PROFILE.MAX_LOCATION_LENGTH
      );
      this.validateProfileField(data.website, 'Website', USER_CONSTANTS.PROFILE.MAX_WEBSITE_LENGTH);
      this.validateProfileField(
        data.avatarUrl,
        'Avatar URL',
        USER_CONSTANTS.PROFILE.MAX_AVATAR_URL_LENGTH
      );

      await this.db
        .update(users)
        .set({
          bio: data.bio,
          location: data.location,
          website: data.website,
          avatarUrl: data.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Invalidate user cache after successful update
      await storageCache.invalidateUserCache(userId);
    } catch (error) {
      this.handleError(error, 'updateUserProfile');
    }
  }

  /**
   * Update user trust level
   * Validates trust level is within USER_CONSTANTS range
   *
   * @param userId - User ID (validated as positive integer)
   * @param trustLevel - New trust level (validated against USER_CONSTANTS)
   */
  async updateUserTrustLevel(userId: number, trustLevel: number): Promise<void> {
    try {
      // Validate inputs
      this.validateUserId(userId);
      this.validateTrustLevel(trustLevel);

      await this.db
        .update(users)
        .set({ trustLevel, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Invalidate user cache after successful update
      await storageCache.invalidateUserCache(userId);
    } catch (error) {
      this.handleError(error, 'updateUserTrustLevel');
    }
  }

  /**
   * Suspend user account and send notification
   * Uses transaction to ensure suspension and notification are atomic
   * UX: User must be notified of important moderation events
   *
   * @param userId - User ID to suspend
   * @param reason - Suspension reason (shown to user in notification)
   * @param moderatorId - ID of moderator performing suspension
   */
  async suspendUser(userId: number, reason: string, moderatorId: number): Promise<void> {
    try {
      // Validate inputs
      this.validateUserId(userId);
      this.validateUserId(moderatorId);

      // UX: Use transaction to ensure suspension and notification are atomic
      await this.db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ isSuspended: true, updatedAt: new Date() })
          .where(eq(users.id, userId));

        // Create notification - must succeed or rollback suspension
        await tx.insert(notifications).values({
          userId,
          type: 'moderation',
          title: 'Account suspended',
          content: reason || 'Your account has been suspended',
          relatedUserId: moderatorId,
        });
      });

      // Invalidate user cache after successful suspension
      await storageCache.invalidateUserCache(userId);
    } catch (error) {
      this.handleError(error, 'suspendUser');
    }
  }

  async unsuspendUser(userId: number, moderatorId: number): Promise<void> {
    try {
      this.validateUserId(userId);
      this.validateUserId(moderatorId);

      await this.db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ isSuspended: false, updatedAt: new Date() })
          .where(eq(users.id, userId));

        await tx.insert(notifications).values({
          userId,
          type: 'moderation',
          title: 'Account reinstated',
          content: 'Your account has been reinstated',
          relatedUserId: moderatorId,
        });
      });

      await storageCache.invalidateUserCache(userId);
    } catch (error) {
      this.handleError(error, 'unsuspendUser');
    }
  }

  async updateUserRole(userId: number, role: 'user' | 'moderator' | 'admin'): Promise<void> {
    try {
      this.validateUserId(userId);
      await this.db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
      await storageCache.invalidateUserCache(userId);
    } catch (error) {
      this.handleError(error, 'updateUserRole');
    }
  }

  /**
   * Update user's password hash (for transparent rehashing on login)
   * SECURITY: Only updates passwordHash, no token required
   *
   * @param userId - User ID
   * @param newPasswordHash - New bcrypt hash (NEVER expose in logs/responses)
   */
  async updateUserPasswordHash(userId: number, newPasswordHash: string): Promise<void> {
    try {
      this.validateUserId(userId);

      // SECURITY: Validate password hash format (bcrypt hashes are 60 chars)
      if (!newPasswordHash || typeof newPasswordHash !== 'string' || newPasswordHash.length < 60) {
        throw new Error('Invalid password hash format');
      }

      await this.db
        .update(users)
        .set({
          passwordHash: newPasswordHash, // SECURITY: NEVER expose passwordHash in SELECT queries
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Invalidate user cache after password update
      await storageCache.invalidateUserCache(userId);
    } catch (error) {
      this.handleError(error, 'updateUserPasswordHash');
    }
  }

  /**
   * Invalidate all user sessions except optionally the current one
   * SECURITY: Used after password change to prevent session hijacking
   *
   * This method clears all Redis session keys for a user, forcing re-login.
   * The current session can be preserved to keep the user logged in after
   * password change.
   *
   * @param userId - User ID whose sessions to invalidate
   * @param exceptSessionId - Optional session ID to preserve (current session)
   */
  async invalidateUserSessions(userId: number, exceptSessionId?: string): Promise<void> {
    const startTime = Date.now();

    try {
      this.validateUserId(userId);

      // Get Redis client
      const { getRedisSessionClient } = await import('../../config/redis');
      const redisClient = getRedisSessionClient();

      if (!redisClient) {
        logger.warn('[UserStorage] Cannot invalidate sessions: Redis not available', { userId });
        return;
      }

      // PERFORMANCE: Use user-keyed session index for O(M) complexity instead of O(N)
      // where M = user's sessions (typically 2-5) and N = total sessions (potentially 100K+)
      const {
        getUserSessionIds,
        cleanupStaleSessionsFromIndex,
        removeSessionFromUserIndex,
      } = await import('../../utils/session-index');

      // Cleanup stale sessions from index before using it
      await cleanupStaleSessionsFromIndex(userId);

      // Get user's session IDs from index (O(M) lookup)
      const sessionIds = await getUserSessionIds(userId);

      if (sessionIds.length === 0) {
        logger.debug('[UserStorage] No sessions to invalidate', { userId });
        return;
      }

      // Filter out the excepted session and build Redis keys
      const sessionIdsToDelete = sessionIds.filter(sid => sid !== exceptSessionId);
      const keysToDelete = sessionIdsToDelete.map(sid => `sess:${sid}`);

      // Delete sessions from Redis
      if (keysToDelete.length > 0) {
        await redisClient.del(keysToDelete);

        // Remove deleted sessions from index
        for (const sessionId of sessionIdsToDelete) {
          await removeSessionFromUserIndex(userId, sessionId);
        }

        const duration = Date.now() - startTime;

        logger.info('[UserStorage] Invalidated user sessions', {
          userId,
          sessionsDeleted: keysToDelete.length,
          preservedSession: exceptSessionId || 'none',
          totalUserSessions: sessionIds.length,
          durationMs: duration,
        });

        // MONITORING: Alert if session invalidation is slow (should be <100ms with index)
        if (duration > 1000) {
          logger.warn('[UserStorage] Slow session invalidation detected', {
            userId,
            durationMs: duration,
            sessionCount: keysToDelete.length,
            message: 'Session invalidation took >1s. This may indicate index issues or high session count.',
          });
        }
      } else {
        logger.debug('[UserStorage] All sessions preserved (matched exception)', {
          userId,
          preservedSession: exceptSessionId,
        });
      }
    } catch (error) {
      this.handleError(error, 'invalidateUserSessions');
    }
  }

  /**
   * Set user account active status
   *
   * Toggles whether a user account is active. Inactive accounts are rejected
   * during authentication (isActive === false check in basicAuth middleware).
   *
   * **Difference between isActive and isSuspended:**
   * - `isActive`: Administrative account management (user requests, support actions)
   * - `isSuspended`: Disciplinary moderation action (policy violations)
   *
   * Both prevent authentication, but serve different purposes:
   * - Inactive: "Account deactivated" (reversible by admin or user request)
   * - Suspended: "Account suspended" (requires moderation review)
   *
   * **Related methods:**
   * - `suspendUser()` - For disciplinary suspension (creates moderation notification)
   * - `setUserActive()` - For administrative activation/deactivation (no notification)
   *
   * **Used by:** HTTP Basic Auth testing, account management, admin tools
   *
   * @param userId - User ID (validated as positive integer)
   * @param active - Boolean flag: true = account active, false = account deactivated
   */
  async setUserActive(userId: number, active: boolean): Promise<void> {
    try {
      // Validate inputs
      this.validateUserId(userId);
      this.validateActiveStatus(active);

      await this.db
        .update(users)
        .set({
          isActive: active,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Invalidate user cache after successful update
      await storageCache.invalidateUserCache(userId);
    } catch (error) {
      this.handleError(error, 'setUserActive');
    }
  }

  // ============================================================================
  // Admin User Operations
  // ============================================================================

  /**
   * Get all users (admin view)
   * SECURITY: Never exposes passwordHash - explicit field selection
   *
   * @returns Array of AdminUser objects (subset of SafeUser fields)
   */
  async getAllUsers(): Promise<AdminUser[]> {
    try {
      // SECURITY: Never expose passwordHash - explicit field selection
      return await this.db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          isSuspended: users.isSuspended,
          reputation: users.reputation,
          createdAt: users.createdAt,
        })
        .from(users);
    } catch (error) {
      this.handleError(error, 'getAllUsers');
    }
  }

  /**
   * Get admin analytics overview
   * Returns aggregate counts for users, topics, posts, and categories
   *
   * OPTIMIZATION: Uses parallel queries with Promise.all to reduce latency
   */
  async getAdminAnalyticsOverview(): Promise<AdminAnalyticsOverview> {
    try {
      const [userCount, productCount, retailerCount, alertCount] = await Promise.all([
        this.db.select({ count: sql`count(*)` }).from(users),
        this.db.select({ count: sql`count(*)` }).from(products),
        this.db.select({ count: sql`count(*)` }).from(retailers),
        this.db.select({ count: sql`count(*)` }).from(priceAlerts),
      ]);

      return {
        totalUsers: Number(userCount[0]?.count || 0),
        totalProducts: Number(productCount[0]?.count || 0),
        totalRetailers: Number(retailerCount[0]?.count || 0),
        totalAlerts: Number(alertCount[0]?.count || 0),
      };
    } catch (error) {
      this.handleError(error, 'getAdminAnalyticsOverview');
    }
  }

  /**
   * Get user growth data (registrations per day)
   * Used for: Admin dashboard charts, growth analytics
   *
   * @returns Array of {date, count} objects ordered by date
   */
  async getUserGrowthData(): Promise<UserGrowthData[]> {
    try {
      const result = await this.db
        .select({
          date: sql<string>`DATE(${users.createdAt})`.as('date'),
          count: sql<number>`count(*)`.as('count'),
        })
        .from(users)
        .groupBy(sql`DATE(${users.createdAt})`)
        .orderBy(sql`DATE(${users.createdAt})`);

      return result.map((row) => ({ date: String(row.date), count: Number(row.count) }));
    } catch (error) {
      this.handleError(error, 'getUserGrowthData');
    }
  }

  // ============================================================================
  // User Account Preferences Operations (TODO 258: Agent-Native User Preferences API)
  // ============================================================================

  /**
   * Get user account preferences (country preference, etc.)
   * Returns user's stored account-level preferences for API/agent access
   *
   * NOTE: This is distinct from notification preferences (getUserPreferences in notification-storage.ts).
   * Account preferences control regional settings, while notification preferences control alerts.
   *
   * @param userId - User ID (validated as positive integer)
   * @returns User account preferences object with preferredCountry
   */
  async getUserAccountPreferences(userId: number): Promise<{ preferredCountry: string | null }> {
    try {
      this.validateUserId(userId);

      const [result] = await this.db
        .select({
          preferredCountry: users.preferredCountry,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return {
        preferredCountry: result?.preferredCountry ?? null,
      };
    } catch (error) {
      this.handleError(error, 'getUserAccountPreferences');
    }
  }

  /**
   * Update user account preferences
   * Allows agents and users to update account-level preferences
   *
   * AGENT-NATIVE: This endpoint enables agents to set user preferences
   * that were previously only accessible via localStorage in the browser.
   *
   * NOTE: This is distinct from notification preferences (updateUserPreferences in notification-storage.ts).
   *
   * @param userId - User ID (validated as positive integer)
   * @param preferences - Preference fields to update
   * @param preferences.preferredCountry - ISO 3166-1 alpha-2 country code (US, CA) or null to clear
   */
  async updateUserAccountPreferences(
    userId: number,
    preferences: { preferredCountry?: string | null }
  ): Promise<void> {
    try {
      this.validateUserId(userId);

      // Validate country code format if provided (2 uppercase letters)
      if (preferences.preferredCountry !== undefined && preferences.preferredCountry !== null) {
        if (!/^[A-Z]{2}$/.test(preferences.preferredCountry)) {
          throw new Error('Invalid country code: must be 2 uppercase letters (ISO 3166-1 alpha-2)');
        }
      }

      await this.db
        .update(users)
        .set({
          preferredCountry: preferences.preferredCountry,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Invalidate user cache after successful update
      await storageCache.invalidateUserCache(userId);

      this.logSuccess('updateUserAccountPreferences', { userId, preferences });
    } catch (error) {
      this.handleError(error, 'updateUserAccountPreferences');
    }
  }
}
