import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { db } from '../../db';
import { users, watchLists, products, priceAlerts, productOffers, retailers } from '@shared/schema';
import { registerApiV1Routes } from '../api-v1-routes';
import { eq } from 'drizzle-orm';
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

// Mock notification service - need to partially mock to keep createNotification
vi.mock('../../services/notification-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/notification-service')>();
  return {
    ...actual,
    getUserNotifications: vi.fn().mockResolvedValue([]),
  };
});

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

    // Delete auto-created default watchlist (created by trigger_create_default_watch_list)
    // This ensures tests start with a clean slate and test explicit watchlist creation
    await db.delete(watchLists).where(eq(watchLists.userId, user.id));

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
      expect(res.body.meta).toBeDefined();
    });

    it('should support pagination parameters', async () => {
      const res = await request(app)
        .get('/api/v1/products/search?page=1&limit=10')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
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

    it('should return empty history for non-existent product', async () => {
      const res = await request(app)
        .get('/api/v1/products/99999/price-history')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.history).toEqual([]);
    });
  });

  describe('GET /api/v1/notifications', () => {
    it('should return user notifications with Basic Auth', async () => {
      const res = await request(app).get('/api/v1/notifications').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toBeInstanceOf(Array);
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

  // =============================================================================
  // PHASE 2: Write Operations Tests
  // =============================================================================

  describe('Watchlist Write Operations', () => {
    describe('POST /api/v1/watchlists', () => {
      it('should create a new watchlist with Basic Auth', async () => {
        const res = await request(app)
          .post('/api/v1/watchlists')
          .set('Authorization', authHeader)
          .send({ name: 'My New Watchlist', description: 'Test description' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('My New Watchlist');
        expect(res.body.data.description).toBe('Test description');
        expect(res.body.data.userId).toBe(testUser.id);
      });

      it('should reject watchlist creation without name', async () => {
        const res = await request(app)
          .post('/api/v1/watchlists')
          .set('Authorization', authHeader)
          .send({ description: 'No name' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('should reject watchlist creation without auth', async () => {
        const res = await request(app)
          .post('/api/v1/watchlists')
          .send({ name: 'Unauthorized Watchlist' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      });
    });

    describe('PATCH /api/v1/watchlists/:id', () => {
      it('should update watchlist name', async () => {
        const res = await request(app)
          .patch(`/api/v1/watchlists/${testWatchList.id}`)
          .set('Authorization', authHeader)
          .send({ name: 'Updated Name' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Updated Name');
      });

      it('should update watchlist description', async () => {
        const res = await request(app)
          .patch(`/api/v1/watchlists/${testWatchList.id}`)
          .set('Authorization', authHeader)
          .send({ description: 'Updated description' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.description).toBe('Updated description');
      });

      it('should reject update without any fields', async () => {
        const res = await request(app)
          .patch(`/api/v1/watchlists/${testWatchList.id}`)
          .set('Authorization', authHeader)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('should prevent updating other user watchlist', async () => {
        // Create another user and watchlist
        const otherPassword = await bcrypt.hash('otherpass', PASSWORD.BCRYPT_ROUNDS);
        const otherEmail = 'other@example.com';
        const [otherUser] = await db
          .insert(users)
          .values({
            username: 'otheruser',
            email: otherEmail,
            emailHash: hashEmail(otherEmail),
            passwordHash: otherPassword,
            role: 'user',
          })
          .returning();

        const [otherWatchList] = await db
          .insert(watchLists)
          .values({
            userId: otherUser.id,
            name: 'Other Watchlist',
          })
          .returning();

        const res = await request(app)
          .patch(`/api/v1/watchlists/${otherWatchList.id}`)
          .set('Authorization', authHeader)
          .send({ name: 'Hacked Name' });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });

    describe('DELETE /api/v1/watchlists/:id', () => {
      it('should delete own watchlist', async () => {
        const res = await request(app)
          .delete(`/api/v1/watchlists/${testWatchList.id}`)
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.deletedId).toBe(testWatchList.id);

        // Verify deletion
        const checkRes = await request(app)
          .get(`/api/v1/watchlists/${testWatchList.id}`)
          .set('Authorization', authHeader);

        expect(checkRes.status).toBe(404);
      });

      it('should prevent deleting other user watchlist', async () => {
        const otherPassword = await bcrypt.hash('otherpass', PASSWORD.BCRYPT_ROUNDS);
        const otherEmail = 'other@example.com';
        const [otherUser] = await db
          .insert(users)
          .values({
            username: 'otheruser',
            email: otherEmail,
            emailHash: hashEmail(otherEmail),
            passwordHash: otherPassword,
            role: 'user',
          })
          .returning();

        const [otherWatchList] = await db
          .insert(watchLists)
          .values({
            userId: otherUser.id,
            name: 'Other Watchlist',
          })
          .returning();

        const res = await request(app)
          .delete(`/api/v1/watchlists/${otherWatchList.id}`)
          .set('Authorization', authHeader);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/watchlists/:id/products', () => {
      it('should add product to watchlist', async () => {
        const res = await request(app)
          .post(`/api/v1/watchlists/${testWatchList.id}/products`)
          .set('Authorization', authHeader)
          .send({ productId: testProduct.id });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.watchListId).toBe(testWatchList.id);
        expect(res.body.data.productId).toBe(testProduct.id);
      });

      it('should prevent adding duplicate product', async () => {
        // Add product first time
        await request(app)
          .post(`/api/v1/watchlists/${testWatchList.id}/products`)
          .set('Authorization', authHeader)
          .send({ productId: testProduct.id });

        // Try adding again
        const res = await request(app)
          .post(`/api/v1/watchlists/${testWatchList.id}/products`)
          .set('Authorization', authHeader)
          .send({ productId: testProduct.id });

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
      });

      it('should reject invalid product ID', async () => {
        const res = await request(app)
          .post(`/api/v1/watchlists/${testWatchList.id}/products`)
          .set('Authorization', authHeader)
          .send({ productId: 99999 });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });

    describe('DELETE /api/v1/watchlists/:id/products/:productId', () => {
      beforeEach(async () => {
        // Add product to watchlist for deletion tests
        await request(app)
          .post(`/api/v1/watchlists/${testWatchList.id}/products`)
          .set('Authorization', authHeader)
          .send({ productId: testProduct.id });
      });

      it('should remove product from watchlist', async () => {
        const res = await request(app)
          .delete(`/api/v1/watchlists/${testWatchList.id}/products/${testProduct.id}`)
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent product in watchlist', async () => {
        const res = await request(app)
          .delete(`/api/v1/watchlists/${testWatchList.id}/products/99999`)
          .set('Authorization', authHeader);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });
  });

  describe('Price Alert Write Operations', () => {
    describe('POST /api/v1/price-alerts', () => {
      it('should create a new price alert', async () => {
        const res = await request(app)
          .post('/api/v1/price-alerts')
          .set('Authorization', authHeader)
          .send({
            productId: testProduct.id,
            targetPrice: 69.99,
            notifyForum: false,
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.productId).toBe(testProduct.id);
        expect(res.body.data.targetPrice).toBe('69.99');
        expect(res.body.data.userId).toBe(testUser.id);
      });

      it('should reject alert for non-existent product', async () => {
        const res = await request(app)
          .post('/api/v1/price-alerts')
          .set('Authorization', authHeader)
          .send({
            productId: 99999,
            targetPrice: 69.99,
          });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('not found');
      });

      it('should reject alert with negative price', async () => {
        const res = await request(app)
          .post('/api/v1/price-alerts')
          .set('Authorization', authHeader)
          .send({
            productId: testProduct.id,
            targetPrice: -10.00,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });
    });

    describe('PATCH /api/v1/price-alerts/:id', () => {
      it('should update alert target price', async () => {
        const res = await request(app)
          .patch(`/api/v1/price-alerts/${testAlert.id}`)
          .set('Authorization', authHeader)
          .send({ targetPrice: 59.99 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.targetPrice).toBe('59.99');
      });

      it('should update alert active status', async () => {
        const res = await request(app)
          .patch(`/api/v1/price-alerts/${testAlert.id}`)
          .set('Authorization', authHeader)
          .send({ isActive: false });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isActive).toBe(false);
      });

      it('should reject update without fields', async () => {
        const res = await request(app)
          .patch(`/api/v1/price-alerts/${testAlert.id}`)
          .set('Authorization', authHeader)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('should prevent updating other user alert', async () => {
        const otherPassword = await bcrypt.hash('otherpass', PASSWORD.BCRYPT_ROUNDS);
        const otherEmail = 'other@example.com';
        const [otherUser] = await db
          .insert(users)
          .values({
            username: 'otheruser',
            email: otherEmail,
            emailHash: hashEmail(otherEmail),
            passwordHash: otherPassword,
            role: 'user',
          })
          .returning();

        const [otherAlert] = await db
          .insert(priceAlerts)
          .values({
            userId: otherUser.id,
            productId: testProduct.id,
            targetPrice: '49.99',
            isActive: true,
          })
          .returning();

        const res = await request(app)
          .patch(`/api/v1/price-alerts/${otherAlert.id}`)
          .set('Authorization', authHeader)
          .send({ targetPrice: 10.00 });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });

    describe('DELETE /api/v1/price-alerts/:id', () => {
      it('should delete own price alert', async () => {
        const res = await request(app)
          .delete(`/api/v1/price-alerts/${testAlert.id}`)
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.deleted).toBe(true);

        // Verify deletion
        const checkRes = await request(app)
          .get(`/api/v1/price-alerts/${testAlert.id}`)
          .set('Authorization', authHeader);

        expect(checkRes.status).toBe(404);
      });

      it('should prevent deleting other user alert', async () => {
        const otherPassword = await bcrypt.hash('otherpass', PASSWORD.BCRYPT_ROUNDS);
        const otherEmail = 'other@example.com';
        const [otherUser] = await db
          .insert(users)
          .values({
            username: 'otheruser',
            email: otherEmail,
            emailHash: hashEmail(otherEmail),
            passwordHash: otherPassword,
            role: 'user',
          })
          .returning();

        const [otherAlert] = await db
          .insert(priceAlerts)
          .values({
            userId: otherUser.id,
            productId: testProduct.id,
            targetPrice: '49.99',
            isActive: true,
          })
          .returning();

        const res = await request(app)
          .delete(`/api/v1/price-alerts/${otherAlert.id}`)
          .set('Authorization', authHeader);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });
  });

  describe('Notification Write Operations', () => {
    let testNotificationId: number;

    beforeEach(async () => {
      // Create a test notification
      const { createNotification } = await import('../../services/notification-service');
      const notification = await createNotification({
        userId: testUser.id,
        type: 'price_alert_triggered',
        title: 'Price Alert',
        content: 'Product price dropped',
      });
      testNotificationId = notification.id;
    });

    describe('POST /api/v1/notifications/:id/read', () => {
      it('should mark notification as read', async () => {
        const res = await request(app)
          .post(`/api/v1/notifications/${testNotificationId}/read`)
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent notification', async () => {
        const res = await request(app)
          .post('/api/v1/notifications/99999/read')
          .set('Authorization', authHeader);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });

      it('should prevent marking other user notification as read', async () => {
        const otherPassword = await bcrypt.hash('otherpass', PASSWORD.BCRYPT_ROUNDS);
        const otherEmail = 'other@example.com';
        const [otherUser] = await db
          .insert(users)
          .values({
            username: 'otheruser',
            email: otherEmail,
            emailHash: hashEmail(otherEmail),
            passwordHash: otherPassword,
            role: 'user',
          })
          .returning();

        const { createNotification } = await import('../../services/notification-service');
        const otherNotification = await createNotification({
          userId: otherUser.id,
          type: 'price_alert_triggered',
          title: 'Other Alert',
          content: 'Other message',
        });

        const res = await request(app)
          .post(`/api/v1/notifications/${otherNotification.id}/read`)
          .set('Authorization', authHeader);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/notifications/read-all', () => {
      it('should mark all notifications as read', async () => {
        // Create multiple notifications
        const { createNotification } = await import('../../services/notification-service');
        await createNotification({
          userId: testUser.id,
          type: 'price_alert_triggered',
          title: 'Alert 2',
          content: 'Message 2',
        });
        await createNotification({
          userId: testUser.id,
          type: 'price_alert_triggered',
          title: 'Alert 3',
          content: 'Message 3',
        });

        const res = await request(app)
          .post('/api/v1/notifications/read-all')
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.count).toBeGreaterThanOrEqual(3);
      });

      it('should require authentication', async () => {
        const res = await request(app).post('/api/v1/notifications/read-all');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      });
    });
  });

  // =============================================================================
  // PHASE 3: Advanced Features & Admin Endpoints
  // =============================================================================

  describe('API v1 Routes - Phase 3 Advanced Features', () => {
    let _adminUser: { id: number; username: string };
    let adminAuthHeader: string;

    beforeEach(async () => {
      // Create an admin user for admin endpoints
      const hashedPassword = await bcrypt.hash('adminpass123', PASSWORD.BCRYPT_ROUNDS);
      const adminEmail = 'admin@example.com';
      const [admin] = await db
        .insert(users)
        .values({
          username: 'adminuser',
          email: adminEmail,
          emailHash: hashEmail(adminEmail),
          passwordHash: hashedPassword,
          role: 'admin',
        })
        .returning({ id: users.id, username: users.username });
      _adminUser = admin;

      adminAuthHeader = 'Basic ' + Buffer.from('adminuser:adminpass123').toString('base64');
    });

    describe('GET /api/v1 (API Discovery)', () => {
      it('should return API capabilities with Basic Auth', async () => {
        const res = await request(app).get('/api/v1').set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.version).toBe('1.0.0');
        expect(res.body.data.authentication).toBe('HTTP Basic Auth');
        expect(res.body.data.endpoints).toBeDefined();
        expect(res.body.data.endpoints.watchlists).toBeDefined();
        expect(res.body.data.endpoints.priceAlerts).toBeDefined();
        expect(res.body.data.endpoints.products).toBeDefined();
      });

      it('should reject without authentication', async () => {
        const res = await request(app).get('/api/v1');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/openapi.json (OpenAPI Spec)', () => {
      it('should return OpenAPI specification', async () => {
        const res = await request(app).get('/api/v1/openapi.json').set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.openapi).toBe('3.0.3');
        expect(res.body.info.title).toBe('PriceCompare API');
        expect(res.body.components.securitySchemes.basicAuth).toBeDefined();
        expect(res.body.paths).toBeDefined();
      });

      it('should reject without authentication', async () => {
        const res = await request(app).get('/api/v1/openapi.json');

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/v1/search/advanced', () => {
      it('should perform advanced search with Basic Auth', async () => {
        const res = await request(app)
          .get('/api/v1/search/advanced?query=test')
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.results).toBeInstanceOf(Array);
        expect(res.body.data.metadata).toBeDefined();
        expect(res.body.data.metadata.features).toContain('fuzzy_search');
      });

      it('should support price filters', async () => {
        const res = await request(app)
          .get('/api/v1/search/advanced?query=laptop&minPrice=100&maxPrice=1000')
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should reject without authentication', async () => {
        const res = await request(app).get('/api/v1/search/advanced?query=test');

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/v1/search/suggestions', () => {
      it('should return search suggestions', async () => {
        const res = await request(app)
          .get('/api/v1/search/suggestions?q=iph')
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.suggestions).toBeInstanceOf(Array);
      });

      it('should return empty for short queries', async () => {
        const res = await request(app)
          .get('/api/v1/search/suggestions?q=a')
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.suggestions).toEqual([]);
      });

      it('should respect limit parameter', async () => {
        const res = await request(app)
          .get('/api/v1/search/suggestions?q=test&limit=3')
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('GET /api/v1/analytics/user', () => {
      it('should return user analytics', async () => {
        const res = await request(app)
          .get('/api/v1/analytics/user')
          .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.watchlists).toBeDefined();
        expect(res.body.data.alerts).toBeDefined();
        expect(res.body.data.generatedAt).toBeDefined();
      });

      it('should reject without authentication', async () => {
        const res = await request(app).get('/api/v1/analytics/user');

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/v1/admin/system-health (Admin Only)', () => {
      it('should return system health for admin users', async () => {
        const res = await request(app)
          .get('/api/v1/admin/system-health')
          .set('Authorization', adminAuthHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBeDefined();
        expect(res.body.data.timestamp).toBeDefined();
        expect(res.body.data.components).toBeDefined();
        expect(res.body.data.components.database).toBeDefined();
        expect(res.body.data.uptime).toBeDefined();
        expect(res.body.data.memory).toBeDefined();
      });

      it('should reject non-admin users', async () => {
        const res = await request(app)
          .get('/api/v1/admin/system-health')
          .set('Authorization', authHeader);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      });

      it('should reject without authentication', async () => {
        const res = await request(app).get('/api/v1/admin/system-health');

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/v1/admin/stats (Admin Only)', () => {
      it('should return platform stats for admin users', async () => {
        const res = await request(app)
          .get('/api/v1/admin/stats')
          .set('Authorization', adminAuthHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.overview).toBeDefined();
        expect(res.body.data.generatedAt).toBeDefined();
      });

      it('should reject non-admin users', async () => {
        const res = await request(app)
          .get('/api/v1/admin/stats')
          .set('Authorization', authHeader);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      });

      it('should reject without authentication', async () => {
        const res = await request(app).get('/api/v1/admin/stats');

        expect(res.status).toBe(401);
      });
    });
  });
});
