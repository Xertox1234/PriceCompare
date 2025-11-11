import { db } from "@db";
import {
  notifications,
  notificationPreferences,
  type Notification,
  type NotificationPreferences,
  type InsertNotification,
  type InsertNotificationPreferences
} from "@db/schema";
import { eq, and, desc, count, gte, sql } from "drizzle-orm";

/**
 * Notification Service
 *
 * Handles creation, retrieval, and management of user notifications
 * and notification preferences.
 */

export interface NotificationFilters {
  isRead?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

/**
 * Get user's notifications with optional filters
 */
export async function getUserNotifications(
  userId: number,
  filters: NotificationFilters = {}
): Promise<Notification[]> {
  const { isRead, type, limit = 50, offset = 0 } = filters;

  let query = db
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

  const result = await query
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return result;
}

/**
 * Get notification statistics for a user
 */
export async function getNotificationStats(userId: number): Promise<NotificationStats> {
  const allNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const stats: NotificationStats = {
    total: allNotifications.length,
    unread: allNotifications.filter(n => !n.isRead).length,
    byType: {},
  };

  // Count by type
  allNotifications.forEach(notification => {
    stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
  });

  return stats;
}

/**
 * Mark notification(s) as read
 */
export async function markAsRead(
  userId: number,
  notificationIds: number | number[]
): Promise<number> {
  const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];

  const result = await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, userId),
        sql`${notifications.id} = ANY(${ids})`
      )
    )
    .returning();

  return result.length;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: number): Promise<number> {
  const result = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .returning();

  return result.length;
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  userId: number,
  notificationId: number
): Promise<boolean> {
  const result = await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning();

  return result.length > 0;
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: number): Promise<number> {
  const result = await db
    .delete(notifications)
    .where(eq(notifications.userId, userId))
    .returning();

  return result.length;
}

/**
 * Create a new notification
 */
export async function createNotification(
  notification: InsertNotification
): Promise<Notification> {
  // Check user preferences before creating
  const prefs = await getUserPreferences(notification.userId);

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

    if (isInQuietHours(currentHour, prefs.quietHoursStart, prefs.quietHoursEnd)) {
      // Skip notification during quiet hours (or queue for later)
      throw new Error('User is in quiet hours');
    }
  }

  // Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, notification.userId),
        gte(notifications.createdAt, today)
      )
    );

  if (todayCount[0].count >= prefs.maxDailyNotifications) {
    throw new Error('Daily notification limit reached');
  }

  // Create the notification
  const result = await db.insert(notifications).values(notification).returning();
  return result[0];
}

/**
 * Helper to check if current hour is in quiet hours
 */
function isInQuietHours(currentHour: number, start: number, end: number): boolean {
  if (start < end) {
    return currentHour >= start && currentHour < end;
  } else {
    // Quiet hours span midnight
    return currentHour >= start || currentHour < end;
  }
}

/**
 * Get user's notification preferences
 */
export async function getUserPreferences(userId: number): Promise<NotificationPreferences> {
  const result = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (result.length === 0) {
    // Create default preferences if they don't exist
    return await createDefaultPreferences(userId);
  }

  return result[0];
}

/**
 * Create default notification preferences for a user
 */
export async function createDefaultPreferences(
  userId: number
): Promise<NotificationPreferences> {
  const defaultPrefs: InsertNotificationPreferences = {
    userId,
    priceDropEnabled: true,
    priceDropThresholdPercent: 10,
    priceDropThresholdAmount: "5.00",
    priceAlertEnabled: true,
    emailEnabled: true,
    inAppEnabled: true,
    maxDailyNotifications: 10,
    quietHoursStart: null,
    quietHoursEnd: null,
  };

  const result = await db
    .insert(notificationPreferences)
    .values(defaultPrefs)
    .returning();

  return result[0];
}

/**
 * Update user's notification preferences
 */
export async function updateUserPreferences(
  userId: number,
  updates: Partial<InsertNotificationPreferences>
): Promise<NotificationPreferences> {
  // Check if preferences exist
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    // Create with updates
    return await createDefaultPreferences(userId);
  }

  // Update existing
  const result = await db
    .update(notificationPreferences)
    .set(updates)
    .where(eq(notificationPreferences.userId, userId))
    .returning();

  return result[0];
}

/**
 * Get recent price drop notifications for a user
 */
export async function getRecentPriceDrops(
  userId: number,
  days: number = 7
): Promise<Notification[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return await db
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
}

/**
 * Get recent price alert notifications for a user
 */
export async function getRecentPriceAlerts(
  userId: number,
  days: number = 7
): Promise<Notification[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return await db
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
}
