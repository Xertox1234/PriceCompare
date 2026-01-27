import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Redis and logger BEFORE importing dependencies
import './helpers/mock-redis';
import './helpers/mock-logger';

import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { passport } from '../auth';
import { registerAuthRoutes } from '../routes/auth-routes';
import {
  expectSuccessResponse,
  expectUnauthorizedError,
  expectBadRequestError,
} from '../__tests__/helpers/response-validators';
import { cleanupTestData } from './helpers/test-fixtures';

/**
 * User Preferences Routes Integration Tests
 *
 * Tests complete request/response flows for user preferences endpoints:
 * - GET /api/user/preferences - Get user preferences
 * - PUT /api/user/preferences - Update user preferences
 *
 * Covers theme preferences (light/dark/system) and accessibility (highContrast).
 */

// Mock vite logger
vi.mock('../vite', () => ({
  log: vi.fn(),
}));

// Mock CSRF protection middleware with smart validation
vi.mock('../middleware/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/security')>();
  return {
    ...actual,
    csrfProtection: (req: Request, res: Response, next: NextFunction): void => {
      (req as Request & { csrfToken: () => string }).csrfToken = () => 'test-csrf-token';

      // Validate CSRF token if present in headers
      const token = req.headers['x-csrf-token'];
      if (req.method !== 'GET' && req.method !== 'HEAD' && !token) {
        res.status(403).json({ error: 'CSRF token missing' });
        return;
      }
      if (token && token !== 'test-csrf-token') {
        res.status(403).json({ error: 'Invalid CSRF token' });
        return;
      }

      next();
    },
  };
});

