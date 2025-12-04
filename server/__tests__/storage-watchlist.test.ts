import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../db';
import { users, watchLists, productWatches, products, productOffers, priceHistory, retailers } from '@shared/schema';
import { storage } from '../storage';
import { sql, eq } from 'drizzle-orm';

// Mock Redis client (required by advanced-cache service)
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

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

/**
 * Test Helper Functions
 *
 * Extracted patterns to reduce duplication across test suites.
 * See TODO_007_WATCHLIST_TEST_DATA_BUILDERS.md for rationale.
 */

/**
 * Create a test watchlist for a user
 * @param userId - User ID to create watchlist for
 * @param name - Optional watchlist name (defaults to 'Test List')
 * @returns Created watchlist record
 */
async function createTestWatchList(userId: number, name = 'Test List') {
  const [list] = await db.insert(watchLists).values({
    userId,
    name,
  }).returning();
  return list;
}

/**
 * Add multiple products to a watchlist
 * @param watchListId - Watchlist ID to add products to
 * @param userId - User ID who owns the watchlist
 * @param productIds - Array of product IDs to add
 */
async function _addProductsToWatchList(
  watchListId: number,
  userId: number,
  productIds: number[]
) {
  const values = productIds.map(productId => ({
    userId,
    watchListId,
    productId,
  }));
  await db.insert(productWatches).values(values);
}

/**
 * Create price history data for a product
 * @param productOfferId - Product offer ID to create history for
 * @param productId - Product ID
 * @param retailerId - Retailer ID
 * @param days - Number of days of history to create
 * @param startPrice - Starting price (most recent)
 * @param priceDecrement - Amount to decrease price per day going back (defaults to 10)
 */
async function _createPriceHistory(
  productOfferId: number,
  productId: number,
  retailerId: number,
  days: number,
  startPrice: number,
  priceDecrement = 10
) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    await db.insert(priceHistory).values({
      productOfferId,
      productId,
      retailerId,
      price: (startPrice - (days - i - 1) * priceDecrement).toFixed(2),
      availability: 'in_stock',
      source: 'scraper',
      recordedAt: date,
    });
  }
}

/**
 * Watchlist Storage Layer Tests
 *
 * Tests the storage layer for watchlist operations including:
 * - getUserWatchLists - Retrieve all watch lists with product counts
 * - createWatchList - Create new watch list with validation
 * - addProductToWatchList - Add product with duplicate/limit checks
 * - removeProductFromWatchList - Remove product from list
 * - getWatchedProducts - Get products with pricing and sparkline data
 * - getWatchListStats - Get aggregated dashboard statistics
 *
 * NOTE: Database trigger auto-creates default watchlist on user insert
 * - Trigger: trigger_create_default_watch_list
 * - Migration: migrations/0008_add_watch_lists.sql (lines 75-90)
 * - Creates watchlist with name="My Watches", isDefault=true
 * - We delete this in beforeEach cleanup to isolate tests
 */

