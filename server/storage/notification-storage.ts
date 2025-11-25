import { db } from "../db";
import { BaseStorage } from "./base-storage";
import {
  notifications,
  notificationPreferences,
  productWatches,
  type Notification,
  type NotificationPreferences,
  type InsertNotification,
  type InsertNotificationPreferences,
} from "@shared/schema";
import { type NotificationFilters, type NotificationStats } from "./types";
import { eq, and, desc, count, gte, sql, inArray, type SQL } from "drizzle-orm";
import { retryWithBackoff, isTransientDatabaseError } from "../middleware/retry";
import { logger } from "../utils/logger";

/**
 * Notification Storage Repository
 *
 * Manages user notifications and notification preferences with
 * transactional integrity, daily limits, and preference enforcement.
 *
 * Key Features:
 * - CRUD operations for notifications with ownership verification
 * - Batch marking notifications as read
 * - Daily notification limits with SERIALIZABLE transactions
 * - Notification preferences management with race condition prevention
 * - Quiet hours support
 * - Type-specific notification filtering
 * - WebSocket integration for real-time delivery (non-blocking)
 *
 * Performance Characteristics:
 * - createNotification: SERIALIZABLE transaction with retry (prevents daily limit bypass)
 * - updateUserPreferences: SERIALIZABLE transaction with retry (prevents concurrent creation)
 * - getUserNotifications: Paginated with dynamic filtering
 * - getNotificationStats: Aggregated with FILTER for unread count (single query)
 * - markAsRead: Supports single or batch updates
 *
 * Caching Strategy:
 * - getNotificationStats() is a good candidate for Redis caching (aggregation-heavy)
 * - Cache key pattern: `notification:stats:${userId}`
 * - Suggested TTL: 2 minutes (120 seconds) - balance between accuracy and performance
 * - Invalidate on: new notification created, notification marked as read
 * - Rationale: Dashboard use case tolerates brief staleness
 *
 * - getUserPreferences() could benefit from longer cache (5 minutes)
 * - Cache key pattern: `notification:prefs:${userId}`
 * - Suggested TTL: 5 minutes (300 seconds)
 * - Invalidate on: preferences update
 * - Rationale: Preferences change infrequently
 *
 * Implementation Example:
 * ```typescript
 * import { getRedisClient } from '../config/redis';
 * import { notificationStorage } from './storage';
 *
 * // Cached getNotificationStats wrapper
 * async function getCachedNotificationStats(userId: number): Promise<NotificationStats> {
 *   const redis = getRedisClient();
 *   const cacheKey = `notification:stats:${userId}`;
 *
 *   // Try cache first
 *   const cached = await redis.get(cacheKey);
 *   if (cached) return JSON.parse(cached);
 *
 *   // Cache miss - compute and store
 *   const stats = await notificationStorage.getNotificationStats(userId);
 *   await redis.setex(cacheKey, 120, JSON.stringify(stats)); // 2 min TTL
 *   return stats;
 * }
 *
 * // Invalidate cache when new notification created
 * async function createNotificationWithInvalidation(notification: InsertNotification) {
 *   const redis = getRedisClient();
 *   const result = await notificationStorage.createNotification(notification);
 *
 *   // Invalidate stats cache for this user
 *   await redis.del(`notification:stats:${notification.userId}`);
 *   return result;
 * }
 *
 * // Cached getUserPreferences wrapper
 * async function getCachedUserPreferences(userId: number): Promise<NotificationPreferences> {
 *   const redis = getRedisClient();
 *   const cacheKey = `notification:prefs:${userId}`;
 *
 *   const cached = await redis.get(cacheKey);
 *   if (cached) return JSON.parse(cached);
 *
 *   const prefs = await notificationStorage.getUserPreferences(userId);
 *   await redis.setex(cacheKey, 300, JSON.stringify(prefs)); // 5 min TTL
 *   return prefs;
 * }
 *
 * // Invalidate preferences cache on update
 * async function updatePreferencesWithInvalidation(
 *   userId: number,
 *   updates: Partial<InsertNotificationPreferences>
 * ) {
 *   const redis = getRedisClient();
 *   const result = await notificationStorage.updateUserPreferences(userId, updates);
 *   await redis.del(`notification:prefs:${userId}`);
 *   return result;
 * }
 * ```
 *
 * Database Schema Requirements:
 * - notifications table (userId, type, title, content, isRead, createdAt)
 * - notificationPreferences table (userId, various settings, quiet hours)
 * - Indexes: notifications_user_id_idx, notifications_user_read_idx, notifications_created_at_idx
 * - Foreign keys with CASCADE on delete for notifications
 */

