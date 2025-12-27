import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { db } from '../../db';
import { users, watchLists, products, priceAlerts, productOffers, retailers } from '@shared/schema';
import { registerApiV1Routes } from '../api-v1-routes';
import { sql, eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { hashEmail } from '../../utils/encryption';
import { PASSWORD } from '../../utils/constants';

/**
 * API v1 Routes Integration Test Suite (Phase 1: Read-Only Endpoints)
 *
 * Tests HTTP Basic Auth endpoints for agent-native access:
 * - Watchlist operations (GET /api/v1/watchlists, GET /api/v1/watchlists/:id)
 * - Price alert operations (GET /api/v1/price-alerts, GET /api/v1/price-alerts/:id)
 * - Product operations (GET /api/v1/products/search, GET /api/v1/products/:id, GET /api/v1/products/:id/price-history)
 * - Notification operations (GET /api/v1/notifications)
 *
 * Authentication: HTTP Basic Auth (stateless, no CSRF required)
 */

// Mock Redis client
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
  getRedisClient: vi.fn(() => null),
}));

// Mock agent service
vi.mock('../../services/agent-service', () => ({
  agentService: {
    getCoordinationAgent: vi.fn().mockResolvedValue({
      processTask: vi.fn().mockResolvedValue({ success: true }),
      start: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ isRunning: false }),
    }),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Google search service
vi.mock('../../services/google-search', () => ({
  googleSearchService: {
    searchMultipleRetailers: vi.fn().mockResolvedValue([]),
    getUsageStats: vi.fn().mockReturnValue({}),
  },
}));

// Mock notification service
vi.mock('../../services/notification-service', () => ({
  getUserNotifications: vi.fn().mockResolvedValue([]),
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

describe('API v1 Routes - Phase 1 Read-Only Endpoints', () => {
  let app: Express;
  let testUser: { id: number; username: string; email: string };
  let testProduct: { id: number; name: string };
  let testWatchList: { id: number; name: string };
  let testAlert: { id: number; targetPrice: string };
  let authHeader: string;

  beforeEach(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());
    registerApiV1Routes(app);

    // Clean database
    await db.delete(priceAlerts);
    await db.delete(watchLists);
    await db.delete(productOffers);
    await db.delete(products);
    await db.delete(retailers);
    await db.delete(users);

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', PASSWORD.BCRYPT_ROUNDS);
    const email = 'test@example.com';
    const [user] = await db
      .insert(users)
      .values({
        username: 'testuser',
        email,
        emailHash: hashEmail(email),
        passwordHash: hashedPassword,
        role: 'user',
      })
      .returning({ id: users.id, username: users.username, email: users.email });
    testUser = user;

    // Create Basic Auth header
    authHeader = 'Basic ' + Buffer.from('testuser:password123').toString('base64');

    // Create test retailer
    const [retailer] = await db
      .insert(retailers)
      .values({
        name: 'Test Retailer',
        website: 'https://test.com',
        logo: 'https://test.com/logo.png',
      })
      .returning();

    // Create test product
    const [product] = await db
      .insert(products)
      .values({
        name: 'Test Product',
        description: 'A test product',
        category: 'electronics',
        image: 'https://test.com/image.png',
      })
      .returning();
    testProduct = product;

    // Create product offer for price history
    await db.insert(productOffers).values({
      productId: product.id,
      retailerId: retailer.id,
      price: '99.99',
      productUrl: 'https://test.com/product',
      availability: 'in_stock',
    });

    // Create test watchlist
    const [watchList] = await db
      .insert(watchLists)
      .values({
        userId: testUser.id,
        name: 'Test Watchlist',
        description: 'Test description',
      })
      .returning();
    testWatchList = watchList;

    // Create test price alert
    const [alert] = await db
      .insert(priceAlerts)
      .values({
        userId: testUser.id,
        productId: testProduct.id,
        targetPrice: '79.99',
        isActive: true,
      })
      .returning();
    testAlert = alert;
  });

  afterEach(async () => {
    // Clean up
    await db.delete(priceAlerts);
    await db.delete(watchLists);
    await db.delete(productOffers);
    await db.delete(products);
    await db.delete(retailers);
    await db.delete(users);
  });

  describe('Authentication', () => {
    it('should reject requests without Basic Auth header', async () => {
      const res = await request(app).get('/api/v1/watchlists');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject requests with invalid credentials', async () => {
      const invalidAuth = 'Basic ' + Buffer.from('testuser:wrongpassword').toString('base64');
      const res = await request(app).get('/api/v1/watchlists').set('Authorization', invalidAuth);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should accept requests with valid Basic Auth', async () => {
      const res = await request(app).get('/api/v1/watchlists').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/watchlists', () => {
    it('should return user watchlists with Basic Auth', async () => {
      const res = await request(app).get('/api/v1/watchlists').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.watchLists).toBeInstanceOf(Array);
      expect(res.body.data.watchLists.length).toBeGreaterThan(0);
      expect(res.body.data.watchLists[0].name).toBe('Test Watchlist');
    });

    it('should return empty array for user with no watchlists', async () => {
      // Delete test watchlist
      await db.delete(watchLists).where(eq(watchLists.id, testWatchList.id));

      const res = await request(app).get('/api/v1/watchlists').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.watchLists).toEqual([]);
    });
  });

  describe('GET /api/v1/watchlists/:id', () => {
    it('should return specific watchlist by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/watchlists/${testWatchList.id}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testWatchList.id);
      expect(res.body.data.name).toBe('Test Watchlist');
    });

    it('should return 404 for non-existent watchlist', async () => {
      const res = await request(app).get('/api/v1/watchlists/99999').set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid watchlist ID', async () => {
      const res = await request(app)
        .get('/api/v1/watchlists/invalid')
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/watchlists/:id/products', () => {
    it('should return products in watchlist', async () => {
      const res = await request(app)
        .get(`/api/v1/watchlists/${testWatchList.id}/products`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent watchlist', async () => {
      const res = await request(app)
        .get('/api/v1/watchlists/99999/products')
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/price-alerts', () => {
    it('should return user price alerts with Basic Auth', async () => {
      const res = await request(app).get('/api/v1/price-alerts').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].targetPrice).toBe('79.99');
    });

    it('should return empty array for user with no alerts', async () => {
      await db.delete(priceAlerts).where(eq(priceAlerts.id, testAlert.id));

      const res = await request(app).get('/api/v1/price-alerts').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/price-alerts/:id', () => {
    it('should return specific price alert by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/price-alerts/${testAlert.id}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testAlert.id);
      expect(res.body.data.targetPrice).toBe('79.99');
    });

    it('should return 404 for non-existent alert', async () => {
      const res = await request(app)
        .get('/api/v1/price-alerts/99999')
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid alert ID', async () => {
      const res = await request(app)
        .get('/api/v1/price-alerts/invalid')
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/products/search', () => {
    it('should search products with query parameter', async () => {
      const res = await request(app)
        .get('/api/v1/products/search?query=test')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    });

    it('should search products without authentication', async () => {
      const res = await request(app).get('/api/v1/products/search?query=test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should support pagination parameters', async () => {
      const res = await request(app)
        .get('/api/v1/products/search?page=1&limit=10')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
    });

    it('should support price filters', async () => {
      const res = await request(app)
        .get('/api/v1/products/search?minPrice=50&maxPrice=150')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/products/:id', () => {
    it('should return product details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProduct.id}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testProduct.id);
      expect(res.body.data.name).toBe('Test Product');
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app).get('/api/v1/products/99999').set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid product ID', async () => {
      const res = await request(app)
        .get('/api/v1/products/invalid')
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should work without authentication', async () => {
      const res = await request(app).get(`/api/v1/products/${testProduct.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/products/:id/price-history', () => {
    it('should return price history for product', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProduct.id}/price-history`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.history).toBeInstanceOf(Array);
    });

    it('should support days parameter', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProduct.id}/price-history?days=90`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should support retailerId parameter', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProduct.id}/price-history?retailerId=1`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app)
        .get('/api/v1/products/99999/price-history')
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/notifications', () => {
    it('should return user notifications with Basic Auth', async () => {
      const res = await request(app).get('/api/v1/notifications').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.count).toBeDefined();
    });

    it('should support filter parameters', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?isRead=false&limit=20')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/api/v1/notifications');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Authorization (User Isolation)', () => {
    let otherUser: { id: number; username: string };
    let otherAuthHeader: string;
    let otherWatchList: { id: number };

    beforeEach(async () => {
      // Create another user
      const hashedPassword = await bcrypt.hash('password456', PASSWORD.BCRYPT_ROUNDS);
      const email = 'other@example.com';
      const [user] = await db
        .insert(users)
        .values({
          username: 'otheruser',
          email,
          emailHash: hashEmail(email),
          passwordHash: hashedPassword,
          role: 'user',
        })
        .returning({ id: users.id, username: users.username });
      otherUser = user;

      otherAuthHeader = 'Basic ' + Buffer.from('otheruser:password456').toString('base64');

      // Create watchlist for other user
      const [watchList] = await db
        .insert(watchLists)
        .values({
          userId: otherUser.id,
          name: 'Other User Watchlist',
        })
        .returning();
      otherWatchList = watchList;
    });

    it('should not return other user watchlists', async () => {
      const res = await request(app).get('/api/v1/watchlists').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.watchLists).toBeInstanceOf(Array);
      const hasOtherUserWatchlist = res.body.data.watchLists.some(
        (w: { id: number }) => w.id === otherWatchList.id
      );
      expect(hasOtherUserWatchlist).toBe(false);
    });

    it('should not allow access to other user watchlist by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/watchlists/${otherWatchList.id}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should allow other user to access their own watchlist', async () => {
      const res = await request(app)
        .get(`/api/v1/watchlists/${otherWatchList.id}`)
        .set('Authorization', otherAuthHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(otherWatchList.id);
    });
  });
});
