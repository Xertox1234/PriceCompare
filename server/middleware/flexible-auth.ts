import { Request, Response, NextFunction } from 'express';
import { basicAuth } from './basic-auth';
import { sendError } from '../utils/api-response';
import { logger } from '../utils/logger';

/**
 * Flexible Authentication Middleware
 *
 * Unified authentication supporting both HTTP Basic Auth and session-based auth.
 * Automatically selects the appropriate authentication method based on the request.
 *
 * Authentication Priority:
 * 1. HTTP Basic Auth (if Authorization: Basic header present)
 * 2. Session auth (if Passport session exists)
 * 3. Reject with 401 (if no valid authentication)
 *
 * CSRF Protection Integration:
 * - Sets req.isBasicAuth flag for downstream middleware
 * - Basic Auth requests: req.isBasicAuth = true (CSRF exempt - stateless)
 * - Session requests: req.isBasicAuth = false (CSRF required - stateful)
 *
 * Security Benefits:
 * - Eliminates route duplication (/api/* vs /api/v1/*)
 * - Fixes CSRF bypass vulnerability in old basicAuth fallthrough
 * - Explicit auth method detection for informed CSRF decisions
 * - No "magical" path-based CSRF exemption rules
 *
 * Usage:
 *   app.post('/api/watchlists', flexibleAuth, csrfProtection, withAuth, handler);
 *
 * Example - Session Auth:
 *   POST /api/watchlists
 *   Cookie: connect.sid=abc123
 *   X-CSRF-Token: token123
 *   → Uses session auth, CSRF validated
 *
 * Example - Basic Auth:
 *   POST /api/watchlists
 *   Authorization: Basic base64(user:pass)
 *   → Uses Basic Auth, CSRF exempt
 *
 * @see server/middleware/basic-auth.ts - HTTP Basic Auth implementation
 * @see server/middleware/security.ts - CSRF protection that checks isBasicAuth flag
 * @see docs/UNIFIED_AUTH_DESIGN.md - Complete architecture documentation
 */
export async function flexibleAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Priority 1: Try HTTP Basic Auth (explicit Authorization header)
  // SECURITY: Basic Auth is stateless - no session cookies, no CSRF risk
  if (req.headers?.authorization?.startsWith('Basic ')) {
    logger.debug('flexibleAuth: Using Basic Auth', {
      path: req.path,
      method: req.method,
    });

    // Mark request as using Basic Auth for CSRF exemption
    req.isBasicAuth = true;

    // Delegate to basicAuth middleware for credential validation
    // If validation fails, basicAuth will send error and not call next()
    return basicAuth(req, res, next);
  }

  // Priority 2: Try session auth (Passport session via cookie)
  // SECURITY: Session is stateful - uses cookies, requires CSRF protection
  if (req.isAuthenticated()) {
    logger.debug('flexibleAuth: Using session auth', {
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });

    // Mark request as using session auth for CSRF enforcement
    req.isBasicAuth = false;

    return next();
  }

  // Priority 3: No valid authentication found
  logger.warn('flexibleAuth: No valid authentication', {
    path: req.path,
    method: req.method,
    hasAuthHeader: !!req.headers?.authorization,
    hasSession: !!req.session,
  });

  // SECURITY: Include WWW-Authenticate header to signal auth methods supported
  // This is standard HTTP behavior for 401 responses
  res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
  sendError(res, 'Authentication required', 401);
}

/**
 * Type augmentation for Express Request
 * Adds isBasicAuth flag to track authentication method
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Required for Express type augmentation
  namespace Express {
    interface Request {
      /**
       * Flag indicating if request used HTTP Basic Authentication
       *
       * - true: Request authenticated via Authorization: Basic header (stateless)
       * - false: Request authenticated via session cookie (stateful)
       * - undefined: Authentication not yet attempted by flexibleAuth
       *
       * Used by csrfProtection middleware to determine if CSRF validation required:
       * - Basic Auth (true): CSRF exempt - no session, no CSRF risk
       * - Session (false): CSRF required - stateful, vulnerable to CSRF
       *
       * Set by: flexibleAuth middleware
       * Read by: csrfProtection middleware
       */
      isBasicAuth?: boolean;
    }
  }
}
