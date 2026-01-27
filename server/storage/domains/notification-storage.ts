/**
 * Notification Storage Domain
 *
 * Handles all notification-related database operations including smart alerts,
 * user preferences, and notification counts.
 *
 * Phase 8E: Smart Notification Service Migration
 * Phase 8A: Notification Service Migration (Extended)
 */

import { eq, and, gte, sql, desc, count, inArray } from 'drizzle-orm';
import {
  notifications,
  notificationPreferences,
  type Notification,
  type NotificationPreferences,
  type InsertNotification,
  type InsertNotificationPreferences,
} from '@shared/schema';
import { BaseStorage } from '../base-storage';
import { getFirstResult } from '../../utils/db-helpers';
import { retryWithBackoff, isTransientDatabaseError } from '../../utils/retry-with-backoff';
import { logger } from '../../utils/logger';

export class NotificationStorage extends BaseStorage {
  /**
   * Build common notification select fields
   * Used by: All notification query methods to ensure consistent field selection
   * @private
   */
  private buildNotificationSelect() {
    return {
      id: notifications.id,
      userId: notifications.userId,
      type: notifications.type,
      title: notifications.title,
      content: notifications.content,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      relatedPostId: notifications.relatedPostId,
      relatedTopicId: notifications.relatedTopicId,
      relatedUserId: notifications.relatedUserId,
      relatedProductId: notifications.relatedProductId,
    };
  }