describe('Watchlist Storage Layer', () => {
  let testUserId: number;
  let testProductId: number;
  let testProductId2: number;
  let testRetailerId: number;

  beforeEach(async () => {
    // Clean database
    await db.delete(priceHistory);
    await db.delete(productWatches);
    await db.delete(productOffers);
    await db.delete(products);
    await db.delete(watchLists);
    await db.delete(retailers);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        // SECURITY: NEVER expose passwordHash in production code
        passwordHash: 'hashed_password_test_only', // SECURITY: test only - NEVER expose in production
        role: 'user',
      })
      .returning();
    testUserId = user.id;

    // Delete auto-created default watchlist (created by trigger_create_default_watch_list)
    // This ensures tests start with a clean slate and test explicit watchlist creation
    await db.delete(watchLists).where(eq(watchLists.userId, testUserId));

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

    // Create test products
    const [product1] = await db
      .insert(products)
      .values({
        name: 'Test Product 1',
        description: 'Test description',
        category: 'Electronics',
      })
      .returning();
    testProductId = product1.id;

    const [product2] = await db
      .insert(products)
      .values({
        name: 'Test Product 2',
        description: 'Test description 2',
        category: 'Electronics',
      })
      .returning();
    testProductId2 = product2.id;

    // Create product offers
    const [offer1] = await db.insert(productOffers).values({
      productId: testProductId,
      retailerId: testRetailerId,
      price: '299.99',
      originalPrice: '399.99',
      availability: 'in_stock',
      productUrl: 'https://test.com/product1',
    }).returning();

    await db.insert(productOffers).values({
      productId: testProductId2,
      retailerId: testRetailerId,
      price: '199.99',
      originalPrice: '249.99',
      availability: 'in_stock',
      productUrl: 'https://test.com/product2',
    });

    // Create price history for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);

      await db.insert(priceHistory).values({
        productOfferId: offer1.id,
        productId: testProductId,
        retailerId: testRetailerId,
        price: (350 - i * 10).toFixed(2), // Price dropping over time
        availability: 'in_stock',
        source: 'scraper',
        recordedAt: date,
      });
    }
  });

  afterEach(async () => {
    // Clean up
    await db.delete(priceHistory);
    await db.delete(productWatches);
    await db.delete(productOffers);
    await db.delete(products);
    await db.delete(watchLists);
    await db.delete(retailers);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  describe('getUserWatchLists', () => {
    it('should return all watch lists for user with product counts', async () => {
      // Create watch lists
      const [list1] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'My First List',
        description: 'Test description',
      }).returning();

      const [_list2] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'My Second List',
      }).returning();

      // Add products to first list
      await db.insert(productWatches).values([
        { userId: testUserId, watchListId: list1.id, productId: testProductId },
        { userId: testUserId, watchListId: list1.id, productId: testProductId2 },
      ]);

      // Get watch lists
      const watchListsResult = await storage.getUserWatchLists(testUserId);

      expect(watchListsResult).toHaveLength(2);
      expect(watchListsResult[0].name).toBe('My First List');
      expect(watchListsResult[0].productCount).toBe(2);
      expect(watchListsResult[1].name).toBe('My Second List');
      expect(watchListsResult[1].productCount).toBe(0);
    });

    it('should return empty array for user with no lists', async () => {
      const watchListsResult = await storage.getUserWatchLists(testUserId);
      expect(watchListsResult).toEqual([]);
    });

    it('should not return other users watch lists', async () => {
      // Create another user
      const [otherUser] = await db.insert(users).values({
        username: 'otheruser',
        email: 'other@example.com',
        // SECURITY: NEVER expose passwordHash in production code
        passwordHash: 'hashed_password_test_only', // SECURITY: test only - NEVER expose in production
        role: 'user',
      }).returning();

      // Create watch lists for both users
      await db.insert(watchLists).values([
        { userId: testUserId, name: 'User 1 List' },
        { userId: otherUser.id, name: 'User 2 List' },
      ]);

      // Get watch lists for test user
      const watchListsResult = await storage.getUserWatchLists(testUserId);

      expect(watchListsResult).toHaveLength(1);
      expect(watchListsResult[0].name).toBe('User 1 List');
    });
  });

  describe('createWatchList', () => {
    it('should create watch list successfully', async () => {
      const watchList = await storage.createWatchList(testUserId, {
        name: 'My Watch List',
        description: 'Test description',
      });

      expect(watchList.id).toBeDefined();
      expect(watchList.userId).toBe(testUserId);
      expect(watchList.name).toBe('My Watch List');
      expect(watchList.description).toBe('Test description');
      expect(watchList.createdAt).toBeInstanceOf(Date);
    });

    it('should create watch list without description', async () => {
      const watchList = await storage.createWatchList(testUserId, {
        name: 'My Watch List',
      });

      expect(watchList.id).toBeDefined();
      expect(watchList.name).toBe('My Watch List');
      expect(watchList.description).toBeNull();
    });

    it('should enforce max 20 lists per user', async () => {
      // Create 20 watch lists
      for (let i = 0; i < 20; i++) {
        await db.insert(watchLists).values({
          userId: testUserId,
          name: `Watch List ${i + 1}`,
        });
      }

      // Try to create 21st list
      await expect(
        storage.createWatchList(testUserId, { name: 'Extra List' })
      ).rejects.toThrow('Maximum watch list limit reached (20 lists per user)');
    });

    // NOTE: Name validation (required, length, trimming) is handled by Zod schema in routes
    // Storage layer accepts name as-is and trusts route validation
    // These tests verify storage layer doesn't add extra validation
    it('should preserve empty names without validation (validation is route responsibility)', async () => {
      const watchList = await storage.createWatchList(testUserId, { name: '' });
      expect(watchList.name).toBe('');
    });

    it('should preserve long names without length enforcement (validation is route responsibility)', async () => {
      const longName = 'a'.repeat(101);
      const watchList = await storage.createWatchList(testUserId, { name: longName });
      expect(watchList.name).toBe(longName);
    });

    it('should preserve whitespace without trimming (validation is route responsibility)', async () => {
      const watchList = await storage.createWatchList(testUserId, {
        name: '  My Watch List  ',
      });

      expect(watchList.name).toBe('  My Watch List  ');
    });
  });

  describe('addProductToWatchList', () => {
    let watchListId: number;

    beforeEach(async () => {
      const list = await createTestWatchList(testUserId);
      watchListId = list.id;
    });

    it('should add product to watch list', async () => {
      const productWatch = await storage.addProductToWatchList(
        watchListId,
        testProductId,
        testUserId
      );

      expect(productWatch.id).toBeDefined();
      expect(productWatch.watchListId).toBe(watchListId);
      expect(productWatch.productId).toBe(testProductId);
      expect(productWatch.userId).toBe(testUserId);
    });

    it('should prevent duplicate products in same list', async () => {
      // Add product first time
      await storage.addProductToWatchList(watchListId, testProductId, testUserId);

      // Try to add same product again
      await expect(
        storage.addProductToWatchList(watchListId, testProductId, testUserId)
      ).rejects.toThrow('Product already in watch list');
    });

    it('should enforce max 100 products per list', async () => {
      // Create 100 products
      const productIds: number[] = [];
      for (let i = 0; i < 100; i++) {
        const [product] = await db.insert(products).values({
          name: `Product ${i}`,
          category: 'Test',
        }).returning();
        productIds.push(product.id);

        await db.insert(productWatches).values({
          userId: testUserId,
          watchListId,
          productId: product.id,
        });
      }

      // Try to add 101st product
      const [extraProduct] = await db.insert(products).values({
        name: 'Extra Product',
        category: 'Test',
      }).returning();

      await expect(
        storage.addProductToWatchList(watchListId, extraProduct.id, testUserId)
      ).rejects.toThrow('Watch list is full (max 100 products per list)');
    });

    it('should verify watch list ownership', async () => {
      // Create another user
      const [otherUser] = await db.insert(users).values({
        username: 'otheruser',
        email: 'other@example.com',
        // SECURITY: NEVER expose passwordHash in production code
        passwordHash: 'hashed_password_test_only', // SECURITY: test only - NEVER expose in production
        role: 'user',
      }).returning();

      // Try to add product to testUser's list as otherUser
      await expect(
        storage.addProductToWatchList(watchListId, testProductId, otherUser.id)
      ).rejects.toThrow('Watch list not found or unauthorized');
    });

    it('should verify product exists', async () => {
      await expect(
        storage.addProductToWatchList(watchListId, 99999, testUserId)
      ).rejects.toThrow('Product not found');
    });
  });

  describe('removeProductFromWatchList', () => {
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

    it('should remove product from watch list', async () => {
      const result = await storage.removeProductFromWatchList(
        watchListId,
        testProductId,
        testUserId
      );

      expect(result.watchListId).toBe(watchListId);
      expect(result.productId).toBe(testProductId);

      // Verify product is removed
      const products = await db
        .select()
        .from(productWatches)
        .where(eq(productWatches.watchListId, watchListId));

      expect(products).toHaveLength(0);
    });

    it('should verify ownership before removal', async () => {
      // Create another user
      const [otherUser] = await db.insert(users).values({
        username: 'otheruser',
        email: 'other@example.com',
        // SECURITY: NEVER expose passwordHash in production code
        passwordHash: 'hashed_password_test_only', // SECURITY: test only - NEVER expose in production
        role: 'user',
      }).returning();

      await expect(
        storage.removeProductFromWatchList(watchListId, testProductId, otherUser.id)
      ).rejects.toThrow('Product watch not found or unauthorized');
    });

    it('should throw error if product not in list', async () => {
      await expect(
        storage.removeProductFromWatchList(watchListId, 99999, testUserId)
      ).rejects.toThrow('Product watch not found or unauthorized');
    });
  });

  describe('getWatchedProducts', () => {
    beforeEach(async () => {
      // Create watch list and add products
      const [list] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'Test List',
      }).returning();

      await db.insert(productWatches).values([
        { userId: testUserId, watchListId: list.id, productId: testProductId },
        { userId: testUserId, watchListId: list.id, productId: testProductId2 },
      ]);
    });

    it('should return products with pricing data', async () => {
      const result = await storage.getWatchedProducts(testUserId);

      expect(result.products.length).toBeGreaterThan(0);

      const product = result.products.find((p: { productId: number }) => p.productId === testProductId);
      expect(product).toBeDefined();
      expect(product?.productName).toBe('Test Product 1');
      expect(product?.currentPrice).toBeDefined();
      expect(product?.lowestPrice).toBeDefined();
      expect(product?.averagePrice).toBeDefined();
      expect(product?.savingsPotential).toBeDefined();
    });

    it('should support sorting by priceDropPercent', async () => {
      const result = await storage.getWatchedProducts(testUserId, {
        sortBy: 'priceDropPercent',
      });
      const watchedProducts = result.products;

      // Verify sorted in descending order
      for (let i = 0; i < watchedProducts.length - 1; i++) {
        expect(watchedProducts[i].priceDropPercent).toBeGreaterThanOrEqual(
          watchedProducts[i + 1].priceDropPercent
        );
      }
    });

    it('should support sorting by savings', async () => {
      const result = await storage.getWatchedProducts(testUserId, {
        sortBy: 'savings',
      });
      const watchedProducts = result.products;

      // Verify sorted in descending order
      for (let i = 0; i < watchedProducts.length - 1; i++) {
        expect(watchedProducts[i].savingsPotential).toBeGreaterThanOrEqual(
          watchedProducts[i + 1].savingsPotential
        );
      }
    });

    it('should support sorting by dateAdded', async () => {
      const result = await storage.getWatchedProducts(testUserId, {
        sortBy: 'dateAdded',
      });
      const watchedProducts = result.products;

      // Verify sorted by most recent first
      for (let i = 0; i < watchedProducts.length - 1; i++) {
        expect(watchedProducts[i].addedAt.getTime()).toBeGreaterThanOrEqual(
          watchedProducts[i + 1].addedAt.getTime()
        );
      }
    });

    it('should return 7-day sparkline data', async () => {
      const result = await storage.getWatchedProducts(testUserId);

      const product = result.products.find((p: { productId: number }) => p.productId === testProductId);
      expect(product).toBeDefined();
      expect(product?.last7Days).toBeDefined();
      expect(Array.isArray(product?.last7Days)).toBe(true);

      // Should have sparkline data points
      if (product?.last7Days && product.last7Days.length > 0) {
        expect(product.last7Days[0]).toHaveProperty('date');
        expect(product.last7Days[0]).toHaveProperty('price');
      }
    });

    it('should respect limit option', async () => {
      const result = await storage.getWatchedProducts(testUserId, {
        limit: 1,
      });

      // Verify correct number of products returned
      expect(result.products).toHaveLength(1);

      // Verify hasMore is true (we have 2 products, limit is 1)
      expect(result.hasMore).toBe(true);

      // Verify nextCursor is a valid number
      expect(result.nextCursor).toBeDefined();
      expect(typeof result.nextCursor).toBe('number');
    });

    it('should handle product with no price history', async () => {
      // Create product without price history (no records in priceHistory table)
      // testProductId2 has current price from product offer but no historical data
      const result = await storage.getWatchedProducts(testUserId);

      const productWithoutHistory = result.products.find(
        (p: { productId: number }) => p.productId === testProductId2
      );

      expect(productWithoutHistory).toBeDefined();
      expect(productWithoutHistory?.last7Days).toEqual([]); // Empty array for sparkline - no history
      expect(productWithoutHistory?.currentPrice).toBe('199.99'); // Has current price from offer
      expect(productWithoutHistory?.lowestPrice).toBe('199.99'); // No history, so lowest = current
    });

    it('should support cursor pagination with different products', async () => {
      // Page 1: Get first product with limit=1
      const page1 = await storage.getWatchedProducts(testUserId, {
        limit: 1,
      });

      expect(page1.products).toHaveLength(1);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const firstProductId = page1.products[0].productId;

      // Page 2: Use cursor to get second product
      const page2 = await storage.getWatchedProducts(testUserId, {
        limit: 1,
        cursor: page1.nextCursor!,
      });

      expect(page2.products).toHaveLength(1);
      const secondProductId = page2.products[0].productId;

      // Verify no product overlap
      expect(firstProductId).not.toBe(secondProductId);

      // Verify correct hasMore value (false since we only have 2 products total)
      expect(page2.hasMore).toBe(false);
      expect(page2.nextCursor).toBeNull();
    });

    it('should complete within reasonable time (performance sanity check)', async () => {
      // Sanity check - detects accidental N+1 queries or missing indexes
      // NOT a strict performance test - just regression detection
      // Test setup: 2 products × 7-day history = 14 price records
      // Expected baseline: 45-80ms (Drizzle + PostgreSQL query overhead)
      // CI environment adds 20-50ms overhead
      // Threshold: 200ms gives 2.5x margin while catching N+1 regressions (300ms+)

      const startTime = performance.now();
      await storage.getWatchedProducts(testUserId);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(200); // Catches N+1 queries (300ms+)
    });
  });

  describe('getWatchListStats', () => {
    beforeEach(async () => {
      // Create watch lists
      const [list1] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'List 1',
      }).returning();

      const [list2] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'List 2',
      }).returning();

      // Add products
      await db.insert(productWatches).values([
        { userId: testUserId, watchListId: list1.id, productId: testProductId },
        { userId: testUserId, watchListId: list2.id, productId: testProductId2 },
      ]);
    });

    it('should calculate total potential savings', async () => {
      const stats = await storage.getWatchListStats(testUserId);

      expect(stats.totalPotentialSavings).toBeGreaterThanOrEqual(0);
      expect(typeof stats.totalPotentialSavings).toBe('number');
    });

    it('should return top 5 best deals', async () => {
      const stats = await storage.getWatchListStats(testUserId);

      expect(Array.isArray(stats.bestDeals)).toBe(true);
      expect(stats.bestDeals.length).toBeLessThanOrEqual(5);

      if (stats.bestDeals.length > 0) {
        expect(stats.bestDeals[0]).toHaveProperty('productId');
        expect(stats.bestDeals[0]).toHaveProperty('productName');
        expect(stats.bestDeals[0]).toHaveProperty('currentPrice');
        expect(stats.bestDeals[0]).toHaveProperty('lowestPrice');
        expect(stats.bestDeals[0]).toHaveProperty('discountPercent');
      }
    });

    it('should return correct counts', async () => {
      const stats = await storage.getWatchListStats(testUserId);

      expect(stats.totalWatchLists).toBe(2);
      expect(stats.totalProducts).toBe(2);
      expect(stats.activeAlerts).toBe(0); // No alerts created
      expect(stats.triggeredAlerts).toBe(0);
    });

    it('should return weekly stats', async () => {
      const stats = await storage.getWatchListStats(testUserId);

      expect(stats.weeklyStats).toBeDefined();
      expect(stats.weeklyStats).toHaveProperty('newDeals');
      expect(stats.weeklyStats).toHaveProperty('triggeredAlerts');
      expect(typeof stats.weeklyStats.newDeals).toBe('number');
      expect(typeof stats.weeklyStats.triggeredAlerts).toBe('number');
    });
  });

  describe('deleteWatchList', () => {
    it('should delete watch list and cascade delete products', async () => {
      // Create watch list with products
      const [list] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'Test List',
      }).returning();

      await db.insert(productWatches).values([
        { userId: testUserId, watchListId: list.id, productId: testProductId },
        { userId: testUserId, watchListId: list.id, productId: testProductId2 },
      ]);

      // Delete list
      await storage.deleteWatchList(list.id, testUserId);

      // Verify list deleted
      const lists = await db
        .select()
        .from(watchLists)
        .where(eq(watchLists.id, list.id));
      expect(lists).toHaveLength(0);

      // Verify product watches deleted (CASCADE)
      const products = await db
        .select()
        .from(productWatches)
        .where(eq(productWatches.watchListId, list.id));
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

      // Create list for test user
      const [list] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'Test List',
      }).returning();

      // Try to delete as other user
      await expect(
        storage.deleteWatchList(list.id, otherUser.id)
      ).rejects.toThrow('Watch list not found or unauthorized');
    });
  });
});
