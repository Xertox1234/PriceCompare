import { recordPriceChange } from '../services/price-history-service';
import { processPriceChange } from '../services/price-drop-detection';
import { db } from '../db';
import { productOffers, priceAlerts, users, notifications } from '@shared/schema';
import { eq, and, lte } from 'drizzle-orm';

/**
 * Price Change Hooks Utility
 * Hooks to be called when product offer prices are updated
 */

export interface PriceChangeHookOptions {
  source?: 'manual' | 'scraper' | 'api' | 'admin';
  confidence?: number;
  metadata?: Record<string, unknown>;
  notifyUsers?: boolean;
}

/**
 * Hook to be called after a product offer is created or updated
 * Automatically records the price change and triggers notifications
 *
 * @param productOfferId - ID of the product offer
 * @param newPrice - The new price
 * @param originalPrice - The original/MSRP price (optional)
 * @param options - Additional options
 * @returns Result of price recording
 */
export async function onProductOfferPriceChange(
  productOfferId: number,
  newPrice: number,
  originalPrice?: number,
  options: PriceChangeHookOptions = {}
) {
  const {
    source = 'scraper',
    confidence = 1.0,
    metadata = {},
    notifyUsers = true
  } = options;

  try {
    // Record the price change
    const result = await recordPriceChange(
      productOfferId,
      newPrice,
      originalPrice,
      source,
      confidence,
      metadata
    );

    // If price was recorded and notifications are enabled
    if (result.recorded && notifyUsers) {
      // Process price drop detection and notifications
      // This handles both price alerts and general price drop notifications
      await processPriceChange(productOfferId, newPrice, {
        percentageThreshold: 10,
        absoluteThreshold: 5.00,
        recentPeakDays: 30,
        cooldownHours: 24,
      });
    }

    return result;
  } catch (error) {
    console.error('Error in price change hook:', error);
    // Don't throw error to prevent blocking the main operation
    return { recorded: false, error: (error as Error).message };
  }
}

/**
 * Check if any price alerts should be triggered for this price change
 *
 * @param productOfferId - ID of the product offer
 * @param newPrice - The new price
 */
async function checkAndNotifyPriceAlerts(productOfferId: number, newPrice: number): Promise<void> {
  try {
    // Get the product ID from the offer
    const [offer] = await db
      .select({ productId: productOffers.productId })
      .from(productOffers)
      .where(eq(productOffers.id, productOfferId))
      .limit(1);

    if (!offer) {
      return;
    }

    // Find active price alerts where target price >= new price
    const alerts = await db
      .select({
        alertId: priceAlerts.id,
        userId: priceAlerts.userId,
        targetPrice: priceAlerts.targetPrice,
        notifyForum: priceAlerts.notifyForum,
        username: users.username,
        email: users.email
      })
      .from(priceAlerts)
      .innerJoin(users, eq(priceAlerts.userId, users.id))
      .where(
        and(
          eq(priceAlerts.productId, offer.productId),
          eq(priceAlerts.isActive, true),
          lte(priceAlerts.targetPrice, newPrice.toString())
        )
      );

    // Create notifications for triggered alerts
    for (const alert of alerts) {
      try {
        // Create notification
        await db.insert(notifications).values({
          userId: alert.userId,
          type: 'price_alert',
          title: 'Price Alert Triggered!',
          content: `The price has dropped to $${newPrice.toFixed(2)}, meeting your target of $${parseFloat(alert.targetPrice).toFixed(2)}`,
          relatedPostId: null,
          relatedTopicId: null,
          isRead: false
        });

        // Optionally deactivate the alert (one-time notification)
        // You can change this behavior based on requirements
        await db
          .update(priceAlerts)
          .set({ isActive: false })
          .where(eq(priceAlerts.id, alert.alertId));

        console.log(`Price alert notification sent to user ${alert.username} for product ${offer.productId}`);
      } catch (error) {
        console.error(`Error creating notification for alert ${alert.alertId}:`, error);
        // Continue with other alerts
      }
    }
  } catch (error) {
    console.error('Error checking price alerts:', error);
  }
}

/**
 * Hook to be called when multiple product offers are updated (bulk operation)
 * More efficient than calling onProductOfferPriceChange multiple times
 *
 * @param offers - Array of offers with their new prices
 * @param options - Additional options
 */
export async function onBulkProductOfferPriceChange(
  offers: Array<{
    productOfferId: number;
    newPrice: number;
    originalPrice?: number;
  }>,
  options: PriceChangeHookOptions = {}
): Promise<void> {
  const {
    source = 'scraper',
    confidence = 1.0,
    metadata = {},
    notifyUsers = true
  } = options;

  const results = await Promise.allSettled(
    offers.map(offer =>
      onProductOfferPriceChange(
        offer.productOfferId,
        offer.newPrice,
        offer.originalPrice,
        { source, confidence, metadata, notifyUsers }
      )
    )
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failureCount = results.filter(r => r.status === 'rejected').length;

  console.log(`Bulk price update: ${successCount} succeeded, ${failureCount} failed`);
}

/**
 * Detect if a price change is significant
 *
 * @param oldPrice - Previous price
 * @param newPrice - New price
 * @param thresholdPercent - Minimum percentage change to be considered significant (default: 5%)
 * @returns True if the price change is significant
 */
export function isSignificantPriceChange(
  oldPrice: number,
  newPrice: number,
  thresholdPercent: number = 5
): boolean {
  if (oldPrice === 0) return true;

  const changePercent = Math.abs(((newPrice - oldPrice) / oldPrice) * 100);
  return changePercent >= thresholdPercent;
}

/**
 * Calculate price change statistics
 *
 * @param oldPrice - Previous price
 * @param newPrice - New price
 * @returns Object with price change details
 */
export function calculatePriceChange(oldPrice: number, newPrice: number) {
  const change = newPrice - oldPrice;
  const changePercent = oldPrice !== 0 ? (change / oldPrice) * 100 : 0;

  return {
    change,
    changePercent,
    isIncrease: change > 0,
    isDecrease: change < 0,
    isSignificant: isSignificantPriceChange(oldPrice, newPrice)
  };
}

/**
 * Example usage in routes or services:
 *
 * // When creating/updating a product offer:
 * const newOffer = await db.insert(productOffers).values({...}).returning();
 * await onProductOfferPriceChange(newOffer.id, newPrice, originalPrice, {
 *   source: 'admin',
 *   confidence: 1.0,
 *   metadata: { updatedBy: 'admin-user' }
 * });
 *
 * // In scraping service:
 * await onBulkProductOfferPriceChange(scrapedOffers, {
 *   source: 'scraper',
 *   confidence: 0.95,
 *   metadata: { scrapingSession: sessionId }
 * });
 */
