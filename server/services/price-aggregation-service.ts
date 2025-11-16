import { db } from "../db";
import { logger } from "../utils/logger";
import {
  priceHistory,
  priceAggregatesWeekly,
  priceAggregatesMonthly,
  products,
  retailers
} from "../../shared/schema";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";

export class PriceAggregationService {
  /**
   * Calculate weekly price aggregates for all products
   * Should be run weekly (e.g., Sunday at 11 PM)
   *
   * OPTIMIZED: Uses database-level aggregation and batch operations
   * Reduces ~300 queries to just 3 queries
   * TRANSACTIONAL: All-or-nothing updates for data consistency
   */
  async calculateWeeklyAggregates(): Promise<number> {
    const now = new Date();
    const year = now.getFullYear();
    const week = this.getISOWeek(now);

    logger.info(`[PriceAggregation] Calculating weekly aggregates for year ${year}, week ${week}`);

    // Wrap entire operation in a transaction for data consistency
    return await db.transaction(async (tx) => {
      try {
        // Get date range for the current week
        const { startDate, endDate } = this.getWeekDateRange(year, week);

        // OPTIMIZATION 1: Use database aggregation to group and calculate in a single query
        const priceData = await tx
          .select({
            productId: priceHistory.productId,
            retailerId: priceHistory.retailerId,
            prices: sql<string>`array_agg(${priceHistory.price}::numeric ORDER BY ${priceHistory.recordedAt})`,
            recordCount: sql<number>`count(*)::int`,
          })
          .from(priceHistory)
          .where(
            and(
              gte(priceHistory.recordedAt, startDate),
              lte(priceHistory.recordedAt, endDate)
            )
          )
          .groupBy(priceHistory.productId, priceHistory.retailerId);

        if (priceData.length === 0) {
          logger.info("[PriceAggregation] No price data found for this week");
          return 0;
        }

        logger.info(`[PriceAggregation] Found ${priceData.length} product-retailer combinations`);

        // OPTIMIZATION 2: Batch fetch all previous week data in one query
        const previousWeek = week === 1 ? 52 : week - 1;
        const previousYear = week === 1 ? year - 1 : year;

        const previousWeekMap = new Map<string, typeof priceAggregatesWeekly.$inferSelect>();
        const previousWeekData = await tx
          .select()
          .from(priceAggregatesWeekly)
          .where(
            and(
              eq(priceAggregatesWeekly.year, previousYear),
              eq(priceAggregatesWeekly.week, previousWeek)
            )
          );

        // Index by product-retailer for O(1) lookup
        for (const record of previousWeekData) {
          previousWeekMap.set(`${record.productId}-${record.retailerId}`, record);
        }

        // OPTIMIZATION 3: Prepare all values for batch insert
        const values = priceData.map(data => {
          if (!data.productId || !data.retailerId) return null;

          // Parse the PostgreSQL array string into numbers
          const pricesArray = this.parsePostgresArray(data.prices);
          const stats = this.calculatePriceStatistics(pricesArray);

          // Lookup previous week data from our Map (O(1))
          const prevData = previousWeekMap.get(`${data.productId}-${data.retailerId}`);

          let weekOverWeekChange = null;
          if (prevData?.avgPrice) {
            const prevAvg = parseFloat(prevData.avgPrice);
            weekOverWeekChange = ((stats.avgPrice - prevAvg) / prevAvg * 100).toFixed(2);
          }

          return {
            productId: data.productId,
            retailerId: data.retailerId,
            year,
            week,
            minPrice: stats.minPrice.toFixed(2),
            maxPrice: stats.maxPrice.toFixed(2),
            avgPrice: stats.avgPrice.toFixed(2),
            medianPrice: stats.medianPrice.toFixed(2),
            volatilityScore: stats.volatilityScore.toFixed(2),
            recordCount: data.recordCount,
            weekOverWeekChange,
            updatedAt: new Date(),
          };
        }).filter(Boolean) as any[];

        if (values.length === 0) {
          logger.info("[PriceAggregation] No valid data to insert");
          return 0;
        }

        // OPTIMIZATION 4: Single batch insert/update operation (within transaction)
        await tx
          .insert(priceAggregatesWeekly)
          .values(values)
          .onConflictDoUpdate({
            target: [
              priceAggregatesWeekly.productId,
              priceAggregatesWeekly.retailerId,
              priceAggregatesWeekly.year,
              priceAggregatesWeekly.week,
            ],
            set: {
              minPrice: sql`excluded.min_price`,
              maxPrice: sql`excluded.max_price`,
              avgPrice: sql`excluded.avg_price`,
              medianPrice: sql`excluded.median_price`,
              volatilityScore: sql`excluded.volatility_score`,
              recordCount: sql`excluded.record_count`,
              weekOverWeekChange: sql`excluded.week_over_week_change`,
              updatedAt: sql`excluded.updated_at`,
            },
          });

        logger.info(`[PriceAggregation] Transaction committed: ${values.length} weekly aggregates`);
        return values.length;
      } catch (error) {
        logger.error("[PriceAggregation] Transaction failed, rolling back:", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Rollback happens automatically
      }
    });
  }

  /**
   * Calculate monthly price aggregates for all products
   * Should be run monthly (e.g., last day of month at 11 PM)
   *
   * OPTIMIZED: Uses database-level aggregation and batch operations
   * TRANSACTIONAL: All-or-nothing updates for data consistency
   */
  async calculateMonthlyAggregates(): Promise<number> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    logger.info(`[PriceAggregation] Calculating monthly aggregates for year ${year}, month ${month}`);

    // Wrap entire operation in a transaction
    return await db.transaction(async (tx) => {
      try {
        // Get date range for the current month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // OPTIMIZATION 1: Use database aggregation
        const priceData = await tx
          .select({
            productId: priceHistory.productId,
            retailerId: priceHistory.retailerId,
            prices: sql<string>`array_agg(${priceHistory.price}::numeric ORDER BY ${priceHistory.recordedAt})`,
            recordCount: sql<number>`count(*)::int`,
          })
          .from(priceHistory)
          .where(
            and(
              gte(priceHistory.recordedAt, startDate),
              lte(priceHistory.recordedAt, endDate)
            )
          )
          .groupBy(priceHistory.productId, priceHistory.retailerId);

        if (priceData.length === 0) {
          logger.info("[PriceAggregation] No price data found for this month");
          return 0;
        }

        logger.info(`[PriceAggregation] Found ${priceData.length} product-retailer combinations`);

        // OPTIMIZATION 2: Batch fetch previous month and year data in parallel
        const previousMonth = month === 1 ? 12 : month - 1;
        const previousMonthYear = month === 1 ? year - 1 : year;

        const [previousMonthData, lastYearData] = await Promise.all([
          tx
            .select()
            .from(priceAggregatesMonthly)
            .where(
              and(
                eq(priceAggregatesMonthly.year, previousMonthYear),
                eq(priceAggregatesMonthly.month, previousMonth)
              )
            ),
          tx
            .select()
            .from(priceAggregatesMonthly)
            .where(
              and(
                eq(priceAggregatesMonthly.year, year - 1),
                eq(priceAggregatesMonthly.month, month)
              )
            ),
        ]);

        // Index by product-retailer for O(1) lookup
        const previousMonthMap = new Map<string, typeof priceAggregatesMonthly.$inferSelect>();
        const lastYearMap = new Map<string, typeof priceAggregatesMonthly.$inferSelect>();

        for (const record of previousMonthData) {
          previousMonthMap.set(`${record.productId}-${record.retailerId}`, record);
        }

        for (const record of lastYearData) {
          lastYearMap.set(`${record.productId}-${record.retailerId}`, record);
        }

        // OPTIMIZATION 3: Prepare all values for batch insert
        const values = priceData.map(data => {
          if (!data.productId || !data.retailerId) return null;

          const pricesArray = this.parsePostgresArray(data.prices);
          const stats = this.calculatePriceStatistics(pricesArray);

          const key = `${data.productId}-${data.retailerId}`;

          // Calculate month-over-month change
          let monthOverMonthChange = null;
          const prevMonthData = previousMonthMap.get(key);
          if (prevMonthData?.avgPrice) {
            const prevAvg = parseFloat(prevMonthData.avgPrice);
            monthOverMonthChange = ((stats.avgPrice - prevAvg) / prevAvg * 100).toFixed(2);
          }

          // Calculate year-over-year change
          let yearOverYearChange = null;
          const prevYearData = lastYearMap.get(key);
          if (prevYearData?.avgPrice) {
            const prevYearAvg = parseFloat(prevYearData.avgPrice);
            yearOverYearChange = ((stats.avgPrice - prevYearAvg) / prevYearAvg * 100).toFixed(2);
          }

          return {
            productId: data.productId,
            retailerId: data.retailerId,
            year,
            month,
            minPrice: stats.minPrice.toFixed(2),
            maxPrice: stats.maxPrice.toFixed(2),
            avgPrice: stats.avgPrice.toFixed(2),
            medianPrice: stats.medianPrice.toFixed(2),
            volatilityScore: stats.volatilityScore.toFixed(2),
            recordCount: data.recordCount,
            monthOverMonthChange,
            yearOverYearChange,
            updatedAt: new Date(),
          };
        }).filter(Boolean) as any[];

        if (values.length === 0) {
          logger.info("[PriceAggregation] No valid data to insert");
          return 0;
        }

        // OPTIMIZATION 4: Single batch insert/update (within transaction)
        await tx
          .insert(priceAggregatesMonthly)
          .values(values)
          .onConflictDoUpdate({
            target: [
              priceAggregatesMonthly.productId,
              priceAggregatesMonthly.retailerId,
              priceAggregatesMonthly.year,
              priceAggregatesMonthly.month,
            ],
            set: {
              minPrice: sql`excluded.min_price`,
              maxPrice: sql`excluded.max_price`,
              avgPrice: sql`excluded.avg_price`,
              medianPrice: sql`excluded.median_price`,
              volatilityScore: sql`excluded.volatility_score`,
              recordCount: sql`excluded.record_count`,
              monthOverMonthChange: sql`excluded.month_over_month_change`,
              yearOverYearChange: sql`excluded.year_over_year_change`,
              updatedAt: sql`excluded.updated_at`,
            },
          });

        logger.info(`[PriceAggregation] Transaction committed: ${values.length} monthly aggregates`);
        return values.length;
      } catch (error) {
        logger.error("[PriceAggregation] Transaction failed, rolling back:", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Rollback happens automatically
      }
    });
  }

  /**
   * Calculate aggregates for a specific product
   * Useful when a product is updated individually
   *
   * FIXED: Now actually filters by product ID
   */
  async calculateProductAggregates(productId: number): Promise<void> {
    try {
      logger.info(`[PriceAggregation] Calculating aggregates for product ${productId}`);

      const now = new Date();
      const year = now.getFullYear();
      const week = this.getISOWeek(now);
      const month = now.getMonth() + 1;

      // Calculate weekly for this product only
      await this.calculateWeeklyAggregatesForProduct(productId, year, week);

      // Calculate monthly for this product only
      await this.calculateMonthlyAggregatesForProduct(productId, year, month);

      logger.info(`[PriceAggregation] Completed aggregates for product ${productId}`);
    } catch (error) {
      logger.error(`[PriceAggregation] Error calculating aggregates for product ${productId}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate weekly aggregates for a specific product
   */
  private async calculateWeeklyAggregatesForProduct(
    productId: number,
    year: number,
    week: number
  ): Promise<void> {
    const { startDate, endDate } = this.getWeekDateRange(year, week);

    const priceData = await db
      .select({
        retailerId: priceHistory.retailerId,
        prices: sql<string>`array_agg(${priceHistory.price}::numeric ORDER BY ${priceHistory.recordedAt})`,
        recordCount: sql<number>`count(*)::int`,
      })
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.productId, productId),
          gte(priceHistory.recordedAt, startDate),
          lte(priceHistory.recordedAt, endDate)
        )
      )
      .groupBy(priceHistory.retailerId);

    if (priceData.length === 0) return;

    // Get previous week data for this product
    const previousWeek = week === 1 ? 52 : week - 1;
    const previousYear = week === 1 ? year - 1 : year;

    const previousWeekData = await db
      .select()
      .from(priceAggregatesWeekly)
      .where(
        and(
          eq(priceAggregatesWeekly.productId, productId),
          eq(priceAggregatesWeekly.year, previousYear),
          eq(priceAggregatesWeekly.week, previousWeek)
        )
      );

    const previousWeekMap = new Map<number, typeof priceAggregatesWeekly.$inferSelect>();
    for (const record of previousWeekData) {
      previousWeekMap.set(record.retailerId, record);
    }

    const values = priceData.map(data => {
      if (!data.retailerId) return null;

      const pricesArray = this.parsePostgresArray(data.prices);
      const stats = this.calculatePriceStatistics(pricesArray);

      let weekOverWeekChange = null;
      const prevData = previousWeekMap.get(data.retailerId);
      if (prevData?.avgPrice) {
        const prevAvg = parseFloat(prevData.avgPrice);
        weekOverWeekChange = ((stats.avgPrice - prevAvg) / prevAvg * 100).toFixed(2);
      }

      return {
        productId,
        retailerId: data.retailerId,
        year,
        week,
        minPrice: stats.minPrice.toFixed(2),
        maxPrice: stats.maxPrice.toFixed(2),
        avgPrice: stats.avgPrice.toFixed(2),
        medianPrice: stats.medianPrice.toFixed(2),
        volatilityScore: stats.volatilityScore.toFixed(2),
        recordCount: data.recordCount,
        weekOverWeekChange,
        updatedAt: new Date(),
      };
    }).filter(Boolean) as any[];

    if (values.length > 0) {
      await db
        .insert(priceAggregatesWeekly)
        .values(values)
        .onConflictDoUpdate({
          target: [
            priceAggregatesWeekly.productId,
            priceAggregatesWeekly.retailerId,
            priceAggregatesWeekly.year,
            priceAggregatesWeekly.week,
          ],
          set: {
            minPrice: sql`excluded.min_price`,
            maxPrice: sql`excluded.max_price`,
            avgPrice: sql`excluded.avg_price`,
            medianPrice: sql`excluded.median_price`,
            volatilityScore: sql`excluded.volatility_score`,
            recordCount: sql`excluded.record_count`,
            weekOverWeekChange: sql`excluded.week_over_week_change`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
  }

  /**
   * Calculate monthly aggregates for a specific product
   */
  private async calculateMonthlyAggregatesForProduct(
    productId: number,
    year: number,
    month: number
  ): Promise<void> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const priceData = await db
      .select({
        retailerId: priceHistory.retailerId,
        prices: sql<string>`array_agg(${priceHistory.price}::numeric ORDER BY ${priceHistory.recordedAt})`,
        recordCount: sql<number>`count(*)::int`,
      })
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.productId, productId),
          gte(priceHistory.recordedAt, startDate),
          lte(priceHistory.recordedAt, endDate)
        )
      )
      .groupBy(priceHistory.retailerId);

    if (priceData.length === 0) return;

    const previousMonth = month === 1 ? 12 : month - 1;
    const previousMonthYear = month === 1 ? year - 1 : year;

    const [previousMonthData, lastYearData] = await Promise.all([
      db
        .select()
        .from(priceAggregatesMonthly)
        .where(
          and(
            eq(priceAggregatesMonthly.productId, productId),
            eq(priceAggregatesMonthly.year, previousMonthYear),
            eq(priceAggregatesMonthly.month, previousMonth)
          )
        ),
      db
        .select()
        .from(priceAggregatesMonthly)
        .where(
          and(
            eq(priceAggregatesMonthly.productId, productId),
            eq(priceAggregatesMonthly.year, year - 1),
            eq(priceAggregatesMonthly.month, month)
          )
        ),
    ]);

    const previousMonthMap = new Map<number, typeof priceAggregatesMonthly.$inferSelect>();
    const lastYearMap = new Map<number, typeof priceAggregatesMonthly.$inferSelect>();

    for (const record of previousMonthData) {
      previousMonthMap.set(record.retailerId, record);
    }

    for (const record of lastYearData) {
      lastYearMap.set(record.retailerId, record);
    }

    const values = priceData.map(data => {
      if (!data.retailerId) return null;

      const pricesArray = this.parsePostgresArray(data.prices);
      const stats = this.calculatePriceStatistics(pricesArray);

      let monthOverMonthChange = null;
      const prevMonthData = previousMonthMap.get(data.retailerId);
      if (prevMonthData?.avgPrice) {
        const prevAvg = parseFloat(prevMonthData.avgPrice);
        monthOverMonthChange = ((stats.avgPrice - prevAvg) / prevAvg * 100).toFixed(2);
      }

      let yearOverYearChange = null;
      const prevYearData = lastYearMap.get(data.retailerId);
      if (prevYearData?.avgPrice) {
        const prevYearAvg = parseFloat(prevYearData.avgPrice);
        yearOverYearChange = ((stats.avgPrice - prevYearAvg) / prevYearAvg * 100).toFixed(2);
      }

      return {
        productId,
        retailerId: data.retailerId,
        year,
        month,
        minPrice: stats.minPrice.toFixed(2),
        maxPrice: stats.maxPrice.toFixed(2),
        avgPrice: stats.avgPrice.toFixed(2),
        medianPrice: stats.medianPrice.toFixed(2),
        volatilityScore: stats.volatilityScore.toFixed(2),
        recordCount: data.recordCount,
        monthOverMonthChange,
        yearOverYearChange,
        updatedAt: new Date(),
      };
    }).filter(Boolean) as any[];

    if (values.length > 0) {
      await db
        .insert(priceAggregatesMonthly)
        .values(values)
        .onConflictDoUpdate({
          target: [
            priceAggregatesMonthly.productId,
            priceAggregatesMonthly.retailerId,
            priceAggregatesMonthly.year,
            priceAggregatesMonthly.month,
          ],
          set: {
            minPrice: sql`excluded.min_price`,
            maxPrice: sql`excluded.max_price`,
            avgPrice: sql`excluded.avg_price`,
            medianPrice: sql`excluded.median_price`,
            volatilityScore: sql`excluded.volatility_score`,
            recordCount: sql`excluded.record_count`,
            monthOverMonthChange: sql`excluded.month_over_month_change`,
            yearOverYearChange: sql`excluded.year_over_year_change`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
  }

  /**
   * Helper: Parse PostgreSQL array string into number array
   */
  private parsePostgresArray(arrayString: string): number[] {
    if (!arrayString || arrayString === '{}') return [];

    // PostgreSQL returns arrays as {1.99,2.99,3.99}
    const cleaned = arrayString.replace(/[{}]/g, '');
    if (!cleaned) return [];

    return cleaned.split(',').map(s => parseFloat(s.trim()));
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
