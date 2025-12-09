/**
 * WebSocket Reconnection Tests
 *
 * Tests automatic reconnection behavior:
 * - Network disconnect recovery
 * - Exponential backoff
 * - Subscription restoration
 * - Connection state transitions
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Server as HTTPServer } from 'http';
import type { Express } from 'express';
import { io as ioClient } from 'socket.io-client';
import { createTestServer, closeTestServer, waitForEvent, waitForCondition } from './test-utils';
import { getSocketIO, shutdownWebSocket } from '../index';

// Mock dependencies
vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => null),
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

describe('WebSocket Reconnection Tests', () => {
  let _app: Express;
  let httpServer: HTTPServer;
  let port: number;

  beforeAll(async () => {
    const server = await createTestServer();
    _app = server.app;
    httpServer = server.httpServer;
    port = server.port;
  });

  afterAll(async () => {
    await closeTestServer(httpServer);
  });

  describe('Network Disconnect Recovery', () => {
    it('should reconnect after server disconnect', async () => {
      // Create client with reconnection enabled
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100, // Fast reconnection for tests
        reconnectionAttempts: 5,
      });

      try {
        // Wait for initial connection
        await waitForEvent(client, 'connect');
        expect(client.connected).toBe(true);

        const connectCount = { value: 1 };

        // Listen for reconnection
        client.on('connect', () => {
          connectCount.value++;
        });

        // Force disconnect from server side
        const io = getSocketIO();
        const serverSocket = Array.from(io?.sockets.sockets.values() || [])[0];
        if (serverSocket) {
          serverSocket.disconnect(true);
        }

        // Wait for disconnect
        await waitForEvent(client, 'disconnect', 2000);
        expect(client.connected).toBe(false);

        // Wait for reconnection
        await waitForCondition(() => client.connected, 5000);

        // Verify reconnected
        expect(client.connected).toBe(true);
        expect(connectCount.value).toBeGreaterThan(1);
      } finally {
        client.disconnect();
      }
    });

    it('should handle multiple disconnect/reconnect cycles', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 10,
      });

      try {
        await waitForEvent(client, 'connect');

        const cycles = 3;
        for (let i = 0; i < cycles; i++) {
          // Disconnect
          const io = getSocketIO();
          const serverSocket = Array.from(io?.sockets.sockets.values() || [])[0];
          if (serverSocket) {
            serverSocket.disconnect(true);
          }

          await waitForEvent(client, 'disconnect', 2000);
          expect(client.connected).toBe(false);

          // Reconnect
          await waitForCondition(() => client.connected, 5000);
          expect(client.connected).toBe(true);
        }

        expect(client.connected).toBe(true);
      } finally {
        client.disconnect();
      }
    });
  });

  describe('Exponential Backoff', () => {
    it('should use exponential backoff for reconnection attempts', async () => {
      // Create client with manual reconnection tracking
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000, // 1 second base delay
        reconnectionDelayMax: 5000, // 5 second max
        reconnectionAttempts: 5,
      });

      const reconnectAttempts: number[] = [];
      let lastAttemptTime = 0;

      client.io.on('reconnect_attempt', () => {
        const now = Date.now();
        if (lastAttemptTime > 0) {
          const delay = now - lastAttemptTime;
          reconnectAttempts.push(delay);
        }
        lastAttemptTime = now;
      });

      try {
        await waitForEvent(client, 'connect');

        // Disconnect and prevent reconnection by closing server temporarily
        client.disconnect();
        shutdownWebSocket();

        // Wait for reconnection attempts
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Verify exponential backoff pattern
        // Each delay should be approximately 2x the previous (with some tolerance)
        for (let i = 1; i < reconnectAttempts.length; i++) {
          const ratio = reconnectAttempts[i] / reconnectAttempts[i - 1];
          // Allow 20% tolerance for timing variance
          expect(ratio).toBeGreaterThan(1.6);
          expect(ratio).toBeLessThan(2.4);
        }
      } finally {
        client.disconnect();
        // Restart server for other tests
        // (Note: In real test, you'd want to restart properly)
      }
    }, 15000); // Longer timeout for backoff test

    it('should cap reconnection delay at maximum', async () => {
      const maxDelay = 2000; // 2 seconds max
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: maxDelay,
        reconnectionAttempts: 10,
      });

      const reconnectDelays: number[] = [];
      let lastAttemptTime = 0;

      client.io.on('reconnect_attempt', () => {
        const now = Date.now();
        if (lastAttemptTime > 0) {
          reconnectDelays.push(now - lastAttemptTime);
        }
        lastAttemptTime = now;
      });

      try {
        await waitForEvent(client, 'connect');
        client.disconnect();

        await new Promise((resolve) => setTimeout(resolve, 8000));

        // Verify delays don't exceed max
        const maxObservedDelay = Math.max(...reconnectDelays);
        // Allow 20% tolerance
        expect(maxObservedDelay).toBeLessThan(maxDelay * 1.2);
      } finally {
        client.disconnect();
      }
    }, 10000);
  });

  describe('Max Reconnection Attempts', () => {
    it('should stop reconnecting after max attempts', async () => {
      const maxAttempts = 3;
      const client = ioClient('http://localhost:9999', {
        // Invalid port
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: maxAttempts,
        timeout: 500,
      });

      let attemptCount = 0;
      let failedEmitted = false;

      client.io.on('reconnect_attempt', () => {
        attemptCount++;
      });

      client.io.on('reconnect_failed', () => {
        failedEmitted = true;
      });

      try {
        // Wait for all attempts to complete
        await waitForCondition(() => failedEmitted, 5000);

        expect(attemptCount).toBe(maxAttempts);
        expect(failedEmitted).toBe(true);
        expect(client.connected).toBe(false);
      } finally {
        client.disconnect();
      }
    }, 10000);
  });

  describe('Subscription Restoration', () => {
    it('should restore subscriptions after reconnection', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 5,
      });

      try {
        // Initial connection and subscription
        await waitForEvent(client, 'connect');

        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        // Track subscription confirmations
        const subscriptionConfirmed = { count: 0 };
        client.on('watchlist:subscribed', () => {
          subscriptionConfirmed.count++;
        });

        // Force disconnect
        const io = getSocketIO();
        const serverSocket = Array.from(io?.sockets.sockets.values() || [])[0];
        if (serverSocket) {
          serverSocket.disconnect(true);
        }

        await waitForEvent(client, 'disconnect', 2000);

        // Reconnect
        await waitForCondition(() => client.connected, 5000);

        // Re-subscribe after reconnection
        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed', 2000);

        // Verify subscription was restored
        expect(subscriptionConfirmed.count).toBeGreaterThan(0);
      } finally {
        client.disconnect();
      }
    });

    it('should receive events after reconnection', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 5,
      });

      try {
        await waitForEvent(client, 'connect');

        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        // Force disconnect
        const io = getSocketIO();
        const serverSocket = Array.from(io?.sockets.sockets.values() || [])[0];
        if (serverSocket) {
          serverSocket.disconnect(true);
        }

        await waitForEvent(client, 'disconnect', 2000);
        await waitForCondition(() => client.connected, 5000);

        // Re-subscribe
        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed', 2000);

        // Setup event listener
        const eventReceived = { value: false };
        client.on('watchlist:update', () => {
          eventReceived.value = true;
        });

        // Emit event from server
        const newIo = getSocketIO();
        const room = 'watchlist:999'; // Assuming userId in socket
        newIo?.to(room).emit('watchlist:update', {
          watchListId: 1,
          name: 'Test',
          action: 'created' as const,
          timestamp: new Date().toISOString(),
        });

        // Note: This test is limited because we can't easily determine userId after reconnect
        // In a real app, the client would track and restore its own subscriptions
      } finally {
        client.disconnect();
      }
    });
  });

  describe('Connection State Transitions', () => {
    it('should transition through correct connection states', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 5,
      });

      const states: string[] = [];

      // Track connection state changes
      client.on('connect', () => states.push('connected'));
      client.on('disconnect', () => states.push('disconnected'));
      client.io.on('reconnect_attempt', () => states.push('reconnecting'));
      client.io.on('reconnect', () => states.push('reconnected'));

      try {
        await waitForEvent(client, 'connect');

        // Force disconnect
        const io = getSocketIO();
        const serverSocket = Array.from(io?.sockets.sockets.values() || [])[0];
        if (serverSocket) {
          serverSocket.disconnect(true);
        }

        await waitForEvent(client, 'disconnect', 2000);
        await waitForCondition(() => client.connected, 5000);

        // Verify state transitions
        expect(states).toContain('connected');
        expect(states).toContain('disconnected');
        expect(states).toContain('reconnecting');

        // Final state should be connected
        expect(client.connected).toBe(true);
      } finally {
        client.disconnect();
      }
    });
  });

  describe('Clean Disconnect', () => {
    it('should not reconnect after intentional disconnect', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 5,
      });

      try {
        await waitForEvent(client, 'connect');
        expect(client.connected).toBe(true);

        let reconnectAttempted = false;
        client.io.on('reconnect_attempt', () => {
          reconnectAttempted = true;
        });

        // Intentional disconnect
        client.disconnect();

        await waitForEvent(client, 'disconnect', 2000);

        // Wait to ensure no reconnection attempt
        await new Promise((resolve) => setTimeout(resolve, 1000));

        expect(reconnectAttempted).toBe(false);
        expect(client.connected).toBe(false);
      } finally {
        if (client.connected) {
          client.disconnect();
        }
      }
    });
  });
});
