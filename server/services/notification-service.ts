import { storage } from "../storage";
import { eventBus, AppEvents } from "../utils/event-bus";
import {
  type Notification,
  type NotificationPreferences,
  type InsertNotification,
  type InsertNotificationPreferences
} from "@shared/schema";

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
  return storage.markAsRead(userId, notificationIds);
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: number): Promise<number> {
  return storage.markAllAsRead(userId);
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

  // Create notification with transaction and retry logic (moved to storage layer)
  const created = await storage.createNotification(notification, prefs);

  // Emit event via event bus for WebSocket broadcast (decoupled)
  eventBus.emit(AppEvents.NOTIFICATION_CREATED, {
    userId: notification.userId,
    notification: {
      id: created.id,
      type: created.type,
      title: created.title,
      message: created.content ?? '',
      data: undefined,
      createdAt: created.createdAt ?? new Date()
    }
  });

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
  const prefs = await storage.getUserPreferences(userId);

  if (!prefs) {
    // Create default preferences if they don't exist
    return createDefaultPreferences(userId);
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
  return storage.createDefaultPreferences(userId);
}

/**
 * Update user's notification preferences
 */
export async function updateUserPreferences(
  userId: number,
  updates: Partial<InsertNotificationPreferences>
): Promise<NotificationPreferences> {
  return storage.updateUserPreferences(userId, updates);
}

/**
 * Get recent price drop notifications for a user
 */
export async function getRecentPriceDrops(
  userId: number,
  days = 7
): Promise<Notification[]> {
  return storage.getRecentPriceDrops(userId, days);
}

/**
 * Get recent price alert notifications for a user
 */
export async function getRecentPriceAlerts(
  userId: number,
  days = 7
): Promise<Notification[]> {
  return storage.getRecentPriceAlerts(userId, days);
}
