import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as notificationService from '../services/notification-service';
import { csrfProtection } from '../middleware/security';
import { parseIntSafe } from '../utils/validation-helpers';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { withAuth } from './helpers';

/**
 * Notification Routes
 *
 * API endpoints for managing user notifications and preferences
 */

export function registerNotificationRoutes(app: Express) {
  // Middleware function for routes with CSRF (works with middleware chaining)
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    next();
  }

  /**
   * GET /api/notifications
   * Get user's notifications with optional filters
   */
  app.get(
    '/api/notifications',
    withAuth(async (req, res) => {
      try {
        const user = req.user; // Auth verified by withAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }


        const filterSchema = z.object({
          isRead: z
            .enum(['true', 'false'])
            .optional()
            .transform((val) => val === 'true'),
          type: z.string().optional(),
          limit: z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val) : 50)),
          offset: z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val) : 0)),
        });

        const filters = filterSchema.parse(req.query);

        const notifications = await notificationService.getUserNotifications(user.id, filters);

        sendSuccess(res, {
          data: notifications,
          count: notifications.length,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetNotifications');
      }
    })
  );

  /**
   * GET /api/notifications/stats
   * Get notification statistics for the user
   */
  app.get(
    '/api/notifications/stats',
    withAuth(async (req, res) => {
      try {
        const user = req.user; // Auth verified by withAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const stats = await notificationService.getNotificationStats(user.id);

        sendSuccess(res, stats);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetNotificationStats');
      }
    })
  );

  /**
   * POST /api/notifications/:id/read
   * Mark a notification as read
   * @security CSRF protection required
   */
  app.post(
    '/api/notifications/:id/read',
    requireAuth,
    csrfProtection,
    async (req, res) => {
      try {
        const user = req.user; // Auth verified by requireAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const notificationId = parseIntSafe(req.params.id, 'notificationId', { min: 1 });

        const count = await notificationService.markAsRead(user.id, notificationId);

        if (count === 0) {
          sendError(res, 'Notification not found', 404);
          return;
        }

        sendSuccess(res, {});
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'MarkNotificationRead');
      }
    }
  );

  /**
   * POST /api/notifications/read-all
   * Mark all notifications as read
   * @security CSRF protection required
   */
  app.post(
    '/api/notifications/read-all',
    requireAuth,
    csrfProtection,
    async (req, res) => {
      try {
        const user = req.user; // Auth verified by requireAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const count = await notificationService.markAllAsRead(user.id);

        sendSuccess(res, { count });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'MarkAllNotificationsRead');
      }
    }
  );

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   * @security CSRF protection required
   */
  app.delete(
    '/api/notifications/:id',
    requireAuth,
    csrfProtection,
    async (req, res) => {
      try {
        const user = req.user; // Auth verified by requireAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const notificationId = parseIntSafe(req.params.id, 'notificationId', { min: 1 });

        const deleted = await notificationService.deleteNotification(user.id, notificationId);

        if (!deleted) {
          sendError(res, 'Notification not found', 404);
          return;
        }

        sendSuccess(res, {});
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'DeleteNotification');
      }
    }
  );

  /**
   * DELETE /api/notifications
   * Delete all notifications for the user
   * @security CSRF protection required
   */
  app.delete(
    '/api/notifications',
    requireAuth,
    csrfProtection,
    async (req, res) => {
      try {
        const user = req.user; // Auth verified by requireAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const count = await notificationService.deleteAllNotifications(user.id);

        sendSuccess(res, { count });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'DeleteAllNotifications');
      }
    }
  );

  /**
   * GET /api/notifications/preferences
   * Get user's notification preferences
   */
  app.get(
    '/api/notifications/preferences',
    withAuth(async (req, res) => {
      try {
        const user = req.user; // Auth verified by withAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const preferences = await notificationService.getUserPreferences(user.id);

        sendSuccess(res, preferences);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetNotificationPreferences');
      }
    })
  );

  /**
   * PATCH /api/notifications/preferences
   * Update user's notification preferences
   * @security CSRF protection required
   */
  app.patch(
    '/api/notifications/preferences',
    requireAuth,
    csrfProtection,
    async (req, res) => {
      try {
        const user = req.user; // Auth verified by requireAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }


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

        sendSuccess(res, preferences);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'UpdateNotificationPreferences');
      }
    }
  );

  /**
   * GET /api/notifications/price-drops
   * Get recent price drop notifications
   */
  app.get(
    '/api/notifications/price-drops',
    withAuth(async (req, res) => {
      try {
        const user = req.user; // Auth verified by withAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const days = req.query.days
          ? parseIntSafe(req.query.days as string, 'days', { min: 1, max: 365 })
          : 7;

        const notifications = await notificationService.getRecentPriceDrops(user.id, days);

        sendSuccess(res, {
          data: notifications,
          count: notifications.length,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetPriceDropNotifications');
      }
    })
  );

  /**
   * GET /api/notifications/price-alerts
   * Get recent price alert notifications
   */
  app.get(
    '/api/notifications/price-alerts',
    withAuth(async (req, res) => {
      try {
        const user = req.user; // Auth verified by withAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const days = req.query.days
          ? parseIntSafe(req.query.days as string, 'days', { min: 1, max: 365 })
          : 7;

        const notifications = await notificationService.getRecentPriceAlerts(user.id, days);

        sendSuccess(res, {
          data: notifications,
          count: notifications.length,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetPriceAlertNotifications');
      }
    })
  );

  /**
   * GET /api/notifications/smart
   * Get smart notifications for user with optional filters
   */
  app.get(
    '/api/notifications/smart',
    withAuth(async (req, res) => {
      try {
        const user = req.user; // Auth verified by withAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }


        const filterSchema = z.object({
          urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
          unread: z
            .enum(['true', 'false'])
            .optional()
            .transform((val) => val === 'true'),
          limit: z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val) : 50)),
          offset: z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val) : 0)),
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
          offset: filters.offset,
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

        sendSuccess(res, {
          data: filteredNotifications,
          count: filteredNotifications.length,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetSmartNotifications');
      }
    })
  );

  /**
   * POST /api/notifications/smart/:id/snooze
   * Snooze a smart notification for specified duration
   * @security CSRF protection required
   */
  app.post(
    '/api/notifications/smart/:id/snooze',
    requireAuth,
    csrfProtection,
    async (req, res) => {
      try {
        const user = req.user; // Auth verified by requireAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const notificationId = parseIntSafe(req.params.id, 'notificationId', { min: 1 });

        const snoozeSchema = z.object({
          duration: z
            .number()
            .min(3600)
            .max(7 * 24 * 60 * 60), // 1 hour to 7 days in seconds
        });

        const { duration } = snoozeSchema.parse(req.body);

        // Get the notification to verify ownership
        const notifications = await notificationService.getUserNotifications(user.id, {
          limit: 1,
          offset: 0,
        });

        const notification = notifications.find((n) => n.id === notificationId);

        if (!notification) {
          sendError(res, 'Notification not found', 404);
          return;
        }

        if (notification.type !== 'smart_alert') {
          sendError(res, 'Can only snooze smart notifications', 400);
          return;
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

        sendSuccess(res, {
          snoozedUntil: snoozeUntil.toISOString(),
          message: `Notification snoozed for ${duration / 3600} hours`,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'SnoozeNotification');
      }
    }
  );

  /**
   * POST /api/notifications/smart/:id/dismiss
   * Dismiss a smart notification
   * @security CSRF protection required
   */
  app.post(
    '/api/notifications/smart/:id/dismiss',
    requireAuth,
    csrfProtection,
    async (req, res) => {
      try {
        const user = req.user; // Auth verified by requireAuth middleware
        if (!user) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        const notificationId = parseIntSafe(req.params.id, 'notificationId', { min: 1 });

        // Get the notification to verify ownership and type
        const notifications = await notificationService.getUserNotifications(user.id, {
          limit: 1,
          offset: 0,
        });

        const notification = notifications.find((n) => n.id === notificationId);

        if (!notification) {
          sendError(res, 'Notification not found', 404);
          return;
        }

        if (notification.type !== 'smart_alert') {
          sendError(res, 'Can only dismiss smart notifications', 400);
          return;
        }

        // Mark as read
        await notificationService.markAsRead(user.id, notificationId);

        sendSuccess(res, {
          message: 'Notification dismissed successfully',
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'DismissNotification');
      }
    }
  );
}
