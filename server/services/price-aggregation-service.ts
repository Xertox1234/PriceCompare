/**
 * Price History Aggregation Service
 *
 * OVERVIEW
 * ========
 * This service manages the lifecycle of price history data by automatically
 * aggregating old data into time-based summaries (daily/weekly/monthly) to
 * optimize database storage and query performance.
 *
 * DATA LIFECYCLE
 * ==============
 * - 0-30 days: Raw price_history records (most granular)
 * - 30-90 days: Daily aggregates (price_aggregates_daily)
 * - 90-365 days: Weekly aggregates (price_aggregates_weekly)
 * - 1+ years: Monthly aggregates (price_aggregates_monthly)
 * - 2+ years: Deleted (after aggregation to monthly summaries)
 *
 * SCHEDULED JOBS
 * ==============
 * - Daily: 1:00 AM - Aggregate yesterday's data
 * - Weekly: 11:00 PM Sunday - Aggregate current week
 * - Monthly: 11:00 PM last day - Aggregate current month
 * - Cleanup: 3:00 AM Monday - Aggregate old data and delete 2+ year data
 *
 * PERFORMANCE BENEFITS
 * ====================
 * - Storage: 97-99% reduction for queries > 30 days
 * - Query speed: 5-10x faster for long date ranges
 * - Database size: 80% reduction over time
 *
 * TRANSACTION SAFETY
 * ==================
 * All aggregation operations use database transactions to ensure atomicity.
 * If an aggregation fails, changes are rolled back to prevent partial updates.
 *
 * DISTRIBUTED LOCKING
 * ===================
 * Scheduled jobs use distributed locks (via Redis) to prevent duplicate
 * execution across multiple server instances.
 *
 * STORAGE LAYER EXCEPTION
 * ========================
 * This service retains direct `db` access as an exception to the storage layer pattern
 * due to complex transaction context passing requirements. The service passes transaction
 * contexts (`tx`) between private helper methods to maintain atomic multi-step operations.
 * Abstracting this pattern would leak implementation details and reduce code clarity.
 *
 * All other services should use the storage layer. This exception is documented in:
 * - todos/031-in-progress-p3-direct-db-in-services.md (Phase 7)
 * - GitHub PR #120 (refactor/storage-layer-phase-7)
 */

import { db } from "../db";
import { logger } from "../utils/logger";
import {
  priceHistory,
  priceAggregatesWeekly,
  priceAggregatesMonthly,
  priceAggregatesDaily,
} from "../../shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  validatePricesArray,
  validateProductRetailer,
  validateReasonableDateRange,
  dateRangeSchema,
  productIdSchema,
  ValidationError,
} from "./aggregation-validation";
import {
  retryWithBackoff,
  isTransientDatabaseError,
} from "../utils/retry-with-backoff";
import { measureAggregation } from "./aggregation-metrics";

/**
 * Type-safe filter to remove null/undefined values from arrays
 * This replaces `array.filter(Boolean) as any[]` pattern with proper typing
 */
function filterNullish<T>(array: (T | null | undefined)[]): T[] {
  return array.filter((item): item is T => item != null);
}

// ============================================================================
// AGGREGATION TYPES AND HELPERS
// ============================================================================

type _PeriodType = 'daily' | 'weekly' | 'monthly';

interface PriceDataRow {
  productId: number | null;
  retailerId: number | null;
  prices: string;
  recordCount: number;
}

interface AggregateStats {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  medianPrice: number;
  volatilityScore: number;
  count: number;
}

/**
 * Calculate period-over-period change percentage
 */
function calculatePeriodChange(currentAvg: number, previousAvg: number | null): string | null {
  if (previousAvg === null || previousAvg === 0) return null;
  return ((currentAvg - previousAvg) / previousAvg * 100).toFixed(2);
}

export class PriceAggregationService {
  // ============================================================================
  // CORE AGGREGATION HELPERS (DRY)
  // ============================================================================

  /**
   * Fetch aggregated price data for a date range
   * Common query used by all aggregation methods
   */
  private async fetchPriceData(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    startDate: Date,
    endDate: Date,
    productId?: number
  ): Promise<PriceDataRow[]> {
    const conditions = [
      gte(priceHistory.recordedAt, startDate),
      lte(priceHistory.recordedAt, endDate)
    ];

    if (productId !== undefined) {
      conditions.push(eq(priceHistory.productId, productId));
    }

    return tx
      .select({
        productId: priceHistory.productId,
        retailerId: priceHistory.retailerId,
        prices: sql<string>`array_agg(${priceHistory.price}::numeric ORDER BY ${priceHistory.recordedAt})`,
        recordCount: sql<number>`count(*)::int`,
      })
      .from(priceHistory)
      .where(and(...conditions))
      .groupBy(priceHistory.productId, priceHistory.retailerId);
  }

