import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import { db } from '../../db';
import { products, priceAlerts } from '@shared/schema';
import { passport } from '../../auth';
import { registerAlertRoutes } from '../alert-routes';
import { registerAuthRoutes } from '../auth-routes';
import { sql, eq } from 'drizzle-orm';
import {
  expectSuccessResponse,
  expectErrorResponse,
} from '../../__tests__/helpers/response-validators';

/**
 * Price Alert Routes Integration Test Suite
 *
 * Tests complete request/response flows for price alert endpoints:
 * - Create alerts (authenticated users only)
 * - Get user's alerts (authenticated users only)
 * - Update alerts (owner only)
 * - Delete alerts (owner only)
 *
 * Test categories:
 * 1. Authentication - unauthenticated requests rejected
 * 2. Authorization - users can only access their own alerts
 * 3. Validation - invalid input returns 400
 * 4. Not found - non-existent alerts return 404
 * 5. Happy path - valid requests succeed
 */

// Mock Redis client to avoid requiring Redis in test environment
vi.mock('../../config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    scan: vi.fn(),
    publish: vi.fn(),
    duplicate: vi.fn(() => ({
      subscribe: vi.fn(),
      on: vi.fn(),
      quit: vi.fn(),
    })),
  },
}));

// Mock dependencies
vi.mock('../../services/email-service', () => ({
  emailService: {
    isReady: vi.fn().mockReturnValue(true),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../utils/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
    REGISTER: 'REGISTER',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  },
}));

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

// Mock CSRF protection middleware with smart validation
vi.mock('../../middleware/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../middleware/security')>();
  // Import sendError for standardized responses
  const { sendError } = await import('../../utils/api-response');

  return {
    ...actual,
    csrfProtection: (req: Request, res: Response, next: NextFunction): void => {
      (req as Request & { csrfToken: () => string }).csrfToken = () => 'test-csrf-token';

      // Validate CSRF token if present in headers
      const token = req.headers['x-csrf-token'];
      if (req.method !== 'GET' && req.method !== 'HEAD' && !token) {
        sendError(res, 'CSRF token missing', 403);
        return;
      }
      if (token && token !== 'test-csrf-token') {
        sendError(res, 'Invalid CSRF token', 403);
        return;
      }

      next();
    },
  };
});

