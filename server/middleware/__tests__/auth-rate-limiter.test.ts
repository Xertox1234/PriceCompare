/**
 * Auth Rate Limiter Tests
 *
 * Tests the auth-specific rate limiters to ensure they properly enforce
 * rate limits on authentication endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  passwordResetLimiter,
  loginLimiter,
  registrationLimiter,
} from '../auth-rate-limiter';

// Mock the redis-rate-limiter module
vi.mock('../redis-rate-limiter', () => ({
  createRateLimiter: (options: {
    windowMs: number;
    maxRequests: number;
    message: string;
    keyGenerator?: (req: Request) => string;
  }) => {
    // Return a simple middleware that validates the options
    return (req: Request, res: Response, next: NextFunction) => {
      // Store the options for testing
      (req as unknown as { rateLimiterOptions?: typeof options }).rateLimiterOptions = options;
      next();
    };
  },
}));

describe('Auth Rate Limiters', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      ip: '192.168.1.1',
      socket: {
        remoteAddress: '192.168.1.1',
      } as unknown as Request['socket'],
      body: {
        email: 'test@example.com',
      },
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  describe('passwordResetLimiter', () => {
    it('should create rate limiter with correct configuration', () => {
      void passwordResetLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      expect(options).toBeDefined();
      expect(options?.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(options?.maxRequests).toBe(3);
      expect(options?.message).toBe('Too many password reset requests. Please try again later.');
    });

    it('should use IP+email composite key', () => {
      void passwordResetLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      const key = options?.keyGenerator?.(mockReq as Request);
      expect(key).toBe('192.168.1.1:test@example.com');
    });

    it('should handle missing email gracefully', () => {
      mockReq.body = {};
      void passwordResetLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      const key = options?.keyGenerator?.(mockReq as Request);
      expect(key).toBe('192.168.1.1:unknown');
    });

    it('should normalize email to lowercase', () => {
      mockReq.body = { email: 'TEST@EXAMPLE.COM' };
      void passwordResetLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      const key = options?.keyGenerator?.(mockReq as Request);
      expect(key).toBe('192.168.1.1:test@example.com');
    });

    it('should trim whitespace from email', () => {
      mockReq.body = { email: '  test@example.com  ' };
      void passwordResetLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      const key = options?.keyGenerator?.(mockReq as Request);
      expect(key).toBe('192.168.1.1:test@example.com');
    });
  });

  describe('loginLimiter', () => {
    it('should create rate limiter with correct configuration', () => {
      void loginLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      expect(options).toBeDefined();
      expect(options?.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(options?.maxRequests).toBe(10);
      expect(options?.message).toBe('Too many login attempts. Please try again later.');
    });

    it('should use IP+email composite key', () => {
      void loginLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      const key = options?.keyGenerator?.(mockReq as Request);
      expect(key).toBe('192.168.1.1:test@example.com');
    });

    it('should handle missing email gracefully', () => {
      mockReq.body = {};
      void loginLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      const key = options?.keyGenerator?.(mockReq as Request);
      expect(key).toBe('192.168.1.1:unknown');
    });
  });

  describe('registrationLimiter', () => {
    it('should create rate limiter with correct configuration', () => {
      void registrationLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      expect(options).toBeDefined();
      expect(options?.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(options?.maxRequests).toBe(5);
      expect(options?.message).toBe('Too many accounts created. Please try again later.');
    });

    it('should use default IP-based key (no email)', () => {
      void registrationLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      // registrationLimiter doesn't define a custom keyGenerator, so it should be undefined
      expect(options?.keyGenerator).toBeUndefined();
    });
  });

  describe('Key generator edge cases', () => {
    it('should handle missing IP address', () => {
      const reqWithoutIp: Partial<Request> = {
        socket: {} as Request['socket'],
        body: {
          email: 'test@example.com',
        },
      };
      void passwordResetLimiter(reqWithoutIp as Request, mockRes as Response, mockNext);

      const options = (reqWithoutIp as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      const key = options?.keyGenerator?.(reqWithoutIp as Request);
      expect(key).toBe('unknown:test@example.com');
    });

    it('should handle non-string email', () => {
      mockReq.body = { email: 12345 };
      void loginLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      const key = options?.keyGenerator?.(mockReq as Request);
      expect(key).toBe('192.168.1.1:unknown');
    });

    it('should handle null body', () => {
      mockReq.body = null;
      void loginLimiter(mockReq as Request, mockRes as Response, mockNext);

      const options = (mockReq as unknown as { rateLimiterOptions?: { windowMs: number; maxRequests: number; message: string; keyGenerator?: (req: Request) => string } }).rateLimiterOptions;
      const key = options?.keyGenerator?.(mockReq as Request);
      expect(key).toBe('192.168.1.1:unknown');
    });
  });
});
