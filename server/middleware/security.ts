import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRequiredEnv } from '../config/env-validation';
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';
import { createLogger } from '../utils/logger';
import { sanitizeObject, SanitizationContext } from '../utils/sanitization';
import { cleanupManager } from '../utils/cleanup-manager';
import { sendError } from '../utils/api-response';
import { ErrorCodes } from '../utils/error-codes';

const log = createLogger('Security');

/**
 * Rate Limiting Middleware
 * Prevents API abuse by limiting requests per IP
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number; // SECURITY: Track last access for LRU eviction
}

interface RateLimitStore {
  [key: string]: RateLimitEntry;
}

const rateLimitStore: RateLimitStore = {};

// SECURITY: Maximum entries to prevent unbounded memory growth
const MAX_RATE_LIMIT_ENTRIES = 10000;

// Deterministic cleanup timer for rate limit store
// Runs every 60 seconds to remove expired entries
const CLEANUP_INTERVAL_MS = 60 * 1000;
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  const entries = Object.entries(rateLimitStore);

  // Remove expired entries
  entries.forEach(([key, value]) => {
    if (value.resetTime < now) {
      delete rateLimitStore[key];
    }
  });

  // SECURITY: If still too many entries, perform LRU eviction
  const remainingEntries = Object.keys(rateLimitStore).length;
  if (remainingEntries > MAX_RATE_LIMIT_ENTRIES) {
    const sortedByAccess = Object.entries(rateLimitStore).sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess
    );

    // Remove oldest 20% of entries
    const toRemove = Math.floor(remainingEntries * 0.2);
    sortedByAccess.slice(0, toRemove).forEach(([key]) => {
      delete rateLimitStore[key];
    });

    log.warn(
      `Rate limit store exceeded ${MAX_RATE_LIMIT_ENTRIES} entries. Evicted ${toRemove} least recently used entries.`
    );
  }
}, CLEANUP_INTERVAL_MS);
cleanupManager.addInterval('rate-limit-cleanup', rateLimitCleanupInterval);

/**
 * DEPRECATED: In-memory Rate Limiter
 *
 * @deprecated Use createRateLimiter() from ./redis-rate-limiter.ts instead
 *
 * This implementation is only used as a fallback when Redis is unavailable.
 * It provides no tiering and does not work across multiple server instances.
 *
 * Migration path:
 * 1. Ensure Redis is available in your environment
 * 2. Use createRateLimiter() from redis-rate-limiter.ts
 * 3. Benefits: Distributed rate limiting, tier support, better metrics
 *
 * Current usage (in server/index.ts):
 * - Falls back when Redis unavailable (development only)
 * - No new code should use this function
 *
 * @param options - Rate limiting configuration
 * @param options.windowMs - Time window in milliseconds
 * @param options.maxRequests - Maximum requests per window
 * @param options.message - Error message for rate limit exceeded
 */
export function rateLimiter(options: { windowMs: number; maxRequests: number; message?: string }) {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // SECURITY: Check if we're approaching max entries and skip tracking for new IPs
    const currentSize = Object.keys(rateLimitStore).length;
    if (currentSize >= MAX_RATE_LIMIT_ENTRIES && !rateLimitStore[ip]) {
      // When at capacity, reject new IPs with rate limit error
      res.setHeader('Retry-After', '60');
      sendError(res, 'Service temporarily unavailable due to high load', 429, {
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      });
      return;
    }

    if (!rateLimitStore[ip]) {
      rateLimitStore[ip] = {
        count: 1,
        resetTime: now + windowMs,
        lastAccess: now,
      };
      return next();
    }

    const record = rateLimitStore[ip];
    record.lastAccess = now; // Update last access time

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      sendError(res, message, 429, {
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      });
      return;
    }

    record.count++;
    next();
  };
}

/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

// Extend Express Session type to include our custom fields
declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Required for Express type augmentation
  namespace Express {
    interface Request {
      csrfToken?: () => string;
    }
  }
}

