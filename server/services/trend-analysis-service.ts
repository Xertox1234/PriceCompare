import { db } from "../db";
import { logger } from "../utils/logger";
import { priceHistory, priceTrends } from "../../shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

export class TrendAnalysisService {
  /**
   * Analyze price trends for all products
   * Should be run daily (e.g., 3 AM)
   */
  async analyzeTrendsForAllProducts(analysisPeriodDays: number = 30): Promise<number> {
    try {
      logger.info(`[TrendAnalysis] Starting trend analysis for all products (${analysisPeriodDays} days)`);

      // Get all unique product-retailer combinations
      const combinations = await db
        .selectDistinct({
          productId: priceHistory.productId,
          retailerId: priceHistory.retailerId,
        })
        .from(priceHistory);

      let analyzedCount = 0;

      for (const { productId, retailerId } of combinations) {
        if (!productId || !retailerId) continue;

        try {
          await this.analyzeProductTrend(productId, retailerId, analysisPeriodDays);
          analyzedCount++;
        } catch (error) {
          logger.error(
            `[TrendAnalysis] Error analyzing product ${productId}, retailer ${retailerId}:`,
            { error: error instanceof Error ? error.message : String(error) }
          );
          // Continue with other products
        }
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
   * Analyze price trend for a specific product-retailer combination
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
   */
  async getProductTrend(productId: number, retailerId: number) {
    try {
      const trend = await db
        .select()
        .from(priceTrends)
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
   */
  async getProductTrendSummary(productId: number) {
    try {
      const trends = await db
        .select()
        .from(priceTrends)
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
