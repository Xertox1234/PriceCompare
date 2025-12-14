/**
 * Error Handling Utilities
 *
 * Consolidated error handling with minimal complexity.
 * Provides essential error utilities and minimal custom error classes for actual use cases.
 */

/**
 * Extract error message from unknown error type
 *
 * Handles Error objects, strings, and other values safely.
 * Use in catch blocks to safely extract error messages for logging.
 *
 * @param error - Unknown error value from catch block
 * @returns String representation of the error
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logger.error('Operation failed:', { error: getErrorMessage(error) });
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

/**
 * Get appropriate HTTP status code from error
 *
 * Infers status codes from error messages using common patterns.
 *
 * @param error - Unknown error value
 * @returns HTTP status code (400, 401, 403, 404, 409, or 500)
 *
 * @example
 * ```typescript
 * const status = getErrorStatus(error);
 * res.status(status).json({ error: getErrorMessage(error) });
 * ```
 */
export function getErrorStatus(error: unknown): number {
  if (!(error instanceof Error)) return 500;

  const msg = error.message.toLowerCase();

  // Check for specific status codes based on message content
  if (msg.includes('not found')) return 404;
  if (msg.includes('unauthorized') || msg.includes('authentication required')) return 401;
  if (msg.includes('forbidden') || msg.includes('admin access required')) return 403;
  if (
    msg.includes('already exists') ||
    msg.includes('conflict') ||
    msg.includes('unique constraint')
  )
    return 409;
  if (msg.includes('invalid') || msg.includes('must be') || msg.includes('is required')) return 400;

  return 500;
}

/**
 * Base application error class
 *
 * Custom error with statusCode and metadata support.
 * Used sparingly for cases requiring structured error handling.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string,
    public metadata?: Record<string, unknown>,
    public isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(process.env.NODE_ENV === 'development' && {
        stack: this.stack,
        metadata: this.metadata,
      }),
    };
  }
}

/**
 * Validation Error (400 Bad Request)
 *
 * Used for input validation failures in aggregation services.
 * ONLY custom error class with actual usage (5 occurrences).
 */
export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', metadata);
  }
}

/**
 * Check if an error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
