/**
 * WebSocket Event Types for Watch List Real-Time Notifications
 *
 * Shared types for client-server WebSocket communication.
 * This file defines all event types and payloads for Socket.io events
 * related to watch list price alerts and notifications.
 *
 * Usage:
 * - Client: import type { ServerToClientEvents } from '@shared/websocket-types';
 * - Server: import type { ServerToClientEvents } from '@shared/websocket-types';
 */

/**
 * Price Alert Event - triggered when a product price drops below threshold
 */
export interface PriceAlertEvent {
  alertId: number;
  productId: number;
  productName: string;
  currentPrice: number;
  previousPrice: number;
  targetPrice: number;
  percentageChange: number;
  retailerName: string;
  retailerUrl: string;
  timestamp: string;
}

/**
 * Watch List Update Event - triggered when a watch list is modified
 */
export interface WatchListUpdateEvent {
  watchListId: number;
  name: string;
  action: 'created' | 'updated' | 'deleted' | 'product_added' | 'product_removed';
  productCount?: number;
  timestamp: string;
}

/**
 * Product Price Update Event - triggered when any watched product price changes
 */
export interface ProductPriceUpdateEvent {
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  retailerName: string;
  timestamp: string;
}

/**
 * Notification Event - generic notification for user
 */
export interface NotificationEvent {
  id: number;
  type: 'price_alert' | 'watch_list' | 'system';
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  timestamp: string;
}

/**
 * Server-to-Client Events
 */
export interface ServerToClientEvents {
  // Price alerts and updates
  'price:alert': (data: PriceAlertEvent) => void;
  'price:updated': (data: ProductPriceUpdateEvent & { savings?: number; priority?: string }) => void;
  'price:subscribed': (data: { productIds: number[]; timestamp: string; message: string }) => void;
  'price:unsubscribed': (data: { productIds: number[]; timestamp: string }) => void;

  // Watch list updates
  'watchlist:update': (data: WatchListUpdateEvent) => void;
  'watchlist:product_added': (data: { watchListId: number; product: { id: number; name: string; image?: string | null; currentPrice?: number | null }; timestamp: string }) => void;
  'watchlist:product_removed': (data: { watchListId: number; productId: number; timestamp: string }) => void;
  'watchlist:subscribed': (data: { timestamp: string; message: string }) => void;
  'watchlist:unsubscribed': (data: { timestamp: string }) => void;

  // Notifications
  'notification:new': (data: { notification: NotificationEvent; unreadCount: number }) => void;
  'notification:read': (data: { notificationId: number; unreadCount: number }) => void;
  'notification:count_updated': (data: { unreadCount: number; timestamp: string }) => void;
  'notification:subscribed': (data: { timestamp: string; unreadCount: number; totalCount: number }) => void;
  'notification:unsubscribed': (data: { timestamp: string }) => void;

  // Connection events
  'authenticated': (data: { userId: number; timestamp: string }) => void;
  'error': (data: { message: string; code?: string; event?: string; details?: string }) => void;
}

/**
 * Client-to-Server Events
 */
export interface ClientToServerEvents {
  // Watch list subscriptions
  'subscribe:watchlists': () => void;
  'unsubscribe:watchlists': () => void;

  // Alert subscriptions
  'subscribe:alerts': () => void;

  // Price update subscriptions
  'price:subscribe': (data: { productIds: number[] }) => void;
  'price:unsubscribe': (data: { productIds: number[] }) => void;

  // Notification subscriptions
  'notification:subscribe': () => void;
  'notification:unsubscribe': () => void;

  // Notification actions
  'notification:mark-read': (data: { notificationId: number }) => void;

  // Heartbeat
  'ping': () => void;
}
