/**
 * Error message sanitization for production
 * SECURITY: Prevents information disclosure through error messages
 */

/**
 * Sanitize error messages based on environment
 * In production, generic messages are returned to prevent information disclosure
 * In development, full error details are provided for debugging
 */
export function sanitizeErrorMessage(error: unknown, genericMessage = 'An error occurred'): string {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // In development, return full error details for debugging
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // In production, return generic message unless it's a known safe error
  if (error instanceof Error) {
    // Allow specific error types that are safe to expose
    const safeErrorPatterns = [
      /must be/i,           // Validation errors
      /is required/i,       // Required field errors
      /invalid/i,          // Basic validation errors
      /not found/i,        // Not found errors
      /already exists/i,   // Conflict errors
      /unauthorized/i,     // Auth errors
      /forbidden/i,        // Permission errors
    ];

    const isSafeError = safeErrorPatterns.some(pattern => pattern.test(error.message));
    if (isSafeError) {
      return error.message;
    }
  }

  // Return generic message for everything else in production
  return genericMessage;
}

/**
 * Get appropriate HTTP status code from error
 */
export function getErrorStatus(error: unknown): number {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('not found')) return 404;
    if (message.includes('unauthorized') || message.includes('authentication required')) return 401;
    if (message.includes('forbidden') || message.includes('admin access required')) return 403;
    if (message.includes('already exists') || message.includes('conflict')) return 409;
    if (message.includes('invalid') || message.includes('must be') || message.includes('is required')) return 400;
  }
  
  return 500;
}

/**
 * Create a sanitized error response
 */
export interface ErrorResponse {
  error: string;
  status: number;
  details?: string;
}

export function createErrorResponse(error: unknown, context = 'Operation'): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const status = getErrorStatus(error);
  const message = sanitizeErrorMessage(error, `${context} failed`);

  const response: ErrorResponse = {
    error: message,
    status,
  };

  // Add stack trace in development only
  if (isDevelopment && error instanceof Error && error.stack) {
    response.details = error.stack;
  }

  return response;
}
