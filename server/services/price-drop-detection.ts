import { storage } from '../storage';
import { type PriceHistory, type InsertNotification } from '@shared/schema';
import { createLogger } from '../utils/logger';

const logger = createLogger('PriceDropDetection');

/**
 * Price Drop Detection Service
 *
 * Phase 6 Storage Layer Migration:
 * - Migrated from direct `db` queries to `storage` layer abstraction
 * - Uses getPriceHistoryByOfferId, getProductOfferDetailsForAlert,
 *   getTriggeredPriceAlerts, getUsersWithActiveAlertsForProduct
 * - Preserves all business logic (drop detection, pattern analysis, confidence scoring)
 * - Preserves WebSocket event emission for real-time price alerts
 * - Notification creation uses direct db insert (Phase 2 pattern)
 *
 * Detects significant price drops and triggers notifications
 * based on configurable thresholds and patterns.
 */

export interface PriceDropConfig {
  // Percentage threshold (e.g., 10 = 10% drop)
  percentageThreshold?: number;
  // Absolute dollar threshold (e.g., 5.00 = $5 drop)
  absoluteThreshold?: number;
  // Only alert on drops from recent peak (last N days)
  recentPeakDays?: number;
  // Minimum time between notifications (hours)
  cooldownHours?: number;
}

export interface PriceDropDetection {
  detected: boolean;
  oldPrice: number;
  newPrice: number;
  dropAmount: number;
  dropPercentage: number;
  isSignificant: boolean;
  pattern?: 'seasonal' | 'promotional' | 'clearance' | 'regular';
  confidence: number;
}

export interface PriceDropNotification {
  userId: number;
  productId: number;
  productOfferId: number;
  productName: string;
  retailerName: string;
  oldPrice: number;
  newPrice: number;
  dropAmount: number;
  dropPercentage: number;
  productUrl?: string;
}

// Default configuration
const DEFAULT_CONFIG: PriceDropConfig = {
  percentageThreshold: 10, // 10% drop
  absoluteThreshold: 5.0, // $5 drop
  recentPeakDays: 30,
  cooldownHours: 24,
};

/**
 * Detects if a price change constitutes a significant drop
 */
export async function detectPriceDrop(
  productOfferId: number,
  newPrice: number,
  config: PriceDropConfig = DEFAULT_CONFIG
): Promise<PriceDropDetection> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Get recent price history
  const recentHistory = await storage.getPriceHistoryByOfferId(productOfferId, 100);

  if (recentHistory.length === 0) {
    return {
      detected: false,
      oldPrice: newPrice,
      newPrice,
      dropAmount: 0,
      dropPercentage: 0,
      isSignificant: false,
      confidence: 0,
    };
  }

  // Get the most recent price (before this change)
  const previousPrice = parseFloat(recentHistory[0].price);

  // Calculate drop metrics
  const dropAmount = previousPrice - newPrice;
  const dropPercentage = (dropAmount / previousPrice) * 100;

  // Check if this is a drop (not a price increase)
  if (dropAmount <= 0) {
    return {
      detected: false,
      oldPrice: previousPrice,
      newPrice,
      dropAmount: 0,
      dropPercentage: 0,
      isSignificant: false,
      confidence: 0,
    };
  }

  // Check thresholds
  const meetsPercentageThreshold = dropPercentage >= (mergedConfig.percentageThreshold || 0);
  const meetsAbsoluteThreshold = dropAmount >= (mergedConfig.absoluteThreshold || 0);
  const isSignificant = meetsPercentageThreshold || meetsAbsoluteThreshold;

  // Analyze pattern
  const pattern = analyzeDropPattern(recentHistory, newPrice);

  // Calculate confidence based on data quality
  const confidence = calculateConfidence(recentHistory, dropPercentage);

  return {
    detected: isSignificant,
    oldPrice: previousPrice,
    newPrice,
    dropAmount,
    dropPercentage,
    isSignificant,
    pattern,
    confidence,
  };
}

/**
 * Analyzes the pattern of a price drop
 */
function analyzeDropPattern(
  history: PriceHistory[],
  newPrice: number
): 'seasonal' | 'promotional' | 'clearance' | 'regular' {
  if (history.length < 10) return 'regular';

  const prices = history.map((h) => parseFloat(h.price));
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const _maxPrice = Math.max(...prices);

  // Clearance: dropped below previous minimum significantly
  if (newPrice < minPrice * 0.85) {
    return 'clearance';
  }

  // Seasonal: price has been to this level before recently
  const similarPrices = prices.filter((p) => Math.abs(p - newPrice) < avgPrice * 0.05);
  if (similarPrices.length >= 3) {
    return 'seasonal';
  }

  // Promotional: moderate drop from average
  if (newPrice >= avgPrice * 0.75 && newPrice < avgPrice * 0.9) {
    return 'promotional';
  }

  return 'regular';
}

/**
 * Calculates confidence score for the detection
 */
function calculateConfidence(history: PriceHistory[], dropPercentage: number): number {
  let confidence = 0.5; // Base confidence

  // More data = higher confidence
  if (history.length >= 30) confidence += 0.2;
  else if (history.length >= 10) confidence += 0.1;

  // Larger drops = higher confidence
  if (dropPercentage >= 20) confidence += 0.2;
  else if (dropPercentage >= 10) confidence += 0.1;

  // Recent data = higher confidence
  const latestDate = new Date(history[0].recordedAt || history[0].createdAt || Date.now());
  const daysSinceLatest = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLatest <= 1) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

/**
 * Checks all active price alerts and creates notifications for triggered alerts
 */
