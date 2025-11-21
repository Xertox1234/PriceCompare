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
import { csrfProtection } from '../middleware/security';

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

// Mock logger
vi.mock('../utils/logger', () => ({
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
    csrfProtection: (req: Request, res: Response, next: NextFunction) => {
      (req as Request & { csrfToken: () => string }).csrfToken = () => 'test-csrf-token';

      // Validate CSRF token if present in headers
      const token = req.headers['x-csrf-token'];
      if (req.method !== 'GET' && req.method !== 'HEAD' && !token) {
        return res.status(403).json({ error: 'CSRF token missing' });
      }
      if (token && token !== 'test-csrf-token') {
        return res.status(403).json({ error: 'Invalid CSRF token' });
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
  let authCookie: string;
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

    // Clean database
    await db.delete(productWatches);
    await db.delete(watchLists);
    await db.delete(productOffers);
    await db.delete(products);
    await db.delete(retailers);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

    // Create test user via registration endpoint (same as alert-routes pattern)
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'testuser@example.com',
        username: 'testuser',
        password: 'SecurePass123',
      });

    testUserId = registerRes.body.user.id;
    authCookie = registerRes.headers['set-cookie'];

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
    // Clean up
    await db.delete(productWatches);
    await db.delete(watchLists);
    await db.delete(productOffers);
    await db.delete(products);
    await db.delete(retailers);
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

      const res = await request(app)
        .get('/api/watchlists')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('watchLists');
      expect(Array.isArray(res.body.watchLists)).toBe(true);
      expect(res.body.watchLists).toHaveLength(2);
      expect(res.body.watchLists[0]).toHaveProperty('name');
      expect(res.body.watchLists[0]).toHaveProperty('productCount');
    });

    it('should return empty array when user has no lists', async () => {
      const res = await request(app)
        .get('/api/watchlists')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.watchLists).toEqual([]);
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
      const res = await request(app)
        .post('/api/watchlists')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'My Watch List', description: 'Test description' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('My Watch List');
      expect(res.body.description).toBe('Test description');
      expect(res.body.userId).toBe(testUserId);
    });

    it('should create watch list without description', async () => {
      const res = await request(app)
        .post('/api/watchlists')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'My Watch List' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('My Watch List');
      expect(res.body.description).toBeNull();
    });

    it('should validate name is required', async () => {
      const res = await request(app)
        .post('/api/watchlists')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should validate name length (max 100 chars)', async () => {
      const longName = 'a'.repeat(101);

      const res = await request(app)
        .post('/api/watchlists')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: longName });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
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
      const res = await request(app)
        .get(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', watchListId);
      expect(res.body).toHaveProperty('name', 'Test List');
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0]).toHaveProperty('name', 'Test Product');
    });

    it('should return 404 for non-existent watch list', async () => {
      const res = await request(app)
        .get('/api/watchlists/99999')
        .set('Cookie', authCookie);

      expect(res.status).toBe(404);
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

      const res = await request(app)
        .get(`/api/watchlists/${otherList.id}`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(404);
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
      const res = await request(app)
        .patch(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.description).toBe('Original Description');
    });

    it('should update watch list description', async () => {
      const res = await request(app)
        .patch(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ description: 'Updated Description' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Original Name');
      expect(res.body.description).toBe('Updated Description');
    });

    it('should require at least one field', async () => {
      const res = await request(app)
        .patch(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({});

      expect(res.status).toBe(400);
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
      const res = await request(app)
        .delete(`/api/watchlists/${watchListId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deletedId).toBe(watchListId);

      // Verify list deleted
      const lists = await db
        .select()
        .from(watchLists)
        .where(sql`${watchLists.id} = ${watchListId}`);
      expect(lists).toHaveLength(0);

      // Verify products deleted (CASCADE)
      const products = await db
        .select()
        .from(productWatches)
        .where(sql`${productWatches.watchListId} = ${watchListId}`);
      expect(products).toHaveLength(0);
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

      const res = await request(app)
        .delete(`/api/watchlists/${otherList.id}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(404);
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
      const res = await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ productId: testProductId });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.watchListId).toBe(watchListId);
      expect(res.body.productId).toBe(testProductId);
    });

    it('should validate productId is a positive integer', async () => {
      const res = await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ productId: -1 });

      expect(res.status).toBe(400);
    });

    it('should prevent duplicate products', async () => {
      // Add product first time
      await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ productId: testProductId });

      // Try to add again
      const res = await request(app)
        .post(`/api/watchlists/${watchListId}/products`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ productId: testProductId });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already in watch list');
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
      const res = await request(app)
        .delete(`/api/watchlists/${watchListId}/products/${testProductId}`)
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify product removed
      const products = await db
        .select()
        .from(productWatches)
        .where(sql`${productWatches.watchListId} = ${watchListId}`);
      expect(products).toHaveLength(0);
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
      const res = await request(app)
        .get('/api/watchlists/stats')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalWatchLists');
      expect(res.body).toHaveProperty('totalProducts');
      expect(res.body).toHaveProperty('totalPotentialSavings');
      expect(res.body).toHaveProperty('activeAlerts');
      expect(res.body).toHaveProperty('bestDeals');
      expect(res.body).toHaveProperty('weeklyStats');

      expect(res.body.totalWatchLists).toBe(1);
      expect(res.body.totalProducts).toBe(1);
      expect(Array.isArray(res.body.bestDeals)).toBe(true);
    });
  });
});
