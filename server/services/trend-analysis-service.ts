import { storage, type PriceTrendInsert } from '../storage';
import type { TrendPriceData } from '../storage/types';
import { logger } from '../utils/logger';
import { BATCH_PROCESSING } from '../utils/constants';

export class TrendAnalysisService {
  /**
   * Analyze price trends for all products
   * Should be run daily (e.g., 3 AM)
   *
   * OPTIMIZED: Uses database-level aggregation and parallel batch processing
   * Reduces ~100 queries to 2 queries + batch processing
   * TRANSACTIONAL: All trend updates committed atomically
   */
  async analyzeTrendsForAllProducts(analysisPeriodDays = 30): Promise<number> {
    logger.info(
      `[TrendAnalysis] Starting trend analysis for all products (${analysisPeriodDays} days)`
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - analysisPeriodDays);

    // Fetch all data first (outside transaction to minimize lock time)
    const priceDataGrouped = await storage.getPriceDataGroupedForTrend(cutoffDate);

    if (priceDataGrouped.length === 0) {
      logger.info('[TrendAnalysis] No price data found for trend analysis');
      return 0;
    }

    // Filter out any records with null productId or retailerId (defensive - should never happen)
    const validData = priceDataGrouped.filter(
      (data): data is TrendPriceData & { productId: number; retailerId: number } =>
        data.productId !== null && data.retailerId !== null
    );

    if (validData.length < priceDataGrouped.length) {
      logger.warn(
        `[TrendAnalysis] Filtered out ${priceDataGrouped.length - validData.length} records with null IDs`
      );
    }

    if (validData.length === 0) {
      logger.info('[TrendAnalysis] No valid price data after filtering');
      return 0;
    }

    logger.info(
      `[TrendAnalysis] Found ${validData.length} product-retailer combinations to analyze`
    );

    try {
      // OPTIMIZATION 1: Process trends in parallel batches to avoid overwhelming the system
      const trendValues: PriceTrendInsert[] = [];
      let analyzedCount = 0;

      for (let i = 0; i < validData.length; i += BATCH_PROCESSING.TREND_ANALYSIS) {
        const batch = validData.slice(i, i + BATCH_PROCESSING.TREND_ANALYSIS);

        // Process batch in parallel
        const results = batch.map((data) => {
          try {
            return {
              status: 'fulfilled' as const,
              value: this.analyzeTrendFromData(
                data.productId,
                data.retailerId,
                data.prices,
                analysisPeriodDays
              ),
            };
          } catch (error) {
            return { status: 'rejected' as const, reason: error };
          }
        });

        // Collect successful results
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const data = batch[j];

          if (result.status === 'fulfilled' && result.value) {
            trendValues.push(result.value);
            analyzedCount++;
          } else if (result.status === 'rejected') {
            logger.error(
              `[TrendAnalysis] Failed for product ${data.productId}, retailer ${data.retailerId}:`,
              {
                error:
                  result.reason instanceof Error ? result.reason.message : String(result.reason),
              }
            );
          }
        }

        logger.info(
          `[TrendAnalysis] Processed batch ${Math.floor(i / BATCH_PROCESSING.TREND_ANALYSIS) + 1}/${Math.ceil(priceDataGrouped.length / BATCH_PROCESSING.TREND_ANALYSIS)}`
        );
      }

      // OPTIMIZATION 2: Batch insert/update all trends atomically
      if (trendValues.length > 0) {
        await storage.upsertPriceTrends(trendValues);
        logger.info(`[TrendAnalysis] Batch upsert completed: ${trendValues.length} trends updated`);
      }

      logger.info(
        `[TrendAnalysis] Completed trend analysis for ${analyzedCount} product-retailer combinations`
      );
      return analyzedCount;
    } catch (error) {
      logger.error('[TrendAnalysis] Error analyzing trends:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Analyze trend from pre-fetched price data (no DB query needed)
   * Returns trend values ready for batch insert
   */
  private analyzeTrendFromData(
    productId: number,
    retailerId: number,
    prices: Array<{ price: number; timestamp: string }>,
    analysisPeriodDays: number
  ): {
    productId: number;
    retailerId: number;
    trendDirection: string;
    trendSlope: string;
    trendStrength: string;
    predictedNextPrice: string;
    confidenceLevel: string;
    analysisPeriodDays: number;
    lastAnalyzedAt: Date;
    updatedAt: Date;
  } | null {
    try {
      // Convert to data points for regression
      const dataPoints = prices.map((p, index) => ({
        x: index,
        y: typeof p.price === 'number' ? p.price : parseFloat(String(p.price)),
        timestamp: p.timestamp,
      }));

      if (dataPoints.length < 5) {
        return null;
      }

      // Calculate linear regression
      const regression = this.calculateLinearRegression(dataPoints);

      // Determine trend direction based on slope
      const trendDirection = this.determineTrendDirection(regression.slope, regression.rSquared);

      // Determine confidence level based on R²
      const confidenceLevel = this.determineConfidenceLevel(regression.rSquared);

      // Predict next price (extrapolate one step forward)
      const nextX = dataPoints.length;
      const predictedNextPrice = regression.slope * nextX + regression.intercept;

      // Convert slope from per-index to per-day
      const daysBetweenPoints = analysisPeriodDays / dataPoints.length;
      const slopePerDay = regression.slope / daysBetweenPoints;

      return {
        productId,
        retailerId,
        trendDirection,
        trendSlope: slopePerDay.toFixed(4),
        trendStrength: regression.rSquared.toFixed(4),
        predictedNextPrice: Math.max(0, predictedNextPrice).toFixed(2),
        confidenceLevel,
        analysisPeriodDays,
        lastAnalyzedAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.error(
        `[TrendAnalysis] Error analyzing data for product ${productId}, retailer ${retailerId}:`,
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Get trend analysis for a specific product-retailer combination
   * Includes retailer name and logo for better UI display
   */
  async getProductTrend(productId: number, retailerId: number) {
    try {
      return await storage.getPriceTrendWithRetailer(productId, retailerId);
    } catch (error) {
      logger.error(
        `[TrendAnalysis] Error getting trend for product ${productId}, retailer ${retailerId}:`,
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Calculate linear regression from data points
   * Returns slope, intercept, and R² (coefficient of determination)
   */
  private calculateLinearRegression(dataPoints: Array<{ x: number; y: number }>): {
    slope: number;
    intercept: number;
    rSquared: number;
  } {
    const n = dataPoints.length;

    // Calculate means
    const meanX = dataPoints.reduce((sum, p) => sum + p.x, 0) / n;
    const meanY = dataPoints.reduce((sum, p) => sum + p.y, 0) / n;

    // Calculate slope (m) and intercept (b) using least squares method
    let numerator = 0;
    let denominator = 0;

    for (const point of dataPoints) {
      numerator += (point.x - meanX) * (point.y - meanY);
      denominator += (point.x - meanX) ** 2;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = meanY - slope * meanX;

    // Calculate R² (coefficient of determination)
    let ssRes = 0; // Sum of squares of residuals
    let ssTot = 0; // Total sum of squares

    for (const point of dataPoints) {
      const predicted = slope * point.x + intercept;
      ssRes += (point.y - predicted) ** 2;
      ssTot += (point.y - meanY) ** 2;
    }

    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return {
      slope,
      intercept,
      rSquared: Math.max(0, Math.min(1, rSquared)), // Clamp between 0 and 1
    };
  }

  /**
   * Determine trend direction based on slope and R²
   */
  private determineTrendDirection(slope: number, rSquared: number): string {
    // If R² is too low, consider it stable (not enough confidence in trend)
    if (rSquared < 0.3) {
      return 'stable';
    }

    // Threshold for considering a slope significant
    // This could be adjusted based on price scale
    const slopeThreshold = 0.01;

    if (Math.abs(slope) < slopeThreshold) {
      return 'stable';
    }

    return slope > 0 ? 'uptrend' : 'downtrend';
  }

  /**
   * Determine confidence level based on R²
   */
  private determineConfidenceLevel(rSquared: number): string {
    if (rSquared >= 0.7) {
      return 'high';
    } else if (rSquared >= 0.4) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get trend summary for a product across all retailers
   * Includes retailer names and logos for better UI display
   */
  async getProductTrendSummary(productId: number) {
    try {
      return await storage.getPriceTrendsForProduct(productId);
    } catch (error) {
      logger.error(`[TrendAnalysis] Error getting trend summary for product ${productId}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
export const trendAnalysisService = new TrendAnalysisService();