  /**
   * Get recent notifications by type for a user
   * Used by: getRecentPriceDrops, getRecentPriceAlerts
   * @private
   */
  private async getRecentNotificationsByType(
    userId: number,
    type: string,
    days: number
  ): Promise<Notification[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      return await this.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, type),
            gte(notifications.createdAt, since)
          )
        )
        .orderBy(desc(notifications.createdAt));
    } catch (error) {
      this.handleError(error, 'getRecentNotificationsByType');
      return [];
    }
  }

  /**
   * Get count of notifications by type for a user since a specific date
   *
   * @param userId - User ID to count notifications for
   * @param type - Notification type (e.g., 'smart_alert')
   * @param sinceDate - Count notifications created after this date
   * @returns Number of notifications
   */
  async getNotificationCountByType(userId: number, type: string, sinceDate: Date): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, type),
            gte(notifications.createdAt, sinceDate)
          )
        );

      // Type assertion: Drizzle returns count(*) as string, convert to number
      return Number(result[0]?.count || 0);
    } catch (error) {
      this.handleError(error, 'getNotificationCountByType');
      return 0;
    }
  }

  /**
   * Get user email and username by user ID
   *
   * @param userId - User ID to fetch
   * @returns User with email and username only, or null if not found
   */
  async getUserEmailById(userId: number): Promise<{ email: string; username: string } | null> {
    try {
      const user = await this.db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, userId),
        columns: {
          email: true,
          username: true,
        },
      });

      return user || null;
    } catch (error) {
      this.handleError(error, 'getUserEmailById');
      return null;
    }
  }

  /**
   * Get user's notifications with optional filters
   * Phase 8A: Migrated from notification-service.ts
   */
  async getUserNotifications(
    userId: number,
    filters: {
      isRead?: boolean;
      type?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Notification[]> {
    try {
      const { isRead, type, limit = 50, offset = 0 } = filters;

      let query = this.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .$dynamic();

      if (isRead !== undefined) {
        query = query.where(eq(notifications.isRead, isRead));
      }

      if (type) {
        query = query.where(eq(notifications.type, type));
      }

      const result = await query.orderBy(desc(notifications.createdAt)).limit(limit).offset(offset);

      return result;
    } catch (error) {
      this.handleError(error, 'getUserNotifications');
      return [];
    }
  }

  /**
   * Get notification statistics for a user
   * Uses database aggregation for optimal performance
   * Phase 8A: Migrated from notification-service.ts
   */
  async getNotificationStats(userId: number): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    try {
      // Get total and unread counts in a single query
      const [counts] = await this.db
        .select({
          total: count(),
          // Type assertion: SQL aggregate with ::int cast returns typed as number
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
      typeRows.forEach((row) => {
        byType[row.type] = Number(row.count);
      });

      return {
        total: Number(counts?.total || 0),
        unread: counts?.unread || 0,
        byType,
      };
    } catch (error) {
      this.handleError(error, 'getNotificationStats');
      return { total: 0, unread: 0, byType: {} };
    }
  }

  /**
   * Mark notification(s) as read
   * Phase 8A: Migrated from notification-service.ts
   */
  async markAsRead(userId: number, notificationIds: number | number[]): Promise<number> {
    try {
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];

      const result = await this.db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)))
        .returning();

      return result.length;
    } catch (error) {
      this.handleError(error, 'markAsRead');
      return 0;
    }
  }

  /**
   * Mark all notifications as read for a user
   * Phase 8A: Migrated from notification-service.ts
   */
  async markAllAsRead(userId: number): Promise<number> {
    try {
      const result = await this.db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .returning();

      return result.length;
    } catch (error) {
      this.handleError(error, 'markAllAsRead');
      return 0;
    }
  }

  /**
   * Delete a notification
   * Phase 8A: Migrated from notification-service.ts
   */
  async deleteNotification(userId: number, notificationId: number): Promise<boolean> {
    try {
      const result = await this.db
        .delete(notifications)
        .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
        .returning();

      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'deleteNotification');
      return false;
    }
  }

  /**
   * Delete all notifications for a user
   * Phase 8A: Migrated from notification-service.ts
   */
  async deleteAllNotifications(userId: number): Promise<number> {
    try {
      const result = await this.db
        .delete(notifications)
        .where(eq(notifications.userId, userId))
        .returning();

      return result.length;
    } catch (error) {
      this.handleError(error, 'deleteAllNotifications');
      return 0;
    }
  }

  /**
   * Create a new notification with transaction and retry logic
   * RACE CONDITION: Uses SERIALIZABLE transaction for limit check + creation
   * RETRY: SERIALIZABLE transactions can fail with serialization errors under concurrent load
   * Phase 8A: Migrated from notification-service.ts
   */
  async createNotification(
    notification: InsertNotification,
    preferences: NotificationPreferences
  ): Promise<Notification> {
    // RACE CONDITION: Use transaction with SERIALIZABLE isolation for limit check + creation
    // Without transaction, concurrent notifications could bypass daily limit
    // RETRY: SERIALIZABLE transactions can fail with serialization errors under concurrent load
    const created = await retryWithBackoff(
      async () =>
        this.db.transaction(
          async (tx) => {
            // Check daily limit within transaction
            // IMPORTANT: Use local midnight because PostgreSQL 'timestamp' (without timezone)
            // stores local time, but Drizzle interprets it as UTC when reading.
            // Using setHours() (local) instead of setUTCHours() ensures the comparison works correctly.
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Local midnight, not UTC

            const todayCount = await tx
              .select({ count: count() })
              .from(notifications)
              .where(
                and(
                  eq(notifications.userId, notification.userId),
                  gte(notifications.createdAt, today)
                )
              );

            // IMPORTANT: Drizzle count() returns bigint as string from PostgreSQL
            // Must convert to number for proper comparison
            const currentCount = Number(todayCount[0].count);

            if (
              preferences.maxDailyNotifications &&
              currentCount >= preferences.maxDailyNotifications
            ) {
              throw new Error('Daily notification limit reached');
            }

            // Create the notification - must be atomic with limit check
            const result = await tx.insert(notifications).values(notification).returning();
            const created = getFirstResult(result);
            if (!created) {
              throw new Error('Failed to create notification');
            }
            return created;
          },
          {
            isolationLevel: 'serializable', // Prevent concurrent notification limit bypass
          }
        ),
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        isRetryable: isTransientDatabaseError,
        context: {
          operation: 'createNotification',
          userId: notification.userId,
          type: notification.type,
        },
        onRetry: (error, attempt, delayMs) => {
          logger.warn(
            '[NotificationStorage] Retrying createNotification after serialization error',
            {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              userId: notification.userId,
            }
          );
        },
      }
    );

    return created;
  }

  /**
   * Get user's notification preferences
   * Phase 8A: Migrated from notification-service.ts
   */
  async getUserPreferences(userId: number): Promise<NotificationPreferences | null> {
    try {
      const result = await this.db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0];
    } catch (error) {
      this.handleError(error, 'getUserPreferences');
      return null;
    }
  }

  /**
   * Create default notification preferences for a user
   * Uses ON CONFLICT to handle race conditions when multiple requests
   * try to create preferences simultaneously
   * Phase 8A: Migrated from notification-service.ts
   */
  async createDefaultPreferences(userId: number): Promise<NotificationPreferences> {
    const defaultPrefs: InsertNotificationPreferences = {
      userId,
      priceDropEnabled: true,
      priceDropThresholdPercent: 10,
      priceDropThresholdAmount: '5.00',
      priceAlertEnabled: true,
      emailEnabled: true,
      inAppEnabled: true,
      maxDailyNotifications: 10,
      quietHoursStart: null,
      quietHoursEnd: null,
    };

    try {
      // Use ON CONFLICT to handle concurrent creation attempts
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
    } catch (error) {
      this.handleError(error, 'createDefaultPreferences');
      throw error;
    }
  }

  /**
   * Update user's notification preferences
   * RACE CONDITION: Uses SERIALIZABLE transaction for check + create/update
   * RETRY: SERIALIZABLE transactions can fail with serialization errors under concurrent load
   * Phase 8A: Migrated from notification-service.ts
   */
  async updateUserPreferences(
    userId: number,
    updates: Partial<InsertNotificationPreferences>
  ): Promise<NotificationPreferences> {
    // RACE CONDITION: Use transaction with SERIALIZABLE isolation for check + create/update
    // Without transaction, concurrent updates could both try to create defaults (constraint violation)
    // RETRY: SERIALIZABLE transactions can fail with serialization errors under concurrent load
    return retryWithBackoff(
      async () =>
        this.db.transaction(
          async (tx) => {
            // Check if preferences exist within transaction
            const existing = await tx
              .select()
              .from(notificationPreferences)
              .where(eq(notificationPreferences.userId, userId))
              .limit(1);

            if (existing.length === 0) {
              // Create with updates - must be atomic with existence check
              const defaultPrefs: InsertNotificationPreferences = {
                userId,
                inAppEnabled: true,
                emailEnabled: false,
                priceDropEnabled: true,
                priceAlertEnabled: true,
                quietHoursStart: null,
                quietHoursEnd: null,
                maxDailyNotifications: 50,
                ...updates, // Apply user updates
              };

              const result = await tx
                .insert(notificationPreferences)
                .values(defaultPrefs)
                .returning();
              return result[0];
            }

            // Update existing
            const result = await tx
              .update(notificationPreferences)
              .set(updates)
              .where(eq(notificationPreferences.userId, userId))
              .returning();

            return result[0];
          },
          {
            isolationLevel: 'serializable', // Prevent concurrent preference creation race
          }
        ),
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        isRetryable: isTransientDatabaseError,
        context: { operation: 'updateUserPreferences', userId },
        onRetry: (error, attempt, delayMs) => {
          logger.warn(
            '[NotificationStorage] Retrying updateUserPreferences after serialization error',
            {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              userId,
            }
          );
        },
      }
    );
  }

  /**
   * Get recent price drop notifications for a user
   * Phase 8A: Migrated from notification-service.ts
   */
  async getRecentPriceDrops(userId: number, days = 7): Promise<Notification[]> {
    return this.getRecentNotificationsByType(userId, 'price_drop', days);
  }

  /**
   * Get recent price alert notifications for a user
   * Phase 8A: Migrated from notification-service.ts
   */
  async getRecentPriceAlerts(userId: number, days = 7): Promise<Notification[]> {
    return this.getRecentNotificationsByType(userId, 'price_alert', days);
  }

  /**
   * Batch get user emails and usernames by user IDs
   * Used to eliminate N+1 queries when sending notifications to multiple users
   *
   * @param userIds - Array of user IDs to fetch
   * @returns Map of userId to { email, username }
   */
  async getUserEmailsBatch(
    userIds: number[]
  ): Promise<Map<number, { email: string; username: string }>> {
    if (userIds.length === 0) {
      return new Map();
    }

    try {
      const { users } = await import('@shared/schema');
      const results = await this.db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
        })
        .from(users)
        .where(inArray(users.id, userIds));

      const map = new Map<number, { email: string; username: string }>();
      for (const row of results) {
        map.set(row.id, { email: row.email, username: row.username });
      }
      return map;
    } catch (error) {
      this.handleError(error, 'getUserEmailsBatch');
      return new Map();
    }
  }

  /**
   * Batch get user notification preferences by user IDs
   * Used to eliminate N+1 queries when checking notification settings for multiple users
   *
   * @param userIds - Array of user IDs to fetch
   * @returns Map of userId to NotificationPreferences
   */
  async getUserPreferencesBatch(
    userIds: number[]
  ): Promise<Map<number, NotificationPreferences>> {
    if (userIds.length === 0) {
      return new Map();
    }

    try {
      const results = await this.db
        .select()
        .from(notificationPreferences)
        .where(inArray(notificationPreferences.userId, userIds));

      const map = new Map<number, NotificationPreferences>();
      for (const row of results) {
        map.set(row.userId, row);
      }
      return map;
    } catch (error) {
      this.handleError(error, 'getUserPreferencesBatch');
      return new Map();
    }
  }
}
