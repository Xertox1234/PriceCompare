import type { Express, Request, Response } from "express";
import { logger } from "./utils/logger";
import { z } from "zod";
import * as notificationService from "./services/notification-service";

/**
 * Notification Routes
 *
 * API endpoints for managing user notifications and preferences
 */

export function registerNotificationRoutes(app: Express) {
  // Middleware to ensure user is authenticated
  const withAuth = (handler: (req: Request, res: Response) => Promise<any>) => {
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
    } catch (error: any) {
      logger.error('Error fetching notifications:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to fetch notifications" });
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
    } catch (error: any) {
      logger.error('Error fetching notification stats:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to fetch stats" });
    }
  }));

  /**
   * POST /api/notifications/:id/read
   * Mark a notification as read
   */
  app.post("/api/notifications/:id/read", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const notificationId = parseInt(req.params.id);

      if (isNaN(notificationId)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }

      const count = await notificationService.markAsRead(user.id, notificationId);

      if (count === 0) {
        return res.status(404).json({ error: "Notification not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error marking notification as read:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to mark as read" });
    }
  }));

  /**
   * POST /api/notifications/read-all
   * Mark all notifications as read
   */
  app.post("/api/notifications/read-all", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const count = await notificationService.markAllAsRead(user.id);

      res.json({
        success: true,
        count
      });
    } catch (error: any) {
      logger.error('Error marking all as read:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to mark all as read" });
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      logger.error('Error fetching price alerts:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: error.message || "Failed to fetch price alerts" });
    }
  }));
}
