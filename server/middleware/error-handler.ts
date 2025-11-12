import type { Request, Response, NextFunction } from 'express';
import { AppError, isOperationalError } from '../utils/errors';
import { logger } from '../utils/logger';

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
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log the error
  logError(err, req);

  // Handle known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle validation errors from Zod or other validation libraries
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: (err as any).errors,
    });
  }

  // Handle database errors
  if (isDatabaseError(err)) {
    return res.status(500).json({
      error: 'Database error occurred',
      code: 'DATABASE_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        details: err.message,
      }),
    });
  }

  // Handle unknown errors
  const statusCode = (err as any).statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
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
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Should be placed before error handler middleware
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
}

/**
 * Log error details
 */
function logError(err: Error, req: Request) {
  const isOperational = isOperationalError(err);

  // In production, use proper logging service (e.g., Winston, Pino)
  // For now, using console with structured format
  const errorLog = {
    timestamp: new Date().toISOString(),
    type: isOperational ? 'OPERATIONAL' : 'PROGRAMMING',
    name: err.name,
    message: err.message,
    statusCode: (err as any).statusCode || 500,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  };

  if (isOperational) {
    logger.warn('Operational Error', errorLog);
  } else {
    logger.error('Programming Error', errorLog);
  }

  // TODO: Send to external error tracking service (e.g., Sentry)
  // if (!isOperational) {
  //   sentryClient.captureException(err, { extra: errorLog });
  // }
}

/**
 * Check if error is a database error
 */
function isDatabaseError(err: Error): boolean {
  // PostgreSQL error codes
  const pgErrorCodes = ['ECONNREFUSED', '23505', '23503', '23502'];
  const errorCode = (err as any).code;

  return (
    err.name === 'DatabaseError' ||
    err.name === 'PostgresError' ||
    (errorCode && pgErrorCodes.includes(errorCode))
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
  process.on('unhandledRejection', (reason: any) => {
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
