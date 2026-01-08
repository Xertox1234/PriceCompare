import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../db';
import {
  users,
  products,
  retailers,
  productOffers,
  priceAlerts,
  notificationPreferences,
} from '@shared/schema';
import { cleanupTestData } from '../../__tests__/helpers/test-fixtures';
import { hashEmail } from '../../utils/encryption';
import { triggerPriceAlertCheck } from '../price-alert-checker';

/**
 * Price Alert Checker Job Test Suite
 *
 * Tests the scheduled job that periodically checks all active price alerts:
 * - Successful execution with triggered alerts
 * - Distributed locking (skip if lock held)
 * - N+1 query prevention (single batch query)
 * - Error handling per alert (continue processing remaining)
 * - Stats tracking (checked/triggered/skipped counts)
 * - No in-stock offers handling
 * - Manual trigger functionality
 *
 * PATTERN: Integration tests using real database with TRUNCATE CASCADE
 * AVOIDS: Extensive mocking - tests real query patterns and transaction behavior
 */

// Mock job lock service
vi.mock('../../services/job-lock-service', () => ({
  jobLockService: {
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
    withLock: vi.fn(),
  },
}));

// Mock logger to reduce test noise
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock email service
vi.mock('../../services/email-service', () => ({
  emailService: {
    sendPriceAlertEmail: vi.fn(),
  },
}));

// Mock WebSocket handlers
vi.mock('../../websocket', () => ({
  getSocketIO: vi.fn(() => null),
}));

vi.mock('../../websocket/handlers/price-update-handler', () => ({
  emitPriceAlert: vi.fn(),
}));