// ============================================================================
// Constants
// ============================================================================

const NOTIFICATION_CONSTANTS = {
  QUERY: {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
    DEFAULT_DAYS: 7,
  },
  VALIDATION: {
    MIN_USER_ID: 1,
    MIN_NOTIFICATION_ID: 1,
    MAX_DAILY_NOTIFICATIONS: 50,
  },
  PREFERENCES: {
    DEFAULT_MAX_DAILY: 50,
    DEFAULT_PRICE_DROP_THRESHOLD_PERCENT: 10,
    DEFAULT_PRICE_DROP_THRESHOLD_AMOUNT: "5.00",
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 100,
  },
} as const;

// ============================================================================
// Interface Definition
// ============================================================================

/**
 * Notification Storage Interface
 *
 * Comprehensive notification data access layer for user notifications,
 * preferences, and related operations.
 */
export interface INotificationStorage {
  /**
   * Basic CRUD Operations
   */

  /**
   * Get user's notifications with optional filters
   * @param userId - User ID (must be positive)
   * @param filters - Optional filters (isRead, type, limit, offset)
   * @param filters.isRead - Filter by read status (true/false)
   * @param filters.type - Filter by notification type (e.g., 'price_drop', 'price_alert')
   * @param filters.limit - Maximum number of records (default: 50, max: 100)
   * @param filters.offset - Pagination offset (default: 0)
   * @returns Array of notifications ordered by creation date (newest first)
   */
  getUserNotifications(userId: number, filters?: NotificationFilters): Promise<Notification[]>;

  /**
   * Get notification statistics for a user (aggregated counts)
   * @param userId - User ID (must be positive)
   * @returns Statistics including total, unread, and counts by type
   */
  getNotificationStats(userId: number): Promise<NotificationStats>;

  /**
   * Create a new notification with daily limit enforcement
   * @param notification - Notification data to insert
   * @returns Created notification
   * @throws Error if user preferences disable notifications
   * @throws Error if user is in quiet hours
   * @throws Error if daily notification limit reached
   * @note Uses SERIALIZABLE transaction with retry to prevent daily limit bypass
   */
  createNotification(notification: InsertNotification): Promise<Notification>;

  /**
   * Update Operations
   */

  /**
   * Mark notification(s) as read for a user
   * @param userId - User ID (must be positive)
   * @param notificationIds - Single notification ID or array of IDs
   * @returns Number of notifications marked as read
   */
  markAsRead(userId: number, notificationIds: number | number[]): Promise<number>;

  /**
   * Mark all unread notifications as read for a user
   * @param userId - User ID (must be positive)
   * @returns Number of notifications marked as read
   */
  markAllAsRead(userId: number): Promise<number>;

  /**
   * Delete Operations
   */

  /**
   * Delete a notification (with ownership verification)
   * @param userId - User ID (must be positive, owner of notification)
   * @param notificationId - Notification ID (must be positive)
   * @returns True if deleted, false if not found
   */
  deleteNotification(userId: number, notificationId: number): Promise<boolean>;

  /**
   * Delete all notifications for a user
   * @param userId - User ID (must be positive)
   * @returns Number of notifications deleted
   */
  deleteAllNotifications(userId: number): Promise<number>;

  /**
   * Preferences Operations
   */

  /**
   * Get user's notification preferences (creates defaults if not exist)
   * @param userId - User ID (must be positive)
   * @returns User's notification preferences
   */
  getUserPreferences(userId: number): Promise<NotificationPreferences>;

