import { Request, Response } from "express";
import type { AuthenticatedRequest } from "@shared/types";
import { createErrorResponse } from "../utils/error-sanitizer";

// SECURITY: Express.User type is properly defined in server/auth.ts as SafeUser
// This ensures passwordHash is never exposed in req.user throughout the application
// Do not redeclare Express.User here to avoid type conflicts

/**
 * Type predicate to check if request is authenticated
 */
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return !!req.user;
}

/**
 * Wrapper to enforce authentication with proper typing
 */
export function withAuth(handler: (req: AuthenticatedRequest, res: Response) => Promise<void> | void) {
  return async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    // req is now typed as AuthenticatedRequest
    await handler(req, res);
  };
}

/**
 * Wrapper to enforce admin role with proper typing
 */
export function withAdmin(handler: (req: AuthenticatedRequest, res: Response) => Promise<void> | void) {
  return async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    // req is now typed as AuthenticatedRequest with admin role
    await handler(req, res);
  };
}

/**
 * Standardized error response handler for routes
 * Uses createErrorResponse to sanitize errors and provide consistent format
 */
export function handleRouteError(
  res: Response,
  error: unknown,
  operationName: string,
  statusCode?: number
): void {
  const errorResponse = createErrorResponse(error, operationName);
  res.status(statusCode || errorResponse.status).json({
    error: errorResponse.error
  });
}

/**
 * Standardized 404 not found response
 */
export function notFound(res: Response, resource: string): void {
  res.status(404).json({ error: `${resource} not found` });
}
