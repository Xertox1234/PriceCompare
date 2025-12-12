/**
 * E2E Test Helpers: Notifications
 *
 * Helper functions for notification E2E tests
 */
import { type Page } from '@playwright/test';
import { db } from '../../server/db';
import { notifications, products, retailers, productOffers, priceHistory } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Create a test notification for a user
 */
export async function createTestNotification(
  userId: number,
  options: {
    type?: string;
    title?: string;
    content?: string;
    isRead?: boolean;
    relatedProductId?: number;
  } = {}
): Promise<number> {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      type: options.type || 'price_drop',
      title: options.title || 'Test Notification',
      content: options.content || 'This is a test notification',
      isRead: options.isRead || false,
      relatedProductId: options.relatedProductId || null,
    })
    .returning();

  return notification.id;
}

/**
 * Create a test product with offer and price history
 * Returns product ID and current price
 */
export async function createTestProductWithPrice(
  productName: string,
  currentPrice: number
): Promise<{ productId: number; offerId: number; retailerId: number }> {
  // Create retailer
  const [retailer] = await db
    .insert(retailers)
    .values({
      name: 'Test Retailer',
      website: 'https://test-retailer.com',
      logo: 'https://test-retailer.com/logo.png',
      isActive: true,
    })
    .returning();

  // Create product
  const [product] = await db
    .insert(products)
    .values({
      name: productName,
      description: 'Test product for notifications',
    })
    .returning();

  // Create offer
  const [offer] = await db
    .insert(productOffers)
    .values({
      productId: product.id,
      retailerId: retailer.id,
      price: currentPrice.toFixed(2),
      productUrl: `https://test-retailer.com/product/${product.id}`,
      availability: 'in_stock',
    })
    .returning();

  // Create price history
  await db.insert(priceHistory).values({
    productId: product.id,
    productOfferId: offer.id,
    retailerId: retailer.id,
    price: currentPrice.toFixed(2),
    recordedAt: new Date(),
  });

  return {
    productId: product.id,
    offerId: offer.id,
    retailerId: retailer.id,
  };
}

/**
 * Trigger a price drop by updating product offer price
 * This should generate a notification for users watching the product
 */
export async function triggerPriceDrop(
  offerId: number,
  newPrice: number
): Promise<void> {
  await db
    .update(productOffers)
    .set({ price: newPrice.toFixed(2) })
    .where(eq(productOffers.id, offerId));

  // Create price history record
  const [offer] = await db
    .select()
    .from(productOffers)
    .where(eq(productOffers.id, offerId));

  if (offer) {
    await db.insert(priceHistory).values({
      productId: offer.productId,
      productOfferId: offer.id,
      retailerId: offer.retailerId,
      price: newPrice.toFixed(2),
      recordedAt: new Date(),
    });
  }
}

/**
 * Wait for notification badge to show count
 */
export async function waitForNotificationBadge(
  page: Page,
  expectedCount: number
): Promise<void> {
  const badgeText = expectedCount > 9 ? '9+' : expectedCount.toString();
  await page
    .locator('.notification-badge, [data-testid="notification-badge"]')
    .filter({ hasText: badgeText })
    .waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Navigate to notifications page
 */
export async function navigateToNotifications(page: Page): Promise<void> {
  await page.goto('/notifications');
  await page.waitForLoadState('networkidle');
}

/**
 * Open notification dropdown/menu
 *
 * NOTE: Currently unused - reserved for future dropdown-based notification UI tests.
 * The 500ms timeout is intentional for UI animation timing.
 *
 * Alternative approach: Replace timeout with explicit wait for dropdown visibility:
 * ```typescript
 * await page.getByRole('menu', { name: /notifications/i }).waitFor({ state: 'visible' });
 * ```
 */
export async function openNotificationDropdown(page: Page): Promise<void> {
  // Click bell icon or notification button
  await page.getByRole('button', { name: /notification/i }).first().click();
  // Wait for dropdown animation - intentional timeout for CSS transitions
  await page.waitForTimeout(500);
}

/**
 * Get notification count from stats
 */
export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const result = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return result.length;
}
