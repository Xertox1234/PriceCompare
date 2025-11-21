import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../db';
import { users, watchLists, productWatches, products, productOffers, priceHistory, retailers } from '@shared/schema';
import { storage } from '../storage';
import { sql, eq } from 'drizzle-orm';

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

      const [list2] = await db.insert(watchLists).values({
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

    it('should validate name is required', async () => {
      await expect(
        storage.createWatchList(testUserId, { name: '' })
      ).rejects.toThrow('Watch list name is required');
    });

    it('should validate name length (1-100 chars)', async () => {
      const longName = 'a'.repeat(101);

      await expect(
        storage.createWatchList(testUserId, { name: longName })
      ).rejects.toThrow('Watch list name must be 100 characters or less');
    });

    it('should trim whitespace from name', async () => {
      const watchList = await storage.createWatchList(testUserId, {
        name: '  My Watch List  ',
      });

      expect(watchList.name).toBe('My Watch List');
    });
  });

  describe('addProductToWatchList', () => {
    let watchListId: number;

    beforeEach(async () => {
      const [list] = await db.insert(watchLists).values({
        userId: testUserId,
        name: 'Test List',
      }).returning();
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
      const watchedProducts = await storage.getWatchedProducts(testUserId);

      expect(watchedProducts.length).toBeGreaterThan(0);

      const product = watchedProducts.find(p => p.productId === testProductId);
      expect(product).toBeDefined();
      expect(product!.productName).toBe('Test Product 1');
      expect(product!.currentPrice).toBeDefined();
      expect(product!.lowestPrice).toBeDefined();
      expect(product!.averagePrice).toBeDefined();
      expect(product!.savingsPotential).toBeDefined();
    });

    it('should support sorting by priceDropPercent', async () => {
      const watchedProducts = await storage.getWatchedProducts(testUserId, {
        sortBy: 'priceDropPercent',
      });

      // Verify sorted in descending order
      for (let i = 0; i < watchedProducts.length - 1; i++) {
        expect(watchedProducts[i].priceDropPercent).toBeGreaterThanOrEqual(
          watchedProducts[i + 1].priceDropPercent
        );
      }
    });

    it('should support sorting by savings', async () => {
      const watchedProducts = await storage.getWatchedProducts(testUserId, {
        sortBy: 'savings',
      });

      // Verify sorted in descending order
      for (let i = 0; i < watchedProducts.length - 1; i++) {
        expect(watchedProducts[i].savingsPotential).toBeGreaterThanOrEqual(
          watchedProducts[i + 1].savingsPotential
        );
      }
    });

    it('should support sorting by dateAdded', async () => {
      const watchedProducts = await storage.getWatchedProducts(testUserId, {
        sortBy: 'dateAdded',
      });

      // Verify sorted by most recent first
      for (let i = 0; i < watchedProducts.length - 1; i++) {
        expect(watchedProducts[i].addedAt.getTime()).toBeGreaterThanOrEqual(
          watchedProducts[i + 1].addedAt.getTime()
        );
      }
    });

    it('should return 7-day sparkline data', async () => {
      const watchedProducts = await storage.getWatchedProducts(testUserId);

      const product = watchedProducts.find(p => p.productId === testProductId);
      expect(product).toBeDefined();
      expect(product!.last7Days).toBeDefined();
      expect(Array.isArray(product!.last7Days)).toBe(true);

      // Should have sparkline data points
      if (product!.last7Days.length > 0) {
        expect(product!.last7Days[0]).toHaveProperty('date');
        expect(product!.last7Days[0]).toHaveProperty('price');
      }
    });

    it('should respect limit option', async () => {
      const watchedProducts = await storage.getWatchedProducts(testUserId, {
        limit: 1,
      });

      expect(watchedProducts).toHaveLength(1);
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
