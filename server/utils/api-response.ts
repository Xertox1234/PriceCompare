import { Response } from "express";
import { logger } from "./logger";

/**
 * API Response Helpers
 *
 * Standardized response format across all API endpoints.
 * All responses follow the discriminated union pattern for type safety.
 *
 * Response format:
 * - success: boolean (discriminator)
 * - data?: T (present when success = true)
 * - error?: string (present when success = false)
 * - meta?: PaginationMeta (for paginated responses)
 * - details?: string (development-only error details)
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore?: boolean;
  nextPage?: number | null;
  prevPage?: number | null;
}

/**
 * Success response helper
 * Sends standardized success response with data
 *
 * @param res - Express response object
 * @param data - Response data (any type)
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Error response helper
 * Sends standardized error response
 *
 * @param res - Express response object
 * @param error - Error message string
 * @param statusCode - HTTP status code (default: 500)
 * @param details - Optional error details (development only)
 */
export function sendError(
  res: Response,
  error: string,
  statusCode: number = 500,
  details?: string
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response: {
    success: false;
    error: string;
    details?: string;
  } = {
    success: false,
    error,
  };

  // Add details only in development
  if (isDevelopment && details) {
    response.details = details;
  }

  res.status(statusCode).json(response);
}

/**
 * Paginated response helper
 * Sends standardized paginated response with metadata
 *
 * @param res - Express response object
 * @param data - Array of items for current page
 * @param meta - Pagination metadata
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}

/**
 * Created response helper
 * Sends standardized 201 Created response
 *
 * @param res - Express response object
 * @param data - Created resource data
 */
export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

/**
 * No content response helper
 * Sends standardized 204 No Content response
 *
 * @param res - Express response object
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}

/**
 * Helper to convert legacy response to standardized format
 * Used during migration phase to maintain backward compatibility
 *
 * @param legacyData - Legacy response data in various formats
 * @returns Standardized response data
 */
export function normalizeResponse<T>(legacyData: unknown): T {
  // If already in standardized format, return as-is
  if (
    typeof legacyData === 'object' &&
    legacyData !== null &&
    'success' in legacyData
  ) {
    return legacyData as T;
  }

  // Wrap legacy data in standardized format
  return {
    success: true,
    data: legacyData,
  } as T;
}

/**
 * Convenience function to send error from caught exception
 * Integrates with existing error-sanitizer.ts
 *
 * @param res - Express response object
 * @param error - Caught error (unknown type)
 * @param context - Operation context for logging
 */
export function sendErrorFromException(
  res: Response,
  error: unknown,
  context: string = 'Operation'
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Import createErrorResponse dynamically to avoid circular deps
  // This will be refactored to use error-sanitizer directly
  let message = `${context} failed`;
  let status = 500;
  let details: string | undefined;

  if (error instanceof Error) {
    message = error.message;

    // Determine status code from error message
    const errorMsg = error.message.toLowerCase();
    if (errorMsg.includes('not found')) status = 404;
    else if (errorMsg.includes('unauthorized')) status = 401;
    else if (errorMsg.includes('forbidden')) status = 403;
    else if (errorMsg.includes('already exists')) status = 409;
    else if (errorMsg.includes('invalid') || errorMsg.includes('must be')) status = 400;

    if (isDevelopment && error.stack) {
      details = error.stack;
    }
  }

  // Log error
  logger.error(`${context} error:`, {
    error: error instanceof Error ? error.message : String(error),
    status,
  });

  sendError(res, message, status, details);
}
