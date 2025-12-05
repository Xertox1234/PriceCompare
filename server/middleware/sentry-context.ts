/**
 * Sentry Context Middleware
 *
 * Automatically enriches Sentry error reports with user and request context.
 * This middleware should be placed after authentication middleware in the pipeline.
 *
 * Context added:
 * - User information (id, email, username) for authenticated requests
 * - Request metadata (IP address, path, method, user agent)
 * - Custom tags (environment, session status)
 *
 * Performance: Zero overhead - only sets context in Sentry scope (no I/O)
 */

import { Request, Response, NextFunction } from 'express';
import { Sentry } from '../config/sentry';

/**
 * User type from authenticated requests
 */
interface AuthenticatedUser {
  id: number;
  email: string;
  username?: string;
  role?: string;
}

/**
 * Type guard to check if req.user exists and has required fields with correct types
 */
function isAuthenticatedRequest(req: Request): req is Request & { user: AuthenticatedUser } {
  const user = req.user as unknown;
  return (
    typeof user === 'object' &&
    user !== null &&
    'id' in user &&
    typeof (user as Record<string, unknown>).id === 'number' &&
    'email' in user &&
    typeof (user as Record<string, unknown>).email === 'string'
  );
}

/**
 * Middleware to set Sentry context for error tracking
 *
 * Usage:
 *   app.use(sentryContextMiddleware);
 *
 * Place after:
 *   - passport.initialize()
 *   - passport.session()
 *
 * Place before:
 *   - Application routes
 */
export function sentryContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Set user context if authenticated
  if (isAuthenticatedRequest(req)) {
    Sentry.setUser({
      id: req.user.id.toString(),
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
    });
  }

  // Set request context (always set, even for unauthenticated requests)
  Sentry.setContext('request', {
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    path: req.path,
    method: req.method,
    userAgent: req.headers['user-agent'] || 'unknown',
  });

  // Set custom tags for filtering in Sentry
  Sentry.setTag('environment', process.env.NODE_ENV || 'development');
  Sentry.setTag('has_session', req.session ? 'true' : 'false');

  next();
}
