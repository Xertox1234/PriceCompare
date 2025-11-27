/**
 * Watch List WebSocket Event Handler
 *
 * Handles real-time watch list events:
 * - Client subscriptions to watch list updates
 * - Watch list creation/update/deletion events
 * - Product addition/removal events
 *
 * Events are emitted from storage layer when watch lists change.
 */

import type { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../types';
import { checkRateLimit } from '../middleware/rate-limit';
import { handleSocketError, withErrorHandling } from '../middleware/error-handler';
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
      socket.join(userRoom);

      // Join watch list room for targeted updates
      const watchListRoom = `watchlist:${socket.userId}`;
      socket.join(watchListRoom);

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
      socket.leave(watchListRoom);

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
 * Emit watch list update event to user's connected clients
 *
 * Called from storage layer after watch list operations
 *
 * @param io Socket.io server instance
 * @param userId User ID to target
 * @param action Action performed (created, updated, deleted)
 * @param watchList Watch list data
 */
export function emitWatchListUpdate(
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
 * Emit product added event to user's connected clients
 *
 * Called from storage layer after adding product to watch list
 *
 * @param io Socket.io server instance
 * @param userId User ID to target
 * @param watchListId Watch list ID
 * @param product Product data
 */
export function emitProductAdded(
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
 * Emit product removed event to user's connected clients
 *
 * Called from storage layer after removing product from watch list
 *
 * @param io Socket.io server instance
 * @param userId User ID to target
 * @param watchListId Watch list ID
 * @param productId Product ID
 */
export function emitProductRemoved(
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