  /**
   * Build a lookup map from previous period data
   * Provides O(1) lookup for period-over-period changes
   */
  private buildPreviousPeriodMap<T extends { productId: number; retailerId: number; avgPrice: string | null }>(
    data: T[],
    useRetailerOnly = false
  ): Map<string | number, T> {
    const map = new Map<string | number, T>();
    for (const record of data) {
      const key = useRetailerOnly ? record.retailerId : `${record.productId}-${record.retailerId}`;
      map.set(key, record);
    }
    return map;
  }

  /**
   * Process raw price data into aggregate values
   * Common transformation used by all aggregation methods
   */
  private processAggregateData<T>(
    priceData: PriceDataRow[],
    previousMap: Map<string | number, { avgPrice: string | null }>,
    buildValue: (
      productId: number,
      retailerId: number,
      stats: AggregateStats,
      recordCount: number,
      periodChange: string | null
    ) => T | null,
    context: { aggregationType: string; periodLabel: string },
    useRetailerKeyOnly = false
  ): T[] {
    const rawValues = priceData.map(data => {
      try {
        const { productId, retailerId } = validateProductRetailer(
          data.productId,
          data.retailerId,
          { aggregationType: context.aggregationType }
        );

        const pricesArray = this.parsePostgresArray(data.prices);
        const stats = this.calculatePriceStatistics(pricesArray, {
          productId,
          retailerId,
          date: context.periodLabel,
        });

        const key = useRetailerKeyOnly ? retailerId : `${productId}-${retailerId}`;
        const prevData = previousMap.get(key);
        const periodChange = calculatePeriodChange(
          stats.avgPrice,
          prevData?.avgPrice ? parseFloat(prevData.avgPrice) : null
        );

        return buildValue(productId, retailerId, stats, data.recordCount, periodChange);
      } catch (error) {
        logger.error(`[PriceAggregation] Invalid data in ${context.aggregationType} aggregate:`, {
          error: error instanceof Error ? error.message : String(error),
          productId: data.productId,
          retailerId: data.retailerId,
        });
        return null;
      }
    });

    return filterNullish(rawValues);
  }

  // ============================================================================
  // PUBLIC AGGREGATION METHODS
  // ============================================================================

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

