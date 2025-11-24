import { storage, NotificationFilters, NotificationStats } from "../storage";
import {
  type Notification,
  type NotificationPreferences,
  type InsertNotification,
  type InsertNotificationPreferences
} from "@shared/schema";
import { logger } from "../utils/logger";

/**
 * Notification Service
 *
 * Handles creation, retrieval, and management of user notifications
 * and notification preferences.
 *
 * NOTE: This service delegates to storage layer for database operations
 * and handles business logic (preference checks, quiet hours, WebSocket events)
 */

// Re-export types for consumers that import from this service
export type { NotificationFilters, NotificationStats };

/**
 * Get user's notifications with optional filters
 */
export async function getUserNotifications(
  userId: number,
  filters: NotificationFilters = {}
): Promise<Notification[]> {
  return storage.getUserNotifications(userId, filters);
}

/**
 * Get notification statistics for a user
 * Uses database aggregation for optimal performance
 */
export async function getNotificationStats(userId: number): Promise<NotificationStats> {
  return storage.getNotificationStats(userId);
}

/**
 * Mark notification(s) as read
 */
export async function markAsRead(
  userId: number,
  notificationIds: number | number[]
): Promise<number> {
  return storage.markNotificationsAsRead(userId, notificationIds);
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: number): Promise<number> {
  return storage.markAllNotificationsAsRead(userId);
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  userId: number,
  notificationId: number
): Promise<boolean> {
  return storage.deleteNotification(userId, notificationId);
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: number): Promise<number> {
  return storage.deleteAllNotifications(userId);
}

/**
 * Create a new notification
 *
 * Business logic handled here:
 * - Preference checks (in-app enabled, type-specific settings)
 * - Quiet hours enforcement
 * - WebSocket event emission after creation
 *
 * Storage handles:
 * - Daily limit check with transaction
 * - Actual database insert
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

  // Create notification via storage (handles daily limit check with transaction)
  const created = await storage.createNotificationWithLimitCheck(
    notification,
    prefs.maxDailyNotifications ?? undefined
  );

  // Emit WebSocket event after transaction commits
  try {
    const { getSocketIO } = await import('../websocket');
    const { emitNewNotification } = await import('../websocket/handlers/notification-handler');
    const io = getSocketIO();
    if (io) {
      // Get updated unread count
      const stats = await getNotificationStats(notification.userId);

      emitNewNotification(io, notification.userId, {
        id: created.id,
        type: created.type,
        title: created.title,
        content: created.content ?? '',
        priority: 'normal', // Default priority - field not in schema
      }, stats.unread);
    }
  } catch (error) {
    // Don't fail the operation if WebSocket emit fails
    logger.error('Failed to emit new notification event:', { error: error instanceof Error ? error.message : String(error) });
  }

  return created;
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
  const prefs = await storage.getUserNotificationPreferences(userId);

  if (!prefs) {
    // Create default preferences if they don't exist
    return await createDefaultPreferences(userId);
  }

  return prefs;
}

/**
 * Create default notification preferences for a user
 * Uses ON CONFLICT to handle race conditions when multiple requests
 * try to create preferences simultaneously
 */
export async function createDefaultPreferences(
  userId: number
): Promise<NotificationPreferences> {
  return storage.createDefaultNotificationPreferences(userId);
}

/**
 * Update user's notification preferences
 */
export async function updateUserPreferences(
  userId: number,
  updates: Partial<InsertNotificationPreferences>
): Promise<NotificationPreferences> {
  return storage.updateUserNotificationPreferences(userId, updates);
}

/**
 * Get recent price drop notifications for a user
 */
export async function getRecentPriceDrops(
  userId: number,
  days: number = 7
): Promise<Notification[]> {
  return storage.getRecentNotificationsByType(userId, 'price_drop', days);
}

/**
 * Get recent price alert notifications for a user
 */
export async function getRecentPriceAlerts(
  userId: number,
  days: number = 7
): Promise<Notification[]> {
  return storage.getRecentNotificationsByType(userId, 'price_alert', days);
}
