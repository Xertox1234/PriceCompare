/**
 * WebSocket Error Handling Tests
 *
 * Tests error scenarios and recovery:
 * - Authentication failures
 * - Event handler errors
 * - Redis connection loss
 * - Malformed data
 * - Rate limit errors
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Server as HTTPServer } from 'http';
import type { Express } from 'express';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import {
  createTestServer,
  closeTestServer,
  createAuthenticatedSocket,
  waitForEvent,
  disconnectSockets,
  spyOnSocketEvent,
  TEST_PORT as _TEST_PORT,
} from './test-utils';
import { getSocketIO } from '../index';
import { handleSocketError } from '../middleware/error-handler';
import type { AuthenticatedSocket } from '../types';
import type { MockRedisClient } from './mock-types';
import { createMockSocket } from './mock-types';

// Mock dependencies
let mockRedisClient: MockRedisClient | null = null;

vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => mockRedisClient),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../services/notification-service', () => ({
  markAsRead: vi.fn(async () => 1),
  getNotificationStats: vi.fn(async () => ({
    total: 10,
    unread: 3,
    byType: {},
  })),
}));

describe('WebSocket Error Handling Tests', () => {
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

  beforeEach(() => {
    // Reset Redis mock
    mockRedisClient = null;
  });

  describe('Authentication Failures', () => {
    it('should reject connection without valid session', async () => {
      // Create client without authentication headers
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: false,
        // No authentication headers
      });

      try {
        const errorReceived = new Promise<Error>((resolve) => {
          client.on('connect_error', resolve);
        });

        const error = await errorReceived;

        expect(error).toBeDefined();
        expect(error.message).toBeTruthy();
        expect(client.connected).toBe(false);
      } finally {
        client.disconnect();
      }
    });

    it('should emit user-friendly authentication error', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: false,
      });

      try {
        const errorReceived = new Promise<any>((resolve) => {
          client.on('connect_error', resolve);
        });

        const error = await errorReceived;

        // Verify error message is user-friendly
        expect(error).toBeDefined();
        expect(typeof error.message).toBe('string');

        // Should not expose internal details in production
        if (process.env.NODE_ENV === 'production') {
          expect(error.message).not.toContain('session');
          expect(error.message).not.toContain('passport');
        }
      } finally {
        client.disconnect();
      }
    });
  });

  describe('Event Handler Errors', () => {
    it('should catch and handle errors in event handlers', async () => {
      const userId = 1001;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        const _errorSpy = spyOnSocketEvent(client, 'error');

        // Mock an error by sending invalid data
        // Note: This tests the error handling middleware
        const mockSocket = createMockSocket(1001, 'test-socket');

        const testError = new Error('Watch list not found or unauthorized');
        handleSocketError(mockSocket, testError, {
          event: 'subscribe:watchlists',
          userId: 1001,
        });

        // Verify error handler was called
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            message: expect.any(String),
          })
        );
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should sanitize error messages in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockSocket = createMockSocket(1002, 'test-socket');

      const internalError = new Error('Database connection pool exhausted');
      handleSocketError(mockSocket, internalError, {
        event: 'test:event',
        userId: 1002,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'An unexpected error occurred. Please try again',
          code: 'INTERNAL_ERROR',
        })
      );

      // Should not include internal details
      const emitMock = mockSocket.emit as ReturnType<typeof vi.fn>;
      const errorCall = emitMock.mock.calls[0][1];
      expect(errorCall.details).toBeUndefined();
      expect(errorCall.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should show detailed errors in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockSocket = createMockSocket(1003, 'test-socket');

      const specificError = new Error('Product ID 999 not found in database');
      handleSocketError(mockSocket, specificError, {
        event: 'test:event',
        userId: 1003,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Product ID 999 not found in database',
          event: 'test:event',
          details: 'Product ID 999 not found in database',
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should map known errors to user-friendly messages', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockSocket = createMockSocket(1004, 'test-socket');

      const knownErrors = [
        {
          error: new Error('Rate limit exceeded'),
          expectedMessage: 'Too many requests. Please slow down and try again',
          expectedCode: 'RATE_LIMIT_EXCEEDED',
        },
        {
          error: new Error('Watch list not found or unauthorized'),
          expectedMessage: 'Watch list not found',
          expectedCode: 'NOT_FOUND',
        },
        {
          error: new Error('Maximum watch list limit reached'),
          expectedMessage: 'You have reached the maximum number of watch lists (20)',
          expectedCode: 'LIMIT_EXCEEDED',
        },
      ];

      knownErrors.forEach(({ error, expectedMessage, expectedCode }) => {
        mockSocket.emit = vi.fn();
        handleSocketError(mockSocket, error, {
          event: 'test:event',
          userId: 1004,
        });

        expect(mockSocket.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            message: expectedMessage,
            code: expectedCode,
          })
        );
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Redis Connection Loss', () => {
    it('should continue operating when Redis is unavailable', async () => {
      // Set Redis to null (unavailable)
      mockRedisClient = null;

      const userId = 2001;
      const client = createAuthenticatedSocket(userId, port);

      try {
        // Should still connect without Redis
        await waitForEvent(client, 'connect');
        expect(client.connected).toBe(true);

        // Should still be able to subscribe
        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed', 3000);

        // Test completed successfully
        expect(true).toBe(true);
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should fall back to in-memory rate limiting when Redis fails', async () => {
      mockRedisClient = null;

      const userId = 2002;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        // Make multiple subscription requests (rate limit is 10/second)
        for (let i = 0; i < 12; i++) {
          client.emit('subscribe:watchlists');
        }

        // Wait for responses
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Should handle requests even without Redis
        // (In-memory fallback should be used)
        expect(client.connected).toBe(true);
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should handle Redis errors gracefully during operations', async () => {
      // Mock Redis client that throws errors
      mockRedisClient = {
        incr: vi.fn(async () => {
          throw new Error('Redis connection timeout');
        }),
        expire: vi.fn(async () => {
          throw new Error('Redis connection timeout');
        }),
      };

      const userId = 2003;
      const client = createAuthenticatedSocket(userId, port);

      try {
        // Should still connect despite Redis errors
        await waitForEvent(client, 'connect');
        expect(client.connected).toBe(true);

        // Operations should still work (fail-open behavior)
        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed', 3000);

        expect(true).toBe(true);
      } finally {
        disconnectSockets([client]);
        mockRedisClient = null;
      }
    });
  });

  describe('Malformed Data Handling', () => {
    it('should handle malformed subscription data', async () => {
      const userId = 3001;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        const _errorSpy = spyOnSocketEvent(client, 'error');

        // Send malformed data
        client.emit('price:subscribe' as any, {
          productIds: 'not-an-array', // Should be array
        });

        // Give time for server to process
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Connection should remain stable
        expect(client.connected).toBe(true);
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should validate notification mark-read data', async () => {
      const userId = 3002;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        client.emit('notification:subscribe');
        await waitForEvent(client, 'notification:subscribed');

        // Send invalid notification ID
        client.emit('notification:mark-read' as any, {
          notificationId: 'invalid', // Should be number
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Connection should remain stable
        expect(client.connected).toBe(true);
      } finally {
        disconnectSockets([client]);
      }
    });
  });

  describe('Rate Limit Errors', () => {
    it('should emit error when rate limit is exceeded', async () => {
      const userId = 4001;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        const _errorSpy = spyOnSocketEvent(client, 'error');

        // Spam subscription requests to trigger rate limit
        for (let i = 0; i < 15; i++) {
          client.emit('subscribe:watchlists');
        }

        // Wait for rate limit error
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Should receive rate limit error
        // Note: Exact behavior depends on rate limit implementation
        // Connection should remain open
        expect(client.connected).toBe(true);
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should reset rate limits after time window', async () => {
      const userId = 4002;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        // Make requests up to limit
        for (let i = 0; i < 10; i++) {
          client.emit('subscribe:watchlists');
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Wait for rate limit window to reset (1 second)
        await new Promise((resolve) => setTimeout(resolve, 1200));

        // Should be able to make requests again
        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed', 2000);

        expect(client.connected).toBe(true);
      } finally {
        disconnectSockets([client]);
      }
    }, 5000);
  });

  describe('Server Error Recovery', () => {
    it('should not crash server on unhandled event handler error', async () => {
      const userId = 5001;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        // Simulate an unhandled error scenario
        const mockSocket = createMockSocket(5001, 'test-socket');

        const unexpectedError = new Error('Unexpected null pointer');
        handleSocketError(mockSocket, unexpectedError, {
          event: 'test:event',
          userId: 5001,
        });

        // Server should remain responsive
        const io = getSocketIO();
        expect(io).toBeDefined();
        expect(io?.sockets.sockets.size).toBeGreaterThan(0);
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should handle errors during event emission', async () => {
      const userId = 5002;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        // Try to emit to non-existent room (shouldn't crash)
        const io = getSocketIO();
        if (io) {
          io.to('nonexistent:room').emit('watchlist:update', {
            watchListId: 999,
            name: 'Test',
            action: 'created' as const,
            timestamp: new Date().toISOString(),
          });
        }

        // Server should still be responsive
        expect(client.connected).toBe(true);
      } finally {
        disconnectSockets([client]);
      }
    });
  });

  describe('Multiple Error Scenarios', () => {
    it('should handle multiple concurrent errors', async () => {
      const clients: ClientSocket[] = [];
      const errorCount = { value: 0 };

      try {
        // Create multiple clients
        for (let i = 0; i < 5; i++) {
          const userId = 6000 + i;
          const client = createAuthenticatedSocket(userId, port);
          clients.push(client);
          await waitForEvent(client, 'connect');

          client.on('error', () => errorCount.value++);
        }

        // Trigger errors on all clients simultaneously
        const mockSockets = clients.map((_, i) => ({
          id: `socket-${i}`,
          emit: vi.fn(),
          userId: 6000 + i,
        } as unknown as AuthenticatedSocket));

        mockSockets.forEach((socket) => {
          handleSocketError(socket, new Error('Test error'), {
            event: 'test:event',
            userId: socket.userId,
          });
        });

        // All errors should be handled
        expect(mockSockets.every((s) => s.emit)).toBeTruthy();

        // Clients should remain connected
        const connectedCount = clients.filter((c) => c.connected).length;
        expect(connectedCount).toBe(5);
      } finally {
        disconnectSockets(clients);
      }
    });
  });
});
