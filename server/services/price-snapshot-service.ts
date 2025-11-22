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
          // Batch fetch product and retailer details to avoid N+1 queries
          const [productDetails] = await db
            .select({ name: products.name })
            .from(products)
            .where(eq(products.id, productId))
            .limit(1);

          // Batch fetch all retailers for the offers
          const retailerIds = [...new Set(offers.map(o => o.retailerId))];
          const retailerData = await db
            .select({ id: retailers.id, name: retailers.name })
            .from(retailers)
            .where(inArray(retailers.id, retailerIds));
          const retailerMap = new Map(retailerData.map(r => [r.id, r.name]));

          if (productDetails) {
            for (const offer of offers) {
              const previousPrice = previousPrices.get(offer.id);
              const currentPrice = parseFloat(offer.price);

              // Only emit if price changed and we have a previous price
              if (previousPrice && previousPrice !== currentPrice) {
                const percentageChange = ((currentPrice - previousPrice) / previousPrice) * 100;

                emitPriceUpdate(io, productId, {
                  productName: productDetails.name,
                  retailerName: retailerMap.get(offer.retailerId) || 'Retailer',
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
   *
   * Sophisticated detection includes:
   * - Percentage-based threshold detection (configurable)
   * - Trend analysis using recent price history
   * - Anomaly detection for unusual price movements
   * - Pattern classification (drop, increase, volatile, stable)
   */
  async analyzeSignificantChanges(
    thresholdPercentage: number = 10
  ): Promise<PriceChange[]> {
    try {
      logger.info(
        `[PriceSnapshot] Analyzing price changes with threshold ${thresholdPercentage}%`
      );

      // Get current offers with their products and retailers
      const currentOffers = await db
        .select({
          offerId: productOffers.id,
          productId: productOffers.productId,
          retailerId: productOffers.retailerId,
          currentPrice: productOffers.price,
          productName: products.name,
          retailerName: retailers.name,
        })
        .from(productOffers)
        .innerJoin(products, eq(productOffers.productId, products.id))
        .innerJoin(retailers, eq(productOffers.retailerId, retailers.id));

      if (currentOffers.length === 0) {
        logger.info('[PriceSnapshot] No offers found for analysis');
        return [];
      }

      // BATCH QUERY: Get historical prices for all offers
      // We need at least 2 data points to detect changes
      const offerIds = currentOffers.map(o => o.offerId);
      const allHistory = await db
        .select({
          productOfferId: priceHistory.productOfferId,
          price: priceHistory.price,
          recordedAt: priceHistory.recordedAt,
        })
        .from(priceHistory)
        .where(inArray(priceHistory.productOfferId, offerIds))
        .orderBy(priceHistory.productOfferId, desc(priceHistory.recordedAt));

      // Build map of offerId -> price history (limited to last 30 entries for analysis)
      const historyByOffer = new Map<number, Array<{ price: string; recordedAt: Date | null }>>();
      for (const entry of allHistory) {
        const existing = historyByOffer.get(entry.productOfferId) || [];
        if (existing.length < 30) {
          existing.push({ price: entry.price, recordedAt: entry.recordedAt });
          historyByOffer.set(entry.productOfferId, existing);
        }
      }

      const significantChanges: PriceChange[] = [];

      // Analyze each offer using pre-fetched data (no N+1 queries)
      for (const offer of currentOffers) {
        const history = historyByOffer.get(offer.offerId);

        // Need at least one historical record to detect change
        if (!history || history.length === 0) continue;

        const currentPrice = parseFloat(offer.currentPrice);
        const previousPrice = parseFloat(history[0].price);

        // Skip if no price change
        if (currentPrice === previousPrice) continue;

        // Calculate change metrics
        const priceChange = currentPrice - previousPrice;
        const changePercentage = (priceChange / previousPrice) * 100;
        const absoluteChangePercentage = Math.abs(changePercentage);

        // Apply threshold filter
        if (absoluteChangePercentage < thresholdPercentage) continue;

        // Perform sophisticated analysis for significant changes
        const analysis = this.analyzeChangePattern(history, currentPrice);

        // Add to results with enriched data
        significantChanges.push({
          productId: offer.productId,
          retailerId: offer.retailerId,
          oldPrice: previousPrice.toFixed(2),
          newPrice: currentPrice.toFixed(2),
          changePercentage: parseFloat(changePercentage.toFixed(2)),
          productName: offer.productName,
          retailerName: offer.retailerName,
          // Extended fields from sophisticated analysis
          ...(analysis && {
            pattern: analysis.pattern,
            confidence: analysis.confidence,
            isAnomaly: analysis.isAnomaly,
            trendDirection: analysis.trendDirection,
          }),
        });
      }

      // Sort by absolute change percentage (most significant first)
      significantChanges.sort((a, b) =>
        Math.abs(b.changePercentage) - Math.abs(a.changePercentage)
      );

      logger.info(
        `[PriceSnapshot] Found ${significantChanges.length} significant price changes`
      );

      return significantChanges;
    } catch (error) {
      logger.error("[PriceSnapshot] Error analyzing price changes:", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Analyze the pattern and context of a price change
   * Provides confidence scoring, trend analysis, and anomaly detection
   */
  private analyzeChangePattern(
    history: Array<{ price: string; recordedAt: Date | null }>,
    currentPrice: number
  ): {
    pattern: 'drop' | 'increase' | 'volatile' | 'correction';
    confidence: number;
    isAnomaly: boolean;
    trendDirection: 'up' | 'down' | 'stable';
  } | null {
    if (history.length < 2) return null;

    const prices = history.map(h => parseFloat(h.price));
    const previousPrice = prices[0];

    // Calculate statistical measures
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // Calculate standard deviation for anomaly detection
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    // Determine if current price is an anomaly (>2 standard deviations from mean)
    const isAnomaly = stdDev > 0 && Math.abs(currentPrice - avgPrice) > 2 * stdDev;

    // Analyze trend direction using recent prices
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (prices.length >= 3) {
      const recentPrices = prices.slice(0, Math.min(7, prices.length));
      const firstHalf = recentPrices.slice(0, Math.ceil(recentPrices.length / 2));
      const secondHalf = recentPrices.slice(Math.ceil(recentPrices.length / 2));

      const firstHalfAvg = firstHalf.reduce((s, p) => s + p, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((s, p) => s + p, 0) / secondHalf.length;

      const trendThreshold = avgPrice * 0.02; // 2% threshold for trend detection
      if (firstHalfAvg - secondHalfAvg > trendThreshold) {
        trendDirection = 'down';
      } else if (secondHalfAvg - firstHalfAvg > trendThreshold) {
        trendDirection = 'up';
      }
    }

    // Determine pattern type
    let pattern: 'drop' | 'increase' | 'volatile' | 'correction';
    const priceChange = currentPrice - previousPrice;

    // Check for volatility (high standard deviation relative to average)
    const volatilityRatio = stdDev / avgPrice;
    if (volatilityRatio > 0.15 && priceRange > avgPrice * 0.3) {
      pattern = 'volatile';
    } else if (priceChange < 0) {
      // Check if this is a correction (returning toward average after spike)
      const wasAboveAverage = previousPrice > avgPrice * 1.1;
      const nowNearAverage = Math.abs(currentPrice - avgPrice) < avgPrice * 0.1;
      pattern = wasAboveAverage && nowNearAverage ? 'correction' : 'drop';
    } else {
      // Check if this is a correction (returning toward average after dip)
      const wasBelowAverage = previousPrice < avgPrice * 0.9;
      const nowNearAverage = Math.abs(currentPrice - avgPrice) < avgPrice * 0.1;
      pattern = wasBelowAverage && nowNearAverage ? 'correction' : 'increase';
    }

    // Calculate confidence based on data quality and consistency
    let confidence = 0.5; // Base confidence

    // More historical data = higher confidence
    if (history.length >= 20) confidence += 0.2;
    else if (history.length >= 10) confidence += 0.1;

    // Lower volatility = higher confidence in pattern identification
    if (volatilityRatio < 0.05) confidence += 0.15;
    else if (volatilityRatio < 0.1) confidence += 0.1;

    // Consistent trend = higher confidence
    if (trendDirection !== 'stable') {
      const trendConsistency = prices.slice(0, 5).every((p, i) => {
        if (i === 0) return true;
        return trendDirection === 'down' ? p >= prices[i - 1] : p <= prices[i - 1];
      });
      if (trendConsistency) confidence += 0.15;
    }

    return {
      pattern,
      confidence: Math.min(confidence, 1.0),
      isAnomaly,
      trendDirection,
    };
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
  // Extended fields from sophisticated analysis
  pattern?: 'drop' | 'increase' | 'volatile' | 'correction';
  confidence?: number;
  isAnomaly?: boolean;
  trendDirection?: 'up' | 'down' | 'stable';
}

// Singleton instance
export const priceSnapshotService = new PriceSnapshotService();
