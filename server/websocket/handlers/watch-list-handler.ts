/**
 * Watch List WebSocket Event Handler
 *
 * Handles real-time watch list events:
 * - Client subscriptions to watch list updates
 * - Watch list creation/update/deletion events
 * - Product addition/removal events
 *
 * Uses event bus for decoupled communication with storage layer.
 * @see server/utils/event-bus.ts for event definitions
 */

import type { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../types';
import { checkRateLimit } from '../middleware/rate-limit';
import { withErrorHandling } from '../middleware/error-handler';
import { eventBus, AppEvents } from '../../utils/event-bus';
import { createLogger } from '../../utils/logger';

const log = createLogger('WebSocket:WatchList');

/**
 * Register watch list event handlers on a socket
 *
 * Called when a new authenticated client connects
 */
export function registerWatchListHandlers(socket: AuthenticatedSocket): void {
  // Client subscribes to watch list updates
  socket.on(
    'subscribe:watchlists',
    withErrorHandling(socket, 'subscribe:watchlists', async () => {
      // Rate limiting: Max 10 subscription requests per second per user
      if (!(await checkRateLimit('sub:watchlists', socket.userId, 10, 1))) {
        socket.emit('error', {
          message: 'Too many subscription requests. Please slow down',
          code: 'RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      // Join user-specific room (already done in connection handler, but ensure)
      const userRoom = `user:${socket.userId}`;
      void socket.join(userRoom);

      // Join watch list room for targeted updates
      const watchListRoom = `watchlist:${socket.userId}`;
      void socket.join(watchListRoom);

      log.info('Client subscribed to watch list updates', {
        userId: socket.userId,
        socketId: socket.id,
        rooms: [userRoom, watchListRoom],
      });

      // Send subscription confirmation with current watch list count
      // Note: We don't fetch full data here to avoid performance hit
      // Client should request data via REST API after subscription
      socket.emit('watchlist:subscribed', {
        timestamp: new Date().toISOString(),
        message: 'Successfully subscribed to watch list updates',
      });
    })
  );

  // Client unsubscribes from watch list updates
  socket.on(
    'unsubscribe:watchlists',
    withErrorHandling(socket, 'unsubscribe:watchlists', async () => {
      const watchListRoom = `watchlist:${socket.userId}`;
      void socket.leave(watchListRoom);

      log.info('Client unsubscribed from watch list updates', {
        userId: socket.userId,
        socketId: socket.id,
      });

      socket.emit('watchlist:unsubscribed', {
        timestamp: new Date().toISOString(),
      });
    })
  );

  log.debug('Watch list handlers registered', {
    userId: socket.userId,
    socketId: socket.id,
  });
}

/**
 * Internal: Emit watch list update event to user's connected clients
 *
 * @param io Socket.io server instance
 * @param userId User ID to target
 * @param action Action performed (created, updated, deleted)
 * @param watchList Watch list data
 */
function emitWatchListUpdateInternal(
  io: Server,
  userId: number,
  action: 'created' | 'updated' | 'deleted',
  watchList: {
    id: number;
    name: string;
    description?: string | null;
    productCount?: number;
  }
): void {
  const room = `watchlist:${userId}`;

  io.to(room).emit('watchlist:update', {
    watchListId: watchList.id,
    name: watchList.name,
    action,
    productCount: watchList.productCount,
    timestamp: new Date().toISOString(),
  });

  log.debug('Watch list update emitted', {
    userId,
    action,
    watchListId: watchList.id,
    room,
  });
}

/**
 * Internal: Emit product added event to user's connected clients
 *
 * @param io Socket.io server instance
 * @param userId User ID to target
 * @param watchListId Watch list ID
 * @param product Product data
 */
function emitProductAddedInternal(
  io: Server,
  userId: number,
  watchListId: number,
  product: {
    id: number;
    name: string;
    image?: string | null;
    currentPrice?: number | null;
  }
): void {
  const room = `watchlist:${userId}`;

  io.to(room).emit('watchlist:product_added', {
    watchListId,
    product: {
      id: product.id,
      name: product.name,
      image: product.image,
      currentPrice: product.currentPrice,
    },
    timestamp: new Date().toISOString(),
  });

  log.debug('Product added event emitted', {
    userId,
    watchListId,
    productId: product.id,
    room,
  });
}

/**
 * Internal: Emit product removed event to user's connected clients
 *
 * @param io Socket.io server instance
 * @param userId User ID to target
 * @param watchListId Watch list ID
 * @param productId Product ID
 */
function emitProductRemovedInternal(
  io: Server,
  userId: number,
  watchListId: number,
  productId: number
): void {
  const room = `watchlist:${userId}`;

  io.to(room).emit('watchlist:product_removed', {
    watchListId,
    productId,
    timestamp: new Date().toISOString(),
  });

  log.debug('Product removed event emitted', {
    userId,
    watchListId,
    productId,
    room,
  });
}

/**
 * Set up event bus subscriptions for watch list-related events
 *
 * This function should be called once during WebSocket initialization
 * to subscribe to watch list events from the storage layer.
 *
 * @param io Socket.io server instance
 */
export function setupWatchListEventSubscriptions(io: Server): void {
  // Subscribe to watch list updated events from storage layer
  eventBus.on(AppEvents.WATCHLIST_UPDATED, (payload) => {
    emitWatchListUpdateInternal(
      io,
      payload.userId,
      payload.action,
      {
        id: payload.watchlistId,
        name: payload.watchlist?.name ?? '',
        productCount: payload.watchlist?.productCount,
      }
    );
  });

  // Subscribe to product added events from storage layer
  eventBus.on(AppEvents.WATCHLIST_PRODUCT_ADDED, (payload) => {
    emitProductAddedInternal(
      io,
      payload.userId,
      payload.watchlistId,
      {
        id: payload.productId,
        name: payload.product?.name ?? '',
        image: payload.product?.imageUrl,
      }
    );
  });

  // Subscribe to product removed events from storage layer
  eventBus.on(AppEvents.WATCHLIST_PRODUCT_REMOVED, (payload) => {
    emitProductRemovedInternal(
      io,
      payload.userId,
      payload.watchlistId,
      payload.productId
    );
  });

  log.info('Watch list event subscriptions set up');
}

// Legacy exports for backward compatibility (deprecated - use event bus instead)
export const emitWatchListUpdate = emitWatchListUpdateInternal;
export const emitProductAdded = emitProductAddedInternal;
export const emitProductRemoved = emitProductRemovedInternal;
