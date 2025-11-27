/**
 * WebSocket Server for Watch List Real-Time Notifications
 *
 * Implements Socket.io server with:
 * - Session-based authentication
 * - Redis adapter for multi-server support
 * - User-specific rooms for targeted messaging
 * - Connection rate limiting
 * - Heartbeat monitoring
 *
 * Integration point: Called from server/index.ts after Express setup
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { RequestHandler, Request, Response } from 'express';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedisClient } from '../config/redis';
import { createLogger } from '../utils/logger';
import type {
  AuthenticatedSocket,
  ServerToClientEvents,
  ClientToServerEvents,
  RateLimitData,
} from './types';

/**
 * Extended request type for Socket.io integration with Express sessions
 * Includes session data populated by express-session middleware
 */
type SocketRequestWithSession = Request & {
  session: {
    passport?: {
      user?: number;
    };
    [key: string]: unknown;
  };
};

/**
 * Minimal response object for Express middleware compatibility
 * Socket.io doesn't use the response, but middleware expects it
 */
interface MinimalResponse {
  getHeader: () => undefined;
  setHeader: () => MinimalResponse;
  writeHead: () => MinimalResponse;
  end: () => MinimalResponse;
}

const log = createLogger('WebSocket');

// WebSocket server instance
let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

// Session middleware (stored for Socket.io integration)
let sessionMiddleware: RequestHandler | null = null;

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_CONNECTIONS_PER_MINUTE: 10,
  WINDOW_MS: 60000, // 1 minute
};

// Connection tracking
const connectionCount = new Map<string, number>();

/**
 * Initialize WebSocket server with Redis adapter and authentication
 *
 * @param httpServer Express HTTP server instance
 * @param expressSessionMiddleware Express session middleware for authentication
 * @returns Socket.io server instance
 */
export function initializeWebSocket(
  httpServer: HTTPServer,
  expressSessionMiddleware: RequestHandler
): SocketIOServer {
  sessionMiddleware = expressSessionMiddleware;
  log.info('Initializing WebSocket server...');

  // Create Socket.io server with CORS config matching Express
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/ws', // Use /ws path to differentiate from existing /socket.io
    pingTimeout: 30000, // 30 seconds
    pingInterval: 25000, // 25 seconds
    transports: ['websocket', 'polling'], // Support both transports
  });

  // Setup Redis adapter for multi-server support
  setupRedisAdapter();

  // Setup authentication middleware
  io.use(authenticationMiddleware);

  // Setup rate limiting middleware
  io.use(rateLimitMiddleware);

  // Handle connections
  io.on('connection', handleConnection);

  log.info('WebSocket server initialized successfully', {
    path: '/ws',
    pingTimeout: '30s',
    pingInterval: '25s',
  });

  return io;
}

/**
 * Setup Redis adapter for multi-server Socket.io support
 *
 * Uses ioredis client with pub/sub for cross-server message routing
 */
function setupRedisAdapter(): void {
  const redisClient = getRedisClient();

  if (!redisClient) {
    log.warn('⚠️  Redis not available - WebSocket will only work on single server');
    log.warn('   Multi-server deployments require Redis for proper routing');
    return;
  }

  try {
    // Create pub and sub clients for Redis adapter
    const pubClient = redisClient;
    const subClient = pubClient.duplicate();

    // Socket.io Redis adapter
    io!.adapter(createAdapter(pubClient, subClient));

    log.info('✅ Redis adapter configured for multi-server WebSocket support');
  } catch (error) {
    log.error('Failed to setup Redis adapter', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Continue without Redis adapter (single-server mode)
    log.warn('⚠️  Continuing in single-server mode without Redis adapter');
  }
}

/**
 * Authentication middleware - verify session and extract userId
 *
 * Rejects connections without valid Express session
 */
async function authenticationMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const handshake = socket.handshake;
  const ip = handshake.address;
  const userAgent = handshake.headers['user-agent'] || 'unknown';

  // Wrap Socket.io request in Express session middleware
  if (!sessionMiddleware) {
    log.error('Session middleware not initialized');
    return next(new Error('Server configuration error'));
  }

  // Convert Socket.io handshake to Express-compatible request/response
  const req = socket.request as SocketRequestWithSession;
  const res: MinimalResponse = {
    getHeader: () => undefined,
    setHeader: function() { return this; },
    writeHead: function() { return this; },
    end: function() { return this; },
  };

  // Run Express session middleware
  // Type assertion: MinimalResponse implements the minimal Response interface needed by session middleware.
  // Socket.IO doesn't use the response, but express-session requires it for middleware signature compatibility.
  // We use 'unknown' as an intermediate step to safely cast between incompatible types.
  sessionMiddleware(
    req,
    res as unknown as Response,
    (err?: unknown) => {
      if (err) {
        log.error('Session middleware error', {
          error: err instanceof Error ? err.message : String(err),
        });
        return next(new Error('Authentication failed'));
      }

    // Extract session from request (now populated by session middleware)
    const session = req.session;

    if (!session || !session.passport || !session.passport.user) {
      log.warn('WebSocket connection rejected - no valid session', {
        ip,
        userAgent: userAgent.substring(0, 100),
      });

      return next(new Error('Authentication required'));
    }

    const userId = session.passport.user;

    if (typeof userId !== 'number') {
      log.warn('WebSocket connection rejected - invalid userId in session', {
        ip,
        userId: typeof userId,
      });

      return next(new Error('Invalid session data'));
    }

    // Attach userId to socket for use in handlers
    (socket as AuthenticatedSocket).userId = userId;

    log.info('WebSocket authentication successful', {
      userId,
      ip,
      socketId: socket.id,
    });

    next();
  });
}