  /**
   * Create default notification preferences for a user
   * @param userId - User ID (must be positive)
   * @returns Created preferences
   * @note Uses ON CONFLICT to handle concurrent creation attempts
   */
  createDefaultPreferences(userId: number): Promise<NotificationPreferences>;

  /**
   * Update user's notification preferences (creates if not exist)
   * @param userId - User ID (must be positive)
   * @param updates - Partial preference updates
   * @returns Updated or created preferences
   * @note Uses SERIALIZABLE transaction with retry to prevent concurrent creation
   */
  updateUserPreferences(
    userId: number,
    updates: Partial<InsertNotificationPreferences>
  ): Promise<NotificationPreferences>;

  /**
   * Query Operations
   */

  /**
   * Get recent price drop notifications for a user
   * @param userId - User ID (must be positive)
   * @param days - Number of days to look back (default: 7, must be positive)
   * @returns Array of price drop notifications ordered by date (newest first)
   */
  getRecentPriceDrops(userId: number, days?: number): Promise<Notification[]>;

  /**
   * Get recent price alert notifications for a user
   * @param userId - User ID (must be positive)
   * @param days - Number of days to look back (default: 7, must be positive)
   * @returns Array of price alert notifications ordered by date (newest first)
   */
  getRecentPriceAlerts(userId: number, days?: number): Promise<Notification[]>;
}

// ============================================================================
// Implementation
// ============================================================================

export class NotificationStorage extends BaseStorage implements INotificationStorage {
  constructor() {
    super(db);
  }

  // ============================================================================
  // Private Validation Helpers (DRY Principle - Pattern 17)
  // ============================================================================

  /**
   * Validate that a user ID is a positive number
   * @private
   */
  private validateUserId(userId: number): void {
    if (!userId || userId < NOTIFICATION_CONSTANTS.VALIDATION.MIN_USER_ID) {
      throw new Error('User ID must be a positive number');
    }
  }

  /**
   * Validate that a notification ID is a positive number
   * @private
   */
  private validateNotificationId(notificationId: number): void {
    if (!notificationId || notificationId < NOTIFICATION_CONSTANTS.VALIDATION.MIN_NOTIFICATION_ID) {
      throw new Error('Notification ID must be a positive number');
    }
  }

  /**
   * Validate that days parameter is positive
   * @private
   */
  private validateDays(days: number): void {
    if (days <= 0) {
      throw new Error('Days must be a positive number');
    }
  }

  /**
   * Check if current hour is in quiet hours
   * Handles edge case where quiet hours span midnight (e.g., 22:00-08:00)
   * @private
   * @example
   * // Normal case: 22:00 to 06:00 spans midnight
   * isInQuietHours(23, 22, 6) // true (11pm is quiet)
   * isInQuietHours(1, 22, 6)  // true (1am is quiet)
   * isInQuietHours(7, 22, 6)  // false (7am is not quiet)
   */
  private isInQuietHours(currentHour: number, start: number, end: number): boolean {
    if (start < end) {
      // Normal case: quiet hours within same day (e.g., 14:00-18:00)
      return currentHour >= start && currentHour < end;
    } else {
      // Edge case: quiet hours span midnight (e.g., 22:00-08:00)
      // Includes hours 22,23,0,1,2,3,4,5,6,7 for the example above
      return currentHour >= start || currentHour < end;
    }
  }

  /**
   * Validate notification data fields
   * @private
   */
  private validateNotificationData(notification: InsertNotification): void {
    if (!notification.type) {
      throw new Error('Notification type is required');
    }
    if (!notification.title) {
      throw new Error('Notification title is required');
    }
    if (!notification.content) {
      throw new Error('Notification content is required');
    }
  }

