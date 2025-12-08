/**
 * Event Bus for Decoupling Services and WebSocket Handlers
 *
 * This event bus is designed to break circular dependencies between:
 * - Storage layer and WebSocket handlers
 * - Services and WebSocket handlers
 * - Service-to-service communication
 *
 * Pattern: Publish-Subscribe (Pub/Sub) with typed events
 *
 * Usage:
 *   // In service (publisher):
 *   import { eventBus, AppEvents } from '../utils/event-bus';
 *   eventBus.emit(AppEvents.NOTIFICATION_CREATED, { userId: 123, notification: {...} });
 *
 *   // In WebSocket handler (subscriber):
 *   import { eventBus, AppEvents } from '../../utils/event-bus';
 *   eventBus.on(AppEvents.NOTIFICATION_CREATED, (payload) => {
 *     socket.emit('notification:new', payload.notification);
 *   });
 *
 * @see docs/PATTERNS.md for event bus pattern documentation
 */

import { EventEmitter } from 'events';
import { logger } from './logger';

/**
 * Application Event Names
 * Centralized event name constants for type safety
 */
export const AppEvents = {
  // Notification events
  NOTIFICATION_CREATED: 'notification:created',
  NOTIFICATION_MARKED_READ: 'notification:marked-read',
  NOTIFICATION_MARKED_ALL_READ: 'notification:marked-all-read',

  // Watch list events
  WATCHLIST_UPDATED: 'watchlist:updated',
  WATCHLIST_PRODUCT_ADDED: 'watchlist:product-added',
  WATCHLIST_PRODUCT_REMOVED: 'watchlist:product-removed',
  WATCHLIST_DELETED: 'watchlist:deleted',

  // Price events
  PRICE_UPDATED: 'price:updated',
  PRICE_ALERT_TRIGGERED: 'price:alert-triggered',

  // Alert events (for dashboard)
  ALERT_TRIGGERED: 'alert:triggered',
  ALERT_RESOLVED: 'alert:resolved',

  // System events
  METRICS_UPDATED: 'metrics:updated',
  ERROR_OCCURRED: 'error:occurred',
} as const;

/**
 * Event Payload Types
 */
export interface NotificationCreatedPayload {
  userId: number;
  notification: {
    id: number;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    createdAt: Date;
  };
}

export interface NotificationMarkedReadPayload {
  userId: number;
  notificationId: number;
}

export interface NotificationMarkedAllReadPayload {
  userId: number;
}

export interface WatchlistUpdatedPayload {
  userId: number;
  watchlistId: number;
  action: 'created' | 'updated' | 'deleted';
  watchlist?: {
    id: number;
    name: string;
    productCount: number;
  };
}

export interface WatchlistProductAddedPayload {
  userId: number;
  watchlistId: number;
  productId: number;
  product?: {
    id: number;
    name: string;
    imageUrl?: string;
  };
}

export interface WatchlistProductRemovedPayload {
  userId: number;
  watchlistId: number;
  productId: number;
}

export interface PriceUpdatedPayload {
  productId: number;
  retailerId: number;
  oldPrice: number | null;
  newPrice: number;
  currency: string;
}

export interface PriceAlertTriggeredPayload {
  userId: number;
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  alertType: 'price_drop' | 'price_increase' | 'target_reached';
}

export interface AlertTriggeredPayload {
  alertId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface AlertResolvedPayload {
  alertId: string;
  ruleName: string;
  timestamp: string;
}

export interface MetricsUpdatedPayload {
  metrics: Record<string, unknown>;
  timestamp: string;
}

export interface ErrorOccurredPayload {
  level: 'error' | 'warn';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Event Payload Map - Maps event names to their payload types
 */
export interface EventPayloadMap {
  [AppEvents.NOTIFICATION_CREATED]: NotificationCreatedPayload;
  [AppEvents.NOTIFICATION_MARKED_READ]: NotificationMarkedReadPayload;
  [AppEvents.NOTIFICATION_MARKED_ALL_READ]: NotificationMarkedAllReadPayload;
  [AppEvents.WATCHLIST_UPDATED]: WatchlistUpdatedPayload;
  [AppEvents.WATCHLIST_PRODUCT_ADDED]: WatchlistProductAddedPayload;
  [AppEvents.WATCHLIST_PRODUCT_REMOVED]: WatchlistProductRemovedPayload;
  [AppEvents.PRICE_UPDATED]: PriceUpdatedPayload;
  [AppEvents.PRICE_ALERT_TRIGGERED]: PriceAlertTriggeredPayload;
  [AppEvents.ALERT_TRIGGERED]: AlertTriggeredPayload;
  [AppEvents.ALERT_RESOLVED]: AlertResolvedPayload;
  [AppEvents.METRICS_UPDATED]: MetricsUpdatedPayload;
  [AppEvents.ERROR_OCCURRED]: ErrorOccurredPayload;
}

/**
 * Type-safe Event Bus
 *
 * Provides a centralized event bus with typed events for decoupling
 * application components without creating circular dependencies.
 */
class TypedEventBus {
  private emitter: EventEmitter;
  private listenerCounts: Map<string, number> = new Map();

  constructor() {
    this.emitter = new EventEmitter();
    // Increase max listeners to accommodate multiple subscribers
    this.emitter.setMaxListeners(50);
  }

  /**
   * Emit a typed event
   */
  emit<K extends keyof EventPayloadMap>(event: K, payload: EventPayloadMap[K]): boolean {
    logger.debug('Event bus: emitting event', {
      event,
      hasListeners: this.emitter.listenerCount(event) > 0,
    });
    return this.emitter.emit(event, payload);
  }

  /**
   * Subscribe to a typed event
   */
  on<K extends keyof EventPayloadMap>(
    event: K,
    listener: (payload: EventPayloadMap[K]) => void
  ): this {
    this.emitter.on(event, listener);
    const count = (this.listenerCounts.get(event) || 0) + 1;
    this.listenerCounts.set(event, count);
    logger.debug('Event bus: listener added', { event, totalListeners: count });
    return this;
  }

  /**
   * Subscribe to a typed event (one-time)
   */
  once<K extends keyof EventPayloadMap>(
    event: K,
    listener: (payload: EventPayloadMap[K]) => void
  ): this {
    this.emitter.once(event, listener);
    return this;
  }

  /**
   * Unsubscribe from a typed event
   */
  off<K extends keyof EventPayloadMap>(
    event: K,
    listener: (payload: EventPayloadMap[K]) => void
  ): this {
    this.emitter.off(event, listener);
    const count = Math.max(0, (this.listenerCounts.get(event) || 0) - 1);
    this.listenerCounts.set(event, count);
    logger.debug('Event bus: listener removed', { event, remainingListeners: count });
    return this;
  }

  /**
   * Remove all listeners for an event (or all events if no event specified)
   */
  removeAllListeners<K extends keyof EventPayloadMap>(event?: K): this {
    if (event) {
      this.emitter.removeAllListeners(event);
      this.listenerCounts.set(event, 0);
    } else {
      this.emitter.removeAllListeners();
      this.listenerCounts.clear();
    }
    return this;
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof EventPayloadMap>(event: K): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Get all registered event names
   */
  eventNames(): (keyof EventPayloadMap)[] {
    return this.emitter.eventNames() as (keyof EventPayloadMap)[];
  }
}

/**
 * Singleton event bus instance
 *
 * Use this across the application to emit and subscribe to events
 */
export const eventBus = new TypedEventBus();
