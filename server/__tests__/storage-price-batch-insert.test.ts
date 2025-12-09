// Mock Redis and logger FIRST - must be before imports that use them
import './helpers/mock-redis';
import './helpers/mock-logger';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db';
import { products, productOffers, priceHistory, retailers, users } from '@shared/schema';
import { storage } from '../storage';
import { sql, gte } from 'drizzle-orm';
import type { InsertPriceHistoryWithRecordedAt } from '../storage/types';
import {
  cleanupTestData,
  createTestProduct,
  createTestRetailer,
  createTestProductOffer,
} from './helpers/test-fixtures';

describe('PriceStorage.insertPriceHistoryBatch', () => {
  let testRetailer: typeof retailers.$inferSelect;
  let testProduct: typeof products.$inferSelect;
  let testOffer1: typeof productOffers.$inferSelect;
  let testOffer2: typeof productOffers.$inferSelect;

  beforeEach(async () => {
    // Clean up test data using TRUNCATE CASCADE pattern
    await cleanupTestData(db, [
      'price_history',
      'product_offers',
      'products',
      'retailers',
      'users',
    ]);

    // Create test user (no need to store reference)
    await db.insert(users).values({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hash', // SECURITY: Test data only, never exposed in queries
      role: 'user',
    });

    // Create test retailer using fixture
    const retailerData = createTestRetailer({
      name: 'Test Retailer',
      website: 'https://example.com',
    });
    [testRetailer] = await db.insert(retailers).values(retailerData).returning();

    // Create test product using fixture
    const productData = createTestProduct({
      name: 'Test Product',
      description: 'Test Description',
    });
    [testProduct] = await db.insert(products).values(productData).returning();

    // Create test offers using fixture
    const offer1Data = createTestProductOffer({
      productId: testProduct.id,
      retailerId: testRetailer.id,
      price: '99.99',
      productUrl: 'https://example.com/product1',
      availability: 'in_stock',
    });
    [testOffer1] = await db.insert(productOffers).values(offer1Data).returning();

    const offer2Data = createTestProductOffer({
      productId: testProduct.id,
      retailerId: testRetailer.id,
      price: '89.99',
      productUrl: 'https://example.com/product2',
      availability: 'in_stock',
    });
    [testOffer2] = await db.insert(productOffers).values(offer2Data).returning();
  });

  afterEach(async () => {
    // Clean up test data using TRUNCATE CASCADE pattern
    await cleanupTestData(db, [
      'price_history',
      'product_offers',
      'products',
      'retailers',
      'users',
    ]);
  });

  it('should insert multiple price history records in a single batch', async () => {
    const now = new Date();
    const records: InsertPriceHistoryWithRecordedAt[] = [
      {
        productOfferId: testOffer1.id,
        productId: testProduct.id,
        retailerId: testRetailer.id,
        price: '99.99',
        originalPrice: null,
        availability: 'in_stock',
        rating: null,
        reviewCount: null,
        source: 'snapshot',
        confidence: '1.00',
        metadata: null,
        recordedAt: now,
      },
      {
        productOfferId: testOffer2.id,
        productId: testProduct.id,
        retailerId: testRetailer.id,
        price: '89.99',
        originalPrice: null,
        availability: 'in_stock',
        rating: null,
        reviewCount: null,
        source: 'snapshot',
        confidence: '1.00',
        metadata: null,
        recordedAt: now,
      },
    ];

    // Execute batch insert
    await storage.insertPriceHistoryBatch(records);

    // Verify both records were inserted
    const result = await db
      .select({ count: sql<string>`count(*)` })
      .from(priceHistory)
      .where(gte(priceHistory.recordedAt, now));

    expect(result[0].count).toBe('2');

    // Verify data integrity - check actual records
    const insertedRecords = await db
      .select()
      .from(priceHistory)
      .where(gte(priceHistory.recordedAt, now));

    expect(insertedRecords).toHaveLength(2);
    expect(insertedRecords[0].price).toBe('99.99');
    expect(insertedRecords[1].price).toBe('89.99');
    expect(insertedRecords[0].source).toBe('snapshot');
    expect(insertedRecords[1].source).toBe('snapshot');
  });

  it('should handle empty array without database call', async () => {
    // Get initial count
    const beforeResult = await db.select({ count: sql<string>`count(*)` }).from(priceHistory);
    const beforeCount = beforeResult[0].count;

    // Call with empty array
    await storage.insertPriceHistoryBatch([]);

    // Verify no records were inserted
    const afterResult = await db.select({ count: sql<string>`count(*)` }).from(priceHistory);
    const afterCount = afterResult[0].count;

    expect(afterCount).toBe(beforeCount);
  });

  it('should maintain atomicity - all records inserted or all fail', async () => {
    const now = new Date();
    const records: InsertPriceHistoryWithRecordedAt[] = [
      {
        productOfferId: testOffer1.id,
        productId: testProduct.id,
        retailerId: testRetailer.id,
        price: '99.99',
        originalPrice: null,
        availability: 'in_stock',
        rating: null,
        reviewCount: null,
        source: 'snapshot',
        confidence: '1.00',
        metadata: null,
        recordedAt: now,
      },
      {
        // Invalid: non-existent productOfferId should violate foreign key constraint
        productOfferId: 999999,
        productId: testProduct.id,
        retailerId: testRetailer.id,
        price: '89.99',
        originalPrice: null,
        availability: 'in_stock',
        rating: null,
        reviewCount: null,
        source: 'snapshot',
        confidence: '1.00',
        metadata: null,
        recordedAt: now,
      },
    ];

    // Get count before operation
    const beforeResult = await db.select({ count: sql<string>`count(*)` }).from(priceHistory);
    const beforeCount = beforeResult[0].count;

    // Attempt batch insert - should fail due to foreign key constraint
    await expect(storage.insertPriceHistoryBatch(records)).rejects.toThrow();

    // Verify NO records were inserted (atomicity)
    const afterResult = await db.select({ count: sql<string>`count(*)` }).from(priceHistory);
    const afterCount = afterResult[0].count;

    expect(afterCount).toBe(beforeCount);
  });

  it('should handle large batches efficiently (500 records)', async () => {
    const now = new Date();

    // Create 500 test records
    const records: InsertPriceHistoryWithRecordedAt[] = Array.from({ length: 500 }, (_, i) => ({
      productOfferId: testOffer1.id,
      productId: testProduct.id,
      retailerId: testRetailer.id,
      price: (99.99 - i * 0.01).toFixed(2), // Slight price variation
      originalPrice: null,
      availability: 'in_stock',
      rating: null,
      reviewCount: null,
      source: 'snapshot' as const,
      confidence: '1.00',
      metadata: null,
      recordedAt: new Date(now.getTime() + i * 1000), // Stagger timestamps
    }));

    const startTime = Date.now();
    await storage.insertPriceHistoryBatch(records);
    const duration = Date.now() - startTime;

    // Verify all 500 records inserted
    const result = await db
      .select({ count: sql<string>`count(*)` })
      .from(priceHistory)
      .where(gte(priceHistory.recordedAt, now));

    expect(result[0].count).toBe('500');

    // Performance assertion: 500 records should complete in < 100ms
    // (Target from TODO: 50ms, but allow buffer for CI/test environment)
    expect(duration).toBeLessThan(100);
  });

  it('should preserve all field values correctly', async () => {
    const now = new Date();
    const record: InsertPriceHistoryWithRecordedAt = {
      productOfferId: testOffer1.id,
      productId: testProduct.id,
      retailerId: testRetailer.id,
      price: '129.99',
      originalPrice: '149.99',
      availability: 'limited_stock',
      rating: '4.5',
      reviewCount: 42,
      source: 'scraper',
      confidence: '0.95',
      metadata: JSON.stringify({ scrapedAt: now.toISOString(), userAgent: 'test' }),
      recordedAt: now,
    };

    await storage.insertPriceHistoryBatch([record]);

    // Verify all fields preserved
    const [inserted] = await db
      .select()
      .from(priceHistory)
      .where(gte(priceHistory.recordedAt, now));

    expect(inserted.productOfferId).toBe(testOffer1.id);
    expect(inserted.productId).toBe(testProduct.id);
    expect(inserted.retailerId).toBe(testRetailer.id);
    expect(inserted.price).toBe('129.99');
    expect(inserted.originalPrice).toBe('149.99');
    expect(inserted.availability).toBe('limited_stock');
    expect(inserted.rating).toBe('4.5');
    expect(inserted.reviewCount).toBe(42);
    expect(inserted.source).toBe('scraper');
    expect(inserted.confidence).toBe('0.95');
    // Metadata may be returned as string from JSONB column - parse if needed
    const metadata = typeof inserted.metadata === 'string' 
      ? JSON.parse(inserted.metadata) 
      : inserted.metadata;
    expect(metadata).toEqual({ scrapedAt: now.toISOString(), userAgent: 'test' });
  });

  it('should handle batch with different product offers', async () => {
    const now = new Date();

    // Create additional offers for variety
    const [offer3] = await db
      .insert(productOffers)
      .values({
        productId: testProduct.id,
        retailerId: testRetailer.id,
        price: '79.99',
        productUrl: 'https://example.com/product3',
        availability: 'in_stock',
      })
      .returning();

    const records: InsertPriceHistoryWithRecordedAt[] = [
      {
        productOfferId: testOffer1.id,
        productId: testProduct.id,
        retailerId: testRetailer.id,
        price: '99.99',
        originalPrice: null,
        availability: 'in_stock',
        rating: null,
        reviewCount: null,
        source: 'snapshot',
        confidence: '1.00',
        metadata: null,
        recordedAt: now,
      },
      {
        productOfferId: testOffer2.id,
        productId: testProduct.id,
        retailerId: testRetailer.id,
        price: '89.99',
        originalPrice: null,
        availability: 'in_stock',
        rating: null,
        reviewCount: null,
        source: 'snapshot',
        confidence: '1.00',
        metadata: null,
        recordedAt: now,
      },
      {
        productOfferId: offer3.id,
        productId: testProduct.id,
        retailerId: testRetailer.id,
        price: '79.99',
        originalPrice: null,
        availability: 'in_stock',
        rating: null,
        reviewCount: null,
        source: 'snapshot',
        confidence: '1.00',
        metadata: null,
        recordedAt: now,
      },
    ];

    await storage.insertPriceHistoryBatch(records);

    // Verify all three offers have history
    const offer1History = await db
      .select()
      .from(priceHistory)
      .where(sql`${priceHistory.productOfferId} = ${testOffer1.id}`);

    const offer2History = await db
      .select()
      .from(priceHistory)
      .where(sql`${priceHistory.productOfferId} = ${testOffer2.id}`);

    const offer3History = await db
      .select()
      .from(priceHistory)
      .where(sql`${priceHistory.productOfferId} = ${offer3.id}`);

    expect(offer1History).toHaveLength(1);
    expect(offer2History).toHaveLength(1);
    expect(offer3History).toHaveLength(1);
  });
});
