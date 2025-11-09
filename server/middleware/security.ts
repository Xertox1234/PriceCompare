import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRequiredEnv } from '../config/env-validation';

/**
 * Rate Limiting Middleware
 * Prevents API abuse by limiting requests per IP
 */
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

export function rateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // Clean up expired entries
    if (Math.random() < 0.01) { // 1% chance to cleanup
      Object.keys(rateLimitStore).forEach(key => {
        if (rateLimitStore[key].resetTime < now) {
          delete rateLimitStore[key];
        }
      });
    }

    if (!rateLimitStore[ip]) {
      rateLimitStore[ip] = {
        count: 1,
        resetTime: now + windowMs
      };
      return next();
    }

    const record = rateLimitStore[ip];

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

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for non-browser clients (API endpoints with proper authentication)
  const contentType = req.headers['content-type'];
  if (contentType?.includes('application/json')) {
    // For JSON APIs, we rely on Same-Origin Policy and authentication
    return next();
  }

  // For form submissions, check CSRF token
  const token = req.body._csrf || req.headers['x-csrf-token'];
  const sessionToken = (req.session as any)?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  next();
}

/**
 * Generate CSRF token for the session
 */
export function generateCsrfToken(req: Request): string {
  if (!(req.session as any).csrfToken) {
    (req.session as any).csrfToken = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  }
  return (req.session as any).csrfToken;
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
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

/**
 * Input Sanitization Middleware
 * Sanitizes user input to prevent injection attacks
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query params
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
}

function sanitizeObject(obj: any): any {
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
    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key]);
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
  // Parse allowed origins from environment variable
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:5000'];

  const origin = req.headers.origin;

  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Same-origin requests (no Origin header)
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  // Allow credentials (cookies, authorization headers)
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Allowed HTTP methods
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  // Allowed headers
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  // Preflight request cache duration (24 hours)
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send();
    return;
  }

  next();
}
