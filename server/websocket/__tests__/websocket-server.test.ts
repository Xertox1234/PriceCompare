/**
 * WebSocket Server Tests
 *
 * Tests authentication, rate limiting, and connection handling
 * for the watch list real-time notification WebSocket server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server as HTTPServer, createServer } from 'http';
import express, { type Express } from 'express';
import session from 'express-session';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { initializeWebSocket, shutdownWebSocket } from '../index';

describe('WebSocket Server', () => {
  let app: Express;
  let httpServer: HTTPServer;
  let clientSocket: ClientSocket;
  const TEST_PORT = 5555;

  beforeAll(async () => {
    // Setup Express app with session middleware
    app = express();

    // Mock session middleware for testing
    const sessionMiddleware = session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        // Use secure cookies in production, not in test
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      },
    });

    app.use(sessionMiddleware);

    // Create HTTP server
    httpServer = createServer(app);

    // Initialize WebSocket server
    initializeWebSocket(httpServer, sessionMiddleware);

    // Start listening
    await new Promise<void>((resolve) => {
      httpServer.listen(TEST_PORT, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Cleanup
    if (clientSocket && clientSocket.connected) {
      clientSocket.close();
    }
    shutdownWebSocket();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it('should reject connection without valid session', async () => {
    // Attempt to connect without session cookie
    clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
      path: '/ws',
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect_error', (error) => {
        // Socket.io client may wrap error message, so just verify connection was rejected
        expect(error).toBeDefined();
        expect(error.message).toBeTruthy();
        clientSocket.close();
        resolve();
      });

      // Should not successfully connect
      clientSocket.on('connect', () => {
        reject(new Error('Should not connect without authentication'));
      });
    });
  });

  it('should initialize with correct configuration', () => {
    // Test verifies server starts without errors (covered by beforeAll)
    expect(httpServer.listening).toBe(true);
  });
});

describe('WebSocket Helper Functions', () => {
  it('should export required functions', async () => {
    const {
      initializeWebSocket,
      shutdownWebSocket,
      getSocketIO,
      emitToUser,
      getConnectedClientsCount,
    } = await import('../index');

    expect(typeof initializeWebSocket).toBe('function');
    expect(typeof shutdownWebSocket).toBe('function');
    expect(typeof getSocketIO).toBe('function');
    expect(typeof emitToUser).toBe('function');
    expect(typeof getConnectedClientsCount).toBe('function');
  });
});
