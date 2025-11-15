import { db } from "../db";
import { logger } from "../utils/logger";
import {
  priceHistory,
  priceAggregatesWeekly,
  priceAggregatesMonthly,
  products,
  retailers
} from "../../shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export class PriceAggregationService {
  /**
   * Calculate weekly price aggregates for all products
   * Should be run weekly (e.g., Sunday at 11 PM)
   */
  async calculateWeeklyAggregates(): Promise<number> {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const week = this.getISOWeek(now);

      logger.info(`[PriceAggregation] Calculating weekly aggregates for year ${year}, week ${week}`);

      // Get date range for the current week
      const { startDate, endDate } = this.getWeekDateRange(year, week);

      // Get all product-retailer combinations that have price history this week
      const priceData = await db
        .select({
          productId: priceHistory.productId,
          retailerId: priceHistory.retailerId,
          price: priceHistory.price,
        })
        .from(priceHistory)
        .where(
          and(
            gte(priceHistory.recordedAt, startDate),
            lte(priceHistory.recordedAt, endDate)
          )
        )
        .orderBy(priceHistory.productId, priceHistory.retailerId);

      if (priceData.length === 0) {
        logger.info("[PriceAggregation] No price data found for this week");
        return 0;
      }

      // Group by product-retailer pairs
      const grouped = this.groupPriceData(priceData);

      let aggregateCount = 0;

      for (const [key, prices] of Object.entries(grouped)) {
        const [productId, retailerId] = key.split('-').map(Number);

        // Calculate statistics
        const stats = this.calculatePriceStatistics(prices);

        // Get previous week's average for week-over-week calculation
        const previousWeek = week === 1 ? 52 : week - 1;
        const previousYear = week === 1 ? year - 1 : year;

        const previousWeekData = await db
          .select()
          .from(priceAggregatesWeekly)
          .where(
            and(
              eq(priceAggregatesWeekly.productId, productId),
              eq(priceAggregatesWeekly.retailerId, retailerId),
              eq(priceAggregatesWeekly.year, previousYear),
              eq(priceAggregatesWeekly.week, previousWeek)
            )
          )
          .limit(1);

        let weekOverWeekChange = null;
        if (previousWeekData.length > 0 && previousWeekData[0].avgPrice) {
          const prevAvg = parseFloat(previousWeekData[0].avgPrice);
          const currentAvg = stats.avgPrice;
          weekOverWeekChange = ((currentAvg - prevAvg) / prevAvg * 100).toFixed(2);
        }

        // Insert or update weekly aggregate
        await db
          .insert(priceAggregatesWeekly)
          .values({
            productId,
            retailerId,
            year,
            week,
            minPrice: stats.minPrice.toFixed(2),
            maxPrice: stats.maxPrice.toFixed(2),
            avgPrice: stats.avgPrice.toFixed(2),
            medianPrice: stats.medianPrice.toFixed(2),
            volatilityScore: stats.volatilityScore.toFixed(2),
            recordCount: stats.count,
            weekOverWeekChange,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              priceAggregatesWeekly.productId,
              priceAggregatesWeekly.retailerId,
              priceAggregatesWeekly.year,
              priceAggregatesWeekly.week,
            ],
            set: {
              minPrice: stats.minPrice.toFixed(2),
              maxPrice: stats.maxPrice.toFixed(2),
              avgPrice: stats.avgPrice.toFixed(2),
              medianPrice: stats.medianPrice.toFixed(2),
              volatilityScore: stats.volatilityScore.toFixed(2),
              recordCount: stats.count,
              weekOverWeekChange,
              updatedAt: new Date(),
            },
          });

        aggregateCount++;
      }

      logger.info(`[PriceAggregation] Created/updated ${aggregateCount} weekly aggregates`);
      return aggregateCount;
    } catch (error) {
      logger.error("[PriceAggregation] Error calculating weekly aggregates:", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate monthly price aggregates for all products
   * Should be run monthly (e.g., last day of month at 11 PM)
   */
  async calculateMonthlyAggregates(): Promise<number> {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // 1-12

      logger.info(`[PriceAggregation] Calculating monthly aggregates for year ${year}, month ${month}`);

      // Get date range for the current month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get all product-retailer combinations that have price history this month
      const priceData = await db
        .select({
          productId: priceHistory.productId,
          retailerId: priceHistory.retailerId,
          price: priceHistory.price,
        })
        .from(priceHistory)
        .where(
          and(
            gte(priceHistory.recordedAt, startDate),
            lte(priceHistory.recordedAt, endDate)
          )
        )
        .orderBy(priceHistory.productId, priceHistory.retailerId);

      if (priceData.length === 0) {
        logger.info("[PriceAggregation] No price data found for this month");
        return 0;
      }

      // Group by product-retailer pairs
      const grouped = this.groupPriceData(priceData);

      let aggregateCount = 0;

      for (const [key, prices] of Object.entries(grouped)) {
        const [productId, retailerId] = key.split('-').map(Number);

        // Calculate statistics
        const stats = this.calculatePriceStatistics(prices);

        // Get previous month's average for month-over-month calculation
        const previousMonth = month === 1 ? 12 : month - 1;
        const previousMonthYear = month === 1 ? year - 1 : year;

        const previousMonthData = await db
          .select()
          .from(priceAggregatesMonthly)
          .where(
            and(
              eq(priceAggregatesMonthly.productId, productId),
              eq(priceAggregatesMonthly.retailerId, retailerId),
              eq(priceAggregatesMonthly.year, previousMonthYear),
              eq(priceAggregatesMonthly.month, previousMonth)
            )
          )
          .limit(1);

        let monthOverMonthChange = null;
        if (previousMonthData.length > 0 && previousMonthData[0].avgPrice) {
          const prevAvg = parseFloat(previousMonthData[0].avgPrice);
          const currentAvg = stats.avgPrice;
          monthOverMonthChange = ((currentAvg - prevAvg) / prevAvg * 100).toFixed(2);
        }

        // Get same month last year for year-over-year calculation
        const lastYearData = await db
          .select()
          .from(priceAggregatesMonthly)
          .where(
            and(
              eq(priceAggregatesMonthly.productId, productId),
              eq(priceAggregatesMonthly.retailerId, retailerId),
              eq(priceAggregatesMonthly.year, year - 1),
              eq(priceAggregatesMonthly.month, month)
            )
          )
          .limit(1);

        let yearOverYearChange = null;
        if (lastYearData.length > 0 && lastYearData[0].avgPrice) {
          const prevYearAvg = parseFloat(lastYearData[0].avgPrice);
          const currentAvg = stats.avgPrice;
          yearOverYearChange = ((currentAvg - prevYearAvg) / prevYearAvg * 100).toFixed(2);
        }

        // Insert or update monthly aggregate
        await db
          .insert(priceAggregatesMonthly)
          .values({
            productId,
            retailerId,
            year,
            month,
            minPrice: stats.minPrice.toFixed(2),
            maxPrice: stats.maxPrice.toFixed(2),
            avgPrice: stats.avgPrice.toFixed(2),
            medianPrice: stats.medianPrice.toFixed(2),
            volatilityScore: stats.volatilityScore.toFixed(2),
            recordCount: stats.count,
            monthOverMonthChange,
            yearOverYearChange,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              priceAggregatesMonthly.productId,
              priceAggregatesMonthly.retailerId,
              priceAggregatesMonthly.year,
              priceAggregatesMonthly.month,
            ],
            set: {
              minPrice: stats.minPrice.toFixed(2),
              maxPrice: stats.maxPrice.toFixed(2),
              avgPrice: stats.avgPrice.toFixed(2),
              medianPrice: stats.medianPrice.toFixed(2),
              volatilityScore: stats.volatilityScore.toFixed(2),
              recordCount: stats.count,
              monthOverMonthChange,
              yearOverYearChange,
              updatedAt: new Date(),
            },
          });

        aggregateCount++;
      }

      logger.info(`[PriceAggregation] Created/updated ${aggregateCount} monthly aggregates`);
      return aggregateCount;
    } catch (error) {
      logger.error("[PriceAggregation] Error calculating monthly aggregates:", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate aggregates for a specific product
   * Useful when a product is updated individually
   */
  async calculateProductAggregates(productId: number): Promise<void> {
    try {
      logger.info(`[PriceAggregation] Calculating aggregates for product ${productId}`);

      // For now, recalculate current week and month
      await this.calculateWeeklyAggregates();
      await this.calculateMonthlyAggregates();

      logger.info(`[PriceAggregation] Completed aggregates for product ${productId}`);
    } catch (error) {
      logger.error(`[PriceAggregation] Error calculating aggregates for product ${productId}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Helper: Group price data by product-retailer combination
   */
  private groupPriceData(
    priceData: Array<{ productId: number | null; retailerId: number | null; price: string | null }>
  ): Record<string, number[]> {
    const grouped: Record<string, number[]> = {};

    for (const record of priceData) {
      if (!record.productId || !record.retailerId || !record.price) continue;

      const key = `${record.productId}-${record.retailerId}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(parseFloat(record.price));
    }

    return grouped;
  }

  /**
   * Helper: Calculate price statistics
   */
  private calculatePriceStatistics(prices: number[]): {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    medianPrice: number;
    volatilityScore: number;
    count: number;
  } {
    const sorted = [...prices].sort((a, b) => a - b);
    const count = sorted.length;
    const minPrice = sorted[0];
    const maxPrice = sorted[count - 1];
    const avgPrice = sorted.reduce((sum, p) => sum + p, 0) / count;

    // Calculate median
    const medianPrice =
      count % 2 === 0
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)];

    // Calculate volatility (coefficient of variation)
    const variance =
      sorted.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const volatilityScore = avgPrice > 0 ? (stdDev / avgPrice) * 100 : 0;

    return {
      minPrice,
      maxPrice,
      avgPrice,
      medianPrice,
      volatilityScore,
      count,
    };
  }

  /**
   * Helper: Get ISO week number (1-53)
   */
  private getISOWeek(date: Date): number {
    const target = new Date(date.valueOf());
    const dayNumber = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }

  /**
   * Helper: Get date range for a specific ISO week
   */
  private getWeekDateRange(year: number, week: number): { startDate: Date; endDate: Date } {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const startDate = new Date(ISOweekStart);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(ISOweekStart);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }
}

// Singleton instance
export const priceAggregationService = new PriceAggregationService();
