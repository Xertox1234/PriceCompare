/**
 * WebSocket Integration Tests
 *
 * End-to-end tests for WebSocket event flows:
 * - Watch list update propagation
 * - Multi-tab synchronization
 * - Room isolation
 * - Notification flow
 * - Price alert flow
 *
 * NOTE: These tests call WebSocket handler functions directly rather than
 * testing event bus integration at the unit level. Event bus → WebSocket
 * integration is verified by E2E tests (e2e/websocket.test.ts) which test
 * the full production flow. This approach avoids module isolation issues
 * in Vitest while maintaining coverage of WebSocket functionality.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  setupWebSocketTestContext,
  cleanupWebSocketTestContext,
  createAuthenticatedSocket,
  waitForEvent,
  disconnectSockets,
  spyOnSocketEvent,
  type WebSocketTestContext,
} from './test-utils';
import { getSocketIO } from '../index';
import {
  emitWatchListUpdate,
  emitProductAdded,
  emitProductRemoved,
} from '../handlers/watch-list-handler';
import { emitUnreadCountUpdate } from '../handlers/notification-handler';
import { emitPriceAlert } from '../handlers/price-update-handler';
import { eventBus, AppEvents } from '../../utils/event-bus';

// Mock dependencies
vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => null), // Use in-memory for tests
  redisClient: null,
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../services/notification-service', () => ({
  markAsRead: vi.fn(() => 1),
  getNotificationStats: vi.fn(() => ({
    total: 10,
    unread: 3,
    byType: {},
  })),
}));

// Mock storage layer (used directly by WebSocket handlers)
vi.mock('../../storage', () => ({
  storage: {
    getNotificationStats: vi.fn(async () => ({
      total: 10,
      unread: 3,
      byType: {},
    })),
    markAsRead: vi.fn(async () => 1),
  },
}));

describe('WebSocket Integration Tests', () => {
  let testContext: WebSocketTestContext;
  let port: number;

  beforeAll(async () => {
    testContext = await setupWebSocketTestContext();
    port = testContext.port;
  });

  afterAll(async () => {
    await cleanupWebSocketTestContext(testContext);
  });

  describe('Watch List Update Flow', () => {
    it('should emit watch list creation event to user', async () => {
      const userId = 101;
      const client = createAuthenticatedSocket(userId, port);

      try {
        // Wait for connection
        await waitForEvent(client, 'connect');

        // Subscribe to watch list events
        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        // Setup event spy
        const updateSpy = spyOnSocketEvent(client, 'watchlist:update');

        // Simulate watch list creation from server
        const io = getSocketIO();
        if (io) {
          emitWatchListUpdate(io, userId, 'created', {
            id: 1,
            name: 'My Watch List',
            productCount: 0,
          });
        }

        // Wait for event
        await waitForEvent(client, 'watchlist:update', 2000);

        // Verify event received
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            watchListId: 1,
            name: 'My Watch List',
            action: 'created',
            productCount: 0,
          })
        );
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should emit watch list update event to user', async () => {
      const userId = 102;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');
        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        const updateSpy = spyOnSocketEvent(client, 'watchlist:update');

        const io = getSocketIO();
        if (io) {
          emitWatchListUpdate(io, userId, 'updated', {
            id: 1,
            name: 'Updated Watch List',
            productCount: 5,
          });
        }

        await waitForEvent(client, 'watchlist:update', 2000);

        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            watchListId: 1,
            name: 'Updated Watch List',
            action: 'updated',
            productCount: 5,
          })
        );
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should emit watch list deletion event to user', async () => {
      const userId = 103;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');
        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        const updateSpy = spyOnSocketEvent(client, 'watchlist:update');

        const io = getSocketIO();
        if (io) {
          emitWatchListUpdate(io, userId, 'deleted', {
            id: 1,
            name: 'Deleted Watch List',
          });
        }

        await waitForEvent(client, 'watchlist:update', 2000);

        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            watchListId: 1,
            name: 'Deleted Watch List',
            action: 'deleted',
          })
        );
      } finally {
        disconnectSockets([client]);
      }
    });
  });

  describe('Multi-Tab Synchronization', () => {
    it('should sync watch list updates across multiple connections (same user)', async () => {
      const userId = 201;
      const client1 = createAuthenticatedSocket(userId, port);
      const client2 = createAuthenticatedSocket(userId, port);

      try {
        // Connect both clients
        await Promise.all([waitForEvent(client1, 'connect'), waitForEvent(client2, 'connect')]);

        // Subscribe both to watch lists
        client1.emit('subscribe:watchlists');
        client2.emit('subscribe:watchlists');

        await Promise.all([
          waitForEvent(client1, 'watchlist:subscribed'),
          waitForEvent(client2, 'watchlist:subscribed'),
        ]);

        // Setup spies
        const spy1 = spyOnSocketEvent(client1, 'watchlist:update');
        const spy2 = spyOnSocketEvent(client2, 'watchlist:update');

        // Emit update from server
        const io = getSocketIO();
        if (io) {
          emitWatchListUpdate(io, userId, 'created', {
            id: 1,
            name: 'Synced List',
            productCount: 0,
          });
        }

        // Wait for both to receive
        await Promise.all([
          waitForEvent(client1, 'watchlist:update', 2000),
          waitForEvent(client2, 'watchlist:update', 2000),
        ]);

        // Verify both received the same event
        expect(spy1).toHaveBeenCalledTimes(1);
        expect(spy2).toHaveBeenCalledTimes(1);

        const data1 = spy1.mock.calls[0][0];
        const data2 = spy2.mock.calls[0][0];

        expect(data1).toEqual(data2);
        expect(data1.watchListId).toBe(1);
        expect(data1.name).toBe('Synced List');
      } finally {
        disconnectSockets([client1, client2]);
      }
    });

    it('should sync product additions across multiple tabs', async () => {
      const userId = 202;
      const client1 = createAuthenticatedSocket(userId, port);
      const client2 = createAuthenticatedSocket(userId, port);

      try {
        await Promise.all([waitForEvent(client1, 'connect'), waitForEvent(client2, 'connect')]);

        client1.emit('subscribe:watchlists');
        client2.emit('subscribe:watchlists');

        await Promise.all([
          waitForEvent(client1, 'watchlist:subscribed'),
          waitForEvent(client2, 'watchlist:subscribed'),
        ]);

        const spy1 = spyOnSocketEvent(client1, 'watchlist:product_added');
        const spy2 = spyOnSocketEvent(client2, 'watchlist:product_added');

        const io = getSocketIO();
        if (io) {
          emitProductAdded(io, userId, 1, {
            id: 456,
            name: 'iPhone 15 Pro',
            currentPrice: 999.99,
          });
        }

        await Promise.all([
          waitForEvent(client1, 'watchlist:product_added', 2000),
          waitForEvent(client2, 'watchlist:product_added', 2000),
        ]);

        expect(spy1).toHaveBeenCalledTimes(1);
        expect(spy2).toHaveBeenCalledTimes(1);

        const data1 = spy1.mock.calls[0][0];
        expect(data1.product.id).toBe(456);
        expect(data1.product.name).toBe('iPhone 15 Pro');
      } finally {
        disconnectSockets([client1, client2]);
      }
    });
  });

  describe('Room Isolation', () => {
    it('should only emit events to the correct user', async () => {
      const userA = 301;
      const userB = 302;
      const clientA = createAuthenticatedSocket(userA, port);
      const clientB = createAuthenticatedSocket(userB, port);

      try {
        await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

        clientA.emit('subscribe:watchlists');
        clientB.emit('subscribe:watchlists');

        await Promise.all([
          waitForEvent(clientA, 'watchlist:subscribed'),
          waitForEvent(clientB, 'watchlist:subscribed'),
        ]);

        const spyA = spyOnSocketEvent(clientA, 'watchlist:update');
        const spyB = spyOnSocketEvent(clientB, 'watchlist:update');

        // Emit event only to User A
        const io = getSocketIO();
        if (io) {
          emitWatchListUpdate(io, userA, 'created', {
            id: 1,
            name: 'User A List',
            productCount: 0,
          });
        }

        // Wait for User A to receive
        await waitForEvent(clientA, 'watchlist:update', 2000);

        // Give some time for User B (shouldn't receive)
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify only User A received the event
        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).not.toHaveBeenCalled();
      } finally {
        disconnectSockets([clientA, clientB]);
      }
    });

    it('should isolate product events between users', async () => {
      const userA = 303;
      const userB = 304;
      const clientA = createAuthenticatedSocket(userA, port);
      const clientB = createAuthenticatedSocket(userB, port);

      try {
        await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

        clientA.emit('subscribe:watchlists');
        clientB.emit('subscribe:watchlists');

        await Promise.all([
          waitForEvent(clientA, 'watchlist:subscribed'),
          waitForEvent(clientB, 'watchlist:subscribed'),
        ]);

        const spyA = spyOnSocketEvent(clientA, 'watchlist:product_added');
        const spyB = spyOnSocketEvent(clientB, 'watchlist:product_added');

        const io = getSocketIO();
        if (io) {
          // Add product to User B's list
          emitProductAdded(io, userB, 1, {
            id: 789,
            name: 'Samsung Galaxy',
            currentPrice: 799.99,
          });
        }

        await waitForEvent(clientB, 'watchlist:product_added', 2000);
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(spyA).not.toHaveBeenCalled();
        expect(spyB).toHaveBeenCalledTimes(1);
      } finally {
        disconnectSockets([clientA, clientB]);
      }
    });
  });

  describe('Notification Flow', () => {
    it('should emit new notification with unread count', async () => {
      const userId = 401;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        client.emit('notification:subscribe');
        await waitForEvent(client, 'notification:subscribed');

        const notificationSpy = spyOnSocketEvent(client, 'notification:new');

        // Emit notification via event bus (triggers the handler subscription)
        eventBus.emit(AppEvents.NOTIFICATION_CREATED, {
          userId,
          notification: {
            id: 1,
            type: 'price_alert',
            title: 'Price dropped!',
            message: 'iPhone 15 is now $899',
            createdAt: new Date(),
          },
        });

        await waitForEvent(client, 'notification:new', 2000);

        expect(notificationSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            notification: expect.objectContaining({
              id: 1,
              type: 'price_alert',
              title: 'Price dropped!',
              content: 'iPhone 15 is now $899', // message is mapped to content
              priority: 'normal', // default priority
            }),
            unreadCount: expect.any(Number), // fetched from storage
          })
        );
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should update unread count when notification is read', async () => {
      const userId = 402;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        client.emit('notification:subscribe');
        await waitForEvent(client, 'notification:subscribed');

        const countSpy = spyOnSocketEvent(client, 'notification:count_updated');

        const io = getSocketIO();
        if (io) {
          emitUnreadCountUpdate(io, userId, 3);
        }

        await waitForEvent(client, 'notification:count_updated', 2000);

        expect(countSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            unreadCount: 3,
          })
        );
      } finally {
        disconnectSockets([client]);
      }
    });
  });

  describe('Price Alert Flow', () => {
    it('should emit price alert to user', async () => {
      const userId = 501;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        const alertSpy = spyOnSocketEvent(client, 'price:alert');

        const io = getSocketIO();
        if (io) {
          emitPriceAlert(io, userId, {
            alertId: 1,
            productId: 456,
            productName: 'iPhone 15',
            currentPrice: 899.99,
            previousPrice: 999.99,
            targetPrice: 900.0,
            percentageChange: -10.0,
            retailerName: 'Amazon',
            retailerUrl: 'https://amazon.com/iphone',
          });
        }

        await waitForEvent(client, 'price:alert', 2000);

        expect(alertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            alertId: 1,
            productId: 456,
            productName: 'iPhone 15',
            currentPrice: 899.99,
            previousPrice: 999.99,
            percentageChange: -10.0,
          })
        );
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should emit price alert only to targeted user', async () => {
      const userA = 502;
      const userB = 503;
      const clientA = createAuthenticatedSocket(userA, port);
      const clientB = createAuthenticatedSocket(userB, port);

      try {
        await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

        const spyA = spyOnSocketEvent(clientA, 'price:alert');
        const spyB = spyOnSocketEvent(clientB, 'price:alert');

        const io = getSocketIO();
        if (io) {
          emitPriceAlert(io, userA, {
            alertId: 1,
            productId: 789,
            productName: 'Samsung Galaxy',
            currentPrice: 699.99,
            previousPrice: 799.99,
            targetPrice: 700.0,
            percentageChange: -12.5,
            retailerName: 'Best Buy',
            retailerUrl: 'https://bestbuy.com/samsung',
          });
        }

        await waitForEvent(clientA, 'price:alert', 2000);
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).not.toHaveBeenCalled();
      } finally {
        disconnectSockets([clientA, clientB]);
      }
    });
  });

  describe('Product Addition/Removal Flow', () => {
    it('should emit product added event', async () => {
      const userId = 601;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        const addedSpy = spyOnSocketEvent(client, 'watchlist:product_added');

        const io = getSocketIO();
        if (io) {
          emitProductAdded(io, userId, 1, {
            id: 123,
            name: 'MacBook Pro',
            image: 'https://example.com/macbook.jpg',
            currentPrice: 1999.99,
          });
        }

        await waitForEvent(client, 'watchlist:product_added', 2000);

        expect(addedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            watchListId: 1,
            product: expect.objectContaining({
              id: 123,
              name: 'MacBook Pro',
              currentPrice: 1999.99,
            }),
          })
        );
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should emit product removed event', async () => {
      const userId = 602;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        const removedSpy = spyOnSocketEvent(client, 'watchlist:product_removed');

        const io = getSocketIO();
        if (io) {
          emitProductRemoved(io, userId, 1, 123);
        }

        await waitForEvent(client, 'watchlist:product_removed', 2000);

        expect(removedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            watchListId: 1,
            productId: 123,
          })
        );
      } finally {
        disconnectSockets([client]);
      }
    });
  });
});
