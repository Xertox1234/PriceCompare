import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db';
import { users, notifications, notificationPreferences } from '@shared/schema';
import { sql } from 'drizzle-orm';
import {
  getUserNotifications,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification,
  getUserPreferences,
  createDefaultPreferences,
  updateUserPreferences,
  getRecentPriceDrops,
  getRecentPriceAlerts,
} from '../notification-service';

/**
 * Notification Service Test Suite
 *
 * Tests notification management including:
 * - Creating notifications with preference checks
 * - Daily notification limits (SERIALIZABLE transaction)
 * - Quiet hours enforcement
 * - Notification retrieval with filters
 * - Bulk operations (mark all as read, delete all)
 * - User preferences management
 * - Type-specific notification queries
 */

// Use sequential execution to avoid race conditions with database state
describe.sequential('Notification Service', () => {
  let testUserId: number;

  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    // Clean database
    await db.delete(notifications);
    await db.delete(notificationPreferences);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

    // Create test user with unique identifier to avoid conflicts when tests run in parallel
    const [user] = await db
      .insert(users)
      .values({
        email: 'notification-test@example.com',
        username: 'notification-testuser',
        passwordHash: 'hashed_password',
        role: 'user',
      })
      .returning();

    testUserId = user.id;
  });

  afterEach(async () => {
    // Cleanup
    await db.delete(notifications);
    await db.delete(notificationPreferences);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  describe('Create Notification', () => {
    it('should create notification with default preferences', async () => {
      const notification = await createNotification({
        userId: testUserId,
        type: 'price_drop',
        title: 'Price Drop!',
        content: 'Product is now $50',
      });

      expect(notification).toBeDefined();
      expect(notification.userId).toBe(testUserId);
      expect(notification.type).toBe('price_drop');
      expect(notification.isRead).toBe(false);
    });

    it('should reject notification when in-app disabled', async () => {
      // Disable in-app notifications
      await updateUserPreferences(testUserId, { inAppEnabled: false });

      await expect(
        createNotification({
          userId: testUserId,
          type: 'price_drop',
          title: 'Test',
          content: 'Test',
        })
      ).rejects.toThrow('In-app notifications are disabled');
    });

    it('should reject price drop notification when disabled', async () => {
      await updateUserPreferences(testUserId, { priceDropEnabled: false });

      await expect(
        createNotification({
          userId: testUserId,
          type: 'price_drop',
          title: 'Price Drop',
          content: 'Test',
        })
      ).rejects.toThrow('Price drop notifications are disabled');
    });

    it('should reject price alert notification when disabled', async () => {
      await updateUserPreferences(testUserId, { priceAlertEnabled: false });

      await expect(
        createNotification({
          userId: testUserId,
          type: 'price_alert',
          title: 'Price Alert',
          content: 'Test',
        })
      ).rejects.toThrow('Price alert notifications are disabled');
    });

    it('should enforce daily notification limit', async () => {
      // Set low daily limit
      await updateUserPreferences(testUserId, { maxDailyNotifications: 2 });

      // Create 2 notifications (should succeed)
      await createNotification({
        userId: testUserId,
        type: 'price_drop',
        title: 'Notification 1',
        content: 'Test',
      });

      await createNotification({
        userId: testUserId,
        type: 'price_drop',
        title: 'Notification 2',
        content: 'Test',
      });

      // Third notification should fail (daily limit reached)
      await expect(
        createNotification({
          userId: testUserId,
          type: 'price_drop',
          title: 'Notification 3',
          content: 'Test',
        })
      ).rejects.toThrow('Daily notification limit reached');
    });

    it('should respect quiet hours', async () => {
      // Set quiet hours (current hour +/- window to ensure we're in quiet time)
      const currentHour = new Date().getHours();
      await updateUserPreferences(testUserId, {
        quietHoursStart: currentHour,
        quietHoursEnd: (currentHour + 1) % 24,
      });

      await expect(
        createNotification({
          userId: testUserId,
          type: 'price_drop',
          title: 'Test',
          content: 'Test',
        })
      ).rejects.toThrow('User is in quiet hours');
    });
  });

  describe('Get User Notifications', () => {
    beforeEach(async () => {
      // Create test notifications
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        await db.insert(notifications).values({
          userId: testUserId,
          type: i % 2 === 0 ? 'price_drop' : 'price_alert',
          title: `Notification ${i + 1}`,
          content: 'Test content',
          isRead: i < 2, // First 2 are read
          createdAt: new Date(now.getTime() - i * 1000), // Stagger timestamps
        });
      }
    });

    it('should get all notifications for user', async () => {
      const notifs = await getUserNotifications(testUserId);

      expect(notifs).toHaveLength(5);
      expect(notifs[0].userId).toBe(testUserId);
    });

    it('should filter by read status', async () => {
      const unread = await getUserNotifications(testUserId, { isRead: false });
      expect(unread).toHaveLength(3);

      const read = await getUserNotifications(testUserId, { isRead: true });
      expect(read).toHaveLength(2);
    });

    it('should filter by type', async () => {
      const priceDrops = await getUserNotifications(testUserId, {
        type: 'price_drop',
      });
      expect(priceDrops).toHaveLength(3);

      const priceAlerts = await getUserNotifications(testUserId, {
        type: 'price_alert',
      });
      expect(priceAlerts).toHaveLength(2);
    });

    it('should support pagination', async () => {
      const page1 = await getUserNotifications(testUserId, { limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = await getUserNotifications(testUserId, { limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      // Should be different notifications
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should order by created date descending', async () => {
      const notifs = await getUserNotifications(testUserId);

      // First should be most recent
      for (let i = 1; i < notifs.length; i++) {
        expect(new Date(notifs[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(notifs[i].createdAt).getTime()
        );
      }
    });
  });

  describe('Notification Statistics', () => {
    beforeEach(async () => {
      // Create mixed notifications
      await db.insert(notifications).values([
        {
          userId: testUserId,
          type: 'price_drop',
          title: 'Drop 1',
          content: 'Test',
          isRead: false,
        },
        {
          userId: testUserId,
          type: 'price_drop',
          title: 'Drop 2',
          content: 'Test',
          isRead: true,
        },
        {
          userId: testUserId,
          type: 'price_alert',
          title: 'Alert 1',
          content: 'Test',
          isRead: false,
        },
        {
          userId: testUserId,
          type: 'forum_mention',
          title: 'Mention 1',
          content: 'Test',
          isRead: false,
        },
      ]);
    });

    it('should return correct notification counts', async () => {
      const stats = await getNotificationStats(testUserId);

      expect(stats.total).toBe(4);
      expect(stats.unread).toBe(3);
    });

    it('should count notifications by type', async () => {
      const stats = await getNotificationStats(testUserId);

      expect(stats.byType.price_drop).toBe(2);
      expect(stats.byType.price_alert).toBe(1);
      expect(stats.byType.forum_mention).toBe(1);
    });
  });

  describe('Mark as Read', () => {
    let notificationIds: number[];

    beforeEach(async () => {
      const notifs = await db
        .insert(notifications)
        .values([
          {
            userId: testUserId,
            type: 'price_drop',
            title: 'Test 1',
            content: 'Content',
            isRead: false,
          },
          {
            userId: testUserId,
            type: 'price_drop',
            title: 'Test 2',
            content: 'Content',
            isRead: false,
          },
          {
            userId: testUserId,
            type: 'price_drop',
            title: 'Test 3',
            content: 'Content',
            isRead: false,
          },
        ])
        .returning();

      notificationIds = notifs.map((n) => n.id);
    });

    it('should mark single notification as read', async () => {
      const count = await markAsRead(testUserId, notificationIds[0]);

      expect(count).toBe(1);

      const notifs = await getUserNotifications(testUserId);
      const marked = notifs.find((n) => n.id === notificationIds[0]);
      expect(marked?.isRead).toBe(true);
    });

    it('should mark multiple notifications as read', async () => {
      const count = await markAsRead(testUserId, [notificationIds[0], notificationIds[1]]);

      expect(count).toBe(2);

      const notifs = await getUserNotifications(testUserId);
      const marked = notifs.filter((n) =>
        [notificationIds[0], notificationIds[1]].includes(n.id)
      );
      expect(marked.every((n) => n.isRead)).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      const count = await markAllAsRead(testUserId);

      expect(count).toBe(3);

      const notifs = await getUserNotifications(testUserId);
      expect(notifs.every((n) => n.isRead)).toBe(true);
    });

    it('should only mark unread notifications', async () => {
      // Mark one as read first
      await markAsRead(testUserId, notificationIds[0]);

      // Mark all - should only affect the 2 remaining unread
      const count = await markAllAsRead(testUserId);
      expect(count).toBe(2);
    });
  });

  describe('Delete Notifications', () => {
    let notificationIds: number[];

    beforeEach(async () => {
      const notifs = await db
        .insert(notifications)
        .values([
          {
            userId: testUserId,
            type: 'price_drop',
            title: 'Test 1',
            content: 'Content',
          },
          {
            userId: testUserId,
            type: 'price_drop',
            title: 'Test 2',
            content: 'Content',
          },
        ])
        .returning();

      notificationIds = notifs.map((n) => n.id);
    });

    it('should delete single notification', async () => {
      const deleted = await deleteNotification(testUserId, notificationIds[0]);

      expect(deleted).toBe(true);

      const notifs = await getUserNotifications(testUserId);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].id).toBe(notificationIds[1]);
    });

    it('should not delete notification from different user', async () => {
      const deleted = await deleteNotification(999, notificationIds[0]);

      expect(deleted).toBe(false);

      const notifs = await getUserNotifications(testUserId);
      expect(notifs).toHaveLength(2);
    });

    it('should delete all user notifications', async () => {
      const count = await deleteAllNotifications(testUserId);

      expect(count).toBe(2);

      const notifs = await getUserNotifications(testUserId);
      expect(notifs).toHaveLength(0);
    });
  });

  describe('User Preferences', () => {
    it('should create default preferences', async () => {
      const prefs = await createDefaultPreferences(testUserId);

      expect(prefs.userId).toBe(testUserId);
      expect(prefs.priceDropEnabled).toBe(true);
      expect(prefs.priceAlertEnabled).toBe(true);
      expect(prefs.inAppEnabled).toBe(true);
      expect(prefs.maxDailyNotifications).toBe(10);
    });

    it('should get existing preferences', async () => {
      await createDefaultPreferences(testUserId);

      const prefs = await getUserPreferences(testUserId);

      expect(prefs.userId).toBe(testUserId);
    });

    it('should create default preferences if none exist', async () => {
      const prefs = await getUserPreferences(testUserId);

      expect(prefs).toBeDefined();
      expect(prefs.userId).toBe(testUserId);
    });

    it('should update existing preferences', async () => {
      await createDefaultPreferences(testUserId);

      const updated = await updateUserPreferences(testUserId, {
        priceDropEnabled: false,
        maxDailyNotifications: 5,
      });

      expect(updated.priceDropEnabled).toBe(false);
      expect(updated.maxDailyNotifications).toBe(5);
      expect(updated.priceAlertEnabled).toBe(true); // Unchanged
    });

    it('should create preferences on first update if none exist', async () => {
      const prefs = await updateUserPreferences(testUserId, {
        priceDropEnabled: false,
      });

      expect(prefs).toBeDefined();
      expect(prefs.priceDropEnabled).toBe(false);
    });

    it('should support quiet hours configuration', async () => {
      const prefs = await updateUserPreferences(testUserId, {
        quietHoursStart: 22,
        quietHoursEnd: 7,
      });

      expect(prefs.quietHoursStart).toBe(22);
      expect(prefs.quietHoursEnd).toBe(7);
    });
  });

  describe('Type-Specific Queries', () => {
    beforeEach(async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Create notifications at different times
      await db.insert(notifications).values([
        {
          userId: testUserId,
          type: 'price_drop',
          title: 'Recent drop',
          content: 'Test',
          createdAt: threeDaysAgo,
        },
        {
          userId: testUserId,
          type: 'price_drop',
          title: 'Old drop',
          content: 'Test',
          createdAt: tenDaysAgo,
        },
        {
          userId: testUserId,
          type: 'price_alert',
          title: 'Recent alert',
          content: 'Test',
          createdAt: threeDaysAgo,
        },
        {
          userId: testUserId,
          type: 'price_alert',
          title: 'Old alert',
          content: 'Test',
          createdAt: tenDaysAgo,
        },
      ]);
    });

    it('should get recent price drops (default 7 days)', async () => {
      const drops = await getRecentPriceDrops(testUserId);

      expect(drops).toHaveLength(1);
      expect(drops[0].title).toBe('Recent drop');
    });

    it('should get recent price alerts (default 7 days)', async () => {
      const alerts = await getRecentPriceAlerts(testUserId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].title).toBe('Recent alert');
    });

    it('should support custom time window', async () => {
      const drops = await getRecentPriceDrops(testUserId, 30);

      expect(drops).toHaveLength(2);
    });

    it('should order results by date descending', async () => {
      const drops = await getRecentPriceDrops(testUserId, 30);

      expect(drops[0].title).toBe('Recent drop');
      expect(drops[1].title).toBe('Old drop');
    });
  });
});
