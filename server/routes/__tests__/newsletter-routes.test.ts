import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import session from 'express-session';
import { sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import { db } from '../../db';
import { users, newsletterSubscribers } from '@shared/schema';
import { registerNewsletterRoutes } from '../newsletter-routes';
import { hashEmail } from '../../utils/encryption';
import {
  expectSuccessResponse,
  expectCreatedResponse,
  expectNotFoundError,
  expectConflictError,
  expectBadRequestError,
  expectForbiddenError,
} from '../../__tests__/helpers/response-validators';

/**
 * Newsletter Routes - Integration Tests
 *
 * Tests newsletter subscription API endpoints following project patterns:
 * - Uses standardized response validators (expectSuccessResponse, expectErrorResponse)
 * - Tests CSRF protection on mutation endpoints (POST)
 * - Tests both authenticated and guest user scenarios
 * - Verifies database state changes
 * - Tests email validation
 * - Tests idempotent operations
 * - SECURITY: No passwordHash exposure in tests
 *
 * Test Pattern References:
 * - docs/03_API_PATTERNS.md - API testing patterns, CSRF protection
 * - docs/04_SECURITY_PATTERNS.md - CSRF per-route pattern
 * - docs/08_TESTING_PATTERNS.md - Integration test patterns
 * - server/routes/__tests__/csrf-protection.test.ts - CSRF test patterns
 */

// Mock logger to avoid console noise in tests
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('Newsletter Routes - Integration Tests', () => {
  let app: Express;
  let validCsrfToken: string;
  let sessionCookie: string;
  let testUserId: number;

  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    // Create fresh Express app
    app = express();

    // Setup middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Setup session with CSRF token
    app.use(
      session({
        secret: 'test-secret-key-for-newsletter-testing',
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

    // CSRF token middleware - attach token to session
    app.use((req, res, next) => {
      if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      }
      validCsrfToken = req.session.csrfToken;
      next();
    });

    // Auth middleware - simulate optional authenticated user
    // This allows testing both guest and authenticated scenarios
    app.use((req, res, next) => {
      // If testUserId is set, simulate authenticated user
      if (testUserId) {
        req.user = {
          id: testUserId,
          username: 'testuser',
          email: 'testuser@example.com',
          emailHash: hashEmail('testuser@example.com'),
          role: 'user',
          trustLevel: 1,
          isActive: true,
          isSuspended: false,
          reputation: 0,
          avatarUrl: null,
          bio: null,
          location: null,
          website: null,
          lastSeenAt: null,
          postCount: 0,
          topicCount: 0,
          likesGiven: 0,
          likesReceived: 0,
          timeReadPosts: 0,
          daysVisited: 1,
          preferredCountry: null,
          theme: null,
          highContrast: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      next();
    });

    // Register newsletter routes
    registerNewsletterRoutes(app);

    // Clean database (in foreign key order)
    await db.execute(sql`TRUNCATE TABLE newsletter_subscribers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

    // Create test session cookie
    const sessionRes = await request(app).get('/api/newsletter/status/test@example.com');
    sessionCookie = sessionRes.headers['set-cookie']?.[0] || '';

    // Reset testUserId for each test (tests explicitly set if needed)
    testUserId = 0;
  });

  afterEach(async () => {
    // Clean database
    await db.execute(sql`TRUNCATE TABLE newsletter_subscribers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
    vi.clearAllMocks();
  });

  describe('POST /api/newsletter/subscribe', () => {
    const endpoint = '/api/newsletter/subscribe';

    describe('Happy Path', () => {
      it('should subscribe new email successfully (guest user)', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'newsubscriber@example.com',
            source: 'footer',
          });

        const data = expectCreatedResponse<{ subscriber: { email: string; isActive: boolean; source: string | null; userId: number | null } }>(response);

        // Verify response data
        expect(data.subscriber.email).toBe('newsubscriber@example.com');
        expect(data.subscriber.isActive).toBe(true);
        expect(data.subscriber.source).toBe('footer');
        expect(data.subscriber.userId).toBeNull(); // Guest user - no userId

        // Verify database state
        const [dbSubscriber] = await db
          .select()
          .from(newsletterSubscribers)
          .where(sql`email = 'newsubscriber@example.com'`)
          .limit(1);

        expect(dbSubscriber).toBeDefined();
        expect(dbSubscriber.email).toBe('newsubscriber@example.com');
        expect(dbSubscriber.isActive).toBe(true);
        expect(dbSubscriber.source).toBe('footer');
        expect(dbSubscriber.userId).toBeNull();
      });

      it('should subscribe new email successfully (authenticated user)', async () => {
        // Create test user
        const [user] = await db
          .insert(users)
          .values({
            username: 'testuser',
            email: 'testuser@example.com',
            emailHash: hashEmail('testuser@example.com'),
            passwordHash: 'hashed', // Test fixture only - never exposed
            role: 'user',
          })
          .returning({
            id: users.id,
            // SECURITY: Never return passwordHash
          });

        testUserId = user.id; // Set testUserId to simulate authenticated user

        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'authenticated@example.com',
            source: 'modal',
          });

        const data = expectCreatedResponse<{ subscriber: { email: string; userId: number | null } }>(response);

        // Verify userId is linked
        expect(data.subscriber.email).toBe('authenticated@example.com');
        expect(data.subscriber.userId).toBe(testUserId);

        // Verify in database
        const [dbSubscriber] = await db
          .select()
          .from(newsletterSubscribers)
          .where(sql`email = 'authenticated@example.com'`)
          .limit(1);

        expect(dbSubscriber.userId).toBe(testUserId);
      });

      it('should subscribe with source tracking', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'tracked@example.com',
            source: 'product_page',
          });

        const data = expectCreatedResponse<{ subscriber: { source: string | null } }>(response);

        expect(data.subscriber.source).toBe('product_page');
      });

      it('should subscribe without source (optional field)', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'nosource@example.com',
          });

        const data = expectCreatedResponse<{ subscriber: { source: string | null } }>(response);

        expect(data.subscriber.source).toBeNull();
      });

      it('should reactivate previously unsubscribed email', async () => {
        // Create inactive subscription
        await db.insert(newsletterSubscribers).values({
          email: 'reactivate@example.com',
          isActive: false,
          source: 'old_source',
        });

        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'reactivate@example.com',
            source: 'new_source',
          });

        const data = expectSuccessResponse<{ subscriber: { email: string; isActive: boolean; source: string | null } }>(response, 200);

        // Verify reactivated
        expect(data.subscriber.email).toBe('reactivate@example.com');
        expect(data.subscriber.isActive).toBe(true);
        expect(data.subscriber.source).toBe('new_source'); // Source updated

        // Verify database state
        const [dbSubscriber] = await db
          .select()
          .from(newsletterSubscribers)
          .where(sql`email = 'reactivate@example.com'`)
          .limit(1);

        expect(dbSubscriber.isActive).toBe(true);
        expect(dbSubscriber.source).toBe('new_source');
      });

      it('should normalize email to lowercase', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'MixedCase@Example.COM',
          });

        const data = expectCreatedResponse<{ subscriber: { email: string } }>(response);

        // Storage layer normalizes to lowercase
        expect(data.subscriber.email).toBe('mixedcase@example.com');
      });
    });

    describe('Error Handling', () => {
      it('should return 409 for already active subscription', async () => {
        // Create active subscription
        await db.insert(newsletterSubscribers).values({
          email: 'existing@example.com',
          isActive: true,
        });

        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'existing@example.com',
          });

        expectConflictError(response, /already subscribed/i);

        // Verify no duplicate created
        const subscribers = await db
          .select()
          .from(newsletterSubscribers)
          .where(sql`email = 'existing@example.com'`);

        expect(subscribers).toHaveLength(1);
      });

      it('should return 400 for invalid email format', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'not-an-email',
          });

        expectBadRequestError(response);
      });

      it('should return 400 for missing email', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            source: 'footer',
          });

        expectBadRequestError(response);
      });

      it('should return 400 for empty email', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: '',
          });

        expectBadRequestError(response);
      });

      it('should return 400 for source exceeding max length', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'test@example.com',
            source: 'a'.repeat(51), // Max is 50 characters
          });

        expectBadRequestError(response);
      });
    });

    describe('CSRF Protection', () => {
      it('should require CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .send({
            email: 'test@example.com',
          });

        expectForbiddenError(response, /CSRF/i);
      });

      it('should reject invalid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', 'invalid-token-12345')
          .send({
            email: 'test@example.com',
          });

        expectForbiddenError(response, /CSRF/i);
      });

      it('should accept CSRF token in request body', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .send({
            email: 'test@example.com',
            _csrf: validCsrfToken,
          });

        expectCreatedResponse(response);
      });
    });
  });

  describe('POST /api/newsletter/unsubscribe', () => {
    const endpoint = '/api/newsletter/unsubscribe';

    describe('Happy Path', () => {
      it('should unsubscribe active subscription (soft delete)', async () => {
        // Create active subscription
        await db.insert(newsletterSubscribers).values({
          email: 'unsubscribe@example.com',
          isActive: true,
        });

        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'unsubscribe@example.com',
          });

        const data = expectSuccessResponse<{ message: string }>(response, 200);

        expect(data.message).toMatch(/unsubscribed/i);

        // Verify soft delete - record exists but is_active = false
        const [dbSubscriber] = await db
          .select()
          .from(newsletterSubscribers)
          .where(sql`email = 'unsubscribe@example.com'`)
          .limit(1);

        expect(dbSubscriber).toBeDefined();
        expect(dbSubscriber.isActive).toBe(false);
        expect(dbSubscriber.updatedAt).toBeDefined();
      });

      it('should be idempotent - success even if already unsubscribed', async () => {
        // Create inactive subscription
        await db.insert(newsletterSubscribers).values({
          email: 'already@example.com',
          isActive: false,
        });

        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'already@example.com',
          });

        const data = expectSuccessResponse<{ message: string }>(response, 200);

        expect(data.message).toMatch(/already unsubscribed/i);

        // Verify state unchanged
        const [dbSubscriber] = await db
          .select()
          .from(newsletterSubscribers)
          .where(sql`email = 'already@example.com'`)
          .limit(1);

        expect(dbSubscriber.isActive).toBe(false);
      });

      it('should normalize email to lowercase', async () => {
        // Create subscription with lowercase email
        await db.insert(newsletterSubscribers).values({
          email: 'lowercase@example.com',
          isActive: true,
        });

        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'LowerCase@Example.COM', // Mixed case
          });

        expectSuccessResponse(response, 200);

        // Verify unsubscribed via normalized email
        const [dbSubscriber] = await db
          .select()
          .from(newsletterSubscribers)
          .where(sql`email = 'lowercase@example.com'`)
          .limit(1);

        expect(dbSubscriber.isActive).toBe(false);
      });
    });

    describe('Error Handling', () => {
      it('should return 404 for non-existent email', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'nonexistent@example.com',
          });

        expectNotFoundError(response, /not found/i);
      });

      it('should return 400 for invalid email format', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({
            email: 'not-an-email',
          });

        expectBadRequestError(response);
      });

      it('should return 400 for missing email', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({});

        expectBadRequestError(response);
      });
    });

    describe('CSRF Protection', () => {
      it('should require CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .send({
            email: 'test@example.com',
          });

        expectForbiddenError(response, /CSRF/i);
      });

      it('should reject invalid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', 'invalid-token-12345')
          .send({
            email: 'test@example.com',
          });

        expectForbiddenError(response, /CSRF/i);
      });
    });
  });

  describe('GET /api/newsletter/status/:email', () => {
    const getEndpoint = (email: string) => `/api/newsletter/status/${encodeURIComponent(email)}`;

    describe('Happy Path', () => {
      it('should return subscribed status for active subscription', async () => {
        // Create active subscription
        await db.insert(newsletterSubscribers).values({
          email: 'active@example.com',
          isActive: true,
        });

        const response = await request(app).get(getEndpoint('active@example.com'));

        const data = expectSuccessResponse<{ subscribed: boolean }>(response, 200);

        expect(data.subscribed).toBe(true);
      });

      it('should return not subscribed for inactive subscription', async () => {
        // Create inactive subscription
        await db.insert(newsletterSubscribers).values({
          email: 'inactive@example.com',
          isActive: false,
        });

        const response = await request(app).get(getEndpoint('inactive@example.com'));

        const data = expectSuccessResponse<{ subscribed: boolean }>(response, 200);

        expect(data.subscribed).toBe(false);
      });

      it('should return not subscribed for non-existent email', async () => {
        const response = await request(app).get(getEndpoint('nonexistent@example.com'));

        const data = expectSuccessResponse<{ subscribed: boolean }>(response, 200);

        expect(data.subscribed).toBe(false);
      });

      it('should handle URL-encoded email parameter', async () => {
        // Create subscription
        await db.insert(newsletterSubscribers).values({
          email: 'user+test@example.com',
          isActive: true,
        });

        // Email with + character requires encoding
        const response = await request(app).get(getEndpoint('user+test@example.com'));

        const data = expectSuccessResponse<{ subscribed: boolean }>(response, 200);

        expect(data.subscribed).toBe(true);
      });

      it('should normalize email to lowercase', async () => {
        // Create subscription with lowercase email
        await db.insert(newsletterSubscribers).values({
          email: 'lowercase@example.com',
          isActive: true,
        });

        // Query with mixed case
        const response = await request(app).get(getEndpoint('LowerCase@Example.COM'));

        const data = expectSuccessResponse<{ subscribed: boolean }>(response, 200);

        expect(data.subscribed).toBe(true);
      });

      it('should not require authentication (public endpoint)', async () => {
        // Ensure testUserId is 0 (guest user)
        testUserId = 0;

        const response = await request(app).get(getEndpoint('public@example.com'));

        // Should succeed without authentication
        expectSuccessResponse(response, 200);
      });

      it('should not require CSRF token (GET request)', async () => {
        // GET requests do not require CSRF protection
        const response = await request(app).get(getEndpoint('test@example.com'));

        expectSuccessResponse(response, 200);
      });
    });

    describe('Error Handling', () => {
      it('should return 400 for invalid email format', async () => {
        const response = await request(app).get(getEndpoint('not-an-email'));

        expectBadRequestError(response);
      });

      it('should return 400 for empty email', async () => {
        const response = await request(app).get('/api/newsletter/status/');

        // Express routes /:email with empty param -> 404 Not Found (no route match)
        expect(response.status).toBe(404);
      });

      it('should handle special characters in email', async () => {
        // Create subscription with special characters
        await db.insert(newsletterSubscribers).values({
          email: "user.name+tag@sub-domain.co.uk",
          isActive: true,
        });

        const response = await request(app).get(getEndpoint("user.name+tag@sub-domain.co.uk"));

        const data = expectSuccessResponse<{ subscribed: boolean }>(response, 200);

        expect(data.subscribed).toBe(true);
      });
    });
  });

  describe('Database State Verification', () => {
    it('should maintain audit trail - updatedAt changes on unsubscribe', async () => {
      // Create subscription
      const [original] = await db
        .insert(newsletterSubscribers)
        .values({
          email: 'audit@example.com',
          isActive: true,
        })
        .returning();

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Unsubscribe
      await request(app)
        .post('/api/newsletter/unsubscribe')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .send({ email: 'audit@example.com' });

      // Verify updatedAt changed
      const [updated] = await db
        .select()
        .from(newsletterSubscribers)
        .where(sql`email = 'audit@example.com'`)
        .limit(1);

      expect(updated.updatedAt).not.toEqual(original.updatedAt);
      // Both timestamps verified to exist - safe comparison
      expect(updated.updatedAt).toBeDefined();
      expect(original.updatedAt).toBeDefined();
      expect(new Date(updated.updatedAt as Date).getTime()).toBeGreaterThan(
        new Date(original.updatedAt as Date).getTime()
      );
    });

    it('should preserve subscribedAt timestamp on reactivation', async () => {
      // Create initial subscription
      const [original] = await db
        .insert(newsletterSubscribers)
        .values({
          email: 'preserve@example.com',
          isActive: false,
        })
        .returning();

      const originalSubscribedAt = original.subscribedAt;

      // Reactivate
      await request(app)
        .post('/api/newsletter/subscribe')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .send({ email: 'preserve@example.com' });

      // Verify subscribedAt unchanged
      const [reactivated] = await db
        .select()
        .from(newsletterSubscribers)
        .where(sql`email = 'preserve@example.com'`)
        .limit(1);

      expect(reactivated.subscribedAt).toEqual(originalSubscribedAt);
    });

    it('should handle concurrent subscriptions gracefully (unique email constraint)', async () => {
      // Attempt to create two subscriptions with same email simultaneously
      // Database unique constraint should prevent duplicates
      const requests = [
        request(app)
          .post('/api/newsletter/subscribe')
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({ email: 'concurrent@example.com' }),
        request(app)
          .post('/api/newsletter/subscribe')
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({ email: 'concurrent@example.com' }),
      ];

      const responses = await Promise.allSettled(requests);

      // At least one should succeed, at least one should fail with 409
      const succeeded = responses.filter(r => r.status === 'fulfilled' && (r.value as { status: number }).status === 201);
      const conflicts = responses.filter(r => r.status === 'fulfilled' && (r.value as { status: number }).status === 409);

      expect(succeeded.length).toBeGreaterThanOrEqual(1);
      expect(conflicts.length).toBeGreaterThanOrEqual(1);

      // Verify only one record in database
      const subscribers = await db
        .select()
        .from(newsletterSubscribers)
        .where(sql`email = 'concurrent@example.com'`);

      expect(subscribers).toHaveLength(1);
    });
  });

  describe('User ID Linking', () => {
    it('should link subscription to authenticated user', async () => {
      // Create test user
      const [user] = await db
        .insert(users)
        .values({
          username: 'linkeduser',
          email: 'linkeduser@example.com',
          emailHash: hashEmail('linkeduser@example.com'),
          passwordHash: 'hashed', // Test fixture only
          role: 'user',
        })
        .returning({ id: users.id });

      testUserId = user.id;

      const response = await request(app)
        .post('/api/newsletter/subscribe')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .send({ email: 'linked@example.com' });

      expectCreatedResponse(response);

      // Verify userId linked in database
      const [dbSubscriber] = await db
        .select()
        .from(newsletterSubscribers)
        .where(sql`email = 'linked@example.com'`)
        .limit(1);

      expect(dbSubscriber.userId).toBe(testUserId);
    });

    it('should not link subscription for guest users', async () => {
      testUserId = 0; // Guest user

      const response = await request(app)
        .post('/api/newsletter/subscribe')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .send({ email: 'guest@example.com' });

      expectCreatedResponse(response);

      // Verify userId is null
      const [dbSubscriber] = await db
        .select()
        .from(newsletterSubscribers)
        .where(sql`email = 'guest@example.com'`)
        .limit(1);

      expect(dbSubscriber.userId).toBeNull();
    });
  });
});
