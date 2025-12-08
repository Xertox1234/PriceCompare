import type { Request, Response, NextFunction } from 'express';
import { AppError, isOperationalError } from '../utils/errors';
import { logger } from '../utils/logger';
import { captureException } from '../config/sentry';
import { sendError } from '../utils/api-response';

/**
 * ARCHITECTURAL NOTE - Error Handler Exemption
 *
 * This error handler uses manual res.status().json() calls instead of sendError() helpers.
 * This is INTENTIONAL and documented as an architectural exception.
 *
 * Rationale:
 * 1. Error handler IS the implementation layer for error responses (not a consumer)
 * 2. Last-resort safety net should not depend on higher-level abstractions
 * 3. Using sendError() here would be conceptually circular
 *
 * Format Requirement:
 * All error responses MUST match the standardized envelope format:
 * { success: false, error: string, code?: string, details?: unknown }
 *
 * This format matches server/utils/api-response.ts sendError() envelope.
 *
 * Exception: notFoundHandler() uses sendError() because it's route-like (specific 404 handler),
 * not a catch-all error handler.
 *
 * See docs/ADR_ERROR_HANDLER_EXEMPTION.md for complete architectural decision.
 */

// Type guard for Zod errors
interface ZodError extends Error {
  name: 'ZodError';
  errors: Array<{
    path: (string | number)[];
    message: string;
  }>;
}

// Type guard for database errors
interface DatabaseErrorLike extends Error {
  code?: string;
}

// Type for errors that may have a statusCode
interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

// Type for request with optional user (for type casting only)
type UserInfo = {
  id: number;
  email: string;
  role?: string;
};

/**
 * Centralized Error Handling Middleware
 *
 * Catches all errors thrown in the application and sends appropriate responses.
 * Logs errors and provides different responses for development vs production.
 */

/**
 * Express error handling middleware
 * Must be placed after all routes
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  // Log the error
  logError(err, req);

  // Handle known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle validation errors from Zod or other validation libraries
  if (err.name === 'ZodError') {
    const zodError = err as ZodError;
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: zodError.errors,
    });
  }

  // Handle database errors
  if (isDatabaseError(err)) {
    return res.status(500).json({
      success: false,
      error: 'Database error occurred',
      code: 'DATABASE_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        details: err.message,
      }),
    });
  }

  // Handle unknown errors
  const statusCode = (err as ErrorWithStatusCode).statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  return res.status(statusCode).json({
    success: false,
    error: isDev ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDev && {
      stack: err.stack,
      name: err.name,
    }),
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Should be placed before error handler middleware
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  sendError(
    res,
    'Route not found',
    404,
    JSON.stringify({
      code: 'NOT_FOUND',
      path: req.originalUrl,
      method: req.method,
    })
  );
}

/**
 * Log error details
 */
function logError(err: Error, req: Request) {
  const isOperational = isOperationalError(err);
  const reqWithUser = req as Request & { user?: UserInfo };
  const errorWithStatus = err as ErrorWithStatusCode;

  // In production, use proper logging service (e.g., Winston, Pino)
  // For now, using console with structured format
  const errorLog = {
    timestamp: new Date().toISOString(),
    type: isOperational ? 'OPERATIONAL' : 'PROGRAMMING',
    name: err.name,
    message: err.message,
    statusCode: errorWithStatus.statusCode || 500,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: reqWithUser.user?.id,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  };

  if (isOperational) {
    logger.warn('Operational Error', errorLog);
  } else {
    logger.error('Programming Error', errorLog);
  }

  // Send non-operational errors to Sentry for tracking
  if (!isOperational) {
    captureException(err, {
      user: reqWithUser.user
        ? {
            id: reqWithUser.user.id,
            email: reqWithUser.user.email,
          }
        : undefined,
      extra: errorLog,
      tags: {
        errorType: isOperational ? 'operational' : 'programming',
        path: req.originalUrl,
        method: req.method,
      },
      level: 'error',
    });
  }
}

/**
 * Check if error is a database error
 */
function isDatabaseError(err: Error): boolean {
  // PostgreSQL error codes
  const pgErrorCodes = ['ECONNREFUSED', '23505', '23503', '23502'];
  const dbError = err as DatabaseErrorLike;

  return (
    err.name === 'DatabaseError' ||
    err.name === 'PostgresError' ||
    (dbError.code !== undefined && pgErrorCodes.includes(dbError.code))
  );
}

/**
 * Process shutdown on uncaught errors
 */
export function setupGlobalErrorHandlers() {
  // Handle uncaught exceptions
  process.on('uncaughtException', (err: Error) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    // Give time for logging, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });

    // Give time for logging, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}