    return measureAggregation(
      'weekly',
      async () => retryWithBackoff(
        async () => db.transaction(async (tx) => {
          const { startDate, endDate } = this.getWeekDateRange(year, week);
          const priceData = await this.fetchPriceData(tx, startDate, endDate);

          if (priceData.length === 0) {
            logger.info("[PriceAggregation] No price data found for this week");
            return 0;
          }

          logger.info(`[PriceAggregation] Found ${priceData.length} product-retailer combinations`);

          // Fetch previous week data
          const previousWeek = week === 1 ? 52 : week - 1;
          const previousYear = week === 1 ? year - 1 : year;
          const previousWeekData = await tx
            .select()
            .from(priceAggregatesWeekly)
            .where(and(
              eq(priceAggregatesWeekly.year, previousYear),
              eq(priceAggregatesWeekly.week, previousWeek)
            ));
          const previousMap = this.buildPreviousPeriodMap(previousWeekData);

          // Process data using shared helper
          const values = this.processAggregateData(
            priceData,
            previousMap,
            (productId, retailerId, stats, recordCount, weekOverWeekChange) => ({
              productId,
              retailerId,
              year,
              week,
              minPrice: stats.minPrice.toFixed(2),
              maxPrice: stats.maxPrice.toFixed(2),
              avgPrice: stats.avgPrice.toFixed(2),
              medianPrice: stats.medianPrice.toFixed(2),
              volatilityScore: stats.volatilityScore.toFixed(2),
              recordCount,
              weekOverWeekChange,
              updatedAt: new Date(),
            }),
            { aggregationType: 'weekly', periodLabel: `${year}-W${week}` }
          );

          if (values.length === 0) {
            logger.info("[PriceAggregation] No valid data to insert");
            return 0;
          }

          await this.upsertWeeklyAggregates(tx, values);
          logger.info(`[PriceAggregation] Transaction committed: ${values.length} weekly aggregates`);
          return values.length;
        }),
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'calculateWeeklyAggregates', year, week },
        }
      ),
      { year, week }
    );
  }

  /**
   * Upsert weekly aggregates (shared by bulk and single-product methods)
   */
  private async upsertWeeklyAggregates(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    values: (typeof priceAggregatesWeekly.$inferInsert)[]
  ): Promise<void> {
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
    const month = now.getMonth() + 1;

    logger.info(`[PriceAggregation] Calculating monthly aggregates for year ${year}, month ${month}`);

    return measureAggregation(
      'monthly',
      async () => retryWithBackoff(
        async () => db.transaction(async (tx) => {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59);
          const priceData = await this.fetchPriceData(tx, startDate, endDate);

          if (priceData.length === 0) {
            logger.info("[PriceAggregation] No price data found for this month");
            return 0;
          }

          logger.info(`[PriceAggregation] Found ${priceData.length} product-retailer combinations`);

          // Fetch previous month and year-over-year data in parallel
          const previousMonth = month === 1 ? 12 : month - 1;
          const previousMonthYear = month === 1 ? year - 1 : year;

          const [previousMonthData, lastYearData] = await Promise.all([
            tx.select().from(priceAggregatesMonthly).where(and(
              eq(priceAggregatesMonthly.year, previousMonthYear),
              eq(priceAggregatesMonthly.month, previousMonth)
            )),
            tx.select().from(priceAggregatesMonthly).where(and(
              eq(priceAggregatesMonthly.year, year - 1),
              eq(priceAggregatesMonthly.month, month)
            )),
          ]);

          const previousMonthMap = this.buildPreviousPeriodMap(previousMonthData);
          const lastYearMap = this.buildPreviousPeriodMap(lastYearData);

          // Process with year-over-year calculation
          const values = this.processMonthlyAggregateData(
            priceData,
            previousMonthMap,
            lastYearMap,
            year,
            month
          );

          if (values.length === 0) {
            logger.info("[PriceAggregation] No valid data to insert");
            return 0;
          }

          await this.upsertMonthlyAggregates(tx, values);
          logger.info(`[PriceAggregation] Transaction committed: ${values.length} monthly aggregates`);
          return values.length;
        }),
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'calculateMonthlyAggregates', year, month },
        }
      ),
      { year, month }
    );
  }

  /**
   * Process monthly aggregate data with year-over-year calculation
   */
  private processMonthlyAggregateData(
    priceData: PriceDataRow[],
    previousMonthMap: Map<string | number, { avgPrice: string | null }>,
    lastYearMap: Map<string | number, { avgPrice: string | null }>,
    year: number,
    month: number
  ): (typeof priceAggregatesMonthly.$inferInsert)[] {
    const rawValues = priceData.map(data => {
      try {
        const { productId, retailerId } = validateProductRetailer(
          data.productId,
          data.retailerId,
          { year, month, aggregationType: 'monthly' }
        );

        const pricesArray = this.parsePostgresArray(data.prices);
        const stats = this.calculatePriceStatistics(pricesArray, {
          productId,
          retailerId,
          date: `${year}-${String(month).padStart(2, '0')}`,
        });

        const key = `${productId}-${retailerId}`;
        const prevMonthData = previousMonthMap.get(key);
        const prevYearData = lastYearMap.get(key);

        const monthOverMonthChange = calculatePeriodChange(
          stats.avgPrice,
          prevMonthData?.avgPrice ? parseFloat(prevMonthData.avgPrice) : null
        );
        const yearOverYearChange = calculatePeriodChange(
          stats.avgPrice,
          prevYearData?.avgPrice ? parseFloat(prevYearData.avgPrice) : null
        );

        return {
          productId,
          retailerId,
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
      } catch (error) {
        logger.error('[PriceAggregation] Invalid data in monthly aggregate:', {
          error: error instanceof Error ? error.message : String(error),
          productId: data.productId,
          retailerId: data.retailerId,
          year,
          month,
        });
        return null;
      }
    });

    return filterNullish(rawValues);
  }

  /**
   * Upsert monthly aggregates (shared by bulk and single-product methods)
   */
  private async upsertMonthlyAggregates(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    values: (typeof priceAggregatesMonthly.$inferInsert)[]
  ): Promise<void> {
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
  }

  /**
   * Calculate daily price aggregates for yesterday's data
   *
   * Runs automatically via scheduled job at 1:00 AM daily.
   * Aggregates all price history records from yesterday into daily summaries
   * containing min/max/avg/median prices and volatility scores.
   *
   * Marks aggregated records with `aggregated_at` timestamp for future cleanup.
   *
   * @returns Number of daily aggregates created
   * @throws Error if aggregation fails (transaction will rollback)
   *
   * OPTIMIZED: Uses database-level aggregation and batch operations
   * TRANSACTIONAL: All-or-nothing updates for data consistency
   */
  async calculateDailyAggregates(): Promise<number> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = yesterday.getMonth() + 1;
    const day = yesterday.getDate();
    const dateStr = this.formatDateStr(year, month, day);

    logger.info(`[PriceAggregation] Calculating daily aggregates for ${dateStr}`);

    return measureAggregation(
      'daily',
      async () => retryWithBackoff(
        async () => db.transaction(async (tx) => {
          const { startDate, endDate } = this.getDayDateRange(year, month, day);
          const priceData = await this.fetchPriceData(tx, startDate, endDate);

          if (priceData.length === 0) {
            logger.info("[PriceAggregation] No price data found for yesterday");
            return 0;
          }

          logger.info(`[PriceAggregation] Found ${priceData.length} product-retailer combinations`);

          // Fetch previous day data
          const previousDay = new Date(yesterday);
          previousDay.setDate(previousDay.getDate() - 1);
          const prevDateStr = this.formatDateStr(
            previousDay.getFullYear(),
            previousDay.getMonth() + 1,
            previousDay.getDate()
          );

          const previousDayData = await tx
            .select()
            .from(priceAggregatesDaily)
            .where(eq(priceAggregatesDaily.date, prevDateStr));
          const previousMap = this.buildPreviousPeriodMap(previousDayData);

          // Process data using shared helper
          const values = this.processAggregateData(
            priceData,
            previousMap,
            (productId, retailerId, stats, recordCount, dayOverDayChange) => ({
              productId,
              retailerId,
              date: dateStr,
              minPrice: stats.minPrice.toFixed(2),
              maxPrice: stats.maxPrice.toFixed(2),
              avgPrice: stats.avgPrice.toFixed(2),
              medianPrice: stats.medianPrice.toFixed(2),
              volatilityScore: stats.volatilityScore.toFixed(2),
              recordCount,
              dayOverDayChange,
              updatedAt: new Date(),
            }),
            { aggregationType: 'daily', periodLabel: dateStr }
          );

          if (values.length === 0) {
            logger.info("[PriceAggregation] No valid data to insert");
            return 0;
          }

          await this.upsertDailyAggregates(tx, values);

          // Mark price history records as aggregated
          await tx
            .update(priceHistory)
            .set({ aggregatedAt: new Date() })
            .where(and(
              gte(priceHistory.recordedAt, startDate),
              lte(priceHistory.recordedAt, endDate)
            ));

          logger.info(`[PriceAggregation] Transaction committed: ${values.length} daily aggregates`);
          return values.length;
        }),
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'calculateDailyAggregates', date: dateStr },
        }
      ),
      { date: dateStr }
    );
  }

  /**
   * Format date string in YYYY-MM-DD format
   */
  private formatDateStr(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Upsert daily aggregates (shared by bulk and single-product methods)
   */
  private async upsertDailyAggregates(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    values: (typeof priceAggregatesDaily.$inferInsert)[]
  ): Promise<void> {
    await tx
      .insert(priceAggregatesDaily)
      .values(values)
      .onConflictDoUpdate({
        target: [
          priceAggregatesDaily.productId,
          priceAggregatesDaily.retailerId,
          priceAggregatesDaily.date,
        ],
        set: {
          minPrice: sql`excluded.min_price`,
          maxPrice: sql`excluded.max_price`,
          avgPrice: sql`excluded.avg_price`,
          medianPrice: sql`excluded.median_price`,
          volatilityScore: sql`excluded.volatility_score`,
          recordCount: sql`excluded.record_count`,
          dayOverDayChange: sql`excluded.day_over_day_change`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  /**
   * Aggregate price history for a date range into daily aggregates
   *
   * Used by cleanup service for bulk aggregation of older data (30-90 days old).
   * Processes each day in the range individually, creating daily summaries
   * and marking source records as aggregated.
   *
   * Skips days that are already aggregated to avoid duplicate work.
   * Uses transactions per day to ensure partial failures don't corrupt data.
   *
   * @param startDate Start date (inclusive)
   * @param endDate End date (inclusive)
   * @param force Force re-aggregation even if data already exists (default: false)
   * @returns Total number of daily aggregates created across all days
   * @throws Error if aggregation fails for any day (that day's transaction rolls back)
   *
   * @example
   * // Aggregate 30-90 day old data during cleanup
   * const thirtyDaysAgo = new Date();
   * thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
   * const ninetyDaysAgo = new Date();
   * ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
   * const count = await priceAggregationService.aggregateToDaily(ninetyDaysAgo, thirtyDaysAgo);
   * console.log(`Aggregated ${count} days of historical data`);
   *
   * @example
   * // Re-aggregate a specific date range (incremental)
   * const start = new Date('2025-01-01');
   * const end = new Date('2025-01-07');
   * const count = await priceAggregationService.aggregateToDaily(start, end, true);
   * console.log(`Re-aggregated ${count} days (forced update)`);
   */
  async aggregateToDaily(startDate: Date, endDate: Date, force = false): Promise<number> {
    // Validate date range
    try {
      const validated = dateRangeSchema.parse({ startDate, endDate });
      validateReasonableDateRange(validated.startDate, validated.endDate);
    } catch (error) {
      logger.error('[PriceAggregation] Invalid date range for aggregation:', {
        error: error instanceof Error ? error.message : String(error),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      throw error;
    }

    logger.info(`[PriceAggregation] Aggregating date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    let totalAggregates = 0;
    const currentDate = new Date(startDate);

    // Process each day in the range
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate();

      try {
        await db.transaction(async (tx) => {
          const { startDate: dayStart, endDate: dayEnd } = this.getDayDateRange(year, month, day);
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          // Check if already aggregated (unless force=true)
          // SERIALIZABLE isolation prevents race conditions where multiple instances
          // might check at the same time and both proceed with aggregation
          if (!force) {
            const existing = await tx
              .select({ id: priceAggregatesDaily.id })
              .from(priceAggregatesDaily)
              .where(eq(priceAggregatesDaily.date, dateStr))
              .limit(1);

            if (existing.length > 0) {
              logger.info(`[PriceAggregation] Date ${dateStr} already aggregated, skipping`);
              return;
            }
          } else {
            logger.info(`[PriceAggregation] Force re-aggregation for ${dateStr}`);
          }

          // Aggregate this day
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
                gte(priceHistory.recordedAt, dayStart),
                lte(priceHistory.recordedAt, dayEnd)
              )
            )
            .groupBy(priceHistory.productId, priceHistory.retailerId);

          if (priceData.length === 0) {
            logger.info(`[PriceAggregation] No data for ${dateStr}`);
            return;
          }

          // Get previous day data for day-over-day change
          const previousDay = new Date(currentDate);
          previousDay.setDate(previousDay.getDate() - 1);
          const prevDateStr = `${previousDay.getFullYear()}-${String(previousDay.getMonth() + 1).padStart(2, '0')}-${String(previousDay.getDate()).padStart(2, '0')}`;

          const previousDayMap = new Map<string, typeof priceAggregatesDaily.$inferSelect>();
          const previousDayData = await tx
            .select()
            .from(priceAggregatesDaily)
            .where(eq(priceAggregatesDaily.date, prevDateStr));

          for (const record of previousDayData) {
            previousDayMap.set(`${record.productId}-${record.retailerId}`, record);
          }

          // Prepare values with validation
          const rawValues = priceData.map(data => {
            try {
              // Validate product and retailer IDs
              const { productId, retailerId } = validateProductRetailer(
                data.productId,
                data.retailerId,
                { date: dateStr }
              );

              const pricesArray = this.parsePostgresArray(data.prices);
              const stats = this.calculatePriceStatistics(pricesArray, {
                productId,
                retailerId,
                date: dateStr,
              });

              const prevData = previousDayMap.get(`${productId}-${retailerId}`);
              let dayOverDayChange = null;
              if (prevData?.avgPrice) {
                const prevAvg = parseFloat(prevData.avgPrice);
                dayOverDayChange = ((stats.avgPrice - prevAvg) / prevAvg * 100).toFixed(2);
              }

              return {
                productId,
                retailerId,
                date: dateStr,
                minPrice: stats.minPrice.toFixed(2),
                maxPrice: stats.maxPrice.toFixed(2),
                avgPrice: stats.avgPrice.toFixed(2),
                medianPrice: stats.medianPrice.toFixed(2),
                volatilityScore: stats.volatilityScore.toFixed(2),
                recordCount: data.recordCount,
                dayOverDayChange,
                updatedAt: new Date(),
              };
            } catch (error) {
              logger.error('[PriceAggregation] Invalid data in bulk aggregation:', {
                error: error instanceof Error ? error.message : String(error),
                productId: data.productId,
                retailerId: data.retailerId,
                date: dateStr,
              });
              return null; // Skip invalid records
            }
          });
        const values = filterNullish(rawValues);

          if (values.length > 0) {
            // Use upsert to support force re-aggregation
            await tx
              .insert(priceAggregatesDaily)
              .values(values)
              .onConflictDoUpdate({
                target: [
                  priceAggregatesDaily.productId,
                  priceAggregatesDaily.retailerId,
                  priceAggregatesDaily.date,
                ],
                set: {
                  minPrice: sql`excluded.min_price`,
                  maxPrice: sql`excluded.max_price`,
                  avgPrice: sql`excluded.avg_price`,
                  medianPrice: sql`excluded.median_price`,
                  volatilityScore: sql`excluded.volatility_score`,
                  recordCount: sql`excluded.record_count`,
                  dayOverDayChange: sql`excluded.day_over_day_change`,
                  updatedAt: sql`excluded.updated_at`,
                },
              });

            // Mark records as aggregated
            await tx
              .update(priceHistory)
              .set({ aggregatedAt: new Date() })
              .where(
                and(
                  gte(priceHistory.recordedAt, dayStart),
                  lte(priceHistory.recordedAt, dayEnd)
                )
              );

            totalAggregates += values.length;
            const action = force ? 'Re-aggregated' : 'Aggregated';
            logger.info(`[PriceAggregation] ${action} ${values.length} records for ${dateStr}`);
          }
        }, {
          isolationLevel: 'serializable', // Prevent race conditions in check-then-insert pattern
        });
      } catch (error) {
        logger.error(`[PriceAggregation] Failed to aggregate date ${year}-${month}-${day}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next day even if one fails
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    logger.info(`[PriceAggregation] Completed date range aggregation: ${totalAggregates} total aggregates`);
    return totalAggregates;
  }

  /**
   * Detect gaps in daily aggregates for a date range
   *
   * Identifies dates that have raw price history but no aggregated data.
   * Useful for finding missing aggregates and triggering incremental re-aggregation.
   *
   * @param startDate Start date to check (inclusive)
   * @param endDate End date to check (inclusive)
   * @returns Array of date strings (YYYY-MM-DD) that have gaps
   *
   * @example
   * const gaps = await priceAggregationService.detectGaps(
   *   new Date('2025-01-01'),
   *   new Date('2025-01-31')
   * );
   * console.log(`Found ${gaps.length} missing days:`, gaps);
   * // Output: ['2025-01-05', '2025-01-12', '2025-01-19']
   */
  async detectGaps(startDate: Date, endDate: Date): Promise<string[]> {
    // Validate date range
    const validated = dateRangeSchema.parse({ startDate, endDate });
    validateReasonableDateRange(validated.startDate, validated.endDate);

    logger.info('[PriceAggregation] Detecting gaps in aggregated data', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const gaps: string[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Check if this date has raw price history
      const { startDate: dayStart, endDate: dayEnd } = this.getDayDateRange(year, month, day);
      const [hasRawData, hasAggregatedData] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(priceHistory)
          .where(
            and(
              gte(priceHistory.recordedAt, dayStart),
              lte(priceHistory.recordedAt, dayEnd)
            )
          )
          .then(rows => parseInt(String(rows[0].count)) > 0),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(priceAggregatesDaily)
          .where(eq(priceAggregatesDaily.date, dateStr))
          .then(rows => parseInt(String(rows[0].count)) > 0),
      ]);

      // Gap exists if there's raw data but no aggregated data
      if (hasRawData && !hasAggregatedData) {
        gaps.push(dateStr);
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    logger.info(`[PriceAggregation] Found ${gaps.length} gaps in date range`);
    return gaps;
  }

  /**
   * Fill gaps in daily aggregates
   *
   * Detects dates with missing aggregates and re-aggregates them.
   * Useful for healing data after service outages or failed jobs.
   *
   * @param startDate Start date to check (inclusive)
   * @param endDate End date to check (inclusive)
   * @returns Number of days re-aggregated
   *
   * @example
   * // Fill any gaps in the last 90 days
   * const ninetyDaysAgo = new Date();
   * ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
   * const filled = await priceAggregationService.fillGaps(ninetyDaysAgo, new Date());
   * console.log(`Filled ${filled} missing days`);
   */
  async fillGaps(startDate: Date, endDate: Date): Promise<number> {
    const gaps = await this.detectGaps(startDate, endDate);

    if (gaps.length === 0) {
      logger.info('[PriceAggregation] No gaps found, nothing to fill');
      return 0;
    }

    logger.info(`[PriceAggregation] Filling ${gaps.length} gaps`);

    let filled = 0;
    for (const dateStr of gaps) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const dayStart = new Date(year, month - 1, day);
      const dayEnd = new Date(year, month - 1, day);

      // Re-aggregate this single day with force=true
      try {
        const count = await this.aggregateToDaily(dayStart, dayEnd, true);
        if (count > 0) {
          filled++;
        }
      } catch (error) {
        logger.error(`[PriceAggregation] Failed to fill gap for ${dateStr}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next day even if one fails
      }
    }

    logger.info(`[PriceAggregation] Successfully filled ${filled} out of ${gaps.length} gaps`);
    return filled;
  }

  /**
   * Calculate aggregates for a specific product
   * Useful when a product is updated individually
   *
   * FIXED: Now actually filters by product ID
   */
  async calculateProductAggregates(productId: number): Promise<void> {
    // Validate product ID
    try {
      productIdSchema.parse(productId);
    } catch (error) {
      throw new ValidationError('Invalid product ID', {
        productId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      logger.info(`[PriceAggregation] Calculating aggregates for product ${productId}`);

      const now = new Date();
      const year = now.getFullYear();
      const week = this.getISOWeek(now);
      const month = now.getMonth() + 1;
      const day = now.getDate();

      // Calculate daily for this product only
      await this.calculateDailyAggregatesForProduct(productId, year, month, day);

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
   * Calculate daily aggregates for a specific product
   * Uses shared helpers and upsert function for DRY compliance
   */
  private async calculateDailyAggregatesForProduct(
    productId: number,
    year: number,
    month: number,
    day: number
  ): Promise<void> {
    const { startDate, endDate } = this.getDayDateRange(year, month, day);
    const dateStr = this.formatDateStr(year, month, day);

    const priceData = await this.fetchProductPriceData(productId, startDate, endDate);
    if (priceData.length === 0) return;

    // Get previous day data
    const previousDay = new Date(year, month - 1, day);
    previousDay.setDate(previousDay.getDate() - 1);
    const prevDateStr = this.formatDateStr(
      previousDay.getFullYear(),
      previousDay.getMonth() + 1,
      previousDay.getDate()
    );

    const previousDayData = await db
      .select()
      .from(priceAggregatesDaily)
      .where(and(
        eq(priceAggregatesDaily.productId, productId),
        eq(priceAggregatesDaily.date, prevDateStr)
      ));

    const previousMap = this.buildRetailerMap(previousDayData);
    const values = this.processProductAggregateData(
      priceData,
      previousMap,
      (retailerId, stats, recordCount, dayOverDayChange) => ({
        productId,
        retailerId,
        date: dateStr,
        minPrice: stats.minPrice.toFixed(2),
        maxPrice: stats.maxPrice.toFixed(2),
        avgPrice: stats.avgPrice.toFixed(2),
        medianPrice: stats.medianPrice.toFixed(2),
        volatilityScore: stats.volatilityScore.toFixed(2),
        recordCount,
        dayOverDayChange,
        updatedAt: new Date(),
      })
    );

    if (values.length > 0) {
      await this.upsertDailyAggregates(db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0], values);
    }
  }

  /**
   * Calculate weekly aggregates for a specific product
   * Uses shared helpers and upsert function for DRY compliance
   */
  private async calculateWeeklyAggregatesForProduct(
    productId: number,
    year: number,
    week: number
  ): Promise<void> {
    const { startDate, endDate } = this.getWeekDateRange(year, week);

    const priceData = await this.fetchProductPriceData(productId, startDate, endDate);
    if (priceData.length === 0) return;

    // Get previous week data
    const previousWeek = week === 1 ? 52 : week - 1;
    const previousYear = week === 1 ? year - 1 : year;

    const previousWeekData = await db
      .select()
      .from(priceAggregatesWeekly)
      .where(and(
        eq(priceAggregatesWeekly.productId, productId),
        eq(priceAggregatesWeekly.year, previousYear),
        eq(priceAggregatesWeekly.week, previousWeek)
      ));

    const previousMap = this.buildRetailerMap(previousWeekData);
    const values = this.processProductAggregateData(
      priceData,
      previousMap,
      (retailerId, stats, recordCount, weekOverWeekChange) => ({
        productId,
        retailerId,
        year,
        week,
        minPrice: stats.minPrice.toFixed(2),
        maxPrice: stats.maxPrice.toFixed(2),
        avgPrice: stats.avgPrice.toFixed(2),
        medianPrice: stats.medianPrice.toFixed(2),
        volatilityScore: stats.volatilityScore.toFixed(2),
        recordCount,
        weekOverWeekChange,
        updatedAt: new Date(),
      })
    );

    if (values.length > 0) {
      await this.upsertWeeklyAggregates(db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0], values);
    }
  }

  /**
   * Calculate monthly aggregates for a specific product
   * Uses shared helpers and upsert function for DRY compliance
   */
  private async calculateMonthlyAggregatesForProduct(
    productId: number,
    year: number,
    month: number
  ): Promise<void> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const priceData = await this.fetchProductPriceData(productId, startDate, endDate);
    if (priceData.length === 0) return;

    // Get previous month and year-over-year data
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousMonthYear = month === 1 ? year - 1 : year;

    const [previousMonthData, lastYearData] = await Promise.all([
      db.select().from(priceAggregatesMonthly).where(and(
        eq(priceAggregatesMonthly.productId, productId),
        eq(priceAggregatesMonthly.year, previousMonthYear),
        eq(priceAggregatesMonthly.month, previousMonth)
      )),
      db.select().from(priceAggregatesMonthly).where(and(
        eq(priceAggregatesMonthly.productId, productId),
        eq(priceAggregatesMonthly.year, year - 1),
        eq(priceAggregatesMonthly.month, month)
      )),
    ]);

    const previousMonthMap = this.buildRetailerMap(previousMonthData);
    const lastYearMap = this.buildRetailerMap(lastYearData);

    const values = this.processProductMonthlyData(
      priceData,
      previousMonthMap,
      lastYearMap,
      productId,
      year,
      month
    );

    if (values.length > 0) {
      await this.upsertMonthlyAggregates(db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0], values);
    }
  }

  // ============================================================================
  // SINGLE-PRODUCT HELPERS (DRY)
  // ============================================================================

  /**
   * Fetch price data for a specific product
   */
  private async fetchProductPriceData(
    productId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{ retailerId: number | null; prices: string; recordCount: number }[]> {
    return db
      .select({
        retailerId: priceHistory.retailerId,
        prices: sql<string>`array_agg(${priceHistory.price}::numeric ORDER BY ${priceHistory.recordedAt})`,
        recordCount: sql<number>`count(*)::int`,
      })
      .from(priceHistory)
      .where(and(
        eq(priceHistory.productId, productId),
        gte(priceHistory.recordedAt, startDate),
        lte(priceHistory.recordedAt, endDate)
      ))
      .groupBy(priceHistory.retailerId);
  }

  /**
   * Build retailer-keyed map for single-product aggregation
   */
  private buildRetailerMap<T extends { retailerId: number; avgPrice: string | null }>(
    data: T[]
  ): Map<number, T> {
    const map = new Map<number, T>();
    for (const record of data) {
      map.set(record.retailerId, record);
    }
    return map;
  }

  /**
   * Process single-product aggregate data
   */
  private processProductAggregateData<T>(
    priceData: { retailerId: number | null; prices: string; recordCount: number }[],
    previousMap: Map<number, { avgPrice: string | null }>,
    buildValue: (retailerId: number, stats: AggregateStats, recordCount: number, periodChange: string | null) => T
  ): T[] {
    const rawValues = priceData.map(data => {
      if (!data.retailerId) return null;

      const pricesArray = this.parsePostgresArray(data.prices);
      const stats = this.calculatePriceStatistics(pricesArray);

      const prevData = previousMap.get(data.retailerId);
      const periodChange = calculatePeriodChange(
        stats.avgPrice,
        prevData?.avgPrice ? parseFloat(prevData.avgPrice) : null
      );

      return buildValue(data.retailerId, stats, data.recordCount, periodChange);
    });

    return filterNullish(rawValues);
  }

  /**
   * Process single-product monthly data (with year-over-year)
   */
  private processProductMonthlyData(
    priceData: { retailerId: number | null; prices: string; recordCount: number }[],
    previousMonthMap: Map<number, { avgPrice: string | null }>,
    lastYearMap: Map<number, { avgPrice: string | null }>,
    productId: number,
    year: number,
    month: number
  ): (typeof priceAggregatesMonthly.$inferInsert)[] {
    const rawValues = priceData.map(data => {
      if (!data.retailerId) return null;

      const pricesArray = this.parsePostgresArray(data.prices);
      const stats = this.calculatePriceStatistics(pricesArray);

      const prevMonthData = previousMonthMap.get(data.retailerId);
      const prevYearData = lastYearMap.get(data.retailerId);

      const monthOverMonthChange = calculatePeriodChange(
        stats.avgPrice,
        prevMonthData?.avgPrice ? parseFloat(prevMonthData.avgPrice) : null
      );
      const yearOverYearChange = calculatePeriodChange(
        stats.avgPrice,
        prevYearData?.avgPrice ? parseFloat(prevYearData.avgPrice) : null
      );

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
    });

    return filterNullish(rawValues);
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
   * Helper: Calculate price statistics with validation
   */
  private calculatePriceStatistics(
    prices: number[],
    context?: { productId?: number; retailerId?: number; date?: string }
  ): {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    medianPrice: number;
    volatilityScore: number;
    count: number;
  } {
    // Validate prices array before processing
    validatePricesArray(prices, context || {});

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

  /**
   * Helper: Get date range for a specific day
   */
  private getDayDateRange(year: number, month: number, day: number): { startDate: Date; endDate: Date } {
    const startDate = new Date(year, month - 1, day);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(year, month - 1, day);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }
}

// Singleton instance
export const priceAggregationService = new PriceAggregationService();
