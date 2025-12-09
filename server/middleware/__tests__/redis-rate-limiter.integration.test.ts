/**
 * Integration tests for tiered rate limiting middleware
 *
 * Tests the rate limiter middleware behavior with actual HTTP requests,
 * header setting, rate limiting enforcement, and 429 responses.
 *
 * NOTE: Each test uses a unique key to avoid shared state in the in-memory store.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Express Request.user type requires casting for test mocks */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createRateLimiter } from '../redis-rate-limiter';

// Mock Redis client to avoid actual Redis dependency
vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => null), // Return null to use in-memory fallback
  redisClient: null,
  isRedisConnected: vi.fn(() => false),
  REDIS_KEYS: {
    RATE_LIMIT: (key: string) => `ratelimit:${key}`,
  },
}));

// Mock security logger to avoid actual logging
vi.mock('../../utils/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  },
}));

// Mock cleanup manager
vi.mock('../../utils/cleanup-manager', () => ({
  cleanupManager: {
    addInterval: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

/**
 * Helper to generate unique test ID for each test
 * Prevents shared state in in-memory rate limiter
 */
function createTestId(): string {
  return `test-${Date.now()}-${Math.random()}`;
}

describe('Rate Limiter Middleware Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Response headers', () => {
    it('sets X-RateLimit-Limit header', async () => {
      const testId = createTestId();

      app.use(
        createRateLimiter({
          windowMs: 15 * 60 * 1000,
          maxRequests: 100,
          keyGenerator: () => testId,
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('100');
    });

    it('sets X-RateLimit-Remaining header', async () => {
      const testId = createTestId();

      app.use(
        createRateLimiter({
          windowMs: 15 * 60 * 1000,
          maxRequests: 100,
          keyGenerator: () => testId,
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      // First request should have 99 remaining
      expect(parseInt(response.headers['x-ratelimit-remaining'])).toBe(99);
    });

    it('sets X-RateLimit-Reset header with Unix timestamp', async () => {
      const testId = createTestId();

      app.use(
        createRateLimiter({
          windowMs: 15 * 60 * 1000,
          maxRequests: 100,
          keyGenerator: () => testId,
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const beforeRequest = Math.floor(Date.now() / 1000);
      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      const resetTime = parseInt(response.headers['x-ratelimit-reset']);

      // Reset time should be in the future (within 15 minutes + 1 second tolerance)
      expect(resetTime).toBeGreaterThan(beforeRequest);
      expect(resetTime).toBeLessThanOrEqual(beforeRequest + 15 * 60 + 2); // +2s tolerance
    });

    it('sets X-RateLimit-Tier header for anonymous users', async () => {
      const testId = createTestId();

      app.use(
        createRateLimiter({
          windowMs: 15 * 60 * 1000,
          maxRequests: 100,
          keyGenerator: () => testId,
          tiers: {}, // Enable tiered limits
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-tier']).toBeDefined();
      expect(response.headers['x-ratelimit-tier']).toBe('free');
    });

    it('sets X-RateLimit-Tier header for authenticated admin users', async () => {
      const testId = createTestId();

      // Middleware to simulate authenticated admin user
      app.use((req: Request, res: Response, next: NextFunction) => {
        req.user = { id: 1, role: 'admin', username: 'testadmin', email: 'admin@test.com' } as any;
        next();
      });

      app.use(
        createRateLimiter({
          windowMs: 15 * 60 * 1000,
          maxRequests: 100,
          keyGenerator: () => testId,
          tiers: {}, // Enable tiered limits
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-tier']).toBe('admin');
      expect(response.headers['x-ratelimit-limit']).toBe('10000');
    });
  });

  describe('Rate limiting enforcement', () => {
    it('allows requests within limit for anonymous users', async () => {
      const testId = createTestId();

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000, // 1 minute for faster testing
          maxRequests: 4, // Anonymous: 4 * 0.5 = 2 requests
          keyGenerator: () => testId,
          tiers: {}, // Enable tiered limits
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Anonymous users with base 4 get 2 requests (4 * 0.5 floored)
      const response1 = await request(app).get('/test');
      expect(response1.status).toBe(200);

      const response2 = await request(app).get('/test');
      expect(response2.status).toBe(200);
    });

    it('blocks requests after limit exceeded for anonymous users', async () => {
      const testId = createTestId();

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 4, // Anonymous: 4 * 0.5 = 2 requests
          keyGenerator: () => testId,
          tiers: {},
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // First 2 requests should succeed
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);

      // Third request should be rate limited (429)
      const blockedResponse = await request(app).get('/test');
      expect(blockedResponse.status).toBe(429);
    });

    it('gives authenticated users higher limits', async () => {
      const testId = createTestId();

      // Middleware to simulate authenticated standard user
      app.use((req: Request, res: Response, next: NextFunction) => {
        req.user = { id: 1, role: 'user', username: 'testuser', email: 'user@test.com' } as any;
        next();
      });

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 5, // User: 5 * 1 = 5 requests
          keyGenerator: () => testId,
          tiers: {},
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Should allow 5 requests for authenticated user
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }

      // 6th request should be blocked
      const blockedResponse = await request(app).get('/test');
      expect(blockedResponse.status).toBe(429);
    });

    it('gives premium users significantly higher limits', async () => {
      const testId = createTestId();

      app.use((req: Request, res: Response, next: NextFunction) => {
        req.user = {
          id: 1,
          role: 'premium',
          username: 'premiumuser',
          email: 'premium@test.com',
        } as any;
        next();
      });

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 10, // Premium: 10 * 5 = 50 requests
          keyGenerator: () => testId,
          tiers: {},
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Should allow 50 requests
      for (let i = 0; i < 50; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }

      // 51st request should be blocked
      const blockedResponse = await request(app).get('/test');
      expect(blockedResponse.status).toBe(429);
    });

    it('gives admins very high limits (effectively unlimited)', async () => {
      const testId = createTestId();

      app.use((req: Request, res: Response, next: NextFunction) => {
        req.user = { id: 1, role: 'admin', username: 'admin', email: 'admin@test.com' } as any;
        next();
      });

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 10, // Admin: 10 * 100 = 1000 requests
          keyGenerator: () => testId,
          tiers: {},
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Validate admin gets 1000 requests (test subset for speed)
      for (let i = 0; i < 100; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }

      // Should still have 900 remaining
      const lastResponse = await request(app).get('/test');
      expect(lastResponse.status).toBe(200);
      const remaining = parseInt(lastResponse.headers['x-ratelimit-remaining']);
      expect(remaining).toBeGreaterThan(800);
    });
  });

  describe('429 Response structure', () => {
    it('includes Retry-After header when limit exceeded', async () => {
      const testId = createTestId();

      app.use(
        createRateLimiter({
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 1,
          keyGenerator: () => testId,
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // First request succeeds
      await request(app).get('/test').expect(200);

      // Second request is rate limited
      const blockedResponse = await request(app).get('/test');
      expect(blockedResponse.status).toBe(429);

      // Should have retryAfter in response body (in seconds)
      expect(blockedResponse.body.retryAfter).toBeDefined();
      expect(typeof blockedResponse.body.retryAfter).toBe('number');
      expect(blockedResponse.body.retryAfter).toBeGreaterThan(0);
      expect(blockedResponse.body.retryAfter).toBeLessThanOrEqual(15 * 60); // Max 15 minutes
    });

    it('includes error message in response body', async () => {
      const testId = createTestId();

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 1,
          keyGenerator: () => testId,
          message: 'Custom rate limit message',
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      await request(app).get('/test').expect(200);

      const blockedResponse = await request(app).get('/test');
      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.body.error).toBe('Custom rate limit message');
    });

    it('uses default error message when none provided', async () => {
      const testId = createTestId();

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 1,
          keyGenerator: () => testId,
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      await request(app).get('/test').expect(200);

      const blockedResponse = await request(app).get('/test');
      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.body.error).toBe('Too many requests, please try again later');
    });

    it('includes tier information in headers when rate limited', async () => {
      const testId = createTestId();

      app.use((req: Request, res: Response, next: NextFunction) => {
        req.user = {
          id: 1,
          role: 'premium',
          username: 'premium',
          email: 'premium@test.com',
        } as any;
        next();
      });

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 1, // Premium: 1 * 5 = 5 requests
          keyGenerator: () => testId,
          tiers: {},
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Premium user gets 1 * 5 = 5 requests
      for (let i = 0; i < 5; i++) {
        await request(app).get('/test').expect(200);
      }

      // 6th request blocked
      const blockedResponse = await request(app).get('/test');
      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.headers['x-ratelimit-tier']).toBe('premium');
      expect(blockedResponse.headers['x-ratelimit-limit']).toBe('5');
      expect(blockedResponse.headers['x-ratelimit-remaining']).toBe('0');
    });
  });

  describe('Custom key generator', () => {
    it('uses custom key generator when provided', async () => {
      const customKeyGen = (req: Request) => {
        return (req.headers['x-api-key'] as string) || 'default';
      };

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 2,
          keyGenerator: customKeyGen,
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Different API keys should have separate limits
      await request(app).get('/test').set('x-api-key', 'key1').expect(200);
      await request(app).get('/test').set('x-api-key', 'key1').expect(200);
      await request(app).get('/test').set('x-api-key', 'key1').expect(429); // Blocked

      // Different key should still work
      await request(app).get('/test').set('x-api-key', 'key2').expect(200);
    });
  });

  describe('Tier-based limits with custom overrides', () => {
    it('respects custom tier limits when provided', async () => {
      const testId = createTestId();

      app.use((req: Request, res: Response, next: NextFunction) => {
        req.user = {
          id: 1,
          role: 'premium',
          username: 'premium',
          email: 'premium@test.com',
        } as any;
        next();
      });

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 10,
          keyGenerator: () => testId,
          tiers: {
            premium: 15, // Override: premium gets 15 instead of 50 (10 * 5)
          },
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Should allow 15 requests (custom override)
      for (let i = 0; i < 15; i++) {
        await request(app).get('/test').expect(200);
      }

      // 16th request should be blocked
      await request(app).get('/test').expect(429);
    });

    it('treats tier limit of 0 as unlimited', async () => {
      const testId = createTestId();

      app.use((req: Request, res: Response, next: NextFunction) => {
        req.user = { id: 1, role: 'admin', username: 'admin', email: 'admin@test.com' } as any;
        next();
      });

      app.use(
        createRateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 10,
          keyGenerator: () => testId,
          tiers: {
            admin: 0, // Unlimited
          },
        })
      );

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Should allow many requests (effectively unlimited)
      for (let i = 0; i < 1000; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }
    });
  });
});
