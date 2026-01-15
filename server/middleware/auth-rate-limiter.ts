/**
 * Auth-Specific Rate Limiters
 *
 * Provides strict rate limiting for authentication endpoints to prevent:
 * - Password reset email flooding
 * - Credential stuffing attacks
 * - Brute force attacks
 * - Account enumeration
 *
 * Uses Redis-backed rate limiting with IP+email keying to prevent distributed attacks.
 */

import { Request } from 'express';
import { createRateLimiter } from './redis-rate-limiter';

/**
 * Extract and sanitize email from request body
 * Used for composite key generation (IP + email)
 */
function extractEmail(req: Request): string {
  if (typeof req.body === 'object' && req.body !== null && 'email' in req.body) {
    // Type guard for body with email property
    const bodyWithEmail = req.body as { email?: unknown };
    const email = bodyWithEmail.email;
    if (typeof email === 'string') {
      return email.toLowerCase().trim();
    }
  }
  return 'unknown';
}

/**
 * Password Reset Rate Limiter
 *
 * Strict rate limiting for password reset endpoint to prevent:
 * - Email flooding (spam user's inbox)
 * - Email service abuse
 * - Account enumeration via timing attacks
 *
 * Limit: 3 requests per 15 minutes
 * Key: IP address + email (prevents distributed attacks)
 */
export const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 requests per 15 minutes
  message: 'Too many password reset requests. Please try again later.',
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const email = extractEmail(req);
    return `${ip}:${email}`;
  },
});

/**
 * Login Rate Limiter
 *
 * Moderate rate limiting for login endpoint to prevent:
 * - Credential stuffing attacks
 * - Brute force password guessing
 * - Account compromise
 *
 * Limit: 10 requests per 15 minutes
 * Key: IP address + email (prevents distributed attacks)
 */
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 login attempts per 15 minutes
  message: 'Too many login attempts. Please try again later.',
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const email = extractEmail(req);
    return `${ip}:${email}`;
  },
});

/**
 * Registration Rate Limiter
 *
 * Rate limiting for registration endpoint to prevent:
 * - Mass account creation
 * - Service abuse
 * - Spam account generation
 *
 * Limit: 5 requests per 1 hour
 * Key: IP address only (email not yet known)
 */
export const registrationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 registrations per hour per IP
  message: 'Too many accounts created. Please try again later.',
  // Use default IP-based key generator
});
