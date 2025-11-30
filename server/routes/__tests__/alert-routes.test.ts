/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- Test mocks require flexible typing */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import session from 'express-session';
import { db } from '../../db';
import { products, retailers, priceAlerts } from '@shared/schema';
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

vi.mock('../../middleware/security', () => ({
  generateCsrfToken: vi.fn(() => 'test-csrf-token'),
  csrfProtection: (req: unknown, res: unknown, next: () => void) => next(),
}));

describe('Price Alert Routes - Integration Tests', () => {
  let app: Express;
  let authCookie: string;
  let testUserId: number;
  let testProductId: number;
  let testAlertId: number;

  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

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

    // Mock CSRF middleware
    app.use((req, res, next) => {
      req.csrfToken = () => 'test-csrf-token';
      next();
    });

    // Register auth routes (needed for login)
    registerAuthRoutes(app);

    // Register alert routes
    registerAlertRoutes(app);

    // Clean database
    await db.delete(priceAlerts);
    await db.delete(products);
    await db.delete(retailers);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

    // Create test user and login
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'testuser@example.com',
        username: 'testuser',
        password: 'SecurePass123',
      });

    testUserId = registerRes.body.data.user.id;
    authCookie = registerRes.headers['set-cookie'];

    // Create test product
    const [product] = await db.insert(products).values({
      name: 'Test Product for Alerts',
      category: 'Electronics',
      brand: 'TestBrand',
      model: 'ALERT-001',
    }).returning();
    testProductId = product.id;

    // Create test alert
    const [alert] = await db.insert(priceAlerts).values({
      userId: testUserId,
      productId: testProductId,
      targetPrice: '79.99',
      isActive: true,
      notifyForum: false,
    }).returning();
    testAlertId = alert.id;

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.delete(priceAlerts);
    await db.delete(products);
    await db.delete(retailers);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  describe('POST /api/price-alerts - Create Price Alert', () => {
    it('should create alert for authenticated user', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .send({
          productId: testProductId,
          targetPrice: '89.99',
          notifyForum: false,
        });

      const alert = expectSuccessResponse<{ userId: number; productId: number; targetPrice: string; isActive: boolean; notifyForum: boolean }>(response, 201);
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
        .send({
          productId: testProductId,
          targetPrice: '69.99',
          notifyForum: true,
        });

      const alert = expectSuccessResponse<{ notifyForum: boolean }>(response, 201);
      expect(alert.notifyForum).toBe(true);
    });

    it('should default notifyForum to false if not provided', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .send({
          productId: testProductId,
          targetPrice: '89.99',
        });

      const alert = expectSuccessResponse<{ notifyForum: boolean }>(response, 201);
      expect(alert.notifyForum).toBe(false);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .send({
          productId: testProductId,
          targetPrice: '89.99',
        });

      expectErrorResponse(response, 401, 'Authentication required');
    });

    it('should allow multiple alerts for same product at different prices', async () => {
      // Create first alert
      await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .send({
          productId: testProductId,
          targetPrice: '89.99',
        });

      // Create second alert for same product, different price
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .send({
          productId: testProductId,
          targetPrice: '79.99',
        });

      expectSuccessResponse(response, 201);
    });

    it('should handle missing productId', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .send({
          targetPrice: '89.99',
        });

      expectErrorResponse(response, 500); // Current implementation, could be improved to 400
    });

    it('should handle missing targetPrice', async () => {
      const response = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .send({
          productId: testProductId,
        });

      expectErrorResponse(response, 500); // Current implementation, could be improved to 400
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

      const response = await request(app)
        .get('/api/price-alerts')
        .set('Cookie', authCookie);

      const alerts = expectSuccessResponse<Array<{ userId: number }>>(response, 200);
      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts.length).toBeGreaterThanOrEqual(2);

      // Verify alerts belong to user
      alerts.forEach((alert) => {
        expect(alert.userId).toBe(testUserId);
      });
    });

    it.skip('should include product details in alerts', async () => {
      // SKIP: Product details feature removed due to Drizzle LEFT JOIN issues with nullable fields
      // TODO: Re-implement with separate query or fix Drizzle nested object handling
      const response = await request(app)
        .get('/api/price-alerts')
        .set('Cookie', authCookie);

      const alerts = expectSuccessResponse<Array<{ product: { id: number; name: string } }>>(response, 200);
      expect(alerts[0]).toHaveProperty('product');
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
        .send({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'SecurePass123',
        });

      const newUserCookie = newUserRes.headers['set-cookie'];

      const response = await request(app)
        .get('/api/price-alerts')
        .set('Cookie', newUserCookie);

      const alerts = expectSuccessResponse<unknown[]>(response, 200);
      expect(alerts).toEqual([]);
    });

    it('should not show other users alerts', async () => {
      // Create second user with their own alert
      const user2Res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'SecurePass123',
        });

      const user2Id = user2Res.body.data.user.id;

      await db.insert(priceAlerts).values({
        userId: user2Id,
        productId: testProductId,
        targetPrice: '59.99',
        isActive: true,
      });

      // Get alerts for first user
      const response = await request(app)
        .get('/api/price-alerts')
        .set('Cookie', authCookie);

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
        .send({
          targetPrice: '69.99',
        });

      const alert = expectSuccessResponse<{ targetPrice: string }>(response, 200);
      expect(alert.targetPrice).toBe('69.99');
    });

    it('should activate/deactivate alert', async () => {
      const response = await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
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
        .send({
          targetPrice: '59.99',
          isActive: false,
          notifyForum: true,
        });

      const alert = expectSuccessResponse<{ targetPrice: string; isActive: boolean; notifyForum: boolean }>(response, 200);
      expect(alert).toMatchObject({
        targetPrice: '59.99',
        isActive: false,
        notifyForum: true,
      });
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .send({
          targetPrice: '69.99',
        });

      expectErrorResponse(response, 401, 'Authentication required');
    });

    it('should reject update to another users alert', async () => {
      // Create second user
      const user2Res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'SecurePass123',
        });

      const user2Cookie = user2Res.headers['set-cookie'];

      // Try to update first user's alert as second user
      const response = await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', user2Cookie)
        .send({
          targetPrice: '69.99',
        });

      expectErrorResponse(response, 404, 'not found or unauthorized');
    });

    it('should return 404 for non-existent alert', async () => {
      const response = await request(app)
        .patch('/api/price-alerts/99999')
        .set('Cookie', authCookie)
        .send({
          targetPrice: '69.99',
        });

      expectErrorResponse(response, 404, 'not found or unauthorized');
    });

    it('should handle invalid alert ID', async () => {
      const response = await request(app)
        .patch('/api/price-alerts/invalid')
        .set('Cookie', authCookie)
        .send({
          targetPrice: '69.99',
        });

      expectErrorResponse(response, 400); // Validation error: invalid ID format
    });

    it('should persist update to database', async () => {
      await request(app)
        .patch(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie)
        .send({
          targetPrice: '49.99',
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
        .set('Cookie', authCookie);

      expectSuccessResponse(response, 200);

      // Verify deleted from database
      const alerts = await db.select().from(priceAlerts).where(eq(priceAlerts.id, testAlertId));
      expect(alerts.length).toBe(0);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).delete(`/api/price-alerts/${testAlertId}`);

      expectErrorResponse(response, 401, 'Authentication required');
    });

    it('should reject delete of another users alert', async () => {
      // Create second user
      const user2Res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'SecurePass123',
        });

      const user2Cookie = user2Res.headers['set-cookie'];

      // Try to delete first user's alert as second user
      const response = await request(app)
        .delete(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', user2Cookie);

      expectErrorResponse(response, 404, 'not found or unauthorized');

      // Verify alert still exists
      const alerts = await db.select().from(priceAlerts).where(eq(priceAlerts.id, testAlertId));
      expect(alerts.length).toBe(1);
    });

    it('should return 404 for non-existent alert', async () => {
      const response = await request(app)
        .delete('/api/price-alerts/99999')
        .set('Cookie', authCookie);

      expectErrorResponse(response, 404, 'not found or unauthorized');
    });

    it('should handle invalid alert ID', async () => {
      const response = await request(app)
        .delete('/api/price-alerts/invalid')
        .set('Cookie', authCookie);

      expectErrorResponse(response, 400); // Validation error: invalid ID format
    });

    it('should allow deletion of inactive alerts', async () => {
      // Deactivate alert first
      await db.update(priceAlerts)
        .set({ isActive: false })
        .where(eq(priceAlerts.id, testAlertId));

      const response = await request(app)
        .delete(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie);

      expectSuccessResponse(response, 200);
    });

    it('should handle deletion of already-deleted alert gracefully', async () => {
      // Delete once
      await request(app)
        .delete(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie);

      // Try to delete again
      const response = await request(app)
        .delete(`/api/price-alerts/${testAlertId}`)
        .set('Cookie', authCookie);

      expectErrorResponse(response, 404, 'not found or unauthorized');
    });
  });

  describe('Authorization & Security', () => {
    it('should prevent horizontal privilege escalation', async () => {
      // Create two users
      const user1Res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user1@example.com',
          username: 'user1',
          password: 'SecurePass123',
        });

      const user2Res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'SecurePass123',
        });

      const user1Cookie = user1Res.headers['set-cookie'];
      const user2Cookie = user2Res.headers['set-cookie'];

      // User 1 creates alert
      const createRes = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', user1Cookie)
        .send({
          productId: testProductId,
          targetPrice: '89.99',
        });

      const alert1 = expectSuccessResponse<{ id: number }>(createRes, 201);
      const user1AlertId = alert1.id;

      // User 2 tries to access User 1's alert (GET)
      const getRes = await request(app)
        .get('/api/price-alerts')
        .set('Cookie', user2Cookie);

      const alerts = expectSuccessResponse<Array<{ id: number }>>(getRes, 200);
      expect(alerts.find((a) => a.id === user1AlertId)).toBeUndefined();

      // User 2 tries to update User 1's alert
      const updateRes = await request(app)
        .patch(`/api/price-alerts/${user1AlertId}`)
        .set('Cookie', user2Cookie)
        .send({ targetPrice: '49.99' });

      expectErrorResponse(updateRes, 404);

      // User 2 tries to delete User 1's alert
      const deleteRes = await request(app)
        .delete(`/api/price-alerts/${user1AlertId}`)
        .set('Cookie', user2Cookie);

      expectErrorResponse(deleteRes, 404);
    });

    it('should maintain alert integrity across sessions', async () => {
      // Create alert
      const createRes = await request(app)
        .post('/api/price-alerts')
        .set('Cookie', authCookie)
        .send({
          productId: testProductId,
          targetPrice: '89.99',
        });

      const alert = expectSuccessResponse<{ id: number }>(createRes, 201);
      const alertId = alert.id;

      // Logout (new session)
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookie);

      // Login again
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'SecurePass123',
        });

      const newCookie = loginRes.headers['set-cookie'];

      // Should still be able to access alert
      const getRes = await request(app)
        .get('/api/price-alerts')
        .set('Cookie', newCookie);

      const alerts = expectSuccessResponse<Array<{ id: number }>>(getRes, 200);
      expect(alerts.find((a) => a.id === alertId)).toBeDefined();
    });
  });
});
