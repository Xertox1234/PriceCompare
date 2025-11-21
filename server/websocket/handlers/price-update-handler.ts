/**
 * Price Update WebSocket Event Handler
 *
 * Handles real-time price update events:
 * - Client subscriptions to product price updates
 * - Price change notifications
 * - Price alert triggers
 *
 * Emits events when price monitoring detects changes.
 */

import type { AuthenticatedSocket } from '../types';
import { checkRateLimit } from '../middleware/rate-limit';
import { handleSocketError, withErrorHandling } from '../middleware/error-handler';
import { createLogger } from '../../utils/logger';

const log = createLogger('WebSocket:PriceUpdate');

/**
 * Price subscription event data
 */
interface PriceSubscribeData {
  productIds: number[];
}

/**
 * Track subscribed products per socket to manage room memberships
 */
const socketSubscriptions = new Map<string, Set<number>>();

/**
 * Register price update event handlers on a socket
 *
 * Called when a new authenticated client connects
 */
export function registerPriceUpdateHandlers(socket: AuthenticatedSocket): void {
  // Initialize subscription tracking for this socket
  socketSubscriptions.set(socket.id, new Set());

  // Client subscribes to price updates for specific products
  socket.on(
    'price:subscribe',
    withErrorHandling(socket, 'price:subscribe', async (data: PriceSubscribeData) => {
      // Rate limiting: Max 5 subscription requests per second per user
      if (!(await checkRateLimit('price:subscribe', socket.userId, 5, 1))) {
        socket.emit('error', {
          message: 'Too many subscription requests. Please slow down',
          code: 'RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      // Validate data
      if (!data || !Array.isArray(data.productIds)) {
        socket.emit('error', {
          message: 'Invalid product IDs',
          code: 'INVALID_INPUT',
        });
        return;
      }

      const { productIds } = data;

      // Limit: Max 100 products per user
      if (productIds.length > 100) {
        socket.emit('error', {
          message: 'Too many products. Maximum 100 products per subscription',
          code: 'LIMIT_EXCEEDED',
        });
        return;
      }

      // Validate all IDs are numbers
      const validIds = productIds.filter((id) => typeof id === 'number' && id > 0);

      if (validIds.length === 0) {
        socket.emit('error', {
          message: 'No valid product IDs provided',
          code: 'INVALID_INPUT',
        });
        return;
      }

      // Get current subscriptions for this socket
      const currentSubscriptions = socketSubscriptions.get(socket.id) || new Set();

      // Join product-specific rooms
      const rooms: string[] = [];
      validIds.forEach((productId) => {
        const room = `price:${productId}`;
        socket.join(room);
        rooms.push(room);
        currentSubscriptions.add(productId);
      });

      // Update subscription tracking
      socketSubscriptions.set(socket.id, currentSubscriptions);

      log.info('Client subscribed to price updates', {
        userId: socket.userId,
        socketId: socket.id,
        productIds: validIds,
        roomCount: rooms.length,
        totalSubscriptions: currentSubscriptions.size,
      });

      // Send subscription confirmation
      socket.emit('price:subscribed', {
        productIds: validIds,
        timestamp: new Date().toISOString(),
        message: `Subscribed to price updates for ${validIds.length} products`,
      });
    })
  );

  // Client unsubscribes from price updates for specific products
  socket.on(
    'price:unsubscribe',
    withErrorHandling(socket, 'price:unsubscribe', async (data: PriceSubscribeData) => {
      // Validate data
      if (!data || !Array.isArray(data.productIds)) {
        socket.emit('error', {
          message: 'Invalid product IDs',
          code: 'INVALID_INPUT',
        });
        return;
      }

      const { productIds } = data;
      const currentSubscriptions = socketSubscriptions.get(socket.id) || new Set();

      // Leave product-specific rooms
      productIds.forEach((productId) => {
        if (typeof productId === 'number' && productId > 0) {
          const room = `price:${productId}`;
          socket.leave(room);
          currentSubscriptions.delete(productId);
        }
      });

      // Update subscription tracking
      socketSubscriptions.set(socket.id, currentSubscriptions);

      log.info('Client unsubscribed from price updates', {
        userId: socket.userId,
        socketId: socket.id,
        productIds,
        remainingSubscriptions: currentSubscriptions.size,
      });

      socket.emit('price:unsubscribed', {
        productIds,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // Cleanup subscriptions on disconnect
  socket.on('disconnect', () => {
    socketSubscriptions.delete(socket.id);
    log.debug('Price subscription tracking cleaned up', {
      userId: socket.userId,
      socketId: socket.id,
    });
  });

  log.debug('Price update handlers registered', {
    userId: socket.userId,
    socketId: socket.id,
  });
}

/**
 * Emit price update event to subscribed clients
 *
 * Called from price monitoring service when product price changes
 *
 * @param io Socket.io server instance
 * @param productId Product ID
 * @param priceData Price change data
 */
export function emitPriceUpdate(
  io: Server,
  productId: number,
  priceData: {
    productName: string;
    retailerName: string;
    oldPrice: number;
    newPrice: number;
    percentageChange: number;
  }
): void {
  // Only emit if price difference is significant (> 0.1%)
  const significantChange = Math.abs(priceData.percentageChange) > 0.1;

  if (!significantChange) {
    log.debug('Price change not significant, skipping emit', {
      productId,
      percentageChange: priceData.percentageChange,
    });
    return;
  }

  const room = `price:${productId}`;

  io.to(room).emit('price:updated', {
    productId,
    productName: priceData.productName,
    retailerName: priceData.retailerName,
    oldPrice: priceData.oldPrice,
    newPrice: priceData.newPrice,
    percentageChange: priceData.percentageChange,
    timestamp: new Date().toISOString(),
  });

  log.debug('Price update emitted', {
    productId,
    percentageChange: priceData.percentageChange,
    room,
  });
}

/**
 * Emit price alert event to user's connected clients
 *
 * Called from alert service when alert rule is triggered (high priority)
 *
 * @param io Socket.io server instance
 * @param userId User ID to target
 * @param alert Alert data
 */
export function emitPriceAlert(
  io: Server,
  userId: number,
  alert: {
    alertId: number;
    productId: number;
    productName: string;
    currentPrice: number;
    previousPrice: number;
    targetPrice: number;
    percentageChange: number;
    retailerName: string;
    retailerUrl: string;
  }
): void {
  const room = `user:${userId}`;

  io.to(room).emit('price:alert', {
    alertId: alert.alertId,
    productId: alert.productId,
    productName: alert.productName,
    currentPrice: alert.currentPrice,
    previousPrice: alert.previousPrice,
    targetPrice: alert.targetPrice,
    percentageChange: alert.percentageChange,
    savings: alert.previousPrice - alert.currentPrice,
    retailerName: alert.retailerName,
    retailerUrl: alert.retailerUrl,
    timestamp: new Date().toISOString(),
    priority: 'high',
  });

  log.info('Price alert emitted', {
    userId,
    alertId: alert.alertId,
    productId: alert.productId,
    percentageChange: alert.percentageChange,
    room,
  });
}

/**
 * Get count of active price subscriptions across all sockets
 *
 * Useful for monitoring and debugging
 */
export function getPriceSubscriptionCount(): number {
  let total = 0;
  for (const subscriptions of socketSubscriptions.values()) {
    total += subscriptions.size;
  }
  return total;
}

/**
 * Get products being watched across all sockets
 *
 * Useful for monitoring which products need active price monitoring
 */
export function getWatchedProductIds(): Set<number> {
  const allProducts = new Set<number>();
  for (const subscriptions of socketSubscriptions.values()) {
    for (const productId of subscriptions) {
      allProducts.add(productId);
    }
  }
  return allProducts;
}
