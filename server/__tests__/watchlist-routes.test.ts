import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import { db } from '../db';
import { users, watchLists, productWatches, products, retailers, productOffers } from '@shared/schema';
import { passport } from '../auth';
import { registerWatchListRoutes } from '../routes/watchlist-routes';
import { registerAuthRoutes } from '../routes/auth-routes';
import { sql } from 'drizzle-orm';
import {
  expectSuccessResponse,
  expectErrorResponse,
} from '../__tests__/helpers/response-validators';

/**
 * Watchlist Routes Integration Tests
 *
 * Tests complete request/response flows for watchlist endpoints:
 * - GET /api/watchlists - Get all user watch lists
 * - POST /api/watchlists - Create new watch list
 * - GET /api/watchlists/:id - Get watch list details
 * - PATCH /api/watchlists/:id - Update watch list
 * - DELETE /api/watchlists/:id - Delete watch list
 * - POST /api/watchlists/:id/products - Add product to list
 * - DELETE /api/watchlists/:id/products/:productId - Remove product
 * - GET /api/watchlists/stats - Get dashboard statistics
 */

// Mock Redis client to avoid requiring Redis in test environment
vi.mock('../config/redis', () => ({
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

// Mock logger
vi.mock('../utils/logger', () => ({
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

describe('Watchlist Routes - Integration Tests', () => {
  let app: Express;
  let testUserId: number;
  let testProductId: number;
  let testRetailerId: number;
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
        cookie: { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 },
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    // Register auth routes (needed for login)
    registerAuthRoutes(app);

    // Register watchlist routes
    registerWatchListRoutes(app);

    /**
     * Database Cleanup Strategy:
     * - Use TRUNCATE CASCADE for fast, reliable cleanup
     * - RESTART IDENTITY resets auto-increment sequences to 1
     * - CASCADE automatically handles foreign key relationships
     * - Order: children → parents (respects foreign keys)
     */
    await db.execute(sql`TRUNCATE TABLE product_watches RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE watch_lists RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

    // Create test user via registration endpoint (same as alert-routes pattern)
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

    // Create test retailer
    const [retailer] = await db
      .insert(retailers)
      .values({
        name: 'Test Retailer',
        website: 'https://test.com',
        isActive: true,
      })
      .returning();
    testRetailerId = retailer.id;

    // Create test product
    const [product] = await db
      .insert(products)
      .values({
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics',
      })
      .returning();
    testProductId = product.id;

    // Create product offer
    await db.insert(productOffers).values({
      productId: testProductId,
      retailerId: testRetailerId,
      price: '299.99',
      originalPrice: '399.99',
      availability: 'in_stock',
      productUrl: 'https://test.com/product',
    });

    // Get CSRF token from cookie
    const csrfCookie = authCookie?.find((c: string) => c.startsWith('_csrf='));
    if (csrfCookie) {
      csrfToken = csrfCookie.split('=')[1].split(';')[0];
    } else {
      csrfToken = 'test-csrf-token';
    }
  });

  afterEach(async () => {
    /**
     * Cleanup after each test - ensure no data leaks between tests
     * Same TRUNCATE CASCADE strategy as beforeEach
     */
    await db.execute(sql`TRUNCATE TABLE product_watches RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE watch_lists RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  describe('GET /api/watchlists', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/watchlists');
      expect(res.status).toBe(401);
    });

    it('should return user watch lists', async () => {
      // Create watch lists
      await db.insert(watchLists).values([
        { userId: testUserId, name: 'List 1', description: 'Description 1' },
        { userId: testUserId, name: 'List 2' },
      ]);

      const response = await request(app)
        .get('/api/watchlists')
        .set('Cookie', authCookie);

      const result = expectSuccessResponse<{ watchLists: Array<{ name: string; productCount: number }> }>(response, 200);
      expect(Array.isArray(result.watchLists)).toBe(true);
      expect(result.watchLists).toHaveLength(2);
      expect(result.watchLists[0]).toHaveProperty('name');
      expect(result.watchLists[0]).toHaveProperty('productCount');
    });

    it('should return empty array when user has no lists', async () => {
      const response = await request(app)
        .get('/api/watchlists')
        .set('Cookie', authCookie);

      const result = expectSuccessResponse<{ watchLists: Array<unknown> }>(response, 200);
      expect(result.watchLists).toEqual([]);
    });
  });

  describe('POST /api/watchlists', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/watchlists')
        .send({ name: 'Test List' });

      expect(res.status).toBe(401);
    });

    it('should require CSRF token', async () => {
      const res = await request(app)
        .post('/api/watchlists')
        .set('Cookie', authCookie)
        .send({ name: 'Test List' });

      expect(res.status).toBe(403); // CSRF error
    });

    it('should create watch list with valid data', async () => {
      const response = await request(app)
        .post('/api/watchlists')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'My Watch List', description: 'Test description' });

      const watchList = expectSuccessResponse<{ id: number; name: string; description: string; userId: number }>(response, 201);
      expect(watchList).toHaveProperty('id');
      expect(watchList.name).toBe('My Watch List');
      expect(watchList.description).toBe('Test description');
      expect(watchList.userId).toBe(testUserId);
    });

    it('should create watch list without description', async () => {
      const response = await request(app)
        .post('/api/watchlists')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'My Watch List' });

      const watchList = expectSuccessResponse<{ name: string; description: string | null }>(response, 201);
      expect(watchList.name).toBe('My Watch List');
      expect(watchList.description).toBeNull();
    });

    it('should validate name is required', async () => {
      const response = await request(app)
        .post('/api/watchlists')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: '' });

      // FIXED: Zod schema now uses .trim().min(1) to catch empty strings at validation layer
      // Returns 400 (Bad Request) instead of 500 (Server Error)
      expectErrorResponse(response, 400);
    });

    it('should validate name length (max 100 chars)', async () => {
      const longName = 'a'.repeat(101);

      const response = await request(app)
        .post('/api/watchlists')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: longName });

      expectErrorResponse(response, 400);
    });
  });

  describe('GET /api/watchlists/:id', () => {
    let watchListId: number;

    beforeEach(async () => {
      const [list] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'Test List',
      }).returning();
      watchListId = list.id;

      await db.insert(productWatches).values({
        userId: testUserId,
        watchListId,
        productId: testProductId,
      });
    });

    it('should require authentication', async () => {
      const res = await request(app).get(`/api/watchlists/${watchListId}`);
      expect(res.status).toBe(401);
    });

    it('should return watch list with products', async () => {
      const response = await request(app)
        .get(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie);

      const watchList = expectSuccessResponse<{ id: number; name: string; products: Array<{ name: string }> }>(response, 200);
      expect(watchList).toHaveProperty('id', watchListId);
      expect(watchList).toHaveProperty('name', 'Test List');
      expect(watchList).toHaveProperty('products');
      expect(Array.isArray(watchList.products)).toBe(true);
      expect(watchList.products).toHaveLength(1);
      expect(watchList.products[0]).toHaveProperty('name', 'Test Product');
    });

    it('should return 404 for non-existent watch list', async () => {
      const response = await request(app)
        .get('/api/watchlists/99999')
        .set('Cookie', authCookie);

      expectErrorResponse(response, 404, 'Watch list not found or unauthorized');
    });

    it('should not allow accessing other users watch lists', async () => {
      // Create another user
      const [otherUser] = await db.insert(users).values({
        username: 'otheruser',
        email: 'other@example.com',
        // SECURITY: NEVER expose passwordHash in production code
        passwordHash: 'hashed_password_test_only', // SECURITY: test only - NEVER expose in production
        role: 'user',
      }).returning();

      const [otherList] = await db.insert(watchLists).values({
        userId: otherUser.id,
        name: 'Other User List',
      }).returning();

      const response = await request(app)
        .get(`/api/watchlists/${otherList.id}`)
        .set('Cookie', authCookie);

      expectErrorResponse(response, 404, 'Watch list not found or unauthorized');
    });
  });

  describe('PATCH /api/watchlists/:id', () => {
    let watchListId: number;

    beforeEach(async () => {
      const [list] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'Original Name',
        description: 'Original Description',
      }).returning();
      watchListId = list.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .patch(`/api/watchlists/${watchListId}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(401);
    });

    it('should require CSRF token', async () => {
      const res = await request(app)
        .patch(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie)
        .send({ name: 'New Name' });

      expect(res.status).toBe(403);
    });

    it('should update watch list name', async () => {
      const response = await request(app)
        .patch(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Updated Name' });

      const watchList = expectSuccessResponse<{ name: string; description: string }>(response, 200);
      expect(watchList.name).toBe('Updated Name');
      expect(watchList.description).toBe('Original Description');
    });

    it('should update watch list description', async () => {
      const response = await request(app)
        .patch(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ description: 'Updated Description' });

      const watchList = expectSuccessResponse<{ name: string; description: string }>(response, 200);
      expect(watchList.name).toBe('Original Name');
      expect(watchList.description).toBe('Updated Description');
    });

    it('should require at least one field', async () => {
      const response = await request(app)
        .patch(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({});

      expectErrorResponse(response, 400);
    });
  });

  describe('DELETE /api/watchlists/:id', () => {
    let watchListId: number;

    beforeEach(async () => {
      const [list] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'Test List',
      }).returning();
      watchListId = list.id;

      await db.insert(productWatches).values([
        { userId: testUserId, watchListId, productId: testProductId },
      ]);
    });

    it('should require authentication', async () => {
      const res = await request(app).delete(`/api/watchlists/${watchListId}`);
      expect(res.status).toBe(401);
    });

    it('should require CSRF token', async () => {
      const res = await request(app)
        .delete(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(403);
    });

    it('should delete watch list and cascade delete products', async () => {
      const response = await request(app)
        .delete(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      const result = expectSuccessResponse<{ deletedId: number }>(response, 200);
      expect(result.deletedId).toBe(watchListId);

      // Verify list deleted
      const lists = await db
        .select()
        .from(watchLists)
        .where(sql`${watchLists.id} = ${watchListId}`);
      expect(lists).toHaveLength(0);

      // Verify products deleted (CASCADE)
      const watches = await db
        .select()
        .from(productWatches)
        .where(sql`${productWatches.watchListId} = ${watchListId}`);
      expect(watches).toHaveLength(0);
    });

    it('should not allow deleting other users lists', async () => {
      // Create another user
      const [otherUser] = await db.insert(users).values({
        username: 'otheruser',
        email: 'other@example.com',
        // SECURITY: NEVER expose passwordHash in production code
        passwordHash: 'hashed_password_test_only', // SECURITY: test only - NEVER expose in production
        role: 'user',
      }).returning();

      const [otherList] = await db.insert(watchLists).values({
        userId: otherUser.id,
        name: 'Other User List',
      }).returning();

      const response = await request(app)
        .delete(`/api/watchlists/${otherList.id}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      expectErrorResponse(response, 404);
    });
  });

  describe('POST /api/watchlists/:id/products', () => {
    let watchListId: number;

    beforeEach(async () => {
      const [list] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'Test List',
      }).returning();
      watchListId = list.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .send({ productId: testProductId });

      expect(res.status).toBe(401);
    });

    it('should require CSRF token', async () => {
      const res = await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .set('Cookie', authCookie)
        .send({ productId: testProductId });

      expect(res.status).toBe(403);
    });

    it('should add product to watch list', async () => {
      const response = await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ productId: testProductId });

      const productWatch = expectSuccessResponse<{ id: number; watchListId: number; productId: number }>(response, 201);
      expect(productWatch).toHaveProperty('id');
      expect(productWatch.watchListId).toBe(watchListId);
      expect(productWatch.productId).toBe(testProductId);
    });

    it('should validate productId is a positive integer', async () => {
      const response = await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ productId: -1 });

      expectErrorResponse(response, 400);
    });

    it('should prevent duplicate products', async () => {
      // Add product first time
      await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ productId: testProductId });

      // Try to add again
      const response = await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ productId: testProductId });

      // FIXED: Storage layer catches unique constraint violation (PostgreSQL error code 23505)
      // Returns 409 (Conflict) instead of 500 (Server Error)
      expectErrorResponse(response, 409);
    });
  });

  describe('DELETE /api/watchlists/:id/products/:productId', () => {
    let watchListId: number;

    beforeEach(async () => {
      const [list] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'Test List',
      }).returning();
      watchListId = list.id;

      await db.insert(productWatches).values({
        userId: testUserId,
        watchListId,
        productId: testProductId,
      });
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .delete(`/api/watchlists/${watchListId}/products/${testProductId}`);

      expect(res.status).toBe(401);
    });

    it('should require CSRF token', async () => {
      const res = await request(app)
        .delete(`/api/watchlists/${watchListId}/products/${testProductId}`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(403);
    });

    it('should remove product from watch list', async () => {
      const response = await request(app)
        .delete(`/api/watchlists/${watchListId}/products/${testProductId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      const result = expectSuccessResponse<{ success: boolean }>(response, 200);
      expect(result.success).toBe(true);

      // Verify product removed
      const watches = await db
        .select()
        .from(productWatches)
        .where(sql`${productWatches.watchListId} = ${watchListId}`);
      expect(watches).toHaveLength(0);
    });
  });

  describe('GET /api/watchlists/stats', () => {
    beforeEach(async () => {
      // Create watch lists
      const [list1] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'List 1',
      }).returning();

      // Add products
      await db.insert(productWatches).values({
        userId: testUserId,
        watchListId: list1.id,
        productId: testProductId,
      });
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/watchlists/stats');
      expect(res.status).toBe(401);
    });

    it('should return dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/watchlists/stats')
        .set('Cookie', authCookie);

      const stats = expectSuccessResponse<{
        totalWatchLists: number;
        totalProducts: number;
        totalPotentialSavings: number;
        activeAlerts: number;
        bestDeals: Array<unknown>;
        weeklyStats: unknown;
      }>(response, 200);

      expect(stats).toHaveProperty('totalWatchLists');
      expect(stats).toHaveProperty('totalProducts');
      expect(stats).toHaveProperty('totalPotentialSavings');
      expect(stats).toHaveProperty('activeAlerts');
      expect(stats).toHaveProperty('bestDeals');
      expect(stats).toHaveProperty('weeklyStats');

      expect(stats.totalWatchLists).toBe(1);
      expect(stats.totalProducts).toBe(1);
      expect(Array.isArray(stats.bestDeals)).toBe(true);
    });
  });
});
