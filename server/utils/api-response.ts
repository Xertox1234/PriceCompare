import { Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';
import { captureException } from '../config/sentry';
import { isOperationalError, getErrorMessage, getErrorStatus } from './errors';

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

export interface ApiResponseMeta {
  timestamp: string;
  version: string;
  requestId?: string;
}

/**
 * Success response helper
 * Sends standardized success response with data
 *
 * @param res - Express response object
 * @param data - Response data (any type)
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Optional additional metadata
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Partial<ApiResponseMeta>
): void {
  const response: {
    success: true;
    data: T;
    meta?: ApiResponseMeta;
  } = {
    success: true,
    data,
  };

  // Add metadata if provided or include basic metadata
  if (meta || res.locals.requestId) {
    response.meta = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      requestId: res.locals.requestId as string | undefined,
      ...meta,
    };
  }

  res.status(statusCode).json(response);
}

/**
 * Error response helper
 * Sends standardized error response
 *
 * ARCHITECTURAL NOTE:
 * Error handler middleware (server/middleware/error-handler.ts) uses manual res.status().json()
 * calls and does NOT use this helper. This is intentional - see ADR_ERROR_HANDLER_EXEMPTION.md.
 * Format must remain consistent between this helper and error-handler middleware.
 *
 * @param res - Express response object
 * @param error - Error message string
 * @param statusCode - HTTP status code (default: 500)
 * @param details - Optional error details (development only) OR additional response fields
 */
export function sendError(
  res: Response,
  error: string,
  statusCode = 500,
  details?: string | Record<string, unknown>
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response: {
    success: false;
    error: string;
    details?: string;
    [key: string]: unknown;
  } = {
    success: false,
    error,
  };

  // Handle details parameter
  if (details) {
    if (typeof details === 'string') {
      // String details only in development
      if (isDevelopment) {
        response.details = details;
      }
    } else {
      // Object details - merge additional fields into response
      Object.assign(response, details);
    }
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
  statusCode = 200
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
  if (typeof legacyData === 'object' && legacyData !== null && 'success' in legacyData) {
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
 * Uses consolidated error utilities from errors.ts and integrates with Sentry
 *
 * @param res - Express response object
 * @param error - Caught error (unknown type)
 * @param context - Operation context for logging and Sentry tagging
 */
export function sendErrorFromException(res: Response, error: unknown, context = 'Operation'): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  let message = `${context} failed`;
  let status = 500;
  let details: string | undefined;
  let isOperational = false;

  // Handle Zod validation errors explicitly
  if (error instanceof ZodError) {
    message = error.issues[0]?.message || 'Validation failed';
    status = 400;
    isOperational = true; // Validation errors are operational (expected)
    if (isDevelopment) {
      details = JSON.stringify(error.issues, null, 2);
    }
  } else if (error instanceof Error) {
    // Use consolidated error utilities
    message = getErrorMessage(error);
    status = getErrorStatus(error);

    // Determine if error is operational (expected) based on status code
    // 4xx errors are generally operational (client errors, expected conditions)
    isOperational = status >= 400 && status < 500;

    // Check if error has explicit operational flag
    if (!isOperational && typeof error === 'object' && 'isOperational' in error) {
      isOperational = isOperationalError(error);
    }

    // lgtm[js/stack-trace-exposure] - Stack trace is only included when isDevelopment is true,
    // and sendError() also checks isDevelopment before including details in response.
    // This is a coordinated double-check that CodeQL cannot trace across function boundaries.
    if (isDevelopment && error.stack) {
      details = error.stack;
    }
  } else {
    // Non-Error types (strings, objects, etc.)
    message = getErrorMessage(error);
  }

  // Log error
  logger.error(`${context} error:`, {
    error: getErrorMessage(error),
    status,
  });

  // Capture non-operational errors in Sentry
  // Operational errors (404, validation, etc.) are expected and shouldn't alert
  if (!isOperational && error instanceof Error) {
    captureException(error, {
      tags: {
        context,
        statusCode: status.toString(),
      },
      level: status >= 500 ? 'error' : 'warning',
    });
  }

  sendError(res, message, status, details);
}
