import { Request, Response } from "express";
import type { AuthenticatedRequest } from "@shared/types";
import type { User as SchemaUser } from "@shared/schema";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface User extends SchemaUser {}
  }
}

/**
 * Type predicate to check if request is authenticated
 */
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return !!req.user;
}

/**
 * Wrapper to enforce authentication with proper typing
 */
export function withAuth(handler: (req: AuthenticatedRequest, res: Response) => Promise<any> | any) {
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
export function withAdmin(handler: (req: AuthenticatedRequest, res: Response) => Promise<any> | any) {
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
