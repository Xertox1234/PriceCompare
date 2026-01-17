/**
 * Sentry Error Monitoring Configuration
 *
 * Provides real-time error tracking, performance monitoring, and alerting.
 * Integrates with Sentry.io for comprehensive application monitoring.
 */

import * as Sentry from '@sentry/node';
// Profiling integration is optional - uncomment if @sentry/profiling-node is installed
// import { nodeProfilingIntegration } from "@sentry/profiling-node";
import type { Application, Request, Response, NextFunction } from 'express';
import { isOperationalError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const log = createLogger('Sentry');

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
      log.error('');
      log.error('============ CRITICAL WARNING ============');
      log.error('SENTRY_DSN not configured in production!');
      log.error('Error tracking is DISABLED.');
      log.error('Production issues may go undetected.');
      log.error('');
      log.error('To fix: Set SENTRY_DSN environment variable');
      log.error('Get DSN from: https://sentry.io/settings/projects/');
      log.error('==========================================');
      log.error('');
    } else {
      log.info('Sentry not configured (SENTRY_DSN missing) - error tracking disabled');
    }
    return;
  }

  log.info(`🔍 Initializing Sentry error monitoring (${environment})...`);

  Sentry.init({
    dsn,
    environment,

    // Tracing - adjust sample rate based on environment
    // Production: 10% of transactions (cost optimization)
    // Development: 100% for debugging
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Profiling - 10% sample rate
    profilesSampleRate: 0.1,

    // SECURITY: sendDefaultPii is intentionally NOT enabled to prevent exposure
    // of personally identifiable information (PII) in error reports. This includes
    // sensitive HTTP headers like Authorization, Cookie, and session tokens.
    //
    // Context: Sentry vulnerability GHSA-6465-jgvq-jhgp (fixed in 10.27.0+) leaked
    // sensitive headers when sendDefaultPii was true. Even though we're now on a
    // patched version, we maintain defense-in-depth by keeping this disabled.
    //
    // If PII collection becomes necessary for debugging:
    // 1. Ensure Sentry version >= 10.27.0 (current: 10.28.0+)
    // 2. Implement additional header filtering in beforeSend hook
    // 3. Document security review and approval
    // 4. Consider using Sentry's data scrubbing rules as additional layer
    //
    // sendDefaultPii: false, // (false by default, explicitly documented here)

    // Integrations
    integrations: [
      // Node.js profiling for performance analysis (optional)
      // Uncomment if @sentry/profiling-node is installed:
      // nodeProfilingIntegration(),
    ],

    // Filter out operational errors (expected errors like 404, validation failures)
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Don't send operational errors to Sentry (they're expected)
      if (error && typeof error === 'object' && 'name' in error) {
        if (isOperationalError(error as Error)) {
          // Log operational errors locally but don't send to Sentry
          if (isDevelopment) {
            log.debug('Skipping operational error', { error });
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

  log.info('✅ Sentry initialized successfully');
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
 * Start a new span for performance monitoring
 * Note: Sentry v10+ uses startSpan instead of startTransaction
 */
export function startTransaction(name: string, op: string, data?: Record<string, unknown>): void {
  // In Sentry v10+, use startSpan with callback
  // Cast data to compatible type since Sentry expects specific attribute types
  const attributes = data
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : undefined;
  Sentry.startSpan({ name, op, attributes }, () => {
    // Span is automatically finished when callback completes
  });
}

/**
 * Express error handler middleware (Sentry v10+)
 * Place this BEFORE your custom error handler
 * Note: Call this function and pass your app to set up error handling
 */
export function setupSentryErrorHandler(app: Application): void {
  Sentry.setupExpressErrorHandler(app);
}

/**
 * Express request handler middleware (Sentry v10+)
 * No-op in v10+ - request tracking is automatic
 */
export const sentryRequestHandler = (req: Request, res: Response, next: NextFunction) => next();

/**
 * Express tracing handler for performance monitoring
 * Note: In Sentry v10+, tracing is automatic
 */
export const sentryTracingHandler = (req: Request, res: Response, next: NextFunction) => next();

/**
 * Legacy compatibility: Export as errorHandler for backward compatibility
 */
export const sentryErrorHandler = (req: Request, res: Response, next: NextFunction) => next();

/**
 * Close Sentry and flush pending events
 * Call this on graceful shutdown
 */
export async function closeSentry(timeout = 2000): Promise<void> {
  log.info('Closing Sentry connection...');
  await Sentry.close(timeout);
  log.info('Sentry connection closed');
}
