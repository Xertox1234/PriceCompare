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
import { checkPriceAlertsForDrop } from '../price-drop-detection';

/**
 * Price Drop Detection Integration Test Suite
 *
 * Tests email notification integration in price alert system:
 * - Email sent when user preferences enable both priceAlert and email
 * - Email skipped when priceAlertEnabled is false
 * - Email skipped when emailEnabled is false
 * - Email failure doesn't break in-app notification creation
 * - Multiple alerts respect individual user preferences
 *
 * PATTERN: Integration tests using real database with TRUNCATE CASCADE
 * AVOIDS: Mock-based testing for database operations (see docs/08_TESTING_PATTERNS.md)
 */

// Mock email service
const mockSendPriceAlertEmail = vi.fn();
vi.mock('../email-service', () => ({
  emailService: {
    sendPriceAlertEmail: mockSendPriceAlertEmail,
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

// Mock WebSocket handlers to avoid websocket errors in tests
vi.mock('../../websocket', () => ({
  getSocketIO: vi.fn(() => null),
}));

vi.mock('../../websocket/handlers/price-update-handler', () => ({
  emitPriceAlert: vi.fn(),
}));

// Use serial execution to prevent parallel test conflicts with TRUNCATE CASCADE
describe.sequential('Price Drop Detection - Email Integration', () => {
  let testUser1Id: number;
  let testUser2Id: number;
  let testUser3Id: number;
  let testProductId: number;
  let testRetailerId: number;
  let testOfferId: number;

  // Helper to set user preferences (clears trigger-created defaults first)
  async function setUserPreferences(
    userId: number,
    prefs: { priceAlertEnabled: boolean; emailEnabled: boolean; inAppEnabled: boolean }
  ): Promise<void> {
    const { eq } = await import('drizzle-orm');
    // NOTE: db.delete() with WHERE clause is intentional - deleting trigger-created
    // notification preferences to test specific user scenarios (not using TRUNCATE
    // because we need to preserve other test data)
    await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    await db.insert(notificationPreferences).values({
      userId,
      ...prefs,
    });
  }

  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    // Clear all mocks
    vi.clearAllMocks();
    mockSendPriceAlertEmail.mockResolvedValue(true);

    // Clean database using TRUNCATE CASCADE
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

    // Create test product
    const [product] = await db
      .insert(products)
      .values({
        name: 'Test Product',
        description: 'A test product',
        category: 'Electronics',
      })
      .returning();
    testProductId = product.id;

    // Create test product offer
    const [offer] = await db
      .insert(productOffers)
      .values({
        productId: testProductId,
        retailerId: testRetailerId,
        price: '100.00',
        availability: 'in_stock',
        productUrl: 'https://testretailer.com/product/1',
      })
      .returning();
    testOfferId = offer.id;
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

  describe('checkPriceAlertsForDrop - Email Integration', () => {
    it('should send email when priceAlertEnabled and emailEnabled are true', async () => {
      // Create price alert
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });

      // Set user preferences (clears trigger-created defaults)
      await setUserPreferences(testUser1Id, {
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      });

      // Trigger price drop (current price 90 < target 95)
      const alertsTriggered = await checkPriceAlertsForDrop(testOfferId, 90.0);

      expect(alertsTriggered).toBe(1);

      // Verify email was sent
      expect(mockSendPriceAlertEmail).toHaveBeenCalledTimes(1);
      expect(mockSendPriceAlertEmail).toHaveBeenCalledWith({
        to: 'user1@example.com',
        username: 'user1',
        productName: 'Test Product',
        targetPrice: '95.00',
        currentPrice: 90.0,
        retailerName: 'Test Retailer',
        productUrl: 'https://testretailer.com/product/1',
      });
    });

    it('should NOT send email when priceAlertEnabled is false', async () => {
      // Create price alert
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });

      // Set user preferences with price alerts disabled
      await setUserPreferences(testUser1Id, {
        priceAlertEnabled: false, // DISABLED
        emailEnabled: true,
        inAppEnabled: true,
      });

      // Trigger price drop
      const alertsTriggered = await checkPriceAlertsForDrop(testOfferId, 90.0);

      expect(alertsTriggered).toBe(1);

      // Verify email was NOT sent
      expect(mockSendPriceAlertEmail).not.toHaveBeenCalled();
    });

    it('should NOT send email when emailEnabled is false', async () => {
      // Create price alert
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });

      // Set user preferences with email disabled
      await setUserPreferences(testUser1Id, {
        priceAlertEnabled: true,
        emailEnabled: false, // DISABLED
        inAppEnabled: true,
      });

      // Trigger price drop
      const alertsTriggered = await checkPriceAlertsForDrop(testOfferId, 90.0);

      expect(alertsTriggered).toBe(1);

      // Verify email was NOT sent
      expect(mockSendPriceAlertEmail).not.toHaveBeenCalled();
    });

    it('should create in-app notification even if email fails', async () => {
      // Mock email service to fail
      mockSendPriceAlertEmail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      // Create price alert
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });

      // Set user preferences with email enabled
      await setUserPreferences(testUser1Id, {
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      });

      // Trigger price drop
      const alertsTriggered = await checkPriceAlertsForDrop(testOfferId, 90.0);

      expect(alertsTriggered).toBe(1);

      // Verify email was attempted
      expect(mockSendPriceAlertEmail).toHaveBeenCalledTimes(1);

      // Verify in-app notification was still created
      const { notifications } = await import('@shared/schema');
      const notifs = await db.select().from(notifications);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].userId).toBe(testUser1Id);
      expect(notifs[0].type).toBe('price_alert');
    });

    it('should respect individual user preferences for multiple alerts', async () => {
      // User 1: email enabled
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });
      await setUserPreferences(testUser1Id, {
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      });

      // User 2: email disabled
      await db.insert(priceAlerts).values({
        userId: testUser2Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });
      await setUserPreferences(testUser2Id, {
        priceAlertEnabled: true,
        emailEnabled: false, // DISABLED
        inAppEnabled: true,
      });

      // User 3: email enabled
      await db.insert(priceAlerts).values({
        userId: testUser3Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });
      await setUserPreferences(testUser3Id, {
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      });

      // Trigger price drop
      const alertsTriggered = await checkPriceAlertsForDrop(testOfferId, 90.0);

      expect(alertsTriggered).toBe(3);

      // Verify only user1 and user3 received emails (user2 has email disabled)
      expect(mockSendPriceAlertEmail).toHaveBeenCalledTimes(2);

      const emailCalls = mockSendPriceAlertEmail.mock.calls;
      const recipients = emailCalls.map((call) => call[0].to);
      expect(recipients).toContain('user1@example.com');
      expect(recipients).not.toContain('user2@example.com'); // Excluded
      expect(recipients).toContain('user3@example.com');
    });

    it('should NOT send email when user has no preferences (defaults to disabled)', async () => {
      // Create price alert
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });

      // NOTE: db.delete() with WHERE clause is intentional - deleting trigger-created
      // notification preferences to simulate "no preferences" scenario for testing
      // (not using TRUNCATE because we need to preserve other test data)
      const { eq } = await import('drizzle-orm');
      await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, testUser1Id));

      // Trigger price drop
      const alertsTriggered = await checkPriceAlertsForDrop(testOfferId, 90.0);

      expect(alertsTriggered).toBe(1);

      // Verify email was NOT sent (no preferences = no email)
      expect(mockSendPriceAlertEmail).not.toHaveBeenCalled();
    });

    it('should handle missing user email gracefully', async () => {
      // Create price alert
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });

      // Set preferences but delete user (edge case)
      await setUserPreferences(testUser1Id, {
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      });

      // NOTE: db.delete() without WHERE is intentional for this edge case test -
      // simulating missing user email scenario (full table delete acceptable in
      // isolated test that runs after beforeEach creates fresh test data)
      await db.delete(users);

      // Trigger price drop
      const alertsTriggered = await checkPriceAlertsForDrop(testOfferId, 90.0);

      // Should still create notification attempts (alerts triggered)
      expect(alertsTriggered).toBeGreaterThanOrEqual(0);

      // Email should not be sent (no user email available)
      expect(mockSendPriceAlertEmail).not.toHaveBeenCalled();
    });

    it('should include correct product details in email', async () => {
      // Create price alert
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProductId,
        targetPrice: '100.00',
        isActive: true,
      });

      // Set user preferences
      await setUserPreferences(testUser1Id, {
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      });

      // Trigger price drop
      await checkPriceAlertsForDrop(testOfferId, 95.0);

      // Verify email contains correct details
      expect(mockSendPriceAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          productName: 'Test Product',
          retailerName: 'Test Retailer',
          targetPrice: '100.00',
          currentPrice: 95.0,
          productUrl: 'https://testretailer.com/product/1',
        })
      );
    });

    it('should handle email service being unavailable', async () => {
      // Mock email service to throw an error
      mockSendPriceAlertEmail.mockRejectedValueOnce(new Error('Email service unavailable'));

      // Create price alert
      await db.insert(priceAlerts).values({
        userId: testUser1Id,
        productId: testProductId,
        targetPrice: '95.00',
        isActive: true,
      });

      // Set user preferences
      await setUserPreferences(testUser1Id, {
        priceAlertEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
      });

      // Trigger price drop - should not throw
      await expect(checkPriceAlertsForDrop(testOfferId, 90.0)).resolves.not.toThrow();

      // Verify notification was still created
      const { notifications } = await import('@shared/schema');
      const notifs = await db.select().from(notifications);
      expect(notifs).toHaveLength(1);
    });
  });
});
