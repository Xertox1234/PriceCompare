/**
 * WebSocket Error Handler Middleware
 *
 * Centralized error handling for WebSocket events.
 * Logs errors with full context and emits user-friendly messages to clients.
 *
 * Usage:
 *   socket.on('some:event', async (data) => {
 *     try {
 *       // Event logic
 *     } catch (error) {
 *       handleSocketError(socket, error, { event: 'some:event', userId: socket.userId });
 *     }
 *   });
 */

import type { AuthenticatedSocket } from '../types';
import { createLogger } from '../../utils/logger';
import { monitoringService } from '../../services/monitoring-service';

const log = createLogger('WebSocket:ErrorHandler');

/**
 * Error context for tracking and debugging
 */
export interface SocketErrorContext {
  event: string;
  userId?: number;
  data?: unknown;
  // Note: Additional properties can be added dynamically in development mode
}

/**
 * User-friendly error messages mapped from internal errors
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  'Authentication required': 'Please sign in to continue',
  'Invalid session data': 'Your session has expired. Please sign in again',

  // Watch list errors
  'Watch list not found or unauthorized': 'Watch list not found',
  'Maximum watch list limit reached': 'You have reached the maximum number of watch lists (20)',
  'Watch list name is required': 'Watch list name is required',
  'Watch list name cannot be empty': 'Watch list name cannot be empty',
  'Watch list is full': 'This watch list is full (max 100 products)',

  // Product errors
  'Product not found': 'Product not found',
  'Product already in watch list': 'This product is already in your watch list',

  // Notification errors
  'Notification not found': 'Notification not found',
  'In-app notifications are disabled': 'You have disabled in-app notifications',
  'Daily notification limit reached': 'You have reached your daily notification limit',

  // Rate limiting errors
  'Rate limit exceeded': 'Too many requests. Please slow down and try again',

  // Subscription errors
  'Too many products subscribed': 'You have subscribed to too many products (max 100)',
};

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for known error messages
    const knownMessage = ERROR_MESSAGES[error.message];
    if (knownMessage) {
      return knownMessage;
    }

    // In production, return generic message for unknown errors
    if (process.env.NODE_ENV === 'production') {
      return 'An unexpected error occurred. Please try again';
    }

    // In development, return actual error message
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Get error code for tracking
 */
function getErrorCode(error: unknown): string | undefined {
  if (error instanceof Error) {
    // Check for common error patterns (generic before specific to allow fallthrough)
    if (error.message.includes('not found')) return 'NOT_FOUND';
    if (error.message.includes('unauthorized')) return 'UNAUTHORIZED';
    if (error.message.includes('limit')) return 'LIMIT_EXCEEDED'; // Generic pattern first
    if (error.message.includes('invalid')) return 'INVALID_INPUT';
  }

  return 'INTERNAL_ERROR';
}

/**
 * Handle WebSocket event errors
 *
 * Logs the error with full context and emits a user-friendly error message to the client.
 *
 * @param socket Authenticated socket connection
 * @param error Error object
 * @param context Error context for logging
 */
export function handleSocketError(
  socket: AuthenticatedSocket,
  error: unknown,
  context: SocketErrorContext
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = getErrorCode(error);
  const userFriendlyMessage = getUserFriendlyMessage(error);

  // Log error with full context
  log.error('WebSocket event error', {
    ...context,
    error: errorMessage,
    errorCode,
    socketId: socket.id,
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Emit user-friendly error to client
  socket.emit('error', {
    message: userFriendlyMessage,
    code: errorCode,
    // Include event context in development for debugging
    ...(process.env.NODE_ENV !== 'production' && {
      event: context.event,
      details: errorMessage,
    }),
  });

  // Track error metrics (if monitoring service is available)
  trackErrorMetric(errorCode, context.event);
}

/**
 * Wrap an async event handler with automatic error handling
 *
 * Usage:
 *   socket.on('some:event', withErrorHandling(socket, 'some:event', async (data) => {
 *     // Event logic
 *   }));
 */
export function withErrorHandling<T = unknown>(
  socket: AuthenticatedSocket,
  eventName: string,
  handler: (data: T) => Promise<void>
): (data: T) => Promise<void> {
  return async (data: T) => {
    try {
      await handler(data);
    } catch (error) {
      handleSocketError(socket, error, {
        event: eventName,
        userId: socket.userId,
        data: process.env.NODE_ENV !== 'production' ? data : undefined,
      });
    }
  };
}

/**
 * Track error metrics for monitoring
 *
 * Integrates with the monitoring service to log WebSocket errors for dashboard visibility.
 * Errors are tracked in the monitoring service's error log and can be viewed via the
 * monitoring dashboard API endpoints.
 */
function trackErrorMetric(errorCode: string | undefined, eventName: string | undefined): void {
  const code = errorCode || 'UNKNOWN_ERROR';
  const event = eventName || 'unknown';
  // Log to monitoring service for dashboard visibility
  monitoringService.logError('error', `WebSocket error: ${code} in ${event}`, {
    errorCode: code,
    eventName: event,
    source: 'websocket',
  });
  log.debug('Error metric tracked', { errorCode: code, eventName: event });
}

/**
 * Validate event data with Zod schema
 *
 * Returns validated data or throws validation error
 */
export function validateEventData<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown,
  eventName: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    // Convert Zod error to user-friendly message
    if (error && typeof error === 'object' && 'errors' in error) {
      const zodErrors = error.errors as Array<{ path: string[]; message: string }>;
      const firstError = zodErrors[0];
      throw new Error(
        `Invalid ${eventName} data: ${firstError.path.join('.')} ${firstError.message}`
      );
    }
    throw new Error(`Invalid ${eventName} data`);
  }
}