const CSRF_TOKEN_LENGTH = 32;
// SECURITY: Required for secure CSRF token generation - never use fallback values
const _CSRF_SECRET = getRequiredEnv('CSRF_SECRET');

/**
 * List of public endpoints that don't require CSRF protection
 * These should be carefully considered and well-documented
 */
const CSRF_EXEMPT_PATHS = [
  '/api/affiliate/track-click', // Public click tracking
  '/api/health',
  '/health',
  '/discourse/sso', // External SSO callback
];

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check if path is exempt from CSRF protection
  const isExempt = CSRF_EXEMPT_PATHS.some((path) => req.path.startsWith(path));
  if (isExempt) {
    return next();
  }

  // Get CSRF token from request
  // req.body is typed as any by Express, but _csrf may not be present
  const bodyToken =
    typeof req.body === 'object' && req.body !== null && '_csrf' in req.body
      ? String((req.body as { _csrf?: unknown })._csrf ?? '')
      : '';
  const headerToken = req.headers['x-csrf-token'];
  const token = bodyToken || (typeof headerToken === 'string' ? headerToken : '');
  const sessionToken = req.session?.csrfToken;

  // Validate CSRF token
  if (!token || !sessionToken) {
    // SECURITY: Log CSRF token missing violation
    logSecurityEvent(SecurityEventType.CSRF_VIOLATION, req, {
      success: false,
      message: 'CSRF token missing',
      metadata: {
        method: req.method,
        path: req.path,
        hasToken: !!token,
        hasSessionToken: !!sessionToken,
      },
    });

    sendError(res, 'CSRF token missing', 403, 'CSRF token is required for this request');
    return;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const isValid = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken));

    if (!isValid) {
      // SECURITY: Log CSRF token mismatch violation
      logSecurityEvent(SecurityEventType.CSRF_VIOLATION, req, {
        success: false,
        message: 'Invalid CSRF token',
        metadata: {
          method: req.method,
          path: req.path,
          reason: 'Token mismatch',
        },
      });

      sendError(res, 'Invalid CSRF token', 403);
      return;
    }
  } catch (error) {
    // timingSafeEqual throws if buffers are different lengths
    // SECURITY: Log CSRF token format violation
    logSecurityEvent(SecurityEventType.CSRF_VIOLATION, req, {
      success: false,
      message: 'Invalid CSRF token format',
      metadata: {
        method: req.method,
        path: req.path,
        reason: 'Token length mismatch',
      },
    });

    sendError(res, 'Invalid CSRF token', 403);
    return;
  }

  next();
}

/**
 * Generate CSRF token for the session
 */