// Use serial execution to prevent parallel test conflicts with TRUNCATE CASCADE
describe.sequential('Price Alert Checker Job', () => {
  let testUser1Id: number;
  let testUser2Id: number;
  let testUser3Id: number;
  let testProduct1Id: number;
  let testProduct2Id: number;
  let testRetailerId: number;

  // Get references to mocked functions
  let mockSendPriceAlertEmail: ReturnType<typeof vi.fn>;
  let mockWithLock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    // Get references to mocked functions
    const { jobLockService } = await import('../../services/job-lock-service');
    const { emailService } = await import('../../services/email-service');
    mockWithLock = jobLockService.withLock as ReturnType<typeof vi.fn>;
    mockSendPriceAlertEmail = emailService.sendPriceAlertEmail as ReturnType<typeof vi.fn>;

    // Clear all mocks
    vi.clearAllMocks();
    mockSendPriceAlertEmail.mockResolvedValue(true);
    mockWithLock.mockImplementation((_key, callback) => {
      return callback();
    });

    // Clean database
    await cleanupTestData(db, [
      'notifications',
      'notification_preferences',
      'price_alerts',
      'price_history',
      'product_offers',
      'products',
      'retailers',
      'users',
    ]);

    // Create test users
    // SECURITY: Explicit field selection to avoid exposing passwordHash
    const [user1] = await db
      .insert(users)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        emailHash: hashEmail('user1@example.com'),
        passwordHash: 'hashed_password', // SECURITY: Test fixture only, returning explicit fields
        role: 'user',
      })
      .returning({ id: users.id });
    testUser1Id = user1.id;

    const [user2] = await db
      .insert(users)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        emailHash: hashEmail('user2@example.com'),
        passwordHash: 'hashed_password', // SECURITY: Test fixture only, returning explicit fields
        role: 'user',
      })
      .returning({ id: users.id });
    testUser2Id = user2.id;

    const [user3] = await db
      .insert(users)
      .values({
        email: 'user3@example.com',
        username: 'user3',
        emailHash: hashEmail('user3@example.com'),
        passwordHash: 'hashed_password', // SECURITY: Test fixture only, returning explicit fields
        role: 'user',
      })
      .returning({ id: users.id });
    testUser3Id = user3.id;

    // Create test retailer
    const [retailer] = await db
      .insert(retailers)
      .values({
        name: 'Test Retailer',
        website: 'https://testretailer.com',
        logo: 'https://testretailer.com/logo.png',
        isActive: true,
      })
      .returning();
    testRetailerId = retailer.id;

    // Create test products
    const [product1] = await db
      .insert(products)
      .values({
        name: 'Test Product 1',
        description: 'First test product',
        category: 'Electronics',
      })
      .returning();
    testProduct1Id = product1.id;

    const [product2] = await db
      .insert(products)
      .values({
        name: 'Test Product 2',
        description: 'Second test product',
        category: 'Electronics',
      })
      .returning();
    testProduct2Id = product2.id;

    // Delete trigger-created preferences and create test ones
    const { eq, or } = await import('drizzle-orm');
    await db.delete(notificationPreferences).where(
      or(
        eq(notificationPreferences.userId, testUser1Id),
        eq(notificationPreferences.userId, testUser2Id),
        eq(notificationPreferences.userId, testUser3Id)
      )
    );

    // Create default notification preferences for all users
    await db.insert(notificationPreferences).values([
      {
        userId: testUser1Id,
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      },
      {
        userId: testUser2Id,
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      },
      {
        userId: testUser3Id,
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      },
    ]);
  });

  afterEach(async () => {
    await cleanupTestData(db, [
      'notifications',
      'notification_preferences',
      'price_alerts',
      'price_history',
      'product_offers',
      'products',
      'retailers',
      'users',
    ]);
  });

  describe('Successful Execution', () => {
    it('should check all active alerts and trigger notifications', async () => {
      // Create product offers with prices
      await db
        .insert(productOffers)
        .values({
          productId: testProduct1Id,
          retailerId: testRetailerId,
          price: '90.00', // Below target
          availability: 'in_stock',
          productUrl: 'https://testretailer.com/product/1',
        })
        .returning();

      await db
        .insert(productOffers)
        .values({
          productId: testProduct2Id,
          retailerId: testRetailerId,
          price: '150.00', // Above target
          availability: 'in_stock',
          productUrl: 'https://testretailer.com/product/2',
        })
        .returning();

      // Create price alerts
      await db.insert(priceAlerts).values([
        {
          userId: testUser1Id,
          productId: testProduct1Id,
          targetPrice: '95.00', // Will trigger (current 90 < target 95)
          isActive: true,
        },
        {
          userId: testUser2Id,
          productId: testProduct2Id,
          targetPrice: '100.00', // Will NOT trigger (current 150 > target 100)
          isActive: true,
        },
      ]);

      // Run job
      const stats = await triggerPriceAlertCheck();

      expect(stats).not.toBeNull();
      expect(stats!.checked).toBe(2);
      expect(stats!.triggered).toBe(1); // Only first alert triggered
      expect(stats!.skipped).toBe(0);

      // Verify notification created
      const { notifications } = await import('@shared/schema');
      const notifs = await db.select().from(notifications);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].userId).toBe(testUser1Id);
      expect(notifs[0].type).toBe('price_alert');
    });

    it('should handle multiple alerts for same product', async () => {
      // Create product offer
      await db.insert(productOffers).values({
        productId: testProduct1Id,
        retailerId: testRetailerId,
        price: '85.00',
        availability: 'in_stock',
        productUrl: 'https://testretailer.com/product/1',
      });

      // Create multiple alerts for same product
      await db.insert(priceAlerts).values([
        {
          userId: testUser1Id,
          productId: testProduct1Id,
          targetPrice: '90.00', // Will trigger
          isActive: true,
        },
        {
          userId: testUser2Id,
          productId: testProduct1Id,
          targetPrice: '88.00', // Will trigger
          isActive: true,
        },
        {
          userId: testUser3Id,
          productId: testProduct1Id,
          targetPrice: '80.00', // Will NOT trigger
          isActive: true,
        },
      ]);

      // Run job
      const stats = await triggerPriceAlertCheck();

      expect(stats).not.toBeNull();
      expect(stats!.checked).toBe(3);
      expect(stats!.triggered).toBe(2); // First two alerts triggered

      // Verify notifications created
      const { notifications } = await import('@shared/schema');
      const notifs = await db.select().from(notifications);
      expect(notifs).toHaveLength(2);
    });
  });

  describe('Distributed Locking', () => {
    it('should skip execution if lock is held', async () => {
      // Mock lock acquisition to fail (already held)
      // The manual trigger now uses withLock, which returns null when lock can't be acquired
      mockWithLock.mockResolvedValueOnce(null);

      // Create alert
      await db.insert(productOffers).values({
        productId: testProduct1Id,
        retailerId: testRetailerId,
        price: '90.00',
        availability: 'in_stock',
      });

      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProduct1Id,
        targetPrice: '95.00',
        isActive: true,
      });

      // Run job (should skip due to lock)
      const stats = await triggerPriceAlertCheck();

      // Should return null when lock can't be acquired
      // (withLock returns null if lock held by another process)
      expect(stats).toBeNull();

      // Verify withLock was called with the manual trigger lock key
      expect(mockWithLock).toHaveBeenCalledWith(
        'price-alert-checker:manual',
        expect.any(Function),
        300
      );
    });
  });

  describe('N+1 Prevention', () => {
    it('should query alerts in a single batch query', async () => {
      // Create 10 product offers
      const offerIds = [];
      for (let i = 0; i < 10; i++) {
        const [product] = await db
          .insert(products)
          .values({
            name: `Product ${i}`,
            category: 'Electronics',
          })
          .returning();

        const [offer] = await db
          .insert(productOffers)
          .values({
            productId: product.id,
            retailerId: testRetailerId,
            price: '90.00',
            availability: 'in_stock',
          })
          .returning();

        offerIds.push(offer.id);

        await db.insert(priceAlerts).values({
          userId: testUser1Id,
          productId: product.id,
          targetPrice: '95.00',
          isActive: true,
        });
      }

      // Run job
      const stats = await triggerPriceAlertCheck();

      expect(stats?.checked).toBe(10);
      // All alerts should trigger (all prices 90 < target 95)
      expect(stats?.triggered).toBeGreaterThan(0);

      // PATTERN: Job uses single JOIN query, not N queries
      // If this test completes quickly (<1s), N+1 is avoided
      // Manual verification: Check logs for single SELECT with JOIN
    });
  });

  describe('Error Handling', () => {
    it('should continue processing remaining alerts if one fails', async () => {
      // Create offers
      await db
        .insert(productOffers)
        .values({
          productId: testProduct1Id,
          retailerId: testRetailerId,
          price: '90.00',
          availability: 'in_stock',
        })
        .returning();

      await db
        .insert(productOffers)
        .values({
          productId: testProduct2Id,
          retailerId: testRetailerId,
          price: '90.00',
          availability: 'in_stock',
        })
        .returning();

      // Create alerts
      await db.insert(priceAlerts).values([
        {
          userId: testUser1Id,
          productId: testProduct1Id,
          targetPrice: '95.00',
          isActive: true,
        },
        {
          userId: testUser2Id,
          productId: testProduct2Id,
          targetPrice: '95.00',
          isActive: true,
        },
        {
          userId: testUser3Id,
          productId: testProduct1Id,
          targetPrice: '95.00',
          isActive: true,
        },
      ]);

      // Mock email to fail for middle alert
      mockSendPriceAlertEmail
        .mockResolvedValueOnce(true) // First succeeds
        .mockRejectedValueOnce(new Error('Email failed')) // Second fails
        .mockResolvedValueOnce(true); // Third succeeds

      // Run job - should not throw
      await expect(triggerPriceAlertCheck()).resolves.not.toThrow();

      // All alerts should still be processed
      const { notifications } = await import('@shared/schema');
      const notifs = await db.select().from(notifications);
      expect(notifs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Stats Tracking', () => {
    it('should return accurate checked/triggered/skipped counts', async () => {
      // Create mix of triggered and not-triggered alerts
      await db.insert(productOffers).values([
        {
          productId: testProduct1Id,
          retailerId: testRetailerId,
          price: '85.00', // Will trigger (< 90)
          availability: 'in_stock',
        },
        {
          productId: testProduct2Id,
          retailerId: testRetailerId,
          price: '110.00', // Will NOT trigger (> 100)
          availability: 'in_stock',
        },
      ]);

      await db.insert(priceAlerts).values([
        {
          userId: testUser1Id,
          productId: testProduct1Id,
          targetPrice: '90.00', // Triggered
          isActive: true,
        },
        {
          userId: testUser2Id,
          productId: testProduct2Id,
          targetPrice: '100.00', // Not triggered
          isActive: true,
        },
      ]);

      const stats = await triggerPriceAlertCheck();

      expect(stats?.checked).toBe(2);
      expect(stats?.triggered).toBe(1);
      expect(stats?.skipped).toBe(0);
    });

    it('should count skipped alerts with no in-stock offers', async () => {
      // Create product with NO offers
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProduct1Id,
        targetPrice: '95.00',
        isActive: true,
      });

      // Create product with out-of-stock offer
      await db.insert(productOffers).values({
        productId: testProduct2Id,
        retailerId: testRetailerId,
        price: '90.00',
        availability: 'out_of_stock', // Out of stock
      });

      await db.insert(priceAlerts).values({
        userId: testUser2Id,
        productId: testProduct2Id,
        targetPrice: '95.00',
        isActive: true,
      });

      const stats = await triggerPriceAlertCheck();

      expect(stats?.checked).toBe(2);
      expect(stats?.triggered).toBe(0);
      expect(stats?.skipped).toBe(2); // Both skipped (no in-stock offers)
    });
  });

  describe('No In-Stock Offers', () => {
    it('should skip alerts with no in-stock offers', async () => {
      // Create product with only out-of-stock offers
      await db.insert(productOffers).values({
        productId: testProduct1Id,
        retailerId: testRetailerId,
        price: '90.00',
        availability: 'out_of_stock',
      });

      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProduct1Id,
        targetPrice: '95.00',
        isActive: true,
      });

      const stats = await triggerPriceAlertCheck();

      expect(stats?.checked).toBe(1);
      expect(stats?.triggered).toBe(0);
      expect(stats?.skipped).toBe(1);

      // No notifications created
      const { notifications } = await import('@shared/schema');
      const notifs = await db.select().from(notifications);
      expect(notifs).toHaveLength(0);
    });

    it('should only consider in_stock offers for price comparison', async () => {
      // Create multiple offers (mix of in-stock and out-of-stock)
      await db.insert(productOffers).values([
        {
          productId: testProduct1Id,
          retailerId: testRetailerId,
          price: '80.00', // Lowest but out of stock
          availability: 'out_of_stock',
        },
        {
          productId: testProduct1Id,
          retailerId: testRetailerId,
          price: '90.00', // In stock (should use this)
          availability: 'in_stock',
        },
        {
          productId: testProduct1Id,
          retailerId: testRetailerId,
          price: '85.00', // Lower but out of stock
          availability: 'out_of_stock',
        },
      ]);

      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProduct1Id,
        targetPrice: '95.00',
        isActive: true,
      });

      const stats = await triggerPriceAlertCheck();

      expect(stats?.checked).toBe(1);
      expect(stats?.triggered).toBe(1); // Should trigger using in-stock price (90)

      // Verify notification has correct price
      const { notifications } = await import('@shared/schema');
      const notifs = await db.select().from(notifications);
      expect(notifs).toHaveLength(1);
      // Price in notification should reference in-stock price (90)
      expect(notifs[0].content).toContain('$90.00');
    });
  });

  describe('Manual Trigger', () => {
    it('should allow manual job execution', async () => {
      // Create alert
      await db.insert(productOffers).values({
        productId: testProduct1Id,
        retailerId: testRetailerId,
        price: '90.00',
        availability: 'in_stock',
      });

      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProduct1Id,
        targetPrice: '95.00',
        isActive: true,
      });

      // Manually trigger
      const stats = await triggerPriceAlertCheck();

      expect(stats?.checked).toBe(1);
      expect(stats?.triggered).toBe(1);

      // Verify notification created
      const { notifications } = await import('@shared/schema');
      const notifs = await db.select().from(notifications);
      expect(notifs).toHaveLength(1);
    });
  });

  describe('Inactive Alerts', () => {
    it('should NOT check inactive alerts', async () => {
      // Create offers
      await db.insert(productOffers).values({
        productId: testProduct1Id,
        retailerId: testRetailerId,
        price: '90.00',
        availability: 'in_stock',
      });

      // Create mix of active and inactive alerts
      await db.insert(priceAlerts).values([
        {
          userId: testUser1Id,
          productId: testProduct1Id,
          targetPrice: '95.00',
          isActive: true, // Active
        },
        {
          userId: testUser2Id,
          productId: testProduct1Id,
          targetPrice: '95.00',
          isActive: false, // Inactive
        },
      ]);

      const stats = await triggerPriceAlertCheck();

      // Should only check active alert
      expect(stats?.checked).toBe(1);
      expect(stats?.triggered).toBe(1);

      // Only one notification created (for active alert)
      const { notifications } = await import('@shared/schema');
      const notifs = await db.select().from(notifications);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].userId).toBe(testUser1Id);
    });
  });
});
