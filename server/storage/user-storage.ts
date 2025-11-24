/**
 * User Storage Repository
 *
 * Domain-specific storage for user management operations including:
 * - User CRUD operations (safe - never exposes passwordHash)
 * - User profile management
 * - Trust level and moderation
 * - User registration with transaction support
 * - Admin analytics (user growth, counts)
 *
 * SECURITY NOTES:
 * - ALL methods use explicit field selection to NEVER expose passwordHash
 * - Registration uses SERIALIZABLE isolation to prevent first-user race conditions
 * - Suspension creates notification atomically using transactions
 */

import { BaseStorage } from './base-storage';
import type {
  SafeUser,
  AdminUser,
  UserGrowthData,
} from './types';
import { users, notifications } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { retryWithBackoff, isTransientDatabaseError } from '../utils/retry-with-backoff';
import { logger } from '../utils/logger';

/**
 * User Storage Interface
 * Defines all user-related database operations
 */
export interface IUserStorage {
  // User Retrieval (Admin)
  getAllUsers(): Promise<AdminUser[]>;
  getUserByIdSafe(id: number): Promise<SafeUser | null>;
  getUserCount(): Promise<number>;

  // User Profile Management
  updateUserProfile(userId: number, data: {
    bio?: string;
    location?: string;
    website?: string;
    avatarUrl?: string
  }): Promise<void>;

  updateUserTrustLevel(userId: number, trustLevel: number): Promise<void>;

  suspendUser(userId: number, reason: string, moderatorId: number): Promise<void>;

  // User Registration (with transaction and first-user detection)
  // SECURITY: passwordHash handled internally, NEVER exposed in return value
  createUserWithTransaction(
    username: string,
    email: string,
    passwordHash: string // SECURITY: NEVER expose - internal parameter only
  ): Promise<{ user: SafeUser; isFirstUser: boolean }>;

  // Analytics
  getUserGrowthData(): Promise<UserGrowthData[]>;
}

/**
 * User Storage Implementation
 * Handles all user-related database operations with proper security and transactions
 */
export class UserStorage extends BaseStorage implements IUserStorage {
  /**
   * Get all users (admin view with reputation)
   * SECURITY: Explicitly selects fields to NEVER expose passwordHash
   */
  async getAllUsers(): Promise<AdminUser[]> {
    return this.handleError('getAllUsers', async () => {
      // SECURITY: Never expose passwordHash - explicit field selection
      return await this.db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        reputation: users.reputation,
        createdAt: users.createdAt
      }).from(users);
    });
  }

  /**
   * Get user by ID (safe - no passwordHash)
   * SECURITY: Explicitly selects fields to NEVER expose passwordHash
   */
  async getUserByIdSafe(id: number): Promise<SafeUser | null> {
    return this.handleError('getUserByIdSafe', async () => {
      // SECURITY: Never expose passwordHash - explicit field selection
      const [user] = await this.db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        trustLevel: users.trustLevel,
        isActive: users.isActive,
        isSuspended: users.isSuspended,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      }).from(users)
        .where(eq(users.id, id))
        .limit(1);

      return user || null;
    });
  }

  /**
   * Get total user count
   */
  async getUserCount(): Promise<number> {
    return this.handleError('getUserCount', async () => {
      const [result] = await this.db.select({
        count: sql<number>`count(*)::int`
      }).from(users);
      return result?.count ?? 0;
    });
  }

  /**
   * Update user profile information
   */
  async updateUserProfile(
    userId: number,
    data: {
      bio?: string;
      location?: string;
      website?: string;
      avatarUrl?: string
    }
  ): Promise<void> {
    return this.handleError('updateUserProfile', async () => {
      await this.db.update(users)
        .set({
          bio: data.bio,
          location: data.location,
          website: data.website,
          avatarUrl: data.avatarUrl,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
    });
  }

  /**
   * Update user's trust level
   */
  async updateUserTrustLevel(userId: number, trustLevel: number): Promise<void> {
    return this.handleError('updateUserTrustLevel', async () => {
      await this.db.update(users)
        .set({ trustLevel, updatedAt: new Date() })
        .where(eq(users.id, userId));
    });
  }

  /**
   * Suspend a user and create notification atomically
   * UX: Uses transaction to ensure suspension and notification are atomic
   */
  async suspendUser(userId: number, reason: string, moderatorId: number): Promise<void> {
    return this.handleError('suspendUser', async () => {
      // UX: Use transaction to ensure suspension and notification are atomic
      await this.executeTransaction(async (tx) => {
        await tx.update(users)
          .set({ isSuspended: true, updatedAt: new Date() })
          .where(eq(users.id, userId));

        // Create notification - must succeed or rollback suspension
        await tx.insert(notifications).values({
          userId,
          type: 'moderation',
          title: 'Account suspended',
          content: reason || 'Your account has been suspended',
          relatedUserId: moderatorId
        });
      });
    });
  }

  /**
   * Create user with transaction support and first-user detection
   *
   * Features:
   * - Detects first user and makes them admin
   * - Uses SERIALIZABLE isolation to prevent race conditions
   * - Retry logic for transient database errors
   * - SECURITY: passwordHash stored securely but NEVER exposed in return value
   *
   * @param username - Username
   * @param email - Email address
   * @param passwordHash - Hashed password (NEVER exposed in return)
   * @returns User data (without passwordHash) and isFirstUser flag
   */
  async createUserWithTransaction(
    username: string,
    email: string,
    passwordHash: string // SECURITY: NEVER expose - internal parameter only
  ): Promise<{ user: SafeUser; isFirstUser: boolean }> {
    let user: SafeUser;
    let isFirstUser: boolean = false;

    await retryWithBackoff(
      async () => this.db.transaction(async (tx) => {
        // Check if this is the first user (make them admin)
        const userCount = await tx.select({ count: sql`count(*)` }).from(users);
        isFirstUser = parseInt(userCount[0].count as string) === 0;

        // Create user - must be in same transaction as count check
        // SECURITY: passwordHash stored securely, NEVER exposed in return value
        const newUserResult = await tx.insert(users).values({
          username,
          email,
          passwordHash, // SECURITY: NEVER expose - only used internally for storage
          role: isFirstUser ? 'admin' : 'user',
        }).returning();

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
      }, {
        isolationLevel: 'serializable', // Prevent concurrent first-user race condition
      }),
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        isRetryable: isTransientDatabaseError,
        context: { operation: 'createUserWithTransaction', username, email },
        onRetry: (error, attempt, delayMs) => {
          logger.warn('[UserStorage] Retrying user registration after serialization error', {
            error: error instanceof Error ? error.message : String(error),
            attempt,
            delayMs,
            username,
          });
        },
      }
    );

    return { user: user!, isFirstUser };
  }

  /**
   * Get user growth data over time (for analytics)
   * Returns daily user registration counts
   */
  async getUserGrowthData(): Promise<UserGrowthData[]> {
    return this.handleError('getUserGrowthData', async () => {
      const result = await this.db.select({
        date: sql<string>`DATE(${users.createdAt})`.as('date'),
        count: sql<number>`count(*)`.as('count')
      })
      .from(users)
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`);

      return result.map(row => ({
        date: String(row.date),
        count: Number(row.count)
      }));
    });
  }
}
