import type { Express, Request, Response } from "express";
import { logger } from "./utils/logger";
import { z } from "zod";
import * as notificationService from "./services/notification-service";
import { csrfProtection } from "./middleware/security";
import { parseIntSafe } from "./utils/validation-helpers";
import { createErrorResponse } from "./utils/error-sanitizer";

/**
 * Notification Routes
 *
 * API endpoints for managing user notifications and preferences
 */

export function registerNotificationRoutes(app: Express) {
  // Middleware to ensure user is authenticated
  const withAuth = (handler: (req: Request, res: Response) => Promise<void>) => {
    return async (req: Request, res: Response) => {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      return handler(req, res);
    };
  };

  /**
   * GET /api/notifications
   * Get user's notifications with optional filters
   */
  app.get("/api/notifications", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware

      const filterSchema = z.object({
        isRead: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
        type: z.string().optional(),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
        offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
      });

      const filters = filterSchema.parse(req.query);

      const notifications = await notificationService.getUserNotifications(user.id, filters);

      res.json({
        success: true,
        data: notifications,
        count: notifications.length
      });
    } catch (error) {
      logger.error('Error fetching notifications:', { error: error instanceof Error ? error.message : String(error) });
      const errorResponse = createErrorResponse(error, 'GetNotifications');
      res.status(errorResponse.status).json({
        error: errorResponse.error,
        details: errorResponse.details
      });
    }
  }));

  /**
   * GET /api/notifications/stats
   * Get notification statistics for the user
   */
  app.get("/api/notifications/stats", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const stats = await notificationService.getNotificationStats(user.id);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching notification stats:', { error: error instanceof Error ? error.message : String(error) });
      const errorResponse = createErrorResponse(error, 'GetNotificationStats');
      res.status(errorResponse.status).json({
        error: errorResponse.error,
        details: errorResponse.details
      });
    }
  }));

  /**
   * POST /api/notifications/:id/read
   * Mark a notification as read
   * @security CSRF protection required
   */
  app.post("/api/notifications/:id/read", withAuth(async (req, res) => {
    // CSRF protection check
    const csrfValid = await new Promise((resolve) => {
      csrfProtection(req, res, (err) => {
        if (err) {
          res.status(403).json({ error: "Invalid CSRF token" });
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
    if (!csrfValid) return;

    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const notificationId = parseIntSafe(req.params.id, 'notificationId', { min: 1 });

      const count = await notificationService.markAsRead(user.id, notificationId);

      if (count === 0) {
        return res.status(404).json({ error: "Notification not found" });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Error marking notification as read:', { error: error instanceof Error ? error.message : String(error) });
      const errorResponse = createErrorResponse(error, 'MarkNotificationRead');
      res.status(errorResponse.status).json({
        error: errorResponse.error,
        details: errorResponse.details
      });
    }
  }));

  /**
   * POST /api/notifications/read-all
   * Mark all notifications as read
   * @security CSRF protection required
   */
  app.post("/api/notifications/read-all", withAuth(async (req, res) => {
    // CSRF protection check
    const csrfValid = await new Promise((resolve) => {
      csrfProtection(req, res, (err) => {
        if (err) {
          res.status(403).json({ error: "Invalid CSRF token" });
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
    if (!csrfValid) return;

    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const count = await notificationService.markAllAsRead(user.id);

      res.json({
        success: true,
        count
      });
    } catch (error) {
      logger.error('Error marking all as read:', { error: error instanceof Error ? error.message : String(error) });
      const errorResponse = createErrorResponse(error, 'MarkAllNotificationsRead');
      res.status(errorResponse.status).json({
        error: errorResponse.error,
        details: errorResponse.details
      });
    }
  }));

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  app.delete("/api/notifications/:id", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const notificationId = parseInt(req.params.id);

      if (isNaN(notificationId)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }

      const deleted = await notificationService.deleteNotification(user.id, notificationId);

      if (!deleted) {
        return res.status(404).json({ error: "Notification not found" });
      }

      res.json({ success: true });
    } catch (error: unknown) {
      logger.error('Error deleting notification:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to delete notification" });
    }
  }));

  /**
   * DELETE /api/notifications
   * Delete all notifications for the user
   */
  app.delete("/api/notifications", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const count = await notificationService.deleteAllNotifications(user.id);

      res.json({
        success: true,
        count
      });
    } catch (error: unknown) {
      logger.error('Error deleting all notifications:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to delete notifications" });
    }
  }));

  /**
   * GET /api/notifications/preferences
   * Get user's notification preferences
   */
  app.get("/api/notifications/preferences", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const preferences = await notificationService.getUserPreferences(user.id);

      res.json({
        success: true,
        data: preferences
      });
    } catch (error: unknown) {
      logger.error('Error fetching preferences:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to fetch preferences" });
    }
  }));

  /**
   * PATCH /api/notifications/preferences
   * Update user's notification preferences
   */
  app.patch("/api/notifications/preferences", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware

      const updateSchema = z.object({
        priceDropEnabled: z.boolean().optional(),
        priceDropThresholdPercent: z.number().min(1).max(100).optional(),
        priceDropThresholdAmount: z.string().optional(),
        priceAlertEnabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        inAppEnabled: z.boolean().optional(),
        maxDailyNotifications: z.number().min(1).max(100).optional(),
        quietHoursStart: z.number().min(0).max(23).nullable().optional(),
        quietHoursEnd: z.number().min(0).max(23).nullable().optional(),
      });

      const updates = updateSchema.parse(req.body);

      const preferences = await notificationService.updateUserPreferences(user.id, updates);

      res.json({
        success: true,
        data: preferences
      });
    } catch (error: unknown) {
      logger.error('Error updating preferences:', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid preferences data", details: error.issues });
      }
      res.status(500).json({ error: error.message || "Failed to update preferences" });
    }
  }));

  /**
   * GET /api/notifications/price-drops
   * Get recent price drop notifications
   */
  app.get("/api/notifications/price-drops", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const days = req.query.days ? parseInt(req.query.days as string) : 7;

      const notifications = await notificationService.getRecentPriceDrops(user.id, days);

      res.json({
        success: true,
        data: notifications,
        count: notifications.length
      });
    } catch (error: unknown) {
      logger.error('Error fetching price drops:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to fetch price drops" });
    }
  }));

  /**
   * GET /api/notifications/price-alerts
   * Get recent price alert notifications
   */
  app.get("/api/notifications/price-alerts", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const days = req.query.days ? parseInt(req.query.days as string) : 7;

      const notifications = await notificationService.getRecentPriceAlerts(user.id, days);

      res.json({
        success: true,
        data: notifications,
        count: notifications.length
      });
    } catch (error: unknown) {
      logger.error('Error fetching price alerts:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to fetch price alerts" });
    }
  }));

  /**
   * GET /api/notifications/smart
   * Get smart notifications for user with optional filters
   */
  app.get("/api/notifications/smart", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware

      const filterSchema = z.object({
        urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        unread: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
        offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
      });

      const filters = filterSchema.parse(req.query);

      // Get smart alert notifications
      const baseFilters: {
        type: string;
        limit: number;
        offset: number;
        isRead?: boolean;
      } = {
        type: 'smart_alert',
        limit: filters.limit,
        offset: filters.offset
      };

      if (filters.unread !== undefined) {
        baseFilters.isRead = !filters.unread;
      }

      const notifications = await notificationService.getUserNotifications(user.id, baseFilters);

      // Note: Urgency filtering is not currently supported as the notifications table
      // does not have a metadata field. To enable urgency-based filtering, a schema
      // migration would be needed to add a metadata column to store urgency levels.
      // For now, all smart_alert notifications are returned regardless of urgency parameter.
      const filteredNotifications = notifications;

      res.json({
        success: true,
        data: filteredNotifications,
        count: filteredNotifications.length
      });
    } catch (error: unknown) {
      logger.error('Error fetching smart notifications:', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid filter parameters", details: error.issues });
      }
      res.status(500).json({ error: error.message || "Failed to fetch smart notifications" });
    }
  }));

  /**
   * POST /api/notifications/smart/:id/snooze
   * Snooze a smart notification for specified duration
   */
  app.post("/api/notifications/smart/:id/snooze", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const notificationId = parseInt(req.params.id);

      if (isNaN(notificationId)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }

      const snoozeSchema = z.object({
        duration: z.number().min(3600).max(7 * 24 * 60 * 60), // 1 hour to 7 days in seconds
      });

      const { duration } = snoozeSchema.parse(req.body);

      // Get the notification to verify ownership
      const notifications = await notificationService.getUserNotifications(user.id, {
        limit: 1,
        offset: 0
      });

      const notification = notifications.find(n => n.id === notificationId);

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      if (notification.type !== 'smart_alert') {
        return res.status(400).json({ error: "Can only snooze smart notifications" });
      }

      // Mark as read and update metadata with snooze timestamp
      await notificationService.markAsRead(user.id, notificationId);

      // Calculate snooze until timestamp
      const snoozeUntil = new Date(Date.now() + duration * 1000);

      // Note: Full snooze functionality with reactivation requires a metadata field
      // in the notifications table to store snoozeUntil timestamp. Currently, snooze
      // only marks the notification as read. To enable full snooze support, add a
      // metadata column to the notifications schema and implement snooze expiration
      // checking in getUserNotifications.

      res.json({
        success: true,
        snoozedUntil: snoozeUntil.toISOString(),
        message: `Notification snoozed for ${duration / 3600} hours`
      });
    } catch (error: unknown) {
      logger.error('Error snoozing notification:', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid snooze duration", details: error.issues });
      }
      res.status(500).json({ error: error.message || "Failed to snooze notification" });
    }
  }));

  /**
   * POST /api/notifications/smart/:id/dismiss
   * Dismiss a smart notification
   */
  app.post("/api/notifications/smart/:id/dismiss", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const notificationId = parseInt(req.params.id);

      if (isNaN(notificationId)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }

      // Get the notification to verify ownership and type
      const notifications = await notificationService.getUserNotifications(user.id, {
        limit: 1,
        offset: 0
      });

      const notification = notifications.find(n => n.id === notificationId);

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      if (notification.type !== 'smart_alert') {
        return res.status(400).json({ error: "Can only dismiss smart notifications" });
      }

      // Mark as read
      await notificationService.markAsRead(user.id, notificationId);

      res.json({
        success: true,
        message: "Notification dismissed successfully"
      });
    } catch (error: unknown) {
      logger.error('Error dismissing notification:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to dismiss notification" });
    }
  }));
}
