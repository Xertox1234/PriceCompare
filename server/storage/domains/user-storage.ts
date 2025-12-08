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

import { eq, sql } from 'drizzle-orm';
import {
  users,
  notifications,
  passwordResetTokens,
  products,
  retailers,
  priceAlerts,
} from '@shared/schema';
import { BaseStorage } from '../base-storage';
import type { SafeUser, AdminUser, AdminAnalyticsOverview, UserGrowthData } from '../types';
import { retryWithBackoff, isTransientDatabaseError } from '../../utils/retry-with-backoff';
import { USER_CONSTANTS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { storageCache } from '../../services/storage-cache';

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
      const [user] = await this.db.insert(users).values(userData).returning({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        trustLevel: users.trustLevel,
        isActive: users.isActive,
        isSuspended: users.isSuspended,
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

              // Create user - must be in same transaction as count check
              // SECURITY: passwordHash stored securely, NEVER exposed in return value
              const newUserResult = await tx
                .insert(users)
                .values({
                  username,
                  email,
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
}
