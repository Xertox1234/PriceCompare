/**
 * WebSocket Server-Side Types
 *
 * Re-exports shared WebSocket types and defines server-only types
 * that depend on Socket.io server internals.
 */

import { Socket } from 'socket.io';

// Re-export all shared types for server-side usage
export type {
  PriceAlertEvent,
  WatchListUpdateEvent,
  ProductPriceUpdateEvent,
  NotificationEvent,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@shared/websocket-types';

/**
 * Extended Socket type with authenticated user data
 * Server-only: depends on Socket.io server internals
 */
export interface AuthenticatedSocket extends Socket {
  userId: number;
  userEmail: string;
}

/**
 * Rate limit tracking for WebSocket connections
 * Server-only: used for connection throttling
 */
export interface RateLimitData {
  count: number;
  resetAt: number;
}
