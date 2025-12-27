import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { sendError } from '../utils/api-response';
import { logger } from '../utils/logger';
import { verifyPassword } from '../auth';
import {
  recordFailedLoginAsync,
  clearFailedLoginsAsync,
} from '../utils/account-lockout-simple';

/**
 * HTTP Basic Authentication Middleware
 *
 * SECURITY: REQUIRES HTTPS IN PRODUCTION
 * Basic Auth sends credentials in base64-encoded plaintext (RFC 7617).
 * Always use HTTPS to prevent credential exposure on the network.
 *
 * Authenticates requests using the Authorization: Basic header.
 * SECURITY FIX (2025-12-27): Removed fallthrough to session auth to prevent CSRF bypass.
 * Now called exclusively by flexibleAuth middleware, which handles auth method routing.
 *
 * Usage (via flexibleAuth):
 *   app.post('/api/watchlists', flexibleAuth, csrfProtection, withAuth, handler);
 *
 * Direct usage (legacy, not recommended):
 *   app.post('/api/v1/scraping/discover-trends', basicAuth, withAdmin, handler);
 *
 * Client example:
 *   curl -u "admin:password" https://api.pricecompare.com/api/watchlists
 *
 * WARNING: Do NOT use http:// (unencrypted) in production
 *
 * @see server/middleware/flexible-auth.ts - Unified auth middleware (recommended)
 * @see docs/UNIFIED_AUTH_DESIGN.md - Architecture documentation
 */
export async function basicAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // SECURITY: Basic Auth REQUIRES HTTPS in production (RFC 7617)
  // Credentials are sent base64-encoded (not encrypted), so transport encryption is mandatory
  if (process.env.NODE_ENV === 'production' && req.protocol !== 'https') {
    logger.warn('Basic auth attempted over insecure HTTP protocol', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
    sendError(res, 'HTTPS required for Basic Authentication', 403);
    return;
  }

  const authHeader = req.headers.authorization;

  // SECURITY FIX (2025-12-27): Removed fallthrough to session authentication
  // Previous behavior allowed CSRF bypass: requests to /api/v1/* without Authorization
  // header would fall through to session auth without CSRF protection.
  //
  // Now: Require Authorization header explicitly. If missing, reject with 401.
  // flexibleAuth middleware handles routing between Basic Auth and session auth.
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    logger.warn('Basic auth failed: Missing or invalid Authorization header', {
      ip: req.ip,
      path: req.path,
      hasAuthHeader: !!authHeader,
    });
    res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
    sendError(res, 'Basic Authentication required', 401);
    return;
  }

  try {
    // Decode credentials from "Basic base64(username:password)"
    const base64Credentials = authHeader.slice(6); // Remove "Basic " prefix
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      logger.warn('Basic auth failed: Invalid credentials format');
      res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
      sendError(res, 'Invalid credentials format', 401);
      return;
    }

    // SECURITY: Validate credential length limits to prevent DoS
    const MAX_USERNAME_LENGTH = 255;
    const MAX_PASSWORD_LENGTH = 1000;

    if (username.length > MAX_USERNAME_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      logger.warn('Basic auth failed: Credentials exceed length limits', {
        usernameLen: username.length,
        passwordLen: password.length,
      });
      res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
      sendError(res, 'Invalid credentials format', 401);
      return;
    }

    // Look up user by username
    const user = await storage.getUserByUsername(username);

    if (!user) {
      logger.warn('Basic auth failed: User not found', { username });
      res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
      sendError(res, 'Invalid credentials', 401);
      return;
    }

    // Verify password using existing auth system
    const isValid = await verifyPassword(password, user.passwordHash); // SECURITY: passwordHash required for verification

    if (!isValid) {
      logger.warn('Basic auth failed: Invalid password', { username });

      // SECURITY: Rate limiting on failed attempts (same as main login)
      // NOTE: Disabled in test env to keep E2E runs deterministic
      if (process.env.NODE_ENV !== 'test') {
        const lockoutResult = await recordFailedLoginAsync(user.email);
        if (lockoutResult.locked) {
          logger.warn('Basic auth account locked after failed attempts', {
            username,
            attemptCount: lockoutResult.attempts,
          });
          res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
          sendError(res, 'Account temporarily locked after failed attempts', 429);
          return;
        }
      }

      res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
      sendError(res, 'Invalid credentials', 401);
      return;
    }

    // SECURITY: Verify account is active (matches main login behavior)
    if (user.isSuspended) {
      logger.warn('Basic auth failed: Account suspended', { username, userId: user.id });
      res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
      sendError(res, 'Account access denied', 403);
      return;
    }

    if (user.isActive === false) {
      logger.warn('Basic auth failed: Account inactive', { username, userId: user.id });
      res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
      sendError(res, 'Account access denied', 403);
      return;
    }

    // Clear failed login attempts on successful authentication
    if (process.env.NODE_ENV !== 'test') {
      await clearFailedLoginsAsync(user.email);
    }

    // Authentication successful - attach user to request
    req.user = user;
    logger.info('Basic auth successful', { userId: user.id, username: user.username });

    next();
  } catch (error) {
    logger.error('Basic auth error', { error });
    res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
    sendError(res, 'Authentication error', 500);
  }
}
