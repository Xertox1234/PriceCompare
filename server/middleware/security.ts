import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRequiredEnv } from '../config/env-validation';
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';

/**
 * Rate Limiting Middleware
 * Prevents API abuse by limiting requests per IP
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;  // SECURITY: Track last access for LRU eviction
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
setInterval(() => {
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
    const sortedByAccess = Object.entries(rateLimitStore)
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    // Remove oldest 20% of entries
    const toRemove = Math.floor(remainingEntries * 0.2);
    sortedByAccess.slice(0, toRemove).forEach(([key]) => {
      delete rateLimitStore[key];
    });

    console.warn(`Rate limit store exceeded ${MAX_RATE_LIMIT_ENTRIES} entries. Evicted ${toRemove} least recently used entries.`);
  }
}, CLEANUP_INTERVAL_MS);

export function rateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // SECURITY: Check if we're approaching max entries and skip tracking for new IPs
    const currentSize = Object.keys(rateLimitStore).length;
    if (currentSize >= MAX_RATE_LIMIT_ENTRIES && !rateLimitStore[ip]) {
      // When at capacity, reject new IPs with rate limit error
      res.status(429).json({
        error: 'Service temporarily unavailable due to high load',
        retryAfter: 60
      });
      return;
    }

    if (!rateLimitStore[ip]) {
      rateLimitStore[ip] = {
        count: 1,
        resetTime: now + windowMs,
        lastAccess: now
      };
      return next();
    }

    const record = rateLimitStore[ip];
    record.lastAccess = now;  // Update last access time

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
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
  namespace Express {
    interface Request {
      csrfToken?: () => string;
    }
  }
}

const CSRF_TOKEN_LENGTH = 32;
// SECURITY: Required for secure CSRF token generation - never use fallback values
const CSRF_SECRET = getRequiredEnv('CSRF_SECRET');

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
  const isExempt = CSRF_EXEMPT_PATHS.some(path => req.path.startsWith(path));
  if (isExempt) {
    return next();
  }

  // Get CSRF token from request
  const token = req.body._csrf || req.headers['x-csrf-token'];
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
      }
    });

    res.status(403).json({
      error: 'CSRF token missing',
      message: 'CSRF token is required for this request'
    });
    return;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(sessionToken)
    );

    if (!isValid) {
      // SECURITY: Log CSRF token mismatch violation
      logSecurityEvent(SecurityEventType.CSRF_VIOLATION, req, {
        success: false,
        message: 'Invalid CSRF token',
        metadata: {
          method: req.method,
          path: req.path,
          reason: 'Token mismatch',
        }
      });

      res.status(403).json({ error: 'Invalid CSRF token' });
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
      }
    });

    res.status(403).json({ error: 'Invalid CSRF token' });
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
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS Protection (legacy, but still good to have)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  // Note: 'unsafe-inline' for styles is kept for compatibility with inline styles
  // TODO: Replace with nonce-based or hash-based CSP for maximum security
  const isDevelopment = process.env.NODE_ENV === 'development';

  const cspDirectives = [
    "default-src 'self'",
    // Removed 'unsafe-eval' entirely - not needed and dangerous
    // In development, we allow 'unsafe-inline' for scripts due to HMR
    isDevelopment
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join('; ') + ';';

  res.setHeader('Content-Security-Policy', cspDirectives);

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
 * Sanitizes user input to prevent injection attacks
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body) as typeof req.body;
  }

  // Sanitize query params
  if (req.query) {
    req.query = sanitizeObject(req.query) as typeof req.query;
  }

  next();
}

type SanitizableValue = string | number | boolean | null | undefined | SanitizableObject | SanitizableArray;
interface SanitizableObject {
  [key: string]: SanitizableValue;
}
interface SanitizableArray extends Array<SanitizableValue> {}

function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // Remove potential XSS patterns
    return obj
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object' && obj !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject((obj as Record<string, unknown>)[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

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
    allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim());
  } else {
    // SECURITY: Default to localhost only in development
    if (isDevelopment) {
      allowedOrigins = ['http://localhost:5173', 'http://localhost:5000'];
    } else {
      // SECURITY: In production, ALLOWED_ORIGINS must be explicitly set
      // Log warning if not set
      console.warn('WARNING: ALLOWED_ORIGINS not set in production. CORS will be restrictive.');
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
      }
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With');

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
      res.status(403).json({ error: 'Origin not allowed' });
    }
    return;
  }

  next();
}
