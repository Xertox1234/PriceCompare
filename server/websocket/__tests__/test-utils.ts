/**
 * WebSocket Test Utilities
 *
 * Shared helper functions for WebSocket testing:
 * - Creating authenticated test connections
 * - Mocking Redis and sessions
 * - Waiting for events
 * - Test server setup
 */

import { Server as HTTPServer, createServer } from 'http';
import express, { type Express } from 'express';
import session from 'express-session';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { initializeWebSocket, shutdownWebSocket, getSocketIO } from '../index';
import type { ServerToClientEvents, ClientToServerEvents } from '../types';
import { vi } from 'vitest';

// Test server configuration
export const TEST_PORT = 5556;
export const TEST_URL = `http://localhost:${TEST_PORT}`;

/**
 * Create a test HTTP server with WebSocket support
 */
export async function createTestServer(): Promise<{
  app: Express;
  httpServer: HTTPServer;
  port: number;
}> {
  const app = express();

  // Mock session middleware for testing
  const sessionMiddleware = session({
    secret: 'test-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  });

  app.use(sessionMiddleware);

  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize WebSocket server
  initializeWebSocket(httpServer, sessionMiddleware);

  // Start listening
  await new Promise<void>((resolve) => {
    httpServer.listen(TEST_PORT, () => {
      resolve();
    });
  });

  return { app, httpServer, port: TEST_PORT };
}

/**
 * Close test server and cleanup
 */
export async function closeTestServer(httpServer: HTTPServer): Promise<void> {
  await shutdownWebSocket();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
}

/**
 * Create an authenticated WebSocket client connection
 *
 * @param userId User ID for authentication
 * @param port Server port (defaults to TEST_PORT)
 * @returns Socket.io client instance
 */
export function createAuthenticatedSocket(
  userId: number,
  port: number = TEST_PORT
): ClientSocket<ServerToClientEvents, ClientToServerEvents> {
  // Create client with session cookie
  const client = ioClient(`http://localhost:${port}`, {
    path: '/ws',
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: {
      // Mock authentication by setting session data in headers
      // In real tests, this would be handled by cookie-based session
      'x-test-user-id': String(userId),
    },
  });

  return client;
}

/**
 * Wait for a specific event to be emitted by a socket
 *
 * @param socket Socket instance
 * @param eventName Event to wait for
 * @param timeout Timeout in milliseconds (default: 5000)
 * @returns Promise resolving to event data
 */
export function waitForEvent<T = any>(
  socket: ClientSocket,
  eventName: string,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    socket.once(eventName as any, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Wait for multiple events to be emitted
 *
 * @param socket Socket instance
 * @param eventNames Events to wait for
 * @param timeout Timeout in milliseconds (default: 5000)
 * @returns Promise resolving to array of event data
 */
export async function waitForEvents(
  socket: ClientSocket,
  eventNames: string[],
  timeout = 5000
): Promise<any[]> {
  const results = await Promise.all(
    eventNames.map((event) => waitForEvent(socket, event, timeout))
  );
  return results;
}

/**
 * Wait for socket to connect
 */
export function waitForConnection(
  socket: ClientSocket,
  timeout = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeout);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Create a mock session for testing
 */
export function createMockSession(userId: number): any {
  return {
    id: `session-${userId}`,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: false,
    },
    passport: {
      user: userId,
    },
  };
}

/**
 * Mock Redis client for testing
 */
export function createMockRedis() {
  const store = new Map<string, { value: string; expiresAt: number }>();

  return {
    get: vi.fn(async (key: string) => {
      const item = store.get(key);
      if (!item) return null;

      if (item.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }

      return item.value;
    }),

    set: vi.fn(async (key: string, value: string, ex?: number) => {
      store.set(key, {
        value,
        expiresAt: ex ? Date.now() + ex * 1000 : Infinity,
      });
      return 'OK';
    }),

    incr: vi.fn(async (key: string) => {
      const item = store.get(key);
      const current = item ? parseInt(item.value, 10) : 0;
      const newValue = current + 1;
      store.set(key, { value: String(newValue), expiresAt: Infinity });
      return newValue;
    }),

    expire: vi.fn(async (key: string, seconds: number) => {
      const item = store.get(key);
      if (!item) return 0;

      item.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }),

    del: vi.fn(async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    }),

    duplicate: vi.fn(() => createMockRedis()),

    // Helper to clear all data
    _clear: () => store.clear(),

    // Helper to inspect data
    _getAll: () => new Map(store),
  };
}

/**
 * Create multiple authenticated sockets
 *
 * @param userIds Array of user IDs
 * @param port Server port
 * @returns Array of socket instances
 */
export async function createMultipleSockets(
  userIds: number[],
  port: number = TEST_PORT
): Promise<ClientSocket[]> {
  const sockets = userIds.map((userId) => createAuthenticatedSocket(userId, port));

  // Wait for all to connect
  await Promise.all(sockets.map((socket) => waitForConnection(socket)));

  return sockets;
}

/**
 * Disconnect and cleanup multiple sockets
 */
export function disconnectSockets(sockets: ClientSocket[]): void {
  sockets.forEach((socket) => {
    if (socket.connected) {
      socket.disconnect();
    }
  });
}

/**
 * Spy on socket event emissions
 *
 * @param socket Socket instance
 * @param eventName Event to spy on
 * @returns Vitest spy function
 */
export function spyOnSocketEvent(socket: ClientSocket, eventName: string) {
  const spy = vi.fn();
  socket.on(eventName as any, spy);
  return spy;
}

/**
 * Wait for a condition to be true
 *
 * @param condition Function returning boolean
 * @param timeout Timeout in milliseconds
 * @param interval Check interval in milliseconds
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Emit server event to user (for testing server-to-client events)
 */
export function emitServerEvent<K extends keyof ServerToClientEvents>(
  userId: number,
  event: K,
  data: Parameters<ServerToClientEvents[K]>[0]
): void {
  const io = getSocketIO();
  if (!io) {
    throw new Error('Socket.io server not initialized');
  }

  const room = `user:${userId}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Type assertion needed for Socket.io's complex generic emit signature with acknowledgements
  (io.to(room).emit as any)(event, data);
}

/**
 * Get connected sockets count
 */
export function getConnectedSocketsCount(): number {
  const io = getSocketIO();
  return io ? io.sockets.sockets.size : 0;
}

/**
 * Force disconnect a user's sockets
 */
export function forceDisconnectUser(userId: number): void {
  const io = getSocketIO();
  if (!io) return;

  const room = `user:${userId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(room);

  if (socketsInRoom) {
    socketsInRoom.forEach((socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    });
  }
}
