import { db } from "../db";
import { logger } from "../utils/logger";
import { priceHistory, priceTrends, retailers } from "../../shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export class TrendAnalysisService {
  /**
   * Analyze price trends for all products
   * Should be run daily (e.g., 3 AM)
   *
   * OPTIMIZED: Uses database-level aggregation and parallel batch processing
   * Reduces ~100 queries to 2 queries + batch processing
   * TRANSACTIONAL: All trend updates committed atomically
   */
  async analyzeTrendsForAllProducts(analysisPeriodDays: number = 30): Promise<number> {
    logger.info(`[TrendAnalysis] Starting trend analysis for all products (${analysisPeriodDays} days)`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - analysisPeriodDays);

    // Fetch all data first (outside transaction to minimize lock time)
    const priceDataGrouped = await db
      .select({
        productId: priceHistory.productId,
        retailerId: priceHistory.retailerId,
        prices: sql<Array<{price: number, timestamp: string}>>`
          json_agg(
            json_build_object(
              'price', ${priceHistory.price}::numeric,
              'timestamp', ${priceHistory.recordedAt}
            ) ORDER BY ${priceHistory.recordedAt}
          )`,
        recordCount: sql<number>`count(*)::int`,
      })
      .from(priceHistory)
      .where(gte(priceHistory.recordedAt, cutoffDate))
      .groupBy(priceHistory.productId, priceHistory.retailerId)
      .having(sql`count(*) >= 5`); // Only include if at least 5 data points

    if (priceDataGrouped.length === 0) {
      logger.info("[TrendAnalysis] No price data found for trend analysis");
      return 0;
    }

    logger.info(`[TrendAnalysis] Found ${priceDataGrouped.length} product-retailer combinations to analyze`);

    try {
      // OPTIMIZATION 1: Process trends in parallel batches to avoid overwhelming the system
      const BATCH_SIZE = 20; // Process 20 at a time
      const trendValues: any[] = [];
      let analyzedCount = 0;

      for (let i = 0; i < priceDataGrouped.length; i += BATCH_SIZE) {
        const batch = priceDataGrouped.slice(i, i + BATCH_SIZE);

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(data => this.analyzeTrendFromData(
            data.productId!,
            data.retailerId!,
            data.prices,
            analysisPeriodDays
          ))
        );

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
              { error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
            );
          }
        }

        logger.info(`[TrendAnalysis] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(priceDataGrouped.length / BATCH_SIZE)}`);
      }

      // OPTIMIZATION 2: Batch insert/update all trends atomically within a transaction
      if (trendValues.length > 0) {
        await db.transaction(async (tx) => {
          // Split into smaller chunks if needed (PostgreSQL has param limits)
          const CHUNK_SIZE = 100;
          for (let i = 0; i < trendValues.length; i += CHUNK_SIZE) {
            const chunk = trendValues.slice(i, i + CHUNK_SIZE);

            await tx
              .insert(priceTrends)
              .values(chunk)
              .onConflictDoUpdate({
                target: [priceTrends.productId, priceTrends.retailerId],
                set: {
                  trendDirection: sql`excluded.trend_direction`,
                  trendSlope: sql`excluded.trend_slope`,
                  trendStrength: sql`excluded.trend_strength`,
                  predictedNextPrice: sql`excluded.predicted_next_price`,
                  confidenceLevel: sql`excluded.confidence_level`,
                  analysisPeriodDays: sql`excluded.analysis_period_days`,
                  lastAnalyzedAt: sql`excluded.last_analyzed_at`,
                  updatedAt: sql`excluded.updated_at`,
                },
              });
          }

          logger.info(`[TrendAnalysis] Transaction committed: ${trendValues.length} trends updated`);
        });
      }

      logger.info(`[TrendAnalysis] Completed trend analysis for ${analyzedCount} product-retailer combinations`);
      return analyzedCount;
    } catch (error) {
      logger.error("[TrendAnalysis] Error analyzing trends:", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Analyze trend from pre-fetched price data (no DB query needed)
   * Returns trend values ready for batch insert
   */
  private async analyzeTrendFromData(
    productId: number,
    retailerId: number,
    prices: Array<{price: number, timestamp: string}>,
    analysisPeriodDays: number
  ): Promise<any> {
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
   * Analyze price trend for a specific product-retailer combination
   * (Kept for backward compatibility and ad-hoc analysis)
   */
  async analyzeProductTrend(
    productId: number,
    retailerId: number,
    analysisPeriodDays: number = 30
  ): Promise<void> {
    try {
      // Get price history for the analysis period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - analysisPeriodDays);

      const priceData = await db
        .select({
          price: priceHistory.price,
          recordedAt: priceHistory.recordedAt,
        })
        .from(priceHistory)
        .where(
          and(
            eq(priceHistory.productId, productId),
            eq(priceHistory.retailerId, retailerId),
            gte(priceHistory.recordedAt, cutoffDate)
          )
        )
        .orderBy(priceHistory.recordedAt);

      // Need at least 5 data points for meaningful trend analysis
      if (priceData.length < 5) {
        logger.debug(
          `[TrendAnalysis] Insufficient data for product ${productId}, retailer ${retailerId} (${priceData.length} points)`
        );
        return;
      }

      // Prepare data for linear regression
      const dataPoints = priceData
        .filter(d => d.price && d.recordedAt)
        .map((d, index) => ({
          x: index, // Use index as x-value for simplicity
          y: parseFloat(d.price!),
          timestamp: d.recordedAt!,
        }));

      if (dataPoints.length < 5) {
        return;
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

      // Insert or update trend record
      await db
        .insert(priceTrends)
        .values({
          productId,
          retailerId,
          trendDirection,
          trendSlope: slopePerDay.toFixed(4),
          trendStrength: regression.rSquared.toFixed(4),
          predictedNextPrice: Math.max(0, predictedNextPrice).toFixed(2), // Ensure non-negative
          confidenceLevel,
          analysisPeriodDays,
          lastAnalyzedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [priceTrends.productId, priceTrends.retailerId],
          set: {
            trendDirection,
            trendSlope: slopePerDay.toFixed(4),
            trendStrength: regression.rSquared.toFixed(4),
            predictedNextPrice: Math.max(0, predictedNextPrice).toFixed(2),
            confidenceLevel,
            analysisPeriodDays,
            lastAnalyzedAt: new Date(),
            updatedAt: new Date(),
          },
        });

      logger.debug(
        `[TrendAnalysis] Analyzed product ${productId}, retailer ${retailerId}: ${trendDirection} (R²=${regression.rSquared.toFixed(3)})`
      );
    } catch (error) {
      logger.error(
        `[TrendAnalysis] Error analyzing product ${productId}, retailer ${retailerId}:`,
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
      const trend = await db
        .select({
          id: priceTrends.id,
          productId: priceTrends.productId,
          retailerId: priceTrends.retailerId,
          retailerName: retailers.name,
          retailerLogo: retailers.logo,
          trendDirection: priceTrends.trendDirection,
          trendSlope: priceTrends.trendSlope,
          trendStrength: priceTrends.trendStrength,
          predictedNextPrice: priceTrends.predictedNextPrice,
          confidenceLevel: priceTrends.confidenceLevel,
          analysisPeriodDays: priceTrends.analysisPeriodDays,
          lastAnalyzedAt: priceTrends.lastAnalyzedAt,
          createdAt: priceTrends.createdAt,
          updatedAt: priceTrends.updatedAt,
        })
        .from(priceTrends)
        .leftJoin(retailers, eq(priceTrends.retailerId, retailers.id))
        .where(
          and(
            eq(priceTrends.productId, productId),
            eq(priceTrends.retailerId, retailerId)
          )
        )
        .limit(1);

      return trend[0] || null;
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
      return "stable";
    }

    // Threshold for considering a slope significant
    // This could be adjusted based on price scale
    const slopeThreshold = 0.01;

    if (Math.abs(slope) < slopeThreshold) {
      return "stable";
    }

    return slope > 0 ? "uptrend" : "downtrend";
  }

  /**
   * Determine confidence level based on R²
   */
  private determineConfidenceLevel(rSquared: number): string {
    if (rSquared >= 0.7) {
      return "high";
    } else if (rSquared >= 0.4) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Get trend summary for a product across all retailers
   * Includes retailer names and logos for better UI display
   */
  async getProductTrendSummary(productId: number) {
    try {
      const trends = await db
        .select({
          id: priceTrends.id,
          productId: priceTrends.productId,
          retailerId: priceTrends.retailerId,
          retailerName: retailers.name,
          retailerLogo: retailers.logo,
          trendDirection: priceTrends.trendDirection,
          trendSlope: priceTrends.trendSlope,
          trendStrength: priceTrends.trendStrength,
          predictedNextPrice: priceTrends.predictedNextPrice,
          confidenceLevel: priceTrends.confidenceLevel,
          analysisPeriodDays: priceTrends.analysisPeriodDays,
          lastAnalyzedAt: priceTrends.lastAnalyzedAt,
          createdAt: priceTrends.createdAt,
          updatedAt: priceTrends.updatedAt,
        })
        .from(priceTrends)
        .leftJoin(retailers, eq(priceTrends.retailerId, retailers.id))
        .where(eq(priceTrends.productId, productId))
        .orderBy(desc(priceTrends.lastAnalyzedAt));

      return trends;
    } catch (error) {
      logger.error(
        `[TrendAnalysis] Error getting trend summary for product ${productId}:`,
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }
}

// Singleton instance
export const trendAnalysisService = new TrendAnalysisService();
