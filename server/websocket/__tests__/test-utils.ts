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

/**
 * SOCKET.IO TEST BEHAVIOR NOTES
 *
 * CRITICAL: Understanding these behaviors prevents race conditions in tests.
 *
 * 1. Socket.IO Client Auto-Connect:
 *    - By default, ioClient() starts connecting IMMEDIATELY upon creation
 *    - This causes race conditions: server emits events before test sets up listeners
 *    - Solution: Use autoConnect: false and manually call socket.connect() when ready
 *
 * 2. Event Listener Timing (CRITICAL):
 *    - Server emits 'authenticated' synchronously during connection phase
 *    - Test MUST attach listeners BEFORE calling socket.connect()
 *    - socket.once() only catches FUTURE events (not already-emitted events)
 *    - Use connectAndAuthenticate() helper to avoid this race condition
 *
 * 3. Room Operations:
 *    - socket.join() is async with Redis adapter, synchronous without
 *    - Use setImmediate() after join() to ensure completion in both cases
 *    - Wait for room join before expecting room-targeted emissions
 *
 * 4. Event Bus Subscriptions:
 *    - Event bus listeners accumulate if not cleaned up between test servers
 *    - Always call eventBus.removeAllListeners() in closeTestServer()
 *
 * HISTORY: These patterns emerged from fixing TODO_207 (7 failing WebSocket tests).
 * See TODO_207_RESOLUTION_SUMMARY.md for complete root cause analysis.
 */

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
  const io = initializeWebSocket(httpServer, sessionMiddleware);

  // CRITICAL: Set up event bus subscriptions for tests
  // These must be called after WebSocket initialization to ensure event bus
  // listeners are registered BEFORE tests emit events through the event bus
  const [
    { setupWatchListEventSubscriptions },
    { setupNotificationEventSubscriptions },
  ] = await Promise.all([
    import('../handlers/watch-list-handler'),
    import('../handlers/notification-handler'),
  ]);

  setupWatchListEventSubscriptions(io);
  setupNotificationEventSubscriptions(io);

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
 *
 * CRITICAL: Cleans up event bus listeners to prevent accumulation across test runs.
 * Without this, multiple test server instances would accumulate duplicate listeners.
 */
