import { db } from "../db";
import { logger } from "../utils/logger";
import { productOffers, priceHistory, products, retailers } from "../../shared/schema";
import type { InsertPriceHistory } from "../../shared/schema";
import { eq, and, lte, isNotNull, sql, inArray, desc } from "drizzle-orm";
import { priceAggregationService } from "./price-aggregation-service";

export class PriceSnapshotService {
  /**
   * Snapshot all current prices and store them in price history
   * This is called periodically (e.g., every 12 hours) by a scheduled job
   */
  async snapshotAllPrices(): Promise<number> {
    try {
      const allOffers = await db.select().from(productOffers);

      if (allOffers.length === 0) {
        logger.info("[PriceSnapshot] No product offers found to snapshot");
        return 0;
      }

      const now = new Date();
      const snapshots = allOffers.map((offer) => ({
        productOfferId: offer.id,
        productId: offer.productId,
        retailerId: offer.retailerId,
        price: offer.price,
        originalPrice: offer.originalPrice,
        availability: offer.availability,
        rating: offer.rating,
        reviewCount: offer.reviewCount,
        source: 'snapshot' as const,
        confidence: '1.00',
        metadata: null,
        recordedAt: now
      }));

      // Batch insert all snapshots
      await db.insert(priceHistory).values(snapshots);

      logger.info(
        `[PriceSnapshot] Successfully snapshotted ${snapshots.length} price records`
      );

      return snapshots.length;
    } catch (error) {
      logger.error("[PriceSnapshot] Error snapshotting prices:", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Snapshot prices for a specific product
   * Useful when a product is updated individually
   */
  async snapshotProductPrices(productId: number): Promise<number> {
    try {
      const offers = await db
        .select()
        .from(productOffers)
        .where(eq(productOffers.productId, productId));

      if (offers.length === 0) {
        logger.info(`[PriceSnapshot] No offers found for product ${productId}`);
        return 0;
      }

      // BATCH QUERY: Get previous prices to detect changes (fixes N+1)
      const offerIds = offers.map(o => o.id);
      const allLastSnapshots = await db
        .select({
          productOfferId: priceHistory.productOfferId,
          price: priceHistory.price,
        })
        .from(priceHistory)
        .where(inArray(priceHistory.productOfferId, offerIds))
        .orderBy(priceHistory.productOfferId, desc(priceHistory.recordedAt));

      // Build map of offerId -> latest price (first entry per offerId due to ordering)
      const previousPrices = new Map<number, number>();
      for (const snapshot of allLastSnapshots) {
        if (!previousPrices.has(snapshot.productOfferId)) {
          previousPrices.set(snapshot.productOfferId, parseFloat(snapshot.price));
        }
      }

      const now = new Date();
      const snapshots = offers.map((offer) => ({
        productOfferId: offer.id,
        productId: offer.productId,
        retailerId: offer.retailerId,
        price: offer.price,
        originalPrice: offer.originalPrice,
        availability: offer.availability,
        rating: offer.rating,
        reviewCount: offer.reviewCount,
        source: 'snapshot' as const,
        confidence: '1.00',
        metadata: null,
        recordedAt: now
      }));

      await db.insert(priceHistory).values(snapshots);

      logger.info(
        `[PriceSnapshot] Snapshotted ${snapshots.length} prices for product ${productId}`
      );

      // Emit price update events for significant changes
      try {
        const { getSocketIO } = await import('../websocket');
        const { emitPriceUpdate } = await import('../websocket/handlers/price-update-handler');
        const io = getSocketIO();

        if (io) {
          // Get product and retailer details
          const [productDetails] = await db
            .select({ name: products.name })
            .from(products)
            .where(eq(products.id, productId))
            .limit(1);

          if (productDetails) {
            for (const offer of offers) {
              const previousPrice = previousPrices.get(offer.id);
              const currentPrice = parseFloat(offer.price);

              // Only emit if price changed and we have a previous price
              if (previousPrice && previousPrice !== currentPrice) {
                const percentageChange = ((currentPrice - previousPrice) / previousPrice) * 100;

                // Get retailer name
                const [retailerDetails] = await db
                  .select({ name: retailers.name })
                  .from(retailers)
                  .where(eq(retailers.id, offer.retailerId))
                  .limit(1);

                emitPriceUpdate(io, productId, {
                  productName: productDetails.name,
                  retailerName: retailerDetails?.name || 'Retailer',
                  oldPrice: previousPrice,
                  newPrice: currentPrice,
                  percentageChange,
                });
              }
            }
          }
        }
      } catch (error) {
        // Don't fail the operation if WebSocket emit fails
        logger.error('Failed to emit price update events:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return snapshots.length;
    } catch (error) {
      logger.error(
        `[PriceSnapshot] Error snapshotting prices for product ${productId}:`,
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Analyze significant price changes from the last snapshot
   * Returns offers where price changed by more than threshold percentage
   */
  async analyzeSignificantChanges(
    thresholdPercentage: number = 10
  ): Promise<PriceChange[]> {
    try {
      // This would require a more complex query joining with the latest snapshots
      // For now, we'll return an empty array as a placeholder
      // TODO: Implement sophisticated price change detection
      logger.info(
        `[PriceSnapshot] Analyzing price changes with threshold ${thresholdPercentage}%`
      );
      return [];
    } catch (error) {
      logger.error("[PriceSnapshot] Error analyzing price changes:", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Clean up old price history data with aggregation-before-deletion
   *
   * DATA LIFECYCLE (enforced by this method):
   * - 0-30 days: Keep raw priceHistory data
   * - 30-90 days: Aggregate to daily summaries, keep raw data
   * - 90-365 days: Weekly aggregation (handled by scheduled job), keep raw data
   * - 1-2 years: Monthly aggregation (handled by scheduled job), keep raw data
   * - 2+ years: Delete raw data (ONLY if already aggregated)
   *
   * This method ensures data is never lost by aggregating before deletion.
   * Only records with `aggregated_at` set (marked by daily/weekly/monthly jobs)
   * are eligible for deletion.
   *
   * SAFETY: Uses aggregation service to preserve statistics before deletion.
   * TRANSACTIONAL: Aggregation uses transactions to prevent partial updates.
   *
   * @throws Error if aggregation or cleanup fails
   *
   * @example
   * // Typically run weekly via scheduled job
   * await priceSnapshotService.cleanupOldData();
   */
  async cleanupOldData(): Promise<void> {
    try {
      const now = new Date();

      // Step 1: Aggregate 30-90 day old data to daily
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(now.getDate() - 90);

      logger.info('[PriceSnapshot] Starting cleanup: aggregating 30-90 day old data');
      const dailyCount = await priceAggregationService.aggregateToDaily(
        ninetyDaysAgo,
        thirtyDaysAgo
      );
      logger.info(`[PriceSnapshot] Created ${dailyCount} daily aggregates`);

      // Step 2 & 3: Weekly and monthly are handled by scheduled jobs
      // No action needed here - they run on their own schedules

      // Step 4: Delete raw data older than 2 years (only if aggregated)
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(now.getFullYear() - 2);

      const result = await db.delete(priceHistory)
        .where(and(
          lte(priceHistory.recordedAt, twoYearsAgo),
          isNotNull(priceHistory.aggregatedAt)
        ));

      logger.info(
        `[PriceSnapshot] Deleted ${result.rowCount || 0} raw records older than 2 years (already aggregated)`
      );
      logger.info('[PriceSnapshot] Cleanup complete');
    } catch (error) {
      logger.error('[PriceSnapshot] Error cleaning up old data:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export interface PriceChange {
  productId: number;
  retailerId: number;
  oldPrice: string;
  newPrice: string;
  changePercentage: number;
  productName?: string;
  retailerName?: string;
}

// Singleton instance
export const priceSnapshotService = new PriceSnapshotService();
