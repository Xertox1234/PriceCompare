import { Request, Response, NextFunction } from 'express';
import express from 'express';
import { sendError } from '../utils/api-response';

/**
 * Request Size Limit Middleware
 * Implements per-endpoint request size limits to prevent abuse and DoS
 */

export interface RequestSizeLimits {
  // Default size for most endpoints
  default: string;
  // Authentication endpoints (should be small)
  auth: string;
  // File upload endpoints (can be larger)
  upload: string;
  // Admin endpoints (moderate size)
  admin: string;
  // Forum/content endpoints (moderate size for user content)
  content: string;
}

/**
 * Recommended size limits for different endpoint types
 */
export const DEFAULT_SIZE_LIMITS: RequestSizeLimits = {
  default: '100kb',    // Default for most API endpoints
  auth: '10kb',        // Small for login/register
  upload: '10mb',      // Larger for file uploads (images, etc.)
  admin: '1mb',        // Moderate for admin operations
  content: '500kb',    // For forum posts, comments, etc.
};

/**
 * Create a size-limited JSON parser middleware
 */
export function createSizeLimitedParser(limit: string) {
  return express.json({ limit });
}

/**
 * Create a size-limited URL-encoded parser middleware
 */
export function createSizeLimitedUrlEncodedParser(limit: string) {
  return express.urlencoded({ extended: false, limit });
}

/**
 * Apply different size limits based on the route path
 */
export function requestSizeLimiter(limits: RequestSizeLimits = DEFAULT_SIZE_LIMITS) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;

    // Determine the appropriate limit based on the path
    let limit = limits.default;

    if (path.startsWith('/api/auth')) {
      limit = limits.auth;
    } else if (path.includes('/upload') || path.includes('/image')) {
      limit = limits.upload;
    } else if (path.startsWith('/api/admin')) {
      limit = limits.admin;
    } else if (path.includes('/forum') || path.includes('/comment') || path.includes('/post')) {
      limit = limits.content;
    }

    // Check Content-Length header if present
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const limitInBytes = parseSizeString(limit);

      if (sizeInBytes > limitInBytes) {
        sendError(
          res,
          'Request payload too large',
          413,
          `Max size: ${limit}, Received: ${formatBytes(sizeInBytes)}`
        );
        return;
      }
    }

    return next();
  };
}

/**
 * Parse size string (e.g., "10mb", "500kb") to bytes
 */
function parseSizeString(sizeStr: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };

  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error(`Invalid size string: ${sizeStr}`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return Math.floor(value * (units[unit] || 1));
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Middleware to reject requests that are too large
 * This is an alternative to the size limiter that works on the raw request stream
 */
export function rejectOversizedRequests(maxSize: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    let receivedBytes = 0;

    req.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxSize) {
        req.pause();
        sendError(
          res,
          'Request entity too large',
          413,
          `Max size: ${formatBytes(maxSize)}`
        );
        req.destroy();
      }
    });

    next();
  };
}
