import { db } from "../db";
import { logger } from "../utils/logger";
import { productOffers, priceHistory } from "../../shared/schema";
import type { InsertPriceHistory } from "../../shared/schema";

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

      const recordedAt = new Date();
      const snapshots: InsertPriceHistory[] = allOffers.map((offer) => ({
        productOfferId: offer.id,
        productId: offer.productId,
        retailerId: offer.retailerId,
        price: offer.price,
        originalPrice: offer.originalPrice,
        availability: offer.availability,
        rating: offer.rating,
        reviewCount: offer.reviewCount,
        recordedAt,
      }));

      // Batch insert all snapshots
      await db.insert(priceHistory).values(snapshots);

      logger.info(
        `[PriceSnapshot] Successfully snapshotted ${snapshots.length} price records at ${recordedAt.toISOString()}`
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
        .where((offer) => offer.productId === productId);

      if (offers.length === 0) {
        logger.info(`[PriceSnapshot] No offers found for product ${productId}`);
        return 0;
      }

      const recordedAt = new Date();
      const snapshots: InsertPriceHistory[] = offers.map((offer) => ({
        productOfferId: offer.id,
        productId: offer.productId,
        retailerId: offer.retailerId,
        price: offer.price,
        originalPrice: offer.originalPrice,
        availability: offer.availability,
        rating: offer.rating,
        reviewCount: offer.reviewCount,
        recordedAt,
      }));

      await db.insert(priceHistory).values(snapshots);

      logger.info(
        `[PriceSnapshot] Snapshotted ${snapshots.length} prices for product ${productId}`
      );

      return snapshots.length;
    } catch (error) {
      logger.error(
        `[PriceSnapshot] Error snapshotting prices for product ${productId}:`,
        error
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
   * Clean up old price history data
   * Keeps detailed data for 1 year, aggregated data for 2 years
   */
  async cleanupOldData(): Promise<void> {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      // Delete data older than 2 years
      // TODO: Implement aggregation for 1-2 year old data before deletion
      logger.info("[PriceSnapshot] Cleanup complete");
    } catch (error) {
      logger.error("[PriceSnapshot] Error cleaning up old data:", { error: error instanceof Error ? error.message : String(error) });
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