/**
 * Rate limiting middleware - prevent connection spam
 *
 * Limits connections per IP to prevent abuse
 */
async function rateLimitMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const ip = socket.handshake.address;
  const redisClient = getRedisClient();

  try {
    if (redisClient) {
      // Redis-based rate limiting (distributed)
      const key = `ws:ratelimit:${ip}`;
      const current = await redisClient.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await redisClient.expire(key, Math.ceil(RATE_LIMIT.WINDOW_MS / 1000));
      }

      if (current > RATE_LIMIT.MAX_CONNECTIONS_PER_MINUTE) {
        log.warn('WebSocket connection rejected - rate limit exceeded', {
          ip,
          count: current,
          limit: RATE_LIMIT.MAX_CONNECTIONS_PER_MINUTE,
        });

        return next(new Error('Too many connection attempts. Please try again later.'));
      }
    } else {
      // In-memory rate limiting (single server)
      const now = Date.now();
      const currentCount = connectionCount.get(ip) || 0;

      if (currentCount >= RATE_LIMIT.MAX_CONNECTIONS_PER_MINUTE) {
        log.warn('WebSocket connection rejected - rate limit exceeded (in-memory)', {
          ip,
          count: currentCount,
          limit: RATE_LIMIT.MAX_CONNECTIONS_PER_MINUTE,
        });

        return next(new Error('Too many connection attempts. Please try again later.'));
      }

      connectionCount.set(ip, currentCount + 1);

      // Clean up after window expires
      setTimeout(() => {
        connectionCount.delete(ip);
      }, RATE_LIMIT.WINDOW_MS);
    }

    next();
  } catch (error) {
    log.error('Rate limit check failed', {
      error: error instanceof Error ? error.message : String(error),
      ip,
    });

    // Allow connection on error (fail open for availability)
    next();
  }
}

/**
 * Handle new WebSocket connection
 *
 * - Join user to their personal room
 * - Setup event handlers
 * - Track connection duration
 */
function handleConnection(socket: Socket): void {
  const authSocket = socket as AuthenticatedSocket;
  const userId = authSocket.userId;
  const connectedAt = Date.now();

  // Join user to their personal room for targeted messaging
  const userRoom = `user:${userId}`;
  socket.join(userRoom);

  log.info('WebSocket client connected', {
    userId,
    socketId: socket.id,
    room: userRoom,
    ip: socket.handshake.address,
  });

  // Send authentication confirmation
  socket.emit('authenticated', {
    userId,
    timestamp: new Date().toISOString(),
  });

  // Handle client events
  setupEventHandlers(authSocket);

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    const duration = Date.now() - connectedAt;
    log.info('WebSocket client disconnected', {
      userId,
      socketId: socket.id,
      reason,
      duration: `${Math.round(duration / 1000)}s`,
    });
  });

  // Handle errors
  socket.on('error', (error) => {
    log.error('WebSocket client error', {
      userId,
      socketId: socket.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Setup event handlers for authenticated client
 */
function setupEventHandlers(socket: AuthenticatedSocket): void {
  // Import handler registration functions
  const { registerWatchListHandlers } = require('./handlers/watch-list-handler');
  const { registerNotificationHandlers } = require('./handlers/notification-handler');
  const { registerPriceUpdateHandlers } = require('./handlers/price-update-handler');

  // Register all event handlers
  registerWatchListHandlers(socket);
  registerNotificationHandlers(socket);
  registerPriceUpdateHandlers(socket);

  // Heartbeat/ping handler (keep existing)
  socket.on('ping', () => {
    socket.emit('authenticated', {
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    });
  });

  // Subscribe to price alerts (legacy handler for backward compatibility)
  socket.on('subscribe:alerts', () => {
    log.debug('Client subscribed to price alerts', {
      userId: socket.userId,
      socketId: socket.id,
    });
    // Note: Already in user room, no additional action needed
  });
}

/**
 * Get Socket.io server instance
 *
 * Allows other services to emit events to connected clients
 */
export function getSocketIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null {
  if (!io) {
    log.warn('getSocketIO() called before initialization');
  }
  return io;
}

/**
 * Emit event to specific user (all their connected clients)
 *
 * @param userId User ID to target
 * @param event Event name
 * @param data Event payload
 */
export function emitToUser<K extends keyof ServerToClientEvents>(
  userId: number,
  event: K,
  data: Parameters<ServerToClientEvents[K]>[0]
): void {
  if (!io) {
    log.warn('Cannot emit event - WebSocket not initialized', { event, userId });
    return;
  }

  const room = `user:${userId}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Type assertion needed for Socket.io's complex generic emit signature with acknowledgements
  (io.to(room).emit as any)(event, data);

  log.debug('Event emitted to user', {
    userId,
    event,
    room,
  });
}

/**
 * Get count of currently connected clients
 */
export function getConnectedClientsCount(): number {
  return io ? io.sockets.sockets.size : 0;
}

/**
 * Shutdown WebSocket server gracefully
 */
export async function shutdownWebSocket(): Promise<void> {
  if (!io) {
    return;
  }

  log.info('Shutting down WebSocket server...');

  // Close all connections
  io.close(() => {
    log.info('WebSocket server closed');
  });

  io = null;
}

/**
 * Re-export event emitter functions for use by services
 *
 * These allow backend services to emit events to connected clients
 */
export {
  emitWatchListUpdate,
  emitProductAdded,
  emitProductRemoved,
} from './handlers/watch-list-handler';

export {
  emitNewNotification,
  emitUnreadCountUpdate,
} from './handlers/notification-handler';

export {
  emitPriceUpdate,
  emitPriceAlert,
  getPriceSubscriptionCount,
  getWatchedProductIds,
} from './handlers/price-update-handler';
