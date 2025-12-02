/**
 * Event Subscriptions
 *
 * This module sets up event bus subscriptions for services that need to react
 * to events from other services. This pattern breaks circular dependencies
 * by using the event bus as an intermediary.
 *
 * Initialize this module after all services are loaded but before the server starts.
 *
 * @see server/utils/event-bus.ts for event definitions
 */

import { eventBus, AppEvents } from '../utils/event-bus';
import { alertService } from './alert-service';
import { logger } from '../utils/logger';
import type { DashboardMetrics } from './monitoring-service';

let isInitialized = false;

/**
 * Initialize all event subscriptions
 *
 * Call this once during server startup after all services are imported.
 */
export function initializeEventSubscriptions(): void {
  if (isInitialized) {
    logger.warn('Event subscriptions already initialized');
    return;
  }

  // Alert service subscribes to metrics updates to check alert rules
  eventBus.on(AppEvents.METRICS_UPDATED, (payload) => {
    // Type assertion is safe here because we control both sides
    const metrics = payload.metrics as unknown as DashboardMetrics;
    void alertService.checkAlerts(metrics);
  });

  isInitialized = true;
  logger.info('Event subscriptions initialized');
}

/**
 * Cleanup event subscriptions
 *
 * Call this during server shutdown.
 */
export function cleanupEventSubscriptions(): void {
  eventBus.removeAllListeners();
  isInitialized = false;
  logger.info('Event subscriptions cleaned up');
}