export async function checkPriceAlertsForDrop(
  productOfferId: number,
  newPrice: number
): Promise<number> {
  // Get the product offer details
  const offer = await storage.getProductOfferDetailsForAlert(productOfferId);

  if (!offer) return 0;

  // Find all active alerts for this product where target price is met
  const triggeredAlerts = await storage.getTriggeredPriceAlerts(offer.productId, newPrice);

  if (triggeredAlerts.length === 0) return 0;

  // Create notifications for each triggered alert
  const notificationPromises = triggeredAlerts.map(async (alert) => {
    const notification: InsertNotification = {
      userId: alert.userId,
      type: 'price_alert',
      title: `Price Alert: ${offer.productName || 'Product'}`,
      content: `The price dropped to $${newPrice.toFixed(2)}, meeting your target of $${parseFloat(alert.targetPrice).toFixed(2)}!`,
      relatedProductId: offer.productId,
    };

    // Phase 2 pattern: notification creation uses direct db insert
    const { db } = await import('../db');
    const { notifications } = await import('@shared/schema');
    const [created] = await db.insert(notifications).values(notification).returning();

    // Emit WebSocket price alert event
    if (created) {
      try {
        const { getSocketIO } = await import('../websocket');
        const { emitPriceAlert } = await import('../websocket/handlers/price-update-handler');
        const io = getSocketIO();
        if (io) {
          const previousPrice = parseFloat(offer.price);
          const targetPrice = parseFloat(alert.targetPrice);
          const percentageChange = ((newPrice - previousPrice) / previousPrice) * 100;

          emitPriceAlert(io, alert.userId, {
            alertId: alert.id,
            productId: offer.productId,
            productName: offer.productName || 'Product',
            currentPrice: newPrice,
            previousPrice,
            targetPrice,
            percentageChange,
            retailerName: offer.retailerName || 'Retailer',
            retailerUrl: offer.productUrl || '',
          });
        }
      } catch (error) {
        // Don't fail the operation if WebSocket emit fails
        logger.error('Failed to emit price alert event', { error: String(error) });
      }
    }

    // Optionally deactivate the alert after triggering
    // await db.update(priceAlerts)
    //   .set({ isActive: false })
    //   .where(eq(priceAlerts.id, alert.id));
  });

  await Promise.all(notificationPromises);

  return triggeredAlerts.length;
}

/**
 * Creates a notification for a significant price drop
 */
export async function createPriceDropNotification(
  notification: PriceDropNotification
): Promise<void> {
  const notificationData: InsertNotification = {
    userId: notification.userId,
    type: 'price_drop',
    title: `Price Drop: ${notification.productName}`,
    content: `${notification.retailerName} dropped the price by $${notification.dropAmount.toFixed(2)} (${notification.dropPercentage.toFixed(1)}%)! Now $${notification.newPrice.toFixed(2)} (was $${notification.oldPrice.toFixed(2)})`,
    relatedProductId: notification.productId,
  };

  // Phase 2 pattern: notification creation uses direct db insert
  const { db } = await import('../db');
  const { notifications } = await import('@shared/schema');
  await db.insert(notifications).values(notificationData);
}

/**
 * Gets users who should be notified about a price drop
 * Based on their watchlists, alerts, and preferences
 */
export async function getUsersToNotify(
  productId: number,
  _dropPercentage: number
): Promise<number[]> {
  // For now, get all users with active alerts for this product
  // In the future, this would also check user preferences
  const userIds = await storage.getUsersWithActiveAlertsForProduct(productId);

  return Array.from(new Set(userIds));
}

/**
 * Main function to process a price change and trigger notifications
 */
export async function processPriceChange(
  productOfferId: number,
  newPrice: number,
  config?: PriceDropConfig
): Promise<{
  detection: PriceDropDetection;
  alertsTriggered: number;
  notificationsSent: number;
}> {
  // Detect if this is a significant price drop
  const detection = await detectPriceDrop(productOfferId, newPrice, config);

  let alertsTriggered = 0;
  let notificationsSent = 0;

  if (detection.detected) {
    // Check and trigger any price alerts
    alertsTriggered = await checkPriceAlertsForDrop(productOfferId, newPrice);

    // Get product details for general notifications
    const offer = await storage.getProductOfferDetailsForAlert(productOfferId);

    if (offer) {
      // Get users interested in this product
      const userIds = await getUsersToNotify(offer.productId, detection.dropPercentage);

      // Send notifications to interested users
      const notificationPromises = userIds.map((userId) =>
        createPriceDropNotification({
          userId,
          productId: offer.productId,
          productOfferId,
          productName: offer.productName || 'Product',
          retailerName: offer.retailerName || 'Retailer',
          oldPrice: detection.oldPrice,
          newPrice: detection.newPrice,
          dropAmount: detection.dropAmount,
          dropPercentage: detection.dropPercentage,
          productUrl: offer.productUrl || undefined,
        })
      );

      await Promise.all(notificationPromises);
      notificationsSent = userIds.length;
    }
  }

  return {
    detection,
    alertsTriggered,
    notificationsSent,
  };
}

/**
 * Batch process price changes for multiple offers
 * Useful for processing scraper results
 */
export async function batchProcessPriceChanges(
  changes: Array<{ productOfferId: number; newPrice: number }>,
  config?: PriceDropConfig
): Promise<{
  processed: number;
  dropsDetected: number;
  alertsTriggered: number;
  notificationsSent: number;
}> {
  let dropsDetected = 0;
  let alertsTriggered = 0;
  let notificationsSent = 0;

  const results = await Promise.all(
    changes.map((change) => processPriceChange(change.productOfferId, change.newPrice, config))
  );

  results.forEach((result) => {
    if (result.detection.detected) dropsDetected++;
    alertsTriggered += result.alertsTriggered;
    notificationsSent += result.notificationsSent;
  });

  return {
    processed: changes.length,
    dropsDetected,
    alertsTriggered,
    notificationsSent,
  };
}
