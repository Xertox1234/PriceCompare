import { Request, Response } from "express";
import type { AuthenticatedRequest } from "@shared/types";
import { sendError, sendErrorFromException } from "../utils/api-response";

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
      sendError(res, 'Authentication required', 401);
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
      sendError(res, 'Authentication required', 401);
      return;
    }
    if (req.user.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }
    // req is now typed as AuthenticatedRequest with admin role
    await handler(req, res);
  };
}

/**
 * @deprecated Use sendErrorFromException() from '../utils/api-response' instead
 *
 * Legacy error response handler - maintained for backwards compatibility
 * New code should use: sendErrorFromException(res, error, operationName)
 */
export function handleRouteError(
  res: Response,
  error: unknown,
  operationName: string
): void {
  sendErrorFromException(res, error, operationName);
}

/**
 * @deprecated Use sendError(res, `${resource} not found`, 404) instead
 *
 * Legacy 404 response helper - maintained for backwards compatibility
 * New code should use: sendError(res, 'Resource not found', 404)
 */
export function notFound(res: Response, resource: string): void {
  sendError(res, `${resource} not found`, 404);
}
