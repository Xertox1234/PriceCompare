/**
 * Custom Error Classes
 *
 * Provides standardized error types for better error handling across the application.
 */

/**
 * Base application error class
 * All custom errors should extend this class
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
      success: false,  // CRITICAL: Must include success discriminator for API contract
      error: this.message,
      code: this.code,
      ...(process.env.NODE_ENV === 'development' && {
        stack: this.stack,
        metadata: this.metadata,
      }),
    };
  }
}

/**
 * Validation Error (400 Bad Request)
 * Used when user input doesn't meet requirements
 */
export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', metadata);
  }
}

/**
 * Authentication Error (401 Unauthorized)
 * Used when user is not authenticated
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', metadata?: Record<string, unknown>) {
    super(message, 401, 'AUTHENTICATION_ERROR', metadata);
  }
}

/**
 * Authorization Error (403 Forbidden)
 * Used when user doesn't have permission
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Access denied', metadata?: Record<string, unknown>) {
    super(message, 403, 'AUTHORIZATION_ERROR', metadata);
  }
}

/**
 * Not Found Error (404)
 * Used when a resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, metadata?: Record<string, unknown>) {
    super(`${resource} not found`, 404, 'NOT_FOUND', metadata);
  }
}

/**
 * Conflict Error (409)
 * Used when there's a conflict (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT_ERROR', metadata);
  }
}

/**
 * Rate Limit Error (429)
 * Used when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', metadata?: Record<string, unknown>) {
    super(message, 429, 'RATE_LIMIT_ERROR', metadata);
  }
}

/**
 * Database Error (500)
 * Used for database-related errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 500, 'DATABASE_ERROR', metadata, false);
  }
}

/**
 * External Service Error (502)
 * Used when external services fail
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, metadata?: Record<string, unknown>) {
    super(`External service '${service}' failed`, 502, 'EXTERNAL_SERVICE_ERROR', metadata, false);
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
