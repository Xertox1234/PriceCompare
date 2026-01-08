import cron, { type ScheduledTask } from 'node-cron';
import { jobLockService } from '../services/job-lock-service';
import { checkPriceAlertsForDrop } from '../services/price-drop-detection';
import { logger } from '../utils/logger';
import { db } from '../db';
import { priceAlerts, products, productOffers } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Price Alert Checker Scheduled Job
 *
 * Periodically checks all active price alerts against current product prices.
 * Complements the event-driven alert system by catching alerts that may have
 * been missed during scraper downtime or for products that haven't been scraped recently.
 *
 * Schedule: Every 30 minutes
 *
 * PATTERN: Uses distributed locking to prevent duplicate execution in multi-server deployments
 * AVOIDS N+1: Single query with JOIN to get all alerts with current prices
 */

let alertCheckerJob: ScheduledTask | null = null;

/**
 * Check all active price alerts and trigger notifications for those that meet target price
 *
 * CRITICAL PATTERN: Single query with JOIN to avoid N+1 queries
 * Uses MIN(price) grouped by alert to get lowest current price per product
 */
async function checkAllActivePriceAlerts(): Promise<{
  checked: number;
  triggered: number;
  skipped: number;
}> {
  logger.info('[PriceAlertChecker] Starting alert check...');

  try {
    // Fetch all active alerts with current minimum price in a single query
    // AVOIDS N+1: Uses JOIN and GROUP BY instead of querying prices in a loop
    // CRITICAL FIX: Include minOfferId in subquery to eliminate secondary query in loop
    const alertsWithPrices = await db
      .select({
        alertId: priceAlerts.id,
        productId: priceAlerts.productId,
        userId: priceAlerts.userId,
        targetPrice: priceAlerts.targetPrice,
        productName: products.name,
        // Get minimum in-stock price, or NULL if no in-stock offers
        currentPrice: sql<string | null>`MIN(${productOffers.price})`,
        // CRITICAL FIX: Get offer ID with minimum price via subquery to avoid N+1
        minOfferId: sql<number | null>`(
          SELECT id
          FROM product_offers
          WHERE product_id = ${priceAlerts.productId}
            AND availability = 'in_stock'
          ORDER BY price ASC
          LIMIT 1
        )`,
        // Count of in-stock offers for this product
        offerCount: sql<number>`COUNT(${productOffers.id})`,
      })
      .from(priceAlerts)
      .innerJoin(products, eq(priceAlerts.productId, products.id))
      .leftJoin(
        productOffers,
        and(eq(products.id, productOffers.productId), eq(productOffers.availability, 'in_stock'))
      )
      .where(eq(priceAlerts.isActive, true))
      .groupBy(priceAlerts.id, products.id);

    logger.info('[PriceAlertChecker] Fetched active alerts', {
      totalAlerts: alertsWithPrices.length,
    });

    let triggered = 0;
    let skipped = 0;

    // Group alerts by product to avoid duplicate processing
    // CRITICAL FIX: Process each product ONCE to prevent duplicate notifications
    // When multiple users have alerts for the same product, checkPriceAlertsForDrop
    // already finds ALL triggered alerts, so we only need to call it once per product
    const processedProducts = new Set<number>();

    // Process each alert
    for (const alert of alertsWithPrices) {
      try {
        // Skip alerts for products with no in-stock offers
        if (!alert.currentPrice || alert.offerCount === 0) {
          skipped++;
          logger.debug('[PriceAlertChecker] Skipping alert - no in-stock offers', {
            alertId: alert.alertId,
            productId: alert.productId,
            productName: alert.productName,
          });
          continue;
        }

        const currentPrice = parseFloat(alert.currentPrice);
        const targetPrice = parseFloat(alert.targetPrice);

        // Check if target price is met (current price <= target)
        if (currentPrice <= targetPrice) {
          // Skip if we already processed this product
          if (processedProducts.has(alert.productId)) {
            logger.debug('[PriceAlertChecker] Product already processed, skipping duplicate', {
              alertId: alert.alertId,
              productId: alert.productId,
              productName: alert.productName,
            });
            continue;
          }

          logger.info('[PriceAlertChecker] Alert triggered', {
            alertId: alert.alertId,
            productId: alert.productId,
            productName: alert.productName,
            currentPrice,
            targetPrice,
            dropAmount: targetPrice - currentPrice,
          });

          // CRITICAL FIX: Use minOfferId from batch query instead of secondary query
          // This eliminates N+1 query pattern (was: 1 initial + N secondary queries)
          const offerId = alert.minOfferId;

          if (!offerId) {
            logger.debug('[PriceAlertChecker] No in-stock offer found for product', {
              productId: alert.productId,
            });
            skipped++;
            continue;
          }

          // Use existing price drop detection service to handle notification
          // This will find ALL triggered alerts for this product and notify all users
          const alertsTriggered = await checkPriceAlertsForDrop(offerId, currentPrice);
          if (alertsTriggered > 0) {
            triggered += alertsTriggered;
            processedProducts.add(alert.productId);
          }
        }
      } catch (error) {
        logger.error('[PriceAlertChecker] Error processing alert', {
          alertId: alert.alertId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue processing other alerts even if one fails
      }
    }

    logger.info('[PriceAlertChecker] Alert check completed', {
      checked: alertsWithPrices.length,
      triggered,
      skipped,
    });

    return {
      checked: alertsWithPrices.length,
      triggered,
      skipped,
    };
  } catch (error) {
    logger.error('[PriceAlertChecker] Failed to check alerts', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Start the price alert checker scheduled job
 */
export function startPriceAlertCheckerJob(): void {
  logger.info('Starting price alert checker scheduled job...');

  // Run every 30 minutes (0,30 * * * *)
  alertCheckerJob = cron.schedule('*/30 * * * *', async () => {
    // Use distributed lock to prevent duplicate execution (45 minute TTL)
    const result = await jobLockService.withLock(
      'price-alert-checker:periodic',
      async () => {
        const stats = await checkAllActivePriceAlerts();
        return stats;
      },
      2700 // 45 minute lock (longer than 30 min interval to prevent overlap)
    );

    if (result === null) {
      logger.info(
        '[PriceAlertChecker] Alert check skipped - already running on another server'
      );
    }
  });

  logger.info('Price alert checker job scheduled: Every 30 minutes');
}

/**
 * Stop the price alert checker scheduled job
 */
export function stopPriceAlertCheckerJob(): void {
  logger.info('Stopping price alert checker scheduled job...');

  if (alertCheckerJob) {
    void alertCheckerJob.stop();
    alertCheckerJob = null;
  }

  logger.info('Price alert checker job stopped');
}

/**
 * Get the status of the scheduled job
 */
export function getPriceAlertCheckerJobStatus(): {
  alertCheckerJob: boolean;
} {
  return {
    alertCheckerJob: alertCheckerJob !== null,
  };
}

/**
 * Manually trigger alert check (for testing or admin actions)
 *
 * NOTE: This bypasses distributed locking - use only for testing or manual admin triggers
 * For production scheduled execution, use startPriceAlertCheckerJob() which uses locking
 */
export async function triggerPriceAlertCheck(): Promise<{
  checked: number;
  triggered: number;
  skipped: number;
} | null> {
  logger.info('Manually triggering price alert check...');

  // Use lock for manual triggers too, to prevent conflicts with scheduled jobs
  const stats = await jobLockService.withLock(
    'price-alert-checker:manual',
    async () => {
      return await checkAllActivePriceAlerts();
    },
    300 // 5 minute lock for manual execution
  );

  if (stats === null) {
    logger.info('Manual price alert check skipped - job already running');
    return null;
  }

  logger.info('Manual price alert check completed', stats);
  return stats;
}
