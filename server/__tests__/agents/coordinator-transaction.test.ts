/**
 * Coordinator Agent - Transaction Atomicity Tests
 *
 * Tests the atomic product creation + trending product linking operation
 * to ensure both operations succeed together or roll back together.
 *
 * Related: TODO 004 - Add Transaction Boundaries to Multi-Step Database Operations
 */

import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../../db';
import { products, trendingProducts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../../storage';
import type { InsertProduct, InsertTrendingProduct } from '@shared/schema';

describe('Coordinator Agent - Transaction Atomicity', () => {
  // Clean up test data before each test
  beforeEach(async () => {
    // Delete test products and trending products
    await db.delete(products).where(eq(products.category, 'TransactionTest'));
    await db.delete(trendingProducts).where(eq(trendingProducts.category, 'TransactionTest'));
  });

  // Close database connection after all tests
  afterAll(async () => {
    await db.delete(products).where(eq(products.category, 'TransactionTest'));
    await db.delete(trendingProducts).where(eq(trendingProducts.category, 'TransactionTest'));
  });

  /**
   * Helper: Create a test trending product
   */
  async function createTestTrendingProduct(
    overrides: Partial<InsertTrendingProduct> = {}
  ): Promise<number> {
    const trendProduct: InsertTrendingProduct = {
      name: 'Test Trending Product',
      category: 'TransactionTest',
      source: 'test',
      trendScore: 85,
      status: 'discovered',
      ...overrides,
    };

    const [created] = await db.insert(trendingProducts).values(trendProduct).returning();
    return created.id;
  }

  test('creates product and links to trending product atomically', async () => {
    const trendProductId = await createTestTrendingProduct({
      name: 'Atomic Test Product',
      status: 'discovered',
    });

    const productData: InsertProduct = {
      name: 'Atomic Test Product',
      category: 'TransactionTest',
      description: 'Test product for atomic operation',
    };

    // Execute atomic operation
    await db.transaction(async (tx) => {
      const product = await storage.createProduct(productData, tx);
      await storage.updateTrendingProduct(
        trendProductId,
        { productId: product.id, status: 'scraped' },
        tx
      );
    });

    // Verify both operations succeeded
    const updatedTrending = await db
      .select()
      .from(trendingProducts)
      .where(eq(trendingProducts.id, trendProductId));

    expect(updatedTrending).toHaveLength(1);
    expect(updatedTrending[0].status).toBe('scraped');
    expect(updatedTrending[0].productId).toBeDefined();
    expect(updatedTrending[0].productId).not.toBeNull();

    // Verify product was created
    const createdProduct = await db
      .select()
      .from(products)
      .where(eq(products.id, updatedTrending[0].productId!));

    expect(createdProduct).toHaveLength(1);
    expect(createdProduct[0].name).toBe('Atomic Test Product');
  });

  test('rolls back product creation if trending update fails', async () => {
    const nonExistentTrendingId = 999999999; // ID that doesn't exist

    const productData: InsertProduct = {
      name: 'Test Rollback Product',
      category: 'TransactionTest',
      description: 'This product should not be created',
    };

    // Transaction should fail and rollback
    await expect(
      db.transaction(async (tx) => {
        const product = await storage.createProduct(productData, tx);

        // This will fail (trending product doesn't exist)
        await storage.updateTrendingProduct(
          nonExistentTrendingId,
          { productId: product.id, status: 'scraped' },
          tx
        );
      })
    ).rejects.toThrow();

    // Verify product was NOT created (rollback succeeded)
    const allProducts = await db
      .select()
      .from(products)
      .where(eq(products.name, 'Test Rollback Product'));

    expect(allProducts).toHaveLength(0);
  });

  test('handles null product data gracefully in transaction', async () => {
    const trendProductId = await createTestTrendingProduct({
      name: 'Null Test Product',
      status: 'discovered',
    });

    // Product data with null name (violates NOT NULL constraint)
    const invalidProductData = {
      name: null as unknown as string, // Force null to test constraint
      category: 'TransactionTest',
    };

    await expect(
      db.transaction(async (tx) => {
        const product = await storage.createProduct(invalidProductData, tx);
        await storage.updateTrendingProduct(
          trendProductId,
          { productId: product.id, status: 'scraped' },
          tx
        );
      })
    ).rejects.toThrow();

    // Verify trending product state unchanged
    const unchanged = await db
      .select()
      .from(trendingProducts)
      .where(eq(trendingProducts.id, trendProductId));

    expect(unchanged).toHaveLength(1);
    expect(unchanged[0].status).toBe('discovered');
    expect(unchanged[0].productId).toBeNull();
  });

  test('independent transactions do not interfere', async () => {
    // Create two trending products
    const trend1 = await createTestTrendingProduct({ name: 'Product 1' });
    const trend2 = await createTestTrendingProduct({ name: 'Product 2' });

    // Execute two separate transactions
    await db.transaction(async (tx) => {
      const product1 = await storage.createProduct(
        { name: 'Product 1', category: 'TransactionTest' },
        tx
      );
      await storage.updateTrendingProduct(
        trend1,
        { productId: product1.id, status: 'scraped' },
        tx
      );
    });

    await db.transaction(async (tx) => {
      const product2 = await storage.createProduct(
        { name: 'Product 2', category: 'TransactionTest' },
        tx
      );
      await storage.updateTrendingProduct(
        trend2,
        { productId: product2.id, status: 'scraped' },
        tx
      );
    });

    // Verify both transactions succeeded independently
    const result1 = await db
      .select()
      .from(trendingProducts)
      .where(eq(trendingProducts.id, trend1));
    const result2 = await db
      .select()
      .from(trendingProducts)
      .where(eq(trendingProducts.id, trend2));

    expect(result1[0].status).toBe('scraped');
    expect(result1[0].productId).toBeDefined();
    expect(result2[0].status).toBe('scraped');
    expect(result2[0].productId).toBeDefined();
    expect(result1[0].productId).not.toBe(result2[0].productId); // Different products
  });

  test('transaction with multiple updates commits all or none', async () => {
    const trend1 = await createTestTrendingProduct({ name: 'Multi 1', status: 'discovered' });
    const trend2 = await createTestTrendingProduct({ name: 'Multi 2', status: 'discovered' });

    await db.transaction(async (tx) => {
      const product = await storage.createProduct(
        { name: 'Shared Product', category: 'TransactionTest' },
        tx
      );

      // Update both trending products to reference same product
      await storage.updateTrendingProduct(trend1, { productId: product.id, status: 'scraped' }, tx);
      await storage.updateTrendingProduct(trend2, { productId: product.id, status: 'scraped' }, tx);
    });

    // Verify all updates committed
    const results = await db
      .select()
      .from(trendingProducts)
      .where(eq(trendingProducts.category, 'TransactionTest'));

    const updated = results.filter((r) => r.status === 'scraped');
    expect(updated).toHaveLength(2);
    expect(updated[0].productId).toBe(updated[1].productId); // Same product
  });
});
