import { Response } from 'express';
import { createLogger } from './logger';

const log = createLogger('ErrorHandler');

/**
 * Secure Error Handler
 * Prevents information disclosure by sanitizing error messages sent to clients
 */

export interface ErrorResponse {
  error: string;
  code?: string;
  timestamp?: string;
  requestId?: string;
}

/**
 * Sanitize error messages to prevent information disclosure
 * Logs full error details server-side but sends generic messages to client
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // In development, return the full error message
    if (process.env.NODE_ENV === 'development') {
      return error.message;
    }

    // In production, check if error message contains sensitive patterns
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /database/i,
      /connection/i,
      /file not found/i,
      /ENOENT/i,
      /ECONNREFUSED/i,
      /path/i,
      /directory/i,
      /permission denied/i,
      /access denied/i,
      /unauthorized/i,
      /sql/i,
      /query/i,
      /stack/i,
      /at\s+\w+\s+\(/i, // Stack trace pattern
    ];

    // Check if error message contains sensitive information
    const hasSensitiveInfo = sensitivePatterns.some(pattern =>
      pattern.test(error.message)
    );

    // Return generic error in production if sensitive info detected
    if (hasSensitiveInfo) {
      return 'An internal error occurred. Please try again later.';
    }

    // Return error message if it seems safe
    return error.message;
  }

  return 'An unknown error occurred';
}

/**
 * Send a sanitized error response to the client
 * Logs full error details server-side for debugging
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  error: unknown,
  context?: string
): void {
  // Log full error details server-side
  if (error instanceof Error) {
    log.error(`[${context || 'Error'}]:`, {
      error,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : '[redacted]',
      timestamp: new Date().toISOString()
    });
  } else {
    log.error(`[${context || 'Error'}]:`, { error });
  }

  // Send sanitized error to client
  const errorResponse: ErrorResponse = {
    error: sanitizeError(error),
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Standard error messages for common scenarios
 */
export const ErrorMessages = {
  // Generic errors
  INTERNAL_ERROR: 'An internal server error occurred',
  BAD_REQUEST: 'Invalid request parameters',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource already exists',
  TOO_MANY_REQUESTS: 'Too many requests',

  // Authentication errors
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account temporarily locked',
  SESSION_EXPIRED: 'Session has expired',

  // Validation errors
  VALIDATION_FAILED: 'Validation failed',
  MISSING_REQUIRED_FIELD: 'Missing required field',
  INVALID_FORMAT: 'Invalid format',

  // Database errors
  DATABASE_ERROR: 'Database operation failed',
  QUERY_FAILED: 'Query execution failed',

  // API errors
  API_ERROR: 'External API request failed',
  TIMEOUT: 'Request timeout',
  NETWORK_ERROR: 'Network error occurred',
} as const;

/**
 * Create a standardized error object
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Pre-defined application errors
 */
export class BadRequestError extends AppError {
  constructor(message: string = ErrorMessages.BAD_REQUEST) {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = ErrorMessages.UNAUTHORIZED) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = ErrorMessages.FORBIDDEN) {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ErrorMessages.NOT_FOUND) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = ErrorMessages.CONFLICT) {
    super(message, 409, 'CONFLICT');
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = ErrorMessages.INTERNAL_ERROR) {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

import { Request, NextFunction } from 'express';

/**
 * Global error handler middleware
 */
export function errorHandlerMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof AppError) {
    // Handle known application errors
    const errorResponse: ErrorResponse = {
      error: sanitizeError(error),
      code: error.code,
      timestamp: new Date().toISOString()
    };

    // Log error server-side
    log.error(`[AppError ${error.code}]:`, {
      error,
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle unknown errors
  log.error('[UnhandledError]:', {
    error,
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Send generic error to client
  const errorResponse: ErrorResponse = {
    error: ErrorMessages.INTERNAL_ERROR,
    timestamp: new Date().toISOString()
  };

  res.status(500).json(errorResponse);
}