export function generateCsrfToken(req: Request): string {
  if (!req.session) {
    throw new Error('Session not initialized');
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * Middleware to attach CSRF token to response headers
 * This makes it easy for clients to retrieve the token
 */
export function attachCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (req.session) {
    const token = generateCsrfToken(req);
    res.setHeader('X-CSRF-Token', token);
  }
  next();
}

/**
 * Security Headers Middleware
 * Adds comprehensive security headers
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Generate CSP nonce for this request
  // SECURITY: Nonce must be cryptographically random and unique per request
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS Protection (legacy, but still good to have)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy with nonce-based script/style protection
  // SECURITY: Removed 'unsafe-inline' and using nonce for maximum XSS protection
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Build connect-src directive based on environment
  // Development needs WebSocket for Vite HMR (Hot Module Replacement)
  const connectSrc = isDevelopment ? "connect-src 'self' ws: wss:" : "connect-src 'self'";

  const cspDirectives =
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'nonce-${nonce}'`,
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      connectSrc,
      "frame-ancestors 'none'",
      'report-uri /api/csp-violation-report',
    ].join('; ') + ';';

  // SECURITY: Start with Report-Only mode to monitor violations
  // Set CSP_ENFORCE=true in environment to enable full enforcement
  // After 24-48 hours of no violations in report-only mode, enable enforcement
  const cspHeader =
    process.env.CSP_ENFORCE === 'true'
      ? 'Content-Security-Policy'
      : 'Content-Security-Policy-Report-Only';

  res.setHeader(cspHeader, cspDirectives);

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Strict-Transport-Security (HSTS) - enforce HTTPS
  // Only set in production and if using HTTPS
  if (!isDevelopment && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}

/**
 * Input Sanitization Middleware
 * Sanitizes user input to prevent injection attacks using DOMPurify
 *
 * SECURITY: Upgraded from regex-based to DOMPurify-based sanitization
 * for comprehensive XSS prevention with industry-standard library.
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize body (most user input comes through body)
  if (req.body && typeof req.body === 'object') {
    // req.body is typed as any - sanitizeObject expects Record<string, unknown>
    const sanitizedBody = sanitizeObject(
      req.body as Record<string, unknown>,
      SanitizationContext.PLAIN_TEXT
    );
    req.body = sanitizedBody;
  }

  // Sanitize query params (used for search, filters, etc.)
  // Note: In Express 5, req.query is read-only, so we sanitize values in place
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      if (typeof value === 'string') {
        // Sanitize string values directly on the query object
        (req.query as Record<string, unknown>)[key] = sanitizeObject(
          { v: value },
          SanitizationContext.PLAIN_TEXT
        ).v;
      } else if (Array.isArray(value)) {
        // Sanitize array values
        (req.query as Record<string, unknown>)[key] = value.map((v) =>
          typeof v === 'string' ? sanitizeObject({ v }, SanitizationContext.PLAIN_TEXT).v : v
        );
      }
    }
  }

  next();
}

// Note: Legacy sanitizeObject function removed
// Now using DOMPurify-based implementation from utils/sanitization.ts

/**
 * CORS Configuration Middleware
 * Handles Cross-Origin Resource Sharing with explicit security policies
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Parse allowed origins from environment variable
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  let allowedOrigins: string[];

  if (allowedOriginsEnv) {
    allowedOrigins = allowedOriginsEnv.split(',').map((origin) => origin.trim());
  } else {
    // SECURITY: Default to localhost only in development
    if (isDevelopment) {
      allowedOrigins = ['http://localhost:5173', 'http://localhost:5000', 'http://localhost:5001'];
    } else {
      // SECURITY: In production, ALLOWED_ORIGINS must be explicitly set
      // Log warning if not set
      log.warn('WARNING: ALLOWED_ORIGINS not set in production. CORS will be restrictive.');
      allowedOrigins = [];
    }
  }

  const origin = req.headers.origin;

  // SECURITY: Only set Access-Control-Allow-Origin if origin is explicitly allowed
  // Never reflect untrusted origins
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Same-origin requests (no Origin header) - these are always allowed
    // Don't set CORS headers for same-origin requests
    // The browser will allow these by default
  } else {
    // SECURITY: Log CORS violations for monitoring
    logSecurityEvent(SecurityEventType.CORS_VIOLATION, req, {
      success: false,
      message: 'Origin not allowed',
      metadata: {
        origin,
        allowedOrigins,
        method: req.method,
        path: req.path,
      },
    });

    // SECURITY: Don't set CORS headers for disallowed origins
    // The browser will block the request
    // For non-preflight requests, we let them through to the app
    // but without CORS headers, the browser will reject the response
  }

  // Common CORS headers (set regardless of origin validation)
  // Allowed HTTP methods
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');

  // Allowed headers - be specific about what headers are allowed
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-CSRF-Token, X-Requested-With'
  );

  // Expose headers that client-side code can access
  res.setHeader('Access-Control-Expose-Headers', 'X-CSRF-Token, X-Cache, X-Cache-Key');

  // Preflight request cache duration (1 hour for better security)
  res.setHeader('Access-Control-Max-Age', '3600');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    // Only send 204 if origin is allowed or no origin (same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      res.status(204).send();
    } else {
      // Reject preflight for disallowed origins
      sendError(res, 'Origin not allowed', 403);
    }
    return;
  }

  next();
}
