/**
 * Standardized Error Codes Registry
 *
 * Provides a single source of truth for all error codes used in API responses.
 * Error codes enable programmatic client handling and consistent error categorization.
 *
 * Usage:
 *   import { ErrorCodes } from './utils/error-codes';
 *   sendError(res, 'Account locked', 429, { code: ErrorCodes.ACCOUNT_LOCKED });
 *
 * Naming Convention:
 *   - UPPERCASE_WITH_UNDERSCORES (e.g., RATE_LIMIT_EXCEEDED)
 *   - Descriptive and specific (e.g., ACCOUNT_LOCKED, not just LOCKED)
 *   - Action-oriented for errors (e.g., TOKEN_INVALID, not INVALID_TOKEN)
 */

export const ErrorCodes = {
  // ============================================================================
  // Authentication & Authorization Errors
  // ============================================================================

  /**
   * User is not authenticated (401)
   * Client should redirect to login or prompt for credentials
   */
  UNAUTHORIZED: 'UNAUTHORIZED',

  /**
   * User is authenticated but lacks required permissions (403)
   * Client should show "access denied" message
   */
  FORBIDDEN: 'FORBIDDEN',

  /**
   * Account temporarily locked due to too many failed login attempts (429)
   * Response includes remainingTime field for retry logic
   */
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  /**
   * Invalid login credentials provided (401)
   * Generic error to prevent user enumeration
   */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  /**
   * Session expired or invalid (401)
   * Client should clear local session and redirect to login
   */
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // ============================================================================
  // Rate Limiting & Abuse Prevention
  // ============================================================================

  /**
   * Rate limit exceeded for client IP or user (429)
   * Response includes retryAfter field in seconds
   */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  /**
   * Request payload exceeds size limit (413)
   * Response includes maxSize and receivedSize fields
   */
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',

  /**
   * Too many requests from this client within time window (429)
   * Broader than RATE_LIMIT_EXCEEDED, may apply to specific endpoints
   */
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // ============================================================================
  // CSRF & Security
  // ============================================================================

  /**
   * CSRF token is invalid or doesn't match session (403)
   * Client should refresh page to get new token
   */
  CSRF_INVALID: 'CSRF_INVALID',

  /**
   * CSRF token is missing from request (403)
   * Client should include X-CSRF-Token header
   */
  CSRF_MISSING: 'CSRF_MISSING',

  /**
   * Origin not allowed by CORS policy (403)
   * Client origin is not whitelisted
   */
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',

  // ============================================================================
  // Validation & Input Errors
  // ============================================================================

  /**
   * Request validation failed (400)
   * Response includes details field with specific validation errors
   */
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  /**
   * Required field is missing from request (400)
   * Response includes details field with missing field name
   */
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  /**
   * Field value is invalid or out of range (400)
   * Response includes details field with field name and constraints
   */
  INVALID_FIELD_VALUE: 'INVALID_FIELD_VALUE',

  // ============================================================================
  // Resource Errors
  // ============================================================================

  /**
   * Requested resource was not found (404)
   * Response may include details about what was being searched
   */
  NOT_FOUND: 'NOT_FOUND',

  /**
   * Resource already exists (409)
   * Response includes details about conflicting resource
   */
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',

  /**
   * Resource conflict (409)
   * Generic conflict error for business logic violations
   */
  CONFLICT: 'CONFLICT',

  // ============================================================================
  // Database Errors
  // ============================================================================

  /**
   * Database operation failed (500)
   * Generic database error, details sanitized in production
   */
  DATABASE_ERROR: 'DATABASE_ERROR',

  /**
   * Database constraint violation (409)
   * Unique constraint, foreign key, or check constraint failed
   */
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',

  // ============================================================================
  // Server Errors
  // ============================================================================

  /**
   * Internal server error (500)
   * Generic server error, details sanitized in production
   */
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',

  /**
   * Service temporarily unavailable (503)
   * Server is overloaded or in maintenance mode
   */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  /**
   * External service error (502)
   * Upstream service (payment gateway, email service, etc.) failed
   */
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // ============================================================================
  // Business Logic Errors
  // ============================================================================

  /**
   * Insufficient permissions for operation (403)
   * More specific than FORBIDDEN, indicates role/permission check failed
   */
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  /**
   * Operation not allowed in current state (409)
   * Business rule violation (e.g., can't delete published post)
   */
  INVALID_STATE: 'INVALID_STATE',

  /**
   * Operation would exceed quota or limit (429)
   * User has reached maximum allowed resources (posts, uploads, etc.)
   */
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
} as const;

/**
 * Type representing all valid error codes
 * Use this for type-safe error code parameters
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Get error code by HTTP status code (best guess)
 * Useful for generic error handling where specific code is unknown
 *
 * @param statusCode - HTTP status code
 * @returns Appropriate error code for status
 */
export function getErrorCodeByStatus(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return ErrorCodes.VALIDATION_FAILED;
    case 401:
      return ErrorCodes.UNAUTHORIZED;
    case 403:
      return ErrorCodes.FORBIDDEN;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 413:
      return ErrorCodes.PAYLOAD_TOO_LARGE;
    case 429:
      return ErrorCodes.RATE_LIMIT_EXCEEDED;
    case 500:
      return ErrorCodes.INTERNAL_SERVER_ERROR;
    case 502:
      return ErrorCodes.EXTERNAL_SERVICE_ERROR;
    case 503:
      return ErrorCodes.SERVICE_UNAVAILABLE;
    default:
      return ErrorCodes.INTERNAL_SERVER_ERROR;
  }
}

/**
 * Check if a string is a valid error code
 *
 * @param code - String to check
 * @returns True if code is in ErrorCodes registry
 */
export function isValidErrorCode(code: string): code is ErrorCode {
  return Object.values(ErrorCodes).includes(code as ErrorCode);
}