describe('Price Alert Routes - Integration Tests', () => {
  let app: Express;
  let authCookie: string[];
  let csrfToken: string;
  let testUserId: number;
  let testProductId: number;
  let testAlertId: number;

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
        cookie: { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 },
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    // Register auth routes (needed for login)
    registerAuthRoutes(app);

    // Register alert routes
    registerAlertRoutes(app);

    /**
     * Database Cleanup Strategy:
     * - Use TRUNCATE CASCADE for fast, reliable cleanup
     * - RESTART IDENTITY resets auto-increment sequences to 1
     * - CASCADE automatically handles foreign key relationships
     * - Order: children → parents (respects foreign keys)
     */
    await db.execute(sql`TRUNCATE TABLE price_alerts RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

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

    // Create test product
    const [product] = await db
      .insert(products)
      .values({
        name: 'Test Product for Alerts',
        category: 'Electronics',
        brand: 'TestBrand',
        model: 'ALERT-001',
      })
      .returning();
    testProductId = product.id;

    // Create test alert
    const [alert] = await db
      .insert(priceAlerts)
      .values({
        userId: testUserId,
        productId: testProductId,
        targetPrice: '79.99',
        isActive: true,
        notifyForum: false,
      })
      .returning();
    testAlertId = alert.id;

    vi.clearAllMocks();
  });

  afterEach(async () => {
    /**
     * Cleanup after each test - ensure no data leaks between tests
     * Same TRUNCATE CASCADE strategy as beforeEach
     */
    await db.execute(sql`TRUNCATE TABLE price_alerts RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  describe('POST /api/price-alerts - Create Price Alert', () => {
    it('should create alert for authenticated user', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          productId: testProductId,
          targetPrice: 89.99,
          notifyForum: false,
        });

      const alert = expectSuccessResponse<{
        userId: number;
        productId: number;
        targetPrice: string;
        isActive: boolean;
        notifyForum: boolean;
      }>(response, 201);
      expect(alert).toMatchObject({
        userId: testUserId,
        productId: testProductId,
        targetPrice: '89.99',
        isActive: true,
        notifyForum: false,
      });
    });

    it('should create alert with forum notification enabled', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          productId: testProductId,
          targetPrice: 69.99,
          notifyForum: true,
        });

      const alert = expectSuccessResponse<{ notifyForum: boolean }>(response, 201);
      expect(alert.notifyForum).toBe(true);
    });

    it('should default notifyForum to false if not provided', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          productId: testProductId,
          targetPrice: 89.99,
        });

      const alert = expectSuccessResponse<{ notifyForum: boolean }>(response, 201);
      expect(alert.notifyForum).toBe(false);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).post('/api/price-alerts').send({
        productId: testProductId,
        targetPrice: 89.99,
      });

      // CSRF check happens before auth, so expect 403 (CSRF missing)
      expectErrorResponse(response, 403, 'CSRF token missing');
    });

    it('should allow multiple alerts for same product at different prices', async () => {
      // Create first alert
      await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          productId: testProductId,
          targetPrice: 89.99,
        });

      // Create second alert for same product, different price
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          productId: testProductId,
          targetPrice: 79.99,
        });

      expectSuccessResponse(response, 201);
    });

    it('should handle missing productId', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          targetPrice: 89.99,
        });

      expectErrorResponse(response, 400); // Zod validation error
    });

    it('should handle missing targetPrice', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          productId: testProductId,
        });

      expectErrorResponse(response, 400); // Zod validation error
    });
  });

  describe('GET /api/price-alerts - Get User Alerts', () => {
    it('should return all alerts for authenticated user', async () => {
      // Create additional alert
      await db.insert(priceAlerts).values({
        userId: testUserId,
        productId: testProductId,
        targetPrice: '69.99',
        isActive: true,
      });

      const response = await request(app).get('/api/price-alerts').set('Cookie', authCookie);

      const alerts = expectSuccessResponse<Array<{ userId: number }>>(response, 200);
      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts.length).toBeGreaterThanOrEqual(2);

      // Verify alerts belong to user
      alerts.forEach((alert) => {
        expect(alert.userId).toBe(testUserId);
      });
    });

    it('should include product details in alerts', async () => {
      // Product details now included via LEFT JOIN in storage layer
      const response = await request(app).get('/api/price-alerts').set('Cookie', authCookie);

      const alerts = expectSuccessResponse<Array<{ product?: { id: number; name: string } }>>(
        response,
        200
      );
      expect(alerts[0]).toHaveProperty('product');
      expect(alerts[0].product).toBeDefined();
      expect(alerts[0].product).toMatchObject({
        id: testProductId,
        name: expect.any(String),
      });
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/price-alerts');

      expectErrorResponse(response, 401, 'Authentication required');
    });

    it('should return empty array for user with no alerts', async () => {
      // Create new user with no alerts
      const newUserRes = await request(app)
        .post('/api/auth/register')
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'SecurePass123!',
        });

      const newUserSetCookie = newUserRes.headers['set-cookie'];
      const newUserCookie = Array.isArray(newUserSetCookie) ? newUserSetCookie : [newUserSetCookie];

      const response = await request(app).get('/api/price-alerts').set('Cookie', newUserCookie);

      const alerts = expectSuccessResponse<unknown[]>(response, 200);
      expect(alerts).toEqual([]);
    });

    it('should not show other users alerts', async () => {
      // Create second user with their own alert
      const user2Res = await request(app)
        .post('/api/auth/register')
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'SecurePass123!',
        });

      const user2Id = user2Res.body.data.user.id;

      await db.insert(priceAlerts).values({
        userId: user2Id,
        productId: testProductId,
        targetPrice: '59.99',
        isActive: true,
      });

      // Get alerts for first user
      const response = await request(app).get('/api/price-alerts').set('Cookie', authCookie);

      const alerts = expectSuccessResponse<Array<{ userId: number }>>(response, 200);
      // Should only see own alerts, not user2's
      alerts.forEach((alert) => {
        expect(alert.userId).toBe(testUserId);
        expect(alert.userId).not.toBe(user2Id);
      });
    });
  });

  describe('PATCH /api/price-alerts/:id - Update Alert', () => {
    it('should update alert target price', async () => {
      const response = await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          targetPrice: 69.99,
        });

      const alert = expectSuccessResponse<{ targetPrice: string }>(response, 200);
      expect(alert.targetPrice).toBe('69.99');
    });

    it('should activate/deactivate alert', async () => {
      const response = await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          isActive: false,
        });

      const alert = expectSuccessResponse<{ isActive: boolean }>(response, 200);
      expect(alert.isActive).toBe(false);
    });

    it('should update forum notification preference', async () => {
      const response = await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          notifyForum: true,
        });

      const alert = expectSuccessResponse<{ notifyForum: boolean }>(response, 200);
      expect(alert.notifyForum).toBe(true);
    });

    it('should update multiple fields at once', async () => {
      const response = await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          targetPrice: 59.99,
          isActive: false,
          notifyForum: true,
        });

      const alert = expectSuccessResponse<{
        targetPrice: string;
        isActive: boolean;
        notifyForum: boolean;
      }>(response, 200);
      expect(alert).toMatchObject({
        targetPrice: '59.99',
        isActive: false,
        notifyForum: true,
      });
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).patch(`/api/price-alerts/${testAlertId}`).send({
        targetPrice: 69.99,
      });

      // CSRF check happens before auth, so expect 403 (CSRF missing)
      expectErrorResponse(response, 403, 'CSRF token missing');
    });

    it('should reject update to another users alert', async () => {
      // Create second user
      const user2Res = await request(app)
        .post('/api/auth/register')
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'SecurePass123!',
        });

      const user2SetCookie = user2Res.headers['set-cookie'];
      const user2Cookie = Array.isArray(user2SetCookie) ? user2SetCookie : [user2SetCookie];

      // Get CSRF token for user2
      const user2CsrfCookie = user2Cookie?.find((c: string) => c.startsWith('_csrf='));
      const user2CsrfToken = user2CsrfCookie
        ? user2CsrfCookie.split('=')[1].split(';')[0]
        : 'test-csrf-token';

      // Try to update first user's alert as second user
      const response = await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', user2Cookie)
        .set('X-CSRF-Token', user2CsrfToken)
        .send({
          targetPrice: 69.99,
        });

      expectErrorResponse(response, 404, 'not found or unauthorized');
    });

    it('should return 404 for non-existent alert', async () => {
      const response = await request(app)
        .patch('/api/price-alerts/99999')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          targetPrice: 69.99,
        });

      expectErrorResponse(response, 404, 'not found or unauthorized');
    });

    it('should handle invalid alert ID', async () => {
      const response = await request(app)
        .patch('/api/price-alerts/invalid')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          targetPrice: 69.99,
        });

      expectErrorResponse(response, 400); // Validation error: invalid ID format
    });

    it('should persist update to database', async () => {
      await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          targetPrice: 49.99,
        });

      // Verify in database
      const alerts = await db.select().from(priceAlerts).where(eq(priceAlerts.id, testAlertId));
      expect(alerts[0].targetPrice).toBe('49.99');
    });
  });

  describe('DELETE /api/price-alerts/:id - Delete Alert', () => {
    it('should delete own alert', async () => {
      const response = await request(app)
        .delete(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      const result = expectSuccessResponse<{ deleted: boolean }>(response, 200);
      expect(result.deleted).toBe(true);

      // Verify deleted from database
      const alerts = await db.select().from(priceAlerts).where(eq(priceAlerts.id, testAlertId));
      expect(alerts.length).toBe(0);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).delete(`/api/price-alerts/${testAlertId}`);

      // CSRF check happens before auth check, so expect 403 (CSRF missing)
      expect(response.status).toBe(403);
    });

    it('should reject delete of another users alert', async () => {
      // Create second user
      const user2Res = await request(app)
        .post('/api/auth/register')
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'SecurePass123!',
        });

      const user2SetCookie = user2Res.headers['set-cookie'];
      const user2Cookie = Array.isArray(user2SetCookie) ? user2SetCookie : [user2SetCookie];

      // Get CSRF token for user2
      const user2CsrfCookie = user2Cookie?.find((c: string) => c.startsWith('_csrf='));
      const user2CsrfToken = user2CsrfCookie
        ? user2CsrfCookie.split('=')[1].split(';')[0]
        : 'test-csrf-token';

      // Try to delete first user's alert as second user
      const response = await request(app)
        .delete(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', user2Cookie)
        .set('X-CSRF-Token', user2CsrfToken);

      expectErrorResponse(response, 404, 'not found or unauthorized');

      // Verify alert still exists
      const alerts = await db.select().from(priceAlerts).where(eq(priceAlerts.id, testAlertId));
      expect(alerts.length).toBe(1);
    });

    it('should return 404 for non-existent alert', async () => {
      const response = await request(app)
        .delete('/api/price-alerts/99999')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      expectErrorResponse(response, 404, 'not found or unauthorized');
    });

    it('should handle invalid alert ID', async () => {
      const response = await request(app)
        .delete('/api/price-alerts/invalid')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      expectErrorResponse(response, 400); // Validation error: invalid ID format
    });

    it('should allow deletion of inactive alerts', async () => {
      // Deactivate alert first
      await db.update(priceAlerts).set({ isActive: false }).where(eq(priceAlerts.id, testAlertId));

      const response = await request(app)
        .delete(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      const result = expectSuccessResponse<{ deleted: boolean }>(response, 200);
      expect(result.deleted).toBe(true);
    });

    it('should handle deletion of already-deleted alert gracefully', async () => {
      // Delete once
      await request(app)
        .delete(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      // Try to delete again
      const response = await request(app)
        .delete(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      expectErrorResponse(response, 404, 'not found or unauthorized');
    });
  });

  describe('Authorization & Security', () => {
    it('should prevent horizontal privilege escalation', async () => {
      // Create two users
      const user1Res = await request(app)
        .post('/api/auth/register')
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          email: 'user1@example.com',
          username: 'user1',
          password: 'SecurePass123!',
        });

      const user2Res = await request(app)
        .post('/api/auth/register')
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'SecurePass123!',
        });

      const user1SetCookie = user1Res.headers['set-cookie'];
      const user1Cookie = Array.isArray(user1SetCookie) ? user1SetCookie : [user1SetCookie];

      const user2SetCookie = user2Res.headers['set-cookie'];
      const user2Cookie = Array.isArray(user2SetCookie) ? user2SetCookie : [user2SetCookie];

      // Get CSRF tokens for both users
      const user1CsrfCookie = user1Cookie?.find((c: string) => c.startsWith('_csrf='));
      const user1CsrfToken = user1CsrfCookie
        ? user1CsrfCookie.split('=')[1].split(';')[0]
        : 'test-csrf-token';

      const user2CsrfCookie = user2Cookie?.find((c: string) => c.startsWith('_csrf='));
      const user2CsrfToken = user2CsrfCookie
        ? user2CsrfCookie.split('=')[1].split(';')[0]
        : 'test-csrf-token';

      // User 1 creates alert
      const createRes = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', user1Cookie)
        .set('X-CSRF-Token', user1CsrfToken)
        .send({
          productId: testProductId,
          targetPrice: 89.99,
        });

      const alert1 = expectSuccessResponse<{ id: number }>(createRes, 201);
      const user1AlertId = alert1.id;

      // User 2 tries to access User 1's alert (GET)
      const getRes = await request(app).get('/api/price-alerts').set('Cookie', user2Cookie);

      const alerts = expectSuccessResponse<Array<{ id: number }>>(getRes, 200);
      expect(alerts.find((a) => a.id === user1AlertId)).toBeUndefined();

      // User 2 tries to update User 1's alert
      const updateRes = await request(app)
        .patch(`/api/price-alerts/${user1AlertId}`)
        .set('Cookie', user2Cookie)
        .set('X-CSRF-Token', user2CsrfToken)
        .send({ targetPrice: 49.99 });

      expectErrorResponse(updateRes, 404);

      // User 2 tries to delete User 1's alert
      const deleteRes = await request(app)
        .delete(`/api/price-alerts/${user1AlertId}`)
        .set('Cookie', user2Cookie)
        .set('X-CSRF-Token', user2CsrfToken);

      expectErrorResponse(deleteRes, 404);
    });

    it('should maintain alert integrity across sessions', async () => {
      // Create alert
      const createRes = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          productId: testProductId,
          targetPrice: 89.99,
        });

      const alert = expectSuccessResponse<{ id: number }>(createRes, 201);
      const alertId = alert.id;

      // Verify alert persists in database (survives session lifecycle)
      const dbAlerts = await db.select().from(priceAlerts).where(eq(priceAlerts.id, alertId));
      expect(dbAlerts.length).toBe(1);
      expect(dbAlerts[0].userId).toBe(testUserId);
      expect(dbAlerts[0].productId).toBe(testProductId);

      // Verify alert is retrievable via API
      const getRes = await request(app).get('/api/price-alerts').set('Cookie', authCookie);

      const alerts = expectSuccessResponse<Array<{ id: number }>>(getRes, 200);
      expect(alerts.find((a) => a.id === alertId)).toBeDefined();
    });
  });
});