  /**
   * Get default notification preferences with optional overrides
   * Centralizes default values to reduce duplication (DRY principle)
   * @private
   */
  private getDefaultPreferences(
    userId: number,
    overrides?: Partial<InsertNotificationPreferences>
  ): InsertNotificationPreferences {
    return {
      userId,
      priceDropEnabled: true,
      priceDropThresholdPercent: NOTIFICATION_CONSTANTS.PREFERENCES.DEFAULT_PRICE_DROP_THRESHOLD_PERCENT,
      priceDropThresholdAmount: NOTIFICATION_CONSTANTS.PREFERENCES.DEFAULT_PRICE_DROP_THRESHOLD_AMOUNT,
      priceAlertEnabled: true,
      forumMentionEnabled: true,
      badgeEarnedEnabled: true,
      emailEnabled: true,
      inAppEnabled: true,
      maxDailyNotifications: NOTIFICATION_CONSTANTS.PREFERENCES.DEFAULT_MAX_DAILY,
      quietHoursStart: null,
      quietHoursEnd: null,
      ...overrides, // Apply any custom overrides
    };
  }

  /**
   * Emit WebSocket event without blocking operation
   * @private
   */
  private emitWebSocketEvent(operation: string, emitFn: () => Promise<void>): void {
    emitFn().catch(error => {
      // Don't fail the operation if WebSocket emit fails
      logger.error(`[NotificationStorage] Failed to emit WebSocket event`, {
        operation,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }

  // ============================================================================
  // Basic CRUD Operations
  // ============================================================================

  /**
   * Get user's notifications with optional filters
   */
  async getUserNotifications(
    userId: number,
    filters: NotificationFilters = {}
  ): Promise<Notification[]> {
    return this.handleError('getUserNotifications', async () => {
      this.validateUserId(userId);

      const { isRead, type, limit = NOTIFICATION_CONSTANTS.QUERY.DEFAULT_LIMIT, offset = 0 } = filters;

      // Validate pagination parameters
      if (limit <= 0) {
        throw new Error('Limit must be a positive number');
      }
      if (offset < 0) {
        throw new Error('Offset cannot be negative');
      }

      // Build dynamic query conditions
      const conditions: SQL[] = [eq(notifications.userId, userId)];

      if (isRead !== undefined) {
        conditions.push(eq(notifications.isRead, isRead));
      }

      if (type) {
        conditions.push(eq(notifications.type, type));
      }

      const result = await this.db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(Math.min(limit, NOTIFICATION_CONSTANTS.QUERY.MAX_LIMIT))
        .offset(offset);

      return result;
    });
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: number): Promise<NotificationStats> {
    return this.handleError('getNotificationStats', async () => {
      this.validateUserId(userId);

      // Get total and unread counts in a single query (Pattern 4: Database Aggregation)
      const [counts] = await this.db
        .select({
          total: count(),
          unread: sql<number>`count(*) FILTER (WHERE ${notifications.isRead} = false)::int`,
        })
        .from(notifications)
        .where(eq(notifications.userId, userId));

      // Get counts by type using GROUP BY
      const typeRows = await this.db
        .select({
          type: notifications.type,
          count: count(),
        })
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .groupBy(notifications.type);

      // Build byType object from rows
      const byType: Record<string, number> = {};
      typeRows.forEach(row => {
        byType[row.type] = Number(row.count);
      });

      return {
        total: Number(counts?.total || 0),
        unread: counts?.unread || 0,
        byType,
      };
    });
  }

  /**
   * Create a new notification with daily limit enforcement
   */
  async createNotification(notification: InsertNotification): Promise<Notification> {
    return this.handleError('createNotification', async () => {
      this.validateUserId(notification.userId);

      // Validate required notification fields
      this.validateNotificationData(notification);

      // Check user preferences before creating
      const prefs = await this.getUserPreferences(notification.userId);

      // Check if notifications are enabled
      if (!prefs.inAppEnabled) {
        throw new Error('In-app notifications are disabled for this user');
      }

      // Check type-specific settings
      if (notification.type === 'price_drop' && !prefs.priceDropEnabled) {
        throw new Error('Price drop notifications are disabled for this user');
      }

      if (notification.type === 'price_alert' && !prefs.priceAlertEnabled) {
        throw new Error('Price alert notifications are disabled for this user');
      }

      // Check quiet hours
      if (prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null) {
        const now = new Date();
        const currentHour = now.getHours();

        if (this.isInQuietHours(currentHour, prefs.quietHoursStart, prefs.quietHoursEnd)) {
          // Skip notification during quiet hours
          throw new Error('User is in quiet hours');
        }
      }

      // PATTERN 21: SERIALIZABLE transaction with retry logic
      // Use transaction to prevent race conditions in daily limit check
      const created = await retryWithBackoff(
        async () => this.executeTransaction(async (tx) => {
          // Check daily limit within transaction
          // NOTE: Daily limit resets at UTC midnight (not user's local timezone)
          // For multi-timezone support, would need additional timezone field in preferences
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const todayCount = await tx
            .select({ count: count() })
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, notification.userId),
                gte(notifications.createdAt, today)
              )
            );

          if (prefs.maxDailyNotifications && todayCount[0].count >= prefs.maxDailyNotifications) {
            throw new Error('Daily notification limit reached');
          }

          // Create the notification - must be atomic with limit check
          const result = await tx.insert(notifications).values(notification).returning();
          if (result.length === 0) {
            throw new Error('Failed to create notification');
          }
          return result[0];
        }, {
          isolationLevel: 'serializable', // Prevent concurrent notification limit bypass
        }),
        {
          maxAttempts: NOTIFICATION_CONSTANTS.RETRY.MAX_ATTEMPTS,
          initialDelayMs: NOTIFICATION_CONSTANTS.RETRY.INITIAL_DELAY_MS,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'createNotification', userId: notification.userId, type: notification.type },
          onRetry: (error, attempt, delayMs) => {
            logger.warn('[NotificationStorage] Retrying createNotification after serialization error', {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              userId: notification.userId,
              // NOTE: Track retry metrics in production to identify daily limit concurrency patterns
              // Consider adding: metrics.increment('notification.create.serialization.retry', { attempt })
            });
          },
        }
      );

      // PATTERN 22: WebSocket integration (non-blocking)
      // Emit after transaction commits
      this.emitWebSocketEvent('createNotification', async () => {
        const { getSocketIO } = await import('../websocket');
        const { emitNewNotification } = await import('../websocket/handlers/notification-handler');
        const io = getSocketIO();
        if (io) {
          // Get updated unread count
          const stats = await this.getNotificationStats(notification.userId);

          emitNewNotification(io, notification.userId, {
            id: created.id,
            type: created.type,
            title: created.title,
            content: created.content,
          }, stats.unread);
        }
      });

      return created;
    });
  }

