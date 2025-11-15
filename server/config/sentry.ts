/**
 * Sentry Error Monitoring Configuration
 *
 * Provides real-time error tracking, performance monitoring, and alerting.
 * Integrates with Sentry.io for comprehensive application monitoring.
 */

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import type { Request } from "express";
import { isOperationalError } from "../utils/errors";

/**
 * Initialize Sentry error monitoring
 * Call this FIRST before any other imports in server/index.ts
 */
export function initializeSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';

  if (!dsn) {
    if (isProduction) {
      console.error('⚠️  WARNING: SENTRY_DSN not configured in production!');
      console.error('   Error tracking is disabled. Set SENTRY_DSN to enable monitoring.');
    } else {
      console.log('ℹ️  Sentry not configured (SENTRY_DSN missing) - error tracking disabled');
    }
    return;
  }

  console.log(`🔍 Initializing Sentry error monitoring (${environment})...`);

  Sentry.init({
    dsn,
    environment,

    // Tracing - adjust sample rate based on environment
    // Production: 10% of transactions (cost optimization)
    // Development: 100% for debugging
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Profiling - 10% sample rate
    profilesSampleRate: 0.1,

    // Integrations
    integrations: [
      // Node.js profiling for performance analysis
      nodeProfilingIntegration(),
    ],

    // Filter out operational errors (expected errors like 404, validation failures)
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Don't send operational errors to Sentry (they're expected)
      if (error && typeof error === 'object' && 'name' in error) {
        if (isOperationalError(error as Error)) {
          // Log operational errors locally but don't send to Sentry
          if (isDevelopment) {
            console.log('Sentry: Skipping operational error:', error);
          }
          return null;
        }
      }

      // Filter out specific error types
      if (event.exception?.values) {
        for (const exception of event.exception.values) {
          // Don't report CSRF token mismatches (these are expected attacks)
          if (exception.value?.includes('CSRF token')) {
            return null;
          }

          // Don't report rate limit errors
          if (exception.value?.includes('Too many requests')) {
            return null;
          }

          // Don't report validation errors
          if (exception.type === 'ValidationError' || exception.type === 'ZodError') {
            return null;
          }
        }
      }

      return event;
    },

    // Set release version from package.json or git
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version,

    // Server name for identification
    serverName: process.env.HOSTNAME || 'pricecompare-server',

    // Maximum breadcrumbs to capture
    maxBreadcrumbs: 50,

    // Attach stack traces to messages
    attachStacktrace: true,

    // Enable debug mode in development
    debug: isDevelopment,
  });

  console.log('✅ Sentry initialized successfully');
}

/**
 * Get Sentry instance
 */
export { Sentry };

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error,
  context?: {
    user?: { id: number; email: string };
    extra?: Record<string, unknown>;
    tags?: Record<string, string>;
    level?: Sentry.SeverityLevel;
  }
): string {
  return Sentry.captureException(error, {
    user: context?.user,
    extra: context?.extra,
    tags: context?.tags,
    level: context?.level || 'error',
  });
}

/**
 * Capture message with context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: number; email: string; username?: string } | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id.toString(),
      email: user.email,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add tags to current scope
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

/**
 * Add extra context data
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, context);
}

/**
 * Start a new transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, unknown>
): Sentry.Transaction {
  return Sentry.startTransaction({
    name,
    op,
    data,
  });
}

/**
 * Express error handler middleware
 * Place this BEFORE your custom error handler
 */
export const sentryErrorHandler = Sentry.Handlers.errorHandler();

/**
 * Express request handler middleware
 * Place this at the beginning of your middleware chain
 */
export const sentryRequestHandler = Sentry.Handlers.requestHandler();

/**
 * Express tracing handler for performance monitoring
 * Place this after the request handler
 */
export const sentryTracingHandler = Sentry.Handlers.tracingHandler();

/**
 * Close Sentry and flush pending events
 * Call this on graceful shutdown
 */
export async function closeSentry(timeout: number = 2000): Promise<void> {
  console.log('Closing Sentry connection...');
  await Sentry.close(timeout);
  console.log('Sentry connection closed');
}
