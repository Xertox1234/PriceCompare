import { storage } from '../storage';
import { logger } from '../utils/logger';
import { priceAggregationService } from './price-aggregation-service';
import { BATCH_PROCESSING } from '../utils/constants';
import { withRetry, createSmartRetryCondition } from '../utils/retry';

export class PriceSnapshotService {
  /**
   * Default batch size for processing offers in chunks
   * Can be overridden via parameter for testing or tuning
   */
  private static readonly DEFAULT_BATCH_SIZE = BATCH_PROCESSING.PRICE_SNAPSHOT;

  /**
   * Snapshot all current prices and store them in price history
   * This is called periodically (e.g., every 12 hours) by a scheduled job
   *
   * Uses batch processing to maintain stable memory usage regardless of offer count
   *
   * @param batchSize - Number of offers to process per batch (default: 500)
   */
  async snapshotAllPrices(
    batchSize: number = PriceSnapshotService.DEFAULT_BATCH_SIZE
  ): Promise<number> {
    // Wrap entire snapshot operation with retry logic
    // This handles transient database/network failures
    return withRetry(
      async () => {
        let offset = 0;
        let totalCount = 0;
        const now = new Date();

        logger.info(`[PriceSnapshot] Starting batch price snapshot with batch size ${batchSize}`);

        // eslint-disable-next-line no-constant-condition -- Intentional infinite loop with break condition
        while (true) {
          // Fetch offers in batches to maintain stable memory usage
          const batch = await storage.getProductOffersForSnapshot(batchSize, offset);

          if (batch.length === 0) {
            break;
          }

          const snapshots = batch.map((offer) => ({
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
            recordedAt: now,
          }));

          // Insert price history records (batch insert for performance)
          // Wrap individual batch insert with retry for transient failures
          await withRetry(
            () => storage.insertPriceHistoryBatch(snapshots),
            {
              maxAttempts: 3,
              baseDelayMs: 1000,
              maxDelayMs: 10000,
              shouldRetry: createSmartRetryCondition(),
              onRetry: (error, attempt, delayMs) => {
                logger.warn(`Batch insert attempt ${attempt} failed, retrying in ${delayMs}ms`, {
                  batch: offset / batchSize + 1,
                  batchSize: batch.length,
                  attempt,
                  delayMs,
                  error: error.message,
                });
              },
            }
          );

          totalCount += batch.length;
          offset += batchSize;

          logger.info(
            `[PriceSnapshot] Processed batch: ${batch.length} offers (total: ${totalCount})`
          );
        }

        if (totalCount === 0) {
          logger.info('[PriceSnapshot] No product offers found to snapshot');
        } else {
          logger.info(`[PriceSnapshot] Successfully snapshotted ${totalCount} price records`);
        }

        return totalCount;
      },
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
        maxDelayMs: 30000,
        shouldRetry: createSmartRetryCondition(),
        onRetry: (error, attempt, delayMs) => {
          logger.warn(`Price snapshot attempt ${attempt} failed, retrying in ${delayMs}ms`, {
            attempt,
            delayMs,
            error: error.message,
          });
        },
      }
    );
  }

  /**
   * Snapshot prices for a specific product
   * Useful when a product is updated individually
   *
   * Uses retry logic to handle transient failures during individual product updates
   */
  async snapshotProductPrices(productId: number): Promise<number> {
    return withRetry(
      async () => {
        const offers = await storage.getProductOffersByProductId(productId);

        if (offers.length === 0) {
          logger.info(`[PriceSnapshot] No offers found for product ${productId}`);
          return 0;
        }

        // BATCH QUERY: Get previous prices to detect changes (fixes N+1)
        const offerIds = offers.map((o) => o.id);
        const allLastSnapshots = await storage.getPriceHistoryForOffers(offerIds);

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
          recordedAt: now,
        }));

        // Insert price history records (batch insert for performance)
        await storage.insertPriceHistoryBatch(snapshots);

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
            const productDetails = await storage.getProductByIdRaw(productId);

            // Batch fetch all retailers for the offers
            const retailerIds = Array.from(new Set(offers.map((o) => o.retailerId)));
            const retailerData = await storage.getRetailersByIds(retailerIds);
            const retailerMap = new Map(retailerData.map((r) => [r.id, r.name]));

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
      },
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
        maxDelayMs: 30000,
        shouldRetry: createSmartRetryCondition(),
        onRetry: (error, attempt, delayMs) => {
          logger.warn(`Product snapshot attempt ${attempt} failed, retrying in ${delayMs}ms`, {
            productId,
            attempt,
            delayMs,
            error: error.message,
          });
        },
      }
    );
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
  async analyzeSignificantChanges(thresholdPercentage = 10): Promise<PriceChange[]> {
    try {
      logger.info(`[PriceSnapshot] Analyzing price changes with threshold ${thresholdPercentage}%`);

      // Get current offers with their products and retailers
      const currentOffers = await storage.getAllOffersWithDetails();

      if (currentOffers.length === 0) {
        logger.info('[PriceSnapshot] No offers found for analysis');
        return [];
      }

      // BATCH QUERY: Get historical prices for all offers
      // We need at least 2 data points to detect changes
      const offerIds = currentOffers.map((o) => o.offerId);
      const allHistory = await storage.getPriceHistoryForAnalysis(offerIds);

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
      significantChanges.sort(
        (a, b) => Math.abs(b.changePercentage) - Math.abs(a.changePercentage)
      );

      logger.info(`[PriceSnapshot] Found ${significantChanges.length} significant price changes`);

      return significantChanges;
    } catch (error) {
      logger.error('[PriceSnapshot] Error analyzing price changes:', {
        error: error instanceof Error ? error.message : String(error),
      });
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

    const prices = history.map((h) => parseFloat(h.price));
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

      const deletedCount = await storage.deleteOldAggregatedPriceHistory(twoYearsAgo);

      logger.info(
        `[PriceSnapshot] Deleted ${deletedCount} raw records older than 2 years (already aggregated)`
      );
      logger.info('[PriceSnapshot] Cleanup complete');
    } catch (error) {
      logger.error('[PriceSnapshot] Error cleaning up old data:', {
        error: error instanceof Error ? error.message : String(error),
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
