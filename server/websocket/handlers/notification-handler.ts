/**
 * Notification WebSocket Event Handler
 *
 * Handles real-time notification events:
 * - Client subscriptions to notifications
 * - Mark notification as read
 * - New notification delivery
 * - Unread count updates
 *
 * Uses event bus for decoupled communication with notification service.
 * @see server/utils/event-bus.ts for event definitions
 */

import type { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../types';
import { checkRateLimit } from '../middleware/rate-limit';
import { handleSocketError, withErrorHandling } from '../middleware/error-handler';
import { storage } from '../../storage';
import { eventBus, AppEvents } from '../../utils/event-bus';
import { createLogger } from '../../utils/logger';

const log = createLogger('WebSocket:Notification');

/**
 * Notification mark-read event data
 */
interface MarkReadData {
  notificationId: number;
}

/**
 * Register notification event handlers on a socket
 *
 * Called when a new authenticated client connects
 */
export function registerNotificationHandlers(socket: AuthenticatedSocket): void {
  // Client subscribes to notification updates
  socket.on(
    'notification:subscribe',
    withErrorHandling(socket, 'notification:subscribe', async () => {
      // Rate limiting: Max 10 subscription requests per second per user
      if (!(await checkRateLimit('sub:notifications', socket.userId, 10, 1))) {
        socket.emit('error', {
          message: 'Too many subscription requests. Please slow down',
          code: 'RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      // Join notification room
      const notificationRoom = `notifications:${socket.userId}`;
      void socket.join(notificationRoom);

      log.info('Client subscribed to notifications', {
        userId: socket.userId,
        socketId: socket.id,
        room: notificationRoom,
      });

      // Get current unread count and send with subscription confirmation
      try {
        // Use storage directly to avoid circular dependency with notification-service
        const stats = await storage.getNotificationStats(socket.userId);

        socket.emit('notification:subscribed', {
          timestamp: new Date().toISOString(),
          unreadCount: stats.unread,
          totalCount: stats.total,
        });
      } catch (error) {
        // Don't fail subscription if stats retrieval fails
        log.error('Failed to get notification stats', {
          error: error instanceof Error ? error.message : String(error),
          userId: socket.userId,
        });

        socket.emit('notification:subscribed', {
          timestamp: new Date().toISOString(),
          unreadCount: 0,
          totalCount: 0,
        });
      }
    })
  );

  // Client unsubscribes from notifications
  socket.on(
    'notification:unsubscribe',
    withErrorHandling(socket, 'notification:unsubscribe', async () => {
      const notificationRoom = `notifications:${socket.userId}`;
      void socket.leave(notificationRoom);

      log.info('Client unsubscribed from notifications', {
        userId: socket.userId,
        socketId: socket.id,
      });

      socket.emit('notification:unsubscribed', {
        timestamp: new Date().toISOString(),
      });
    })
  );

  // Client marks notification as read
  socket.on(
    'notification:mark-read',
    withErrorHandling(socket, 'notification:mark-read', async (data: MarkReadData) => {
      // Rate limiting: Max 20 mark-read requests per second per user
      if (!(await checkRateLimit('mark-read', socket.userId, 20, 1))) {
        socket.emit('error', {
          message: 'Too many requests. Please slow down',
          code: 'RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      // Validate data
      if (!data || typeof data.notificationId !== 'number') {
        socket.emit('error', {
          message: 'Invalid notification ID',
          code: 'INVALID_INPUT',
        });
        return;
      }

      const { notificationId } = data;

      log.debug('Marking notification as read', {
        userId: socket.userId,
        notificationId,
      });

      try {
        // Use storage directly to avoid circular dependency with notification-service
        const updatedCount = await storage.markAsRead(socket.userId, notificationId);

        if (updatedCount === 0) {
          socket.emit('error', {
            message: 'Notification not found',
            code: 'NOT_FOUND',
          });
          return;
        }

        // Get updated unread count
        const stats = await storage.getNotificationStats(socket.userId);

        // Broadcast to all user's connected clients (not just this socket)
        const room = `notifications:${socket.userId}`;
        socket.to(room).emit('notification:read', {
          notificationId,
          unreadCount: stats.unread,
        });

        // Also emit to this socket
        socket.emit('notification:read', {
          notificationId,
          unreadCount: stats.unread,
        });

        // Emit event via event bus for any interested listeners
        eventBus.emit(AppEvents.NOTIFICATION_MARKED_READ, {
          userId: socket.userId,
          notificationId,
        });

        log.debug('Notification marked as read', {
          userId: socket.userId,
          notificationId,
          unreadCount: stats.unread,
        });
      } catch (error) {
        handleSocketError(socket, error, {
          event: 'notification:mark-read',
          userId: socket.userId,
          data: { notificationId },
        });
      }
    })
  );

  log.debug('Notification handlers registered', {
    userId: socket.userId,
    socketId: socket.id,
  });
}

/**
 * Emit new notification event to user's connected clients
 *
 * Called internally when a notification event is received via event bus
 *
 * @param io Socket.io server instance
 * @param userId User ID to target
 * @param notification Notification data
 * @param unreadCount Updated unread count
 */
function emitNewNotificationInternal(
  io: Server,
  userId: number,
  notification: {
    id: number;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    createdAt: Date;
  },
  unreadCount: number
): void {
  const room = `notifications:${userId}`;

  io.to(room).emit('notification:new', {
    notification: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.message,
      priority: 'normal',
      metadata: notification.data,
      read: false,
      timestamp: notification.createdAt.toISOString(),
    },
    unreadCount,
  });

  log.debug('New notification emitted', {
    userId,
    notificationId: notification.id,
    type: notification.type,
    unreadCount,
    room,
  });
}

/**
 * Emit unread count update to user's connected clients
 *
 * Called when unread count changes (e.g., after bulk mark as read)
 *
 * @param io Socket.io server instance
 * @param userId User ID to target
 * @param unreadCount Updated unread count
 */
export function emitUnreadCountUpdate(
  io: Server,
  userId: number,
  unreadCount: number
): void {
  const room = `notifications:${userId}`;

  io.to(room).emit('notification:count_updated', {
    unreadCount,
    timestamp: new Date().toISOString(),
  });

  log.debug('Unread count update emitted', {
    userId,
    unreadCount,
    room,
  });
}

/**
 * Set up event bus subscriptions for notification-related events
 *
 * This function should be called once during WebSocket initialization
 * to subscribe to notification events from the notification service.
 *
 * @param io Socket.io server instance
 */
export function setupNotificationEventSubscriptions(io: Server): void {
  // Subscribe to notification created events from notification service
  eventBus.on(AppEvents.NOTIFICATION_CREATED, (payload) => {
    // Wrap async handler to properly handle the promise
    void (async () => {
      try {
        // Get updated unread count
        const stats = await storage.getNotificationStats(payload.userId);

        emitNewNotificationInternal(
          io,
          payload.userId,
          payload.notification,
          stats.unread
        );
      } catch (error) {
        log.error('Failed to emit notification event', {
          error: error instanceof Error ? error.message : String(error),
          userId: payload.userId,
          notificationId: payload.notification.id,
        });
      }
    })();
  });

  log.info('Notification event subscriptions set up');
}