describe('User Preferences Routes - Integration Tests', () => {
  let app: Express;
  let testUserId: number;
  let authCookie: string[];
  let csrfToken: string;

  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.CSRF_SECRET = 'test-csrf-secret-key-for-testing';

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Setup session
    app.use(
      session({
        secret: 'test-secret-key-for-testing-only',
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          // Use secure cookies in production, not in test
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000,
        },
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    // Register auth routes (includes preferences endpoints)
    registerAuthRoutes(app);

    // Database cleanup - TRUNCATE CASCADE pattern
    await cleanupTestData(db, ['users']);

    // Create test user via registration endpoint
    const registerRes = await request(app)
      .post('/api/auth/register')
      .set('X-CSRF-Token', 'test-csrf-token')
      .send({
        email: 'testuser@example.com',
        username: 'testuser',
        password: 'SecurePass123!', // Must have special character for password validation
      });

    // Extract user from standardized response envelope
    testUserId = registerRes.body.data.user.id;
    const setCookieHeader = registerRes.headers['set-cookie'];
    authCookie = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

    // Get CSRF token from cookie
    const csrfCookie = authCookie?.find((c: string) => c.startsWith('_csrf='));
    if (csrfCookie) {
      csrfToken = csrfCookie.split('=')[1].split(';')[0];
    } else {
      csrfToken = 'test-csrf-token';
    }
  });

  afterEach(async () => {
    // Cleanup after each test - ensure no data leaks between tests
    await cleanupTestData(db, ['users']);
  });

  describe('GET /api/user/preferences', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/user/preferences');

      expectUnauthorizedError(response, /authentication required/i);
    });

    it('should return default preferences for new user', async () => {
      const response = await request(app).get('/api/user/preferences').set('Cookie', authCookie);

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.preferredCountry).toBe('US');
      expect(prefs.theme).toBe('system');
      expect(prefs.highContrast).toBe(false);
    });

    it('should return stored theme preference', async () => {
      // Update user preferences in database
      await db
        .update(users)
        .set({ theme: 'dark' })
        .where(eq(users.id, testUserId));

      const response = await request(app).get('/api/user/preferences').set('Cookie', authCookie);

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.theme).toBe('dark');
      expect(prefs.preferredCountry).toBe('US');
      expect(prefs.highContrast).toBe(false);
    });

    it('should return stored highContrast preference', async () => {
      // Update user preferences in database
      await db
        .update(users)
        .set({ highContrast: true })
        .where(eq(users.id, testUserId));

      const response = await request(app).get('/api/user/preferences').set('Cookie', authCookie);

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.highContrast).toBe(true);
      expect(prefs.theme).toBe('system');
      expect(prefs.preferredCountry).toBe('US');
    });

    it('should return all stored preferences', async () => {
      // Update user preferences in database
      await db
        .update(users)
        .set({
          theme: 'light',
          highContrast: true,
          preferredCountry: 'CA',
        })
        .where(eq(users.id, testUserId));

      const response = await request(app).get('/api/user/preferences').set('Cookie', authCookie);

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.theme).toBe('light');
      expect(prefs.highContrast).toBe(true);
      expect(prefs.preferredCountry).toBe('CA');
    });
  });

  describe('PUT /api/user/preferences', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .send({ theme: 'dark' });

      // CSRF is checked first (before withAuth), so expect 403 when no auth cookie
      expect(response.status).toBe(403);
    });

    it('should require CSRF token when authenticated', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .send({ theme: 'dark' });

      expect(response.status).toBe(403);
    });

    it('should successfully update theme to light', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ theme: 'light' });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.theme).toBe('light');
      expect(prefs.preferredCountry).toBe('US');
      expect(prefs.highContrast).toBe(false);

      // Verify database was updated
      const [user] = await db
        .select({ theme: users.theme })
        .from(users)
        .where(eq(users.id, testUserId));

      expect(user.theme).toBe('light');
    });

    it('should successfully update theme to dark', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ theme: 'dark' });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.theme).toBe('dark');

      // Verify database was updated
      const [user] = await db
        .select({ theme: users.theme })
        .from(users)
        .where(eq(users.id, testUserId));

      expect(user.theme).toBe('dark');
    });

    it('should successfully update theme to system', async () => {
      // First set to dark
      await db
        .update(users)
        .set({ theme: 'dark' })
        .where(eq(users.id, testUserId));

      // Then update back to system
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ theme: 'system' });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.theme).toBe('system');

      // Verify database was updated
      const [user] = await db
        .select({ theme: users.theme })
        .from(users)
        .where(eq(users.id, testUserId));

      expect(user.theme).toBe('system');
    });

    it('should successfully update highContrast to true', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ highContrast: true });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.highContrast).toBe(true);
      expect(prefs.theme).toBe('system');
      expect(prefs.preferredCountry).toBe('US');

      // Verify database was updated
      const [user] = await db
        .select({ highContrast: users.highContrast })
        .from(users)
        .where(eq(users.id, testUserId));

      expect(user.highContrast).toBe(true);
    });

    it('should successfully update highContrast to false', async () => {
      // First set to true
      await db
        .update(users)
        .set({ highContrast: true })
        .where(eq(users.id, testUserId));

      // Then update to false
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ highContrast: false });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.highContrast).toBe(false);

      // Verify database was updated
      const [user] = await db
        .select({ highContrast: users.highContrast })
        .from(users)
        .where(eq(users.id, testUserId));

      expect(user.highContrast).toBe(false);
    });

    it('should successfully update multiple fields at once', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          theme: 'dark',
          highContrast: true,
          preferredCountry: 'CA',
        });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.theme).toBe('dark');
      expect(prefs.highContrast).toBe(true);
      expect(prefs.preferredCountry).toBe('CA');

      // Verify database was updated
      const [user] = await db
        .select({
          theme: users.theme,
          highContrast: users.highContrast,
          preferredCountry: users.preferredCountry,
        })
        .from(users)
        .where(eq(users.id, testUserId));

      expect(user.theme).toBe('dark');
      expect(user.highContrast).toBe(true);
      expect(user.preferredCountry).toBe('CA');
    });

    it('should reject invalid theme value', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ theme: 'invalid' });

      expectBadRequestError(response, /invalid request body/i);
    });

    it('should reject non-string theme value', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ theme: 123 });

      expectBadRequestError(response, /invalid request body/i);
    });

    it('should reject non-boolean highContrast value', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ highContrast: 'true' }); // String instead of boolean

      expectBadRequestError(response, /invalid request body/i);
    });

    it('should reject invalid country code', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ preferredCountry: 'XX' }); // Invalid country code

      expectBadRequestError(response, /invalid country code/i);
    });

    it('should reject lowercase country code', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ preferredCountry: 'us' }); // Lowercase not allowed

      expectBadRequestError(response, /invalid request body/i);
    });

    it('should reject country code with wrong length', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ preferredCountry: 'USA' }); // 3 chars instead of 2

      expectBadRequestError(response, /invalid request body/i);
    });

    it('should accept valid country code US', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ preferredCountry: 'US' });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.preferredCountry).toBe('US');
    });

    it('should accept valid country code CA', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ preferredCountry: 'CA' });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      expect(prefs.preferredCountry).toBe('CA');
    });

    it('should persist changes across requests', async () => {
      // Update preferences
      await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ theme: 'dark', highContrast: true });

      // Verify via GET endpoint
      const getResponse = await request(app)
        .get('/api/user/preferences')
        .set('Cookie', authCookie);

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(getResponse, 200);

      expect(prefs.theme).toBe('dark');
      expect(prefs.highContrast).toBe(true);
    });

    it('should allow partial updates without affecting other fields', async () => {
      // Set initial state
      await db
        .update(users)
        .set({
          theme: 'light',
          highContrast: true,
          preferredCountry: 'CA',
        })
        .where(eq(users.id, testUserId));

      // Update only theme
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ theme: 'dark' });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      // Theme should be updated
      expect(prefs.theme).toBe('dark');

      // Other fields should remain unchanged
      expect(prefs.highContrast).toBe(true);
      expect(prefs.preferredCountry).toBe('CA');
    });

    it('should handle empty request body gracefully', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({});

      // Empty body should succeed (no changes made)
      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      // Should return current values
      expect(prefs.theme).toBe('system');
      expect(prefs.highContrast).toBe(false);
      expect(prefs.preferredCountry).toBe('US');
    });

    it('should set preferredCountry to null when explicitly provided', async () => {
      // First set a country
      await db
        .update(users)
        .set({ preferredCountry: 'CA' })
        .where(eq(users.id, testUserId));

      // Then clear it
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ preferredCountry: null });

      const prefs = expectSuccessResponse<{
        preferredCountry: string;
        theme: string;
        highContrast: boolean;
      }>(response, 200);

      // API returns default 'US' when null
      expect(prefs.preferredCountry).toBe('US');

      // But database should have null
      const [user] = await db
        .select({ preferredCountry: users.preferredCountry })
        .from(users)
        .where(eq(users.id, testUserId));

      expect(user.preferredCountry).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent updates correctly', async () => {
      // Simulate concurrent updates
      const updates = [
        request(app)
          .put('/api/user/preferences')
          .set('Cookie', authCookie)
          .set('X-CSRF-Token', csrfToken)
          .send({ theme: 'light' }),
        request(app)
          .put('/api/user/preferences')
          .set('Cookie', authCookie)
          .set('X-CSRF-Token', csrfToken)
          .send({ highContrast: true }),
      ];

      await Promise.all(updates);

      // Verify final state
      const [user] = await db
        .select({
          theme: users.theme,
          highContrast: users.highContrast,
        })
        .from(users)
        .where(eq(users.id, testUserId));

      // Both updates should be applied (order doesn't matter)
      expect(user.theme).toBe('light');
      expect(user.highContrast).toBe(true);
    });

    it('should preserve other user fields when updating preferences', async () => {
      // Update user with additional data
      await db
        .update(users)
        .set({
          bio: 'Test bio',
          location: 'Test location',
        })
        .where(eq(users.id, testUserId));

      // Update preferences
      await request(app)
        .put('/api/user/preferences')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ theme: 'dark' });

      // Verify other fields unchanged
      const [user] = await db
        .select({
          bio: users.bio,
          location: users.location,
        })
        .from(users)
        .where(eq(users.id, testUserId));

      expect(user.bio).toBe('Test bio');
      expect(user.location).toBe('Test location');
    });
  });
});