  // ============================================================================
  // Update Operations
  // ============================================================================

  /**
   * Mark notification(s) as read
   */
  async markAsRead(userId: number, notificationIds: number | number[]): Promise<number> {
    return this.handleError('markAsRead', async () => {
      this.validateUserId(userId);

      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];

      // Validate all IDs
      ids.forEach(id => this.validateNotificationId(id));

      if (ids.length === 0) {
        return 0;
      }

      const result = await this.db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, userId),
            inArray(notifications.id, ids)
          )
        )
        .returning();

      return result.length;
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<number> {
    return this.handleError('markAllAsRead', async () => {
      this.validateUserId(userId);

      const result = await this.db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .returning();

      return result.length;
    });
  }

  // ============================================================================
  // Delete Operations
  // ============================================================================

  /**
   * Delete a notification (with ownership verification)
   */
  async deleteNotification(userId: number, notificationId: number): Promise<boolean> {
    return this.handleError('deleteNotification', async () => {
      this.validateUserId(userId);
      this.validateNotificationId(notificationId);

      const result = await this.db
        .delete(notifications)
        .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
        .returning();

      return result.length > 0;
    });
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId: number): Promise<number> {
    return this.handleError('deleteAllNotifications', async () => {
      this.validateUserId(userId);

      const result = await this.db
        .delete(notifications)
        .where(eq(notifications.userId, userId))
        .returning();

      return result.length;
    });
  }

  // ============================================================================
  // Preferences Operations
  // ============================================================================

  /**
   * Get user's notification preferences
   */
  async getUserPreferences(userId: number): Promise<NotificationPreferences> {
    return this.handleError('getUserPreferences', async () => {
      this.validateUserId(userId);

      const result = await this.db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (result.length === 0) {
        // Create default preferences if they don't exist
        return await this.createDefaultPreferences(userId);
      }

      return result[0];
    });
  }

  /**
   * Create default notification preferences for a user
   */
  async createDefaultPreferences(userId: number): Promise<NotificationPreferences> {
    return this.handleError('createDefaultPreferences', async () => {
      this.validateUserId(userId);

      const defaultPrefs = this.getDefaultPreferences(userId);

      // PATTERN 10: Atomic operations with ON CONFLICT
      // ON CONFLICT ensures idempotency - multiple concurrent calls will only
      // create one preference record. If two requests arrive simultaneously,
      // one succeeds (returns data), the other gets empty result (conflict).
      // We then fetch the existing record to return consistent data.
      const result = await this.db
        .insert(notificationPreferences)
        .values(defaultPrefs)
        .onConflictDoNothing({ target: notificationPreferences.userId })
        .returning();

      // If conflict occurred (result is empty), fetch the existing preference
      if (result.length === 0) {
        const existing = await this.db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, userId))
          .limit(1);
        return existing[0];
      }

      return result[0];
    });
  }

  /**
   * Update user's notification preferences
   */
  async updateUserPreferences(
    userId: number,
    updates: Partial<InsertNotificationPreferences>
  ): Promise<NotificationPreferences> {
    return this.handleError('updateUserPreferences', async () => {
      this.validateUserId(userId);

      if (!updates || Object.keys(updates).length === 0) {
        this.logDebug('updateUserPreferences', { userId, reason: 'No updates provided' });
        // Return existing preferences
        return await this.getUserPreferences(userId);
      }

      // PATTERN 21: SERIALIZABLE transaction with retry logic
      // Use transaction to prevent race conditions in check + create/update
      return await retryWithBackoff(
        async () => this.executeTransaction(async (tx) => {
          // Check if preferences exist within transaction
          const existing = await tx
            .select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId))
            .limit(1);

          if (existing.length === 0) {
            // Create with updates - must be atomic with existence check
            const defaultPrefs = this.getDefaultPreferences(userId, updates);

            const result = await tx.insert(notificationPreferences).values(defaultPrefs).returning();
            return result[0];
          }

          // Update existing
          const result = await tx
            .update(notificationPreferences)
            .set(updates)
            .where(eq(notificationPreferences.userId, userId))
            .returning();

          return result[0];
        }, {
          isolationLevel: 'serializable', // Prevent concurrent preference creation race
        }),
        {
          maxAttempts: NOTIFICATION_CONSTANTS.RETRY.MAX_ATTEMPTS,
          initialDelayMs: NOTIFICATION_CONSTANTS.RETRY.INITIAL_DELAY_MS,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'updateUserPreferences', userId },
          onRetry: (error, attempt, delayMs) => {
            logger.warn('[NotificationStorage] Retrying updateUserPreferences after serialization error', {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              userId,
              // NOTE: Track retry metrics in production to identify concurrency patterns
              // Consider adding: metrics.increment('notification.preference.serialization.retry', { attempt })
            });
          },
        }
      );
    });
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Get recent price drop notifications for a user
   */
  async getRecentPriceDrops(userId: number, days: number = NOTIFICATION_CONSTANTS.QUERY.DEFAULT_DAYS): Promise<Notification[]> {
    return this.handleError('getRecentPriceDrops', async () => {
      this.validateUserId(userId);
      this.validateDays(days);

      const since = new Date();
      since.setDate(since.getDate() - days);

      return await this.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, 'price_drop'),
            gte(notifications.createdAt, since)
          )
        )
        .orderBy(desc(notifications.createdAt));
    });
  }

  /**
   * Get recent price alert notifications for a user
   */
  async getRecentPriceAlerts(userId: number, days: number = NOTIFICATION_CONSTANTS.QUERY.DEFAULT_DAYS): Promise<Notification[]> {
    return this.handleError('getRecentPriceAlerts', async () => {
      this.validateUserId(userId);
      this.validateDays(days);

      const since = new Date();
      since.setDate(since.getDate() - days);

      return await this.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, 'price_alert'),
            gte(notifications.createdAt, since)
          )
        )
        .orderBy(desc(notifications.createdAt));
    });
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const notificationStorage = new NotificationStorage();