export async function closeTestServer(httpServer: HTTPServer): Promise<void> {
  // Clean up event listeners to prevent accumulation across test runs
  // This is critical for tests that create multiple servers in sequence
  const { eventBus } = await import('../../utils/event-bus');
  eventBus.removeAllListeners();

  shutdownWebSocket();
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
  // CRITICAL: Use autoConnect: false to prevent immediate connection
  // This allows tests to set up event listeners BEFORE the connection completes
  // and the server emits the 'authenticated' event
  const client = ioClient(`http://localhost:${port}`, {
    path: '/ws',
    transports: ['websocket'],
    reconnection: false,
    autoConnect: false, // Don't connect immediately - let test control when to connect
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic default `any` needed for flexible event data typing
export function waitForEvent<T = any>(
  socket: ClientSocket,
  eventName: string,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Socket.io typed events require cast for dynamic event names
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event data types vary by event name
): Promise<any[]> {
  const results = await Promise.all(
    eventNames.map((event) => waitForEvent(socket, event, timeout))
  );
  return results;
}

/**
 * Wait for socket to connect
 */
export function waitForConnection(socket: ClientSocket, timeout = 5000): Promise<void> {
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
 * Connect socket and wait for authentication to complete
 *
 * CRITICAL: This function prevents a race condition where:
 * 1. Server emits 'authenticated' event synchronously during connection phase
 * 2. Test sets up listener AFTER event has already fired
 * 3. Test times out waiting for event that will never come (already missed)
 *
 * ROOT CAUSE:
 * - Socket.IO server emits 'authenticated' in handleConnection() immediately after auth
 * - socket.once() only catches FUTURE events, not already-emitted events
 * - If listener is attached AFTER connection completes, event is missed
 *
 * SOLUTION:
 * By setting up BOTH 'connect' and 'authenticated' listeners BEFORE calling
 * socket.connect(), we guarantee they're in place to catch synchronous emissions.
 *
 * USAGE PATTERN:
 * ```typescript
 * const client = createAuthenticatedSocket(userId, port); // autoConnect: false
 * await connectAndAuthenticate(client); // Listeners ready BEFORE connecting
 * // Now safe to use client - both events have fired
 * ```
 *
 * HISTORY:
 * This pattern was added to fix 7 failing integration tests in TODO_207.
 * See TODO_207_RESOLUTION_SUMMARY.md for complete root cause analysis.
 *
 * @param socket Socket instance (MUST have autoConnect: false)
 * @param timeout Timeout in milliseconds (default: 5000)
 * @returns Promise resolving with { userId } when both connect and authenticated events fire
 */
export async function connectAndAuthenticate(
  socket: ClientSocket,
  timeout = 5000
): Promise<{ userId: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Connection/authentication timeout'));
    }, timeout);

    let connected = false;
    let authenticated = false;
    let authData: { userId: number } | null = null;

    const checkComplete = () => {
      if (connected && authenticated && authData) {
        clearTimeout(timer);
        resolve(authData);
      }
    };

    // Set up listeners BEFORE connecting
    socket.once('connect', () => {
      connected = true;
      checkComplete();
    });

    socket.once('authenticated', (data: { userId: number }) => {
      authenticated = true;
      authData = data;
      checkComplete();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    // Now connect - both listeners are already in place
    socket.connect();
  });
}

/**
 * Create a mock session for testing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express session mock with variable shape
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
    get: vi.fn((key: string) => {
      const item = store.get(key);
      if (!item) return null;

      if (item.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }

      return item.value;
    }),

    set: vi.fn((key: string, value: string, ex?: number) => {
      store.set(key, {
        value,
        expiresAt: ex ? Date.now() + ex * 1000 : Infinity,
      });
      return 'OK';
    }),

    incr: vi.fn((key: string) => {
      const item = store.get(key);
      const current = item ? parseInt(item.value, 10) : 0;
      const newValue = current + 1;
      store.set(key, { value: String(newValue), expiresAt: Infinity });
      return newValue;
    }),

    expire: vi.fn((key: string, seconds: number) => {
      const item = store.get(key);
      if (!item) return 0;

      item.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }),

    del: vi.fn((key: string) => {
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
 * CRITICAL: Uses connectAndAuthenticate to avoid race condition where
 * server emits 'authenticated' before test sets up listener
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

  // Wait for all to connect AND authenticate
  await Promise.all(sockets.map((socket) => connectAndAuthenticate(socket)));

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Socket.io typed events require cast for dynamic event names
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Socket.io emit signature with acknowledgements requires cast
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

/**
 * Setup common mock dependencies for WebSocket tests
 * Call this function before importing WebSocket modules to ensure mocks are registered
 *
 * @returns Mock configuration object with references to mocked modules
 */
export function setupWebSocketMocks() {
  // This function should be called in the test file's module scope
  // before any WebSocket imports that depend on these mocks.
  // The actual mocking is done via vi.mock() in each test file,
  // but this provides a centralized reference for what needs to be mocked.

  return {
    mockConfig: {
      redis: {
        getRedisClient: vi.fn(() => null),
        redisClient: null,
      },
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
      notificationService: {
        markAsRead: vi.fn(() => 1),
        getNotificationStats: vi.fn(() => ({
          total: 10,
          unread: 3,
          byType: {},
        })),
      },
    },
  };
}

/**
 * Common test server setup for WebSocket tests
 * Use this in beforeAll/afterAll hooks
 *
 * @example
 * ```typescript
 * let testContext: WebSocketTestContext;
 *
 * beforeAll(async () => {
 *   testContext = await setupWebSocketTestContext();
 * });
 *
 * afterAll(async () => {
 *   await cleanupWebSocketTestContext(testContext);
 * });
 * ```
 */
export interface WebSocketTestContext {
  app: Express;
  httpServer: HTTPServer;
  port: number;
}

/**
 * Setup WebSocket test context (server, app, port)
 */
export async function setupWebSocketTestContext(): Promise<WebSocketTestContext> {
  const { app, httpServer, port } = await createTestServer();
  return { app, httpServer, port };
}

/**
 * Cleanup WebSocket test context
 */
export async function cleanupWebSocketTestContext(
  context: WebSocketTestContext
): Promise<void> {
  await closeTestServer(context.httpServer);
}

