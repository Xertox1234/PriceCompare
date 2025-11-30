/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- Test mocks require flexible typing */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../db';
import { users, notifications, products, productOffers, retailers } from '@shared/schema';
import { sql } from 'drizzle-orm';
import {
  analyzeNotificationTriggers,
  prioritizeNotifications,
  shouldNotifyUser,
  createSmartNotification,
  type ProductData,
  type NotificationTrigger,
} from '../smart-notification-service';

/**
 * Smart Notification Service Tests
 *
 * Tests the intelligence layer for smart price notifications:
 * - analyzeNotificationTriggers - Determines if/when to notify
 * - prioritizeNotifications - Sorts by urgency + savings + time
 * - shouldNotifyUser - Respects limits and preferences
 * - createSmartNotification - Creates and delivers notifications
 */

// Mock Redis with accessible functions
const mockRedisGet = vi.fn().mockResolvedValue(null);
const mockRedisSetex = vi.fn().mockResolvedValue('OK');

vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => ({
    get: mockRedisGet,
    setex: mockRedisSetex,
  })),
}));

// Mock WebSocket service
vi.mock('../websocket-service', () => ({
  websocketService: {
    broadcast: vi.fn(),
  },
}));

// Mock email service
vi.mock('../email-service', () => ({
  emailService: {
    isReady: vi.fn().mockReturnValue(false),
    sendEmail: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('Smart Notification Service', () => {
  let testUserId: number;
  let testProductId: number;
  let testRetailerId: number;

  beforeEach(async () => {
    // Clean database
    await db.delete(notifications);
    await db.delete(productOffers);
    await db.delete(products);
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
  });

  afterEach(async () => {
    // Clean up
    await db.delete(notifications);
    await db.delete(productOffers);
    await db.delete(products);
    await db.delete(retailers);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

    // Clear mocks
    vi.clearAllMocks();
  });

  describe('analyzeNotificationTriggers', () => {
    it('should trigger critical notification for price at low + limited stock', async () => {
      const productData: ProductData = {
        currentPrice: 299.99,
        lowestPrice: 299.99,
        averagePrice: 350.0,
        priceDropPercent: 0,
        stockStatus: 'limited_stock',
      };

      const trigger = await analyzeNotificationTriggers(
        testProductId,
        testUserId,
        productData
      );

      expect(trigger.shouldNotify).toBe(true);
      expect(trigger.urgency).toBe('critical');
      expect(trigger.type).toBe('price_drop');
      expect(trigger.reasoning).toContain('Lowest price in history');
      expect(trigger.reasoning).toContain('Stock running low');
      expect(trigger.metadata.productId).toBe(testProductId);
    });

    it('should trigger high notification for 15%+ price drop', async () => {
      const productData: ProductData = {
        currentPrice: 250.0,
        lowestPrice: 280.0,
        averagePrice: 350.0,
        priceDropPercent: 28.6,
        stockStatus: 'in_stock',
      };

      const trigger = await analyzeNotificationTriggers(
        testProductId,
        testUserId,
        productData
      );

      expect(trigger.shouldNotify).toBe(true);
      expect(trigger.urgency).toBe('high');
      // reasoning is an array of strings - check if any includes "Price dropped"
      expect(trigger.reasoning.some(r => r.includes('Price dropped'))).toBe(true);
      expect(trigger.metadata.savings).toBeGreaterThan(0);
    });

    it('should trigger medium notification for 10%+ price drop', async () => {
      const productData: ProductData = {
        currentPrice: 310.0,
        lowestPrice: 320.0,
        averagePrice: 350.0,
        priceDropPercent: 11.4,
        stockStatus: 'in_stock',
      };

      const trigger = await analyzeNotificationTriggers(
        testProductId,
        testUserId,
        productData
      );

      expect(trigger.shouldNotify).toBe(true);
      expect(trigger.urgency).toBe('medium');
    });

    it('should trigger low notification for 5%+ price drop', async () => {
      const productData: ProductData = {
        currentPrice: 330.0,
        lowestPrice: 340.0,
        averagePrice: 350.0,
        priceDropPercent: 5.7,
        stockStatus: 'in_stock',
      };

      const trigger = await analyzeNotificationTriggers(
        testProductId,
        testUserId,
        productData
      );

      expect(trigger.shouldNotify).toBe(true);
      expect(trigger.urgency).toBe('low');
    });

    it('should not trigger for small price drops (<5%)', async () => {
      const productData: ProductData = {
        currentPrice: 345.0,
        lowestPrice: 350.0,
        averagePrice: 350.0,
        priceDropPercent: 1.4,
        stockStatus: 'in_stock',
      };

      const trigger = await analyzeNotificationTriggers(
        testProductId,
        testUserId,
        productData
      );

      expect(trigger.shouldNotify).toBe(false);
    });

    it('should include historical low reasoning when applicable', async () => {
      const productData: ProductData = {
        currentPrice: 280.0,
        lowestPrice: 280.0,
        averagePrice: 350.0,
        priceDropPercent: 20.0,
        stockStatus: 'in_stock',
      };

      const trigger = await analyzeNotificationTriggers(
        testProductId,
        testUserId,
        productData
      );

      expect(trigger.shouldNotify).toBe(true);
      expect(trigger.reasoning).toContain('At lowest price in 90 days');
    });

    it('should calculate savings correctly', async () => {
      const productData: ProductData = {
        currentPrice: 250.0,
        lowestPrice: 280.0,
        averagePrice: 350.0,
        priceDropPercent: 28.6,
        stockStatus: 'in_stock',
      };

      const trigger = await analyzeNotificationTriggers(
        testProductId,
        testUserId,
        productData
      );

      expect(trigger.metadata.savings).toBe(100.0); // 350 - 250
    });

    it('should set expiration date based on urgency', async () => {
      const criticalData: ProductData = {
        currentPrice: 299.99,
        lowestPrice: 299.99,
        averagePrice: 350.0,
        priceDropPercent: 0,
        stockStatus: 'limited_stock',
      };

      const criticalTrigger = await analyzeNotificationTriggers(
        testProductId,
        testUserId,
        criticalData
      );

      const now = Date.now();
      const expiresIn = criticalTrigger.expiresAt.getTime() - now;

      // Critical expires in ~24 hours
      expect(expiresIn).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(expiresIn).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('should set confidence score based on urgency', async () => {
      const criticalData: ProductData = {
        currentPrice: 299.99,
        lowestPrice: 299.99,
        averagePrice: 350.0,
        priceDropPercent: 0,
        stockStatus: 'limited_stock',
      };

      const trigger = await analyzeNotificationTriggers(
        testProductId,
        testUserId,
        criticalData
      );

      expect(trigger.metadata.confidence).toBe(0.95); // Critical has highest confidence
    });
  });

  describe('prioritizeNotifications', () => {
    it('should sort by priority score (urgency + savings + time)', async () => {
      const now = new Date();
      const soonDate = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
      const laterDate = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

      const notifications: NotificationTrigger[] = [
        {
          shouldNotify: true,
          urgency: 'low',
          type: 'price_drop',
          condition: 'Low priority',
          threshold: 100,
          currentValue: 95,
          reasoning: ['Test'],
          metadata: { productId: 1, savings: 10, confidence: 0.6 },
          expiresAt: laterDate,
        },
        {
          shouldNotify: true,
          urgency: 'critical',
          type: 'price_drop',
          condition: 'High priority',
          threshold: 100,
          currentValue: 50,
          reasoning: ['Test'],
          metadata: { productId: 2, savings: 50, confidence: 0.95 },
          expiresAt: soonDate,
        },
        {
          shouldNotify: true,
          urgency: 'medium',
          type: 'price_drop',
          condition: 'Medium priority',
          threshold: 100,
          currentValue: 80,
          reasoning: ['Test'],
          metadata: { productId: 3, savings: 20, confidence: 0.75 },
          expiresAt: laterDate,
        },
      ];

      const sorted = prioritizeNotifications(notifications);

      // Critical with high savings and soon expiration should be first
      expect(sorted[0].urgency).toBe('critical');
      expect(sorted[0].metadata.productId).toBe(2);

      // Medium should be second
      expect(sorted[1].urgency).toBe('medium');

      // Low should be last
      expect(sorted[2].urgency).toBe('low');
    });

    it('should prioritize higher savings when urgency is equal', async () => {
      const laterDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const notifications: NotificationTrigger[] = [
        {
          shouldNotify: true,
          urgency: 'high',
          type: 'price_drop',
          condition: 'Test',
          threshold: 100,
          currentValue: 90,
          reasoning: ['Test'],
          metadata: { productId: 1, savings: 10, confidence: 0.85 },
          expiresAt: laterDate,
        },
        {
          shouldNotify: true,
          urgency: 'high',
          type: 'price_drop',
          condition: 'Test',
          threshold: 100,
          currentValue: 50,
          reasoning: ['Test'],
          metadata: { productId: 2, savings: 50, confidence: 0.85 },
          expiresAt: laterDate,
        },
      ];

      const sorted = prioritizeNotifications(notifications);

      // Higher savings should be first
      expect(sorted[0].metadata.savings).toBe(50);
      expect(sorted[1].metadata.savings).toBe(10);
    });

    it('should prioritize expiring soon when urgency and savings are equal', async () => {
      const soonDate = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const laterDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const notifications: NotificationTrigger[] = [
        {
          shouldNotify: true,
          urgency: 'high',
          type: 'price_drop',
          condition: 'Test',
          threshold: 100,
          currentValue: 70,
          reasoning: ['Test'],
          metadata: { productId: 1, savings: 30, confidence: 0.85 },
          expiresAt: laterDate,
        },
        {
          shouldNotify: true,
          urgency: 'high',
          type: 'price_drop',
          condition: 'Test',
          threshold: 100,
          currentValue: 70,
          reasoning: ['Test'],
          metadata: { productId: 2, savings: 30, confidence: 0.85 },
          expiresAt: soonDate,
        },
      ];

      const sorted = prioritizeNotifications(notifications);

      // Expiring soon should be first
      expect(sorted[0].expiresAt.getTime()).toBeLessThan(sorted[1].expiresAt.getTime());
    });
  });

  describe('shouldNotifyUser', () => {
    beforeEach(() => {
      // Reset Redis mocks before each test
      mockRedisGet.mockClear();
      mockRedisSetex.mockClear();
      mockRedisGet.mockResolvedValue(null);
      mockRedisSetex.mockResolvedValue('OK');
    });

    it('should enforce daily limit (3 notifications per day)', async () => {
      // Create 3 notifications for today
      const today = new Date();
      for (let i = 0; i < 3; i++) {
        await db.insert(notifications).values({
          userId: testUserId,
          type: 'smart_alert',
          title: `Test ${i}`,
          content: 'Test',
          isRead: false,
          createdAt: today,
        });
      }

      const trigger: NotificationTrigger = {
        shouldNotify: true,
        urgency: 'high',
        type: 'price_drop',
        condition: 'Test',
        threshold: 100,
        currentValue: 80,
        reasoning: ['Test'],
        metadata: { productId: testProductId, savings: 20, confidence: 0.85 },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const result = await shouldNotifyUser(testUserId, trigger);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily limit reached');
    });

    it('should prevent duplicates within 6 hours', async () => {
      const trigger: NotificationTrigger = {
        shouldNotify: true,
        urgency: 'high',
        type: 'price_drop',
        condition: 'Test',
        threshold: 100,
        currentValue: 80,
        reasoning: ['Test'],
        metadata: { productId: testProductId, savings: 20, confidence: 0.85 },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      // Mock Redis to return existing dedup key (simulates duplicate)
      mockRedisGet.mockResolvedValueOnce('1');

      const result = await shouldNotifyUser(testUserId, trigger);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Duplicate notification within 6 hours');
    });

    it('should allow notification when no duplicates and under limit', async () => {
      const trigger: NotificationTrigger = {
        shouldNotify: true,
        urgency: 'high',
        type: 'price_drop',
        condition: 'Test',
        threshold: 100,
        currentValue: 80,
        reasoning: ['Test'],
        metadata: { productId: testProductId, savings: 20, confidence: 0.85 },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      // Mock Redis to return no dedup key (already reset in beforeEach, but explicit here)
      mockRedisGet.mockResolvedValueOnce(null);

      const result = await shouldNotifyUser(testUserId, trigger);

      expect(result.allowed).toBe(true);
    });
  });

  describe('createSmartNotification', () => {
    it('should create notification record in database', async () => {
      const trigger: NotificationTrigger = {
        shouldNotify: true,
        urgency: 'high',
        type: 'price_drop',
        condition: 'Price dropped 15%',
        threshold: 100,
        currentValue: 85,
        reasoning: ['Price dropped from average', 'Save $15'],
        metadata: { productId: testProductId, savings: 15, confidence: 0.85 },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await createSmartNotification(testUserId, trigger);

      // Verify notification created
      const notifs = await db
        .select()
        .from(notifications)
        .where(sql`${notifications.userId} = ${testUserId}`);

      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('smart_alert');
      expect(notifs[0].title).toContain('HIGH');
      expect(notifs[0].title).toContain('Price dropped 15%');
      expect(notifs[0].relatedProductId).toBe(testProductId);
    });

    it('should broadcast WebSocket notification', async () => {
      const { websocketService } = await import('../websocket-service');

      const trigger: NotificationTrigger = {
        shouldNotify: true,
        urgency: 'critical',
        type: 'price_drop',
        condition: 'Price dropped 25%',
        threshold: 100,
        currentValue: 75,
        reasoning: ['Lowest price ever', 'Save $25'],
        metadata: { productId: testProductId, savings: 25, confidence: 0.95 },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await createSmartNotification(testUserId, trigger);

      // Verify WebSocket broadcast called
      expect(websocketService.broadcast).toHaveBeenCalledWith(
        'notification:new',
        expect.objectContaining({
          userId: testUserId,
          notification: expect.objectContaining({
            urgency: 'critical',
            productId: testProductId,
          }),
        })
      );
    });

    it('should set deduplication key in Redis', async () => {
      const trigger: NotificationTrigger = {
        shouldNotify: true,
        urgency: 'high',
        type: 'price_drop',
        condition: 'Test',
        threshold: 100,
        currentValue: 80,
        reasoning: ['Test'],
        metadata: { productId: testProductId, savings: 20, confidence: 0.85 },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await createSmartNotification(testUserId, trigger);

      // Verify Redis setex called with 6-hour TTL
      expect(mockRedisSetex).toHaveBeenCalledWith(
        expect.stringContaining(`notif:dedup:${testUserId}:${testProductId}:price_drop`),
        6 * 60 * 60,
        '1'
      );
    });
  });
});
