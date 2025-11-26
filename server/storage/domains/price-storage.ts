/**
 * Price Storage Domain
 *
 * Handles all price-related database operations including price history, analytics,
 * aggregations, snapshots, and trend analysis.
 *
 * PERFORMANCE REQUIREMENTS:
 * - **N+1 Prevention**: Uses batch queries and JOINs where applicable
 * - **Input Validation**: All numeric ID parameters validated as positive integers
 * - **Aggregation Efficiency**: Database-level aggregations to reduce memory usage
 *
 * Phase 3B: Price & PriceHistory Domain Extraction - Migrated from monolithic storage.ts
 */

import { db } from "../../db";
import { eq, and, gte, lte, inArray, sql, desc, asc, isNotNull } from "drizzle-orm";
import {
  priceHistory,
  priceAggregatesDaily,
  priceAggregatesWeekly,
  priceAggregatesMonthly,
  priceSnapshots,
  priceTrends,
  retailers,
  productOffers,
  type PriceHistory,
  type ProductOffer,
} from "@shared/schema";
import { BaseStorage } from "../base-storage";
import type { NormalizedPricePoint } from "../../services/price-history-service";
import type {
  PriceHistoryWithDetails,
  PriceTrendAnalysis,
  BestTimeAnalysis,
  WeeklyAggregate,
  MonthlyAggregate,
  PriceAggregationData,
  WeeklyAggregateRecord,
  DailyAggregateRecord,
  MonthlyAggregateRecord,
  DailyAggregateInsert,
  WeeklyAggregateInsert,
  MonthlyAggregateInsert,
  InsertPriceHistoryWithRecordedAt,
  PriceHistoryQueryParams,
  PriceSnapshotRecord,
  PriceSnapshotInsert,
  TrendPriceData,
  PriceTrendInsert,
  PriceTrendWithRetailer,
} from "../types";

/**
 * PriceStorage - Domain repository for price operations
 *
 * Extends BaseStorage to inherit error handling and logging utilities.
 * Implements the 7-point implementation guidance from base-storage.ts:
 * 1. Input Validation - validateProductId, validateOfferId, validateRetailerId
 * 2. N+1 Prevention - Uses JOINs, batch queries, array_agg for grouped data
 * 3. Security - No sensitive fields in price domain
 * 4. Error Handling - Uses handleError() for storage errors
 * 5. Transactions - Not required for most single-table price operations
 * 6. Retry Logic - Handled by caller if needed
 * 7. Logging - Uses logSuccess() for completed operations where appropriate
 */
export class PriceStorage extends BaseStorage {
  /**
   * Validate product ID is positive integer
   * Used by: Price history, trend, and analytics methods
   * @private
   */
  private validateProductId(productId: number): void {
    if (!productId || productId < 1 || !Number.isInteger(productId)) {
      throw new Error(`Invalid productId: ${productId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate offer ID is positive integer
   * Used by: Price snapshot and history methods
   * @private
   */
  private validateOfferId(offerId: number): void {
    if (!offerId || offerId < 1 || !Number.isInteger(offerId)) {
      throw new Error(`Invalid offerId: ${offerId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate retailer ID is positive integer
   * Used by: Retailer-specific price methods
   * @private
   */
  private validateRetailerId(retailerId: number): void {
    if (!retailerId || retailerId < 1 || !Number.isInteger(retailerId)) {
      throw new Error(`Invalid retailerId: ${retailerId}. Must be a positive integer.`);
    }
  }

  // ============================================================================
  // Price History Operations
  // ============================================================================

  /**
   * Get price history with smart data source selection
   * Automatically uses aggregated data for longer time ranges
   *
   * @param productId - Product ID (validated as positive integer)
   * @param days - Number of days of history to retrieve (default: 30)
   * @returns Array of price history with retailer details
   */
  async getPriceHistory(productId: number, days?: number): Promise<PriceHistoryWithDetails[]> {
    try {
      this.validateProductId(productId);

      // Use optimized query that selects appropriate data source based on date range
      const { getPriceHistoryOptimized } = await import('../../services/price-history-service');
      const optimizedData = await getPriceHistoryOptimized(productId, days || 30);

      // Convert normalized format to legacy format for backward compatibility
      return optimizedData.map((point: NormalizedPricePoint) => ({
        id: 0, // Not available in aggregated data
        productOfferId: 0, // Not available in aggregated data
        productId,
        retailerId: point.retailerId,
        price: point.price.toFixed(2),
        originalPrice: null,
        availability: point.availability || null,
        rating: null,
        reviewCount: null,
        source: point.source,
        confidence: '1.00',
        metadata: null,
        recordedAt: point.date,
        aggregatedAt: null,
        createdAt: point.date,
        retailerName: point.retailerName || '',
        retailerLogo: null,
      }));
    } catch (error) {
      this.handleError(error, 'getPriceHistory');
    }
  }

  /**
   * Get retailer-specific price history with smart data source selection
   *
   * @param productId - Product ID (validated as positive integer)
   * @param retailerId - Retailer ID (validated as positive integer)
   * @param days - Number of days of history to retrieve (default: 30)
   * @returns Array of price history records
   */
  async getRetailerPriceHistory(productId: number, retailerId: number, days?: number): Promise<PriceHistory[]> {
    try {
      this.validateProductId(productId);
      this.validateRetailerId(retailerId);

      // Use optimized query with retailer filter
      const { getPriceHistoryOptimized } = await import('../../services/price-history-service');
      const optimizedData = await getPriceHistoryOptimized(productId, days || 30, retailerId);

      // Convert normalized format to legacy format
      return optimizedData.map((point: NormalizedPricePoint) => ({
        id: 0,
        productOfferId: 0,
        productId,
        retailerId: point.retailerId,
        price: point.price.toFixed(2),
        originalPrice: null,
        availability: point.availability || null,
        rating: null,
        reviewCount: null,
        source: point.source,
        confidence: '1.00',
        metadata: null,
        recordedAt: point.date,
        aggregatedAt: null,
        createdAt: point.date,
      }));
    } catch (error) {
      this.handleError(error, 'getRetailerPriceHistory');
    }
  }

  /**
   * Get price history for a specific product offer (for drop detection)
   *
   * @param productOfferId - ID of the product offer (validated as positive integer)
   * @param limit - Maximum number of history records to return (must be > 0)
   * @returns Array of price history ordered by recordedAt (newest first)
   */
  async getPriceHistoryByOfferId(productOfferId: number, limit: number): Promise<PriceHistory[]> {
    try {
      this.validateOfferId(productOfferId);

      if (limit <= 0) {
        throw new Error('limit must be greater than 0');
      }

      const history = await this.db.select()
        .from(priceHistory)
        .where(eq(priceHistory.productOfferId, productOfferId))
        .orderBy(desc(priceHistory.recordedAt))
        .limit(limit);

      return history;
    } catch (error) {
      this.handleError(error, 'getPriceHistoryByOfferId');
    }
  }

  /**
   * Get latest price for a specific offer
   * Used for: Price snapshot jobs, current price lookups
   *
   * @param offerId - Offer ID (validated as positive integer)
   * @returns Most recent price history record or null if not found
   */
  async getLatestPriceForOffer(offerId: number): Promise<PriceHistory | null> {
    try {
      this.validateOfferId(offerId);

      const [result] = await this.db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.productOfferId, offerId))
        .orderBy(desc(priceHistory.recordedAt))
        .limit(1);

      return result || null;
    } catch (error) {
      this.handleError(error, 'getLatestPriceForOffer');
    }
  }

  /**
   * Insert new price history record
   *
   * @param data - Price history data with recordedAt timestamp
   * @returns Created price history record
   */
  async insertPriceHistory(data: InsertPriceHistoryWithRecordedAt): Promise<PriceHistory> {
    try {
      const [result] = await this.db
        .insert(priceHistory)
        .values(data)
        .returning();
      return result;
    } catch (error) {
      this.handleError(error, 'insertPriceHistory');
    }
  }

  /**
   * Query price history with flexible filters
   *
   * @param query - Filter parameters (productOfferId, productId, retailerId, dates, source, limit)
   * @returns Array of price history matching filters, ordered by recordedAt (newest first)
   */
  async getPriceHistoryByQuery(query: PriceHistoryQueryParams): Promise<PriceHistory[]> {
    try {
      const conditions: ReturnType<typeof eq>[] = [];

      if (query.productOfferId) {
        this.validateOfferId(query.productOfferId);
        conditions.push(eq(priceHistory.productOfferId, query.productOfferId));
      }
      if (query.productId) {
        this.validateProductId(query.productId);
        conditions.push(eq(priceHistory.productId, query.productId));
      }
      if (query.retailerId) {
        this.validateRetailerId(query.retailerId);
        conditions.push(eq(priceHistory.retailerId, query.retailerId));
      }
      if (query.startDate) {
        conditions.push(gte(priceHistory.recordedAt, query.startDate));
      }
      if (query.endDate) {
        conditions.push(lte(priceHistory.recordedAt, query.endDate));
      }
      if (query.source) {
        conditions.push(eq(priceHistory.source, query.source));
      }

      // Build query with all conditions and limit applied at once to avoid type issues
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      if (whereClause && query.limit) {
        return this.db
          .select()
          .from(priceHistory)
          .where(whereClause)
          .orderBy(desc(priceHistory.recordedAt))
          .limit(query.limit);
      } else if (whereClause) {
        return this.db
          .select()
          .from(priceHistory)
          .where(whereClause)
          .orderBy(desc(priceHistory.recordedAt));
      } else if (query.limit) {
        return this.db
          .select()
          .from(priceHistory)
          .orderBy(desc(priceHistory.recordedAt))
          .limit(query.limit);
      } else {
        return this.db
          .select()
          .from(priceHistory)
          .orderBy(desc(priceHistory.recordedAt));
      }
    } catch (error) {
      this.handleError(error, 'getPriceHistoryByQuery');
    }
  }

  // ============================================================================
  // Price Trend & Analysis Operations
  // ============================================================================

  /**
   * Get price trend analysis for a product
   * Analyzes last 30 days of price history
   *
   * @param productId - Product ID (validated as positive integer)
   * @returns Trend analysis including current/average/min/max prices and trend direction
   */
  async getPriceTrend(productId: number): Promise<PriceTrendAnalysis> {
    try {
      this.validateProductId(productId);

      // Get price history for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Select only required columns for price calculations (performance optimization)
      const history = await this.db
        .select({
          price: priceHistory.price,
          recordedAt: priceHistory.recordedAt,
        })
        .from(priceHistory)
        .where(and(
          eq(priceHistory.productId, productId),
          gte(priceHistory.recordedAt, thirtyDaysAgo)
        ))
        .orderBy(asc(priceHistory.recordedAt));

      if (history.length === 0) {
        // No history, use current price from offers (requires ProductStorage integration)
        // Note: This calls getProductOffers which is in ProductStorage domain
        const { storage } = await import('../../storage');
        const offers = await storage.getProductOffers(productId);
        const currentPrice = offers.length > 0
          ? Math.min(...offers.map(o => parseFloat(o.price)))
          : 0;

        return {
          productId,
          currentPrice,
          averagePrice: currentPrice,
          lowestPrice: currentPrice,
          highestPrice: currentPrice,
          trend: 'stable',
          changePercentage: 0,
          daysAnalyzed: 0,
        };
      }

      const prices = history.map(h => parseFloat(h.price));
      const currentPrice = prices[prices.length - 1];
      const oldestPrice = prices[0];
      const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);

      // Calculate trend
      const priceChange = currentPrice - oldestPrice;
      const changePercentage = oldestPrice > 0
        ? ((priceChange / oldestPrice) * 100)
        : 0;

      let trend: 'rising' | 'falling' | 'stable' = 'stable';
      if (Math.abs(changePercentage) > 5) {
        trend = changePercentage > 0 ? 'rising' : 'falling';
      }

      return {
        productId,
        currentPrice,
        averagePrice,
        lowestPrice,
        highestPrice,
        trend,
        changePercentage,
        daysAnalyzed: history.length,
      };
    } catch (error) {
      this.handleError(error, 'getPriceTrend');
    }
  }

  /**
   * Get best time to buy analysis for a product
   * Analyzes last 90 days of price history and provides recommendation
   *
   * @param productId - Product ID (validated as positive integer)
   * @returns Analysis with recommendation (buy_now, wait, good_deal) and confidence score
   */
  async getBestTimeToBuy(productId: number): Promise<BestTimeAnalysis> {
    try {
      this.validateProductId(productId);

      // Get price history for the last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Select only required columns for price calculations (performance optimization)
      const history = await this.db
        .select({
          price: priceHistory.price,
          recordedAt: priceHistory.recordedAt,
        })
        .from(priceHistory)
        .where(and(
          eq(priceHistory.productId, productId),
          gte(priceHistory.recordedAt, ninetyDaysAgo)
        ))
        .orderBy(asc(priceHistory.recordedAt));

      // Get current price (requires ProductStorage integration)
      const { storage } = await import('../../storage');
      const offers = await storage.getProductOffers(productId);
      const currentPrice = offers.length > 0
        ? Math.min(...offers.map(o => parseFloat(o.price)))
        : 0;

      if (history.length === 0) {
        return {
          productId,
          currentPrice,
          historicalAverage: currentPrice,
          lowestPriceLast90Days: currentPrice,
          daysSinceLowest: 0,
          recommendation: 'buy_now',
          confidenceScore: 0.5,
          priceChangeVelocity: 0,
        };
      }

      const prices = history.map(h => parseFloat(h.price));
      const historicalAverage = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const lowestPriceLast90Days = Math.min(...prices);

      // Find days since lowest price
      const lowestPriceIndex = prices.lastIndexOf(lowestPriceLast90Days);
      const lowestPriceDate = history[lowestPriceIndex].recordedAt;
      const daysSinceLowest = Math.floor(
        (Date.now() - new Date(lowestPriceDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate price change velocity (change per day over last 7 days)
      const sevenDaysOfPrices = prices.slice(-7);
      const priceChangeVelocity = sevenDaysOfPrices.length >= 2
        ? (sevenDaysOfPrices[sevenDaysOfPrices.length - 1] - sevenDaysOfPrices[0]) / sevenDaysOfPrices.length
        : 0;

      // Determine recommendation
      let recommendation: 'buy_now' | 'wait' | 'good_deal' = 'buy_now';
      let confidenceScore = 0.5;

      const percentageBelowAverage = ((historicalAverage - currentPrice) / historicalAverage) * 100;

      if (currentPrice <= lowestPriceLast90Days * 1.05) {
        // Within 5% of historical low
        recommendation = 'good_deal';
        confidenceScore = 0.9;
      } else if (percentageBelowAverage > 10) {
        // More than 10% below average
        recommendation = 'good_deal';
        confidenceScore = 0.8;
      } else if (priceChangeVelocity < 0 && percentageBelowAverage > 0) {
        // Price is falling and below average
        recommendation = 'wait';
        confidenceScore = 0.7;
      } else if (priceChangeVelocity > 0 && percentageBelowAverage < -5) {
        // Price is rising and above average
        recommendation = 'wait';
        confidenceScore = 0.8;
      } else {
        recommendation = 'buy_now';
        confidenceScore = 0.6;
      }

      return {
        productId,
        currentPrice,
        historicalAverage,
        lowestPriceLast90Days,
        daysSinceLowest,
        recommendation,
        confidenceScore,
        priceChangeVelocity,
      };
    } catch (error) {
      this.handleError(error, 'getBestTimeToBuy');
    }
  }

  // ============================================================================
  // Price Analytics & Aggregation Operations
  // ============================================================================

  /**
   * Get weekly price aggregates for a product
   *
   * @param productId - Product ID (validated as positive integer)
   * @param options - Optional filters (year, week, retailerId, limit)
   * @returns Array of weekly aggregates ordered by year/week (descending)
   */
  async getWeeklyAggregates(
    productId: number,
    options?: { year?: number; week?: number; retailerId?: number; limit?: number }
  ): Promise<WeeklyAggregate[]> {
    try {
      this.validateProductId(productId);

      const { year, week, retailerId, limit = 12 } = options || {};

      const conditions = [eq(priceAggregatesWeekly.productId, productId)];

      if (year !== undefined) {
        conditions.push(eq(priceAggregatesWeekly.year, year));
      }

      if (week !== undefined) {
        conditions.push(eq(priceAggregatesWeekly.week, week));
      }

      if (retailerId !== undefined) {
        this.validateRetailerId(retailerId);
        conditions.push(eq(priceAggregatesWeekly.retailerId, retailerId));
      }

      const result = await this.db
        .select()
        .from(priceAggregatesWeekly)
        .where(and(...conditions))
        .orderBy(desc(priceAggregatesWeekly.year), desc(priceAggregatesWeekly.week))
        .limit(limit);

      return result.map(row => ({
        id: row.id,
        productId: row.productId,
        retailerId: row.retailerId,
        year: row.year,
        week: row.week,
        minPrice: row.minPrice,
        maxPrice: row.maxPrice,
        avgPrice: row.avgPrice,
        medianPrice: row.medianPrice,
        volatilityScore: row.volatilityScore,
        recordCount: row.recordCount,
        weekOverWeekChange: row.weekOverWeekChange,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    } catch (error) {
      this.handleError(error, 'getWeeklyAggregates');
    }
  }

  /**
   * Get monthly price aggregates for a product
   *
   * @param productId - Product ID (validated as positive integer)
   * @param options - Optional filters (year, month, retailerId, limit)
   * @returns Array of monthly aggregates ordered by year/month (descending)
   */
  async getMonthlyAggregates(
    productId: number,
    options?: { year?: number; month?: number; retailerId?: number; limit?: number }
  ): Promise<MonthlyAggregate[]> {
    try {
      this.validateProductId(productId);

      const { year, month, retailerId, limit = 12 } = options || {};

      const conditions = [eq(priceAggregatesMonthly.productId, productId)];

      if (year !== undefined) {
        conditions.push(eq(priceAggregatesMonthly.year, year));
      }

      if (month !== undefined) {
        conditions.push(eq(priceAggregatesMonthly.month, month));
      }

      if (retailerId !== undefined) {
        this.validateRetailerId(retailerId);
        conditions.push(eq(priceAggregatesMonthly.retailerId, retailerId));
      }

      const result = await this.db
        .select()
        .from(priceAggregatesMonthly)
        .where(and(...conditions))
        .orderBy(desc(priceAggregatesMonthly.year), desc(priceAggregatesMonthly.month))
        .limit(limit);

      return result.map(row => ({
        id: row.id,
        productId: row.productId,
        retailerId: row.retailerId,
        year: row.year,
        month: row.month,
        minPrice: row.minPrice,
        maxPrice: row.maxPrice,
        avgPrice: row.avgPrice,
        medianPrice: row.medianPrice,
        volatilityScore: row.volatilityScore,
        recordCount: row.recordCount,
        monthOverMonthChange: row.monthOverMonthChange,
        yearOverYearChange: row.yearOverYearChange,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    } catch (error) {
      this.handleError(error, 'getMonthlyAggregates');
    }
  }

  /**
   * Get raw price data for aggregation processing
   * Database-level aggregation using array_agg
   *
   * @param startDate - Start date for data range
   * @param endDate - End date for data range
   * @param productId - Optional product ID filter
   * @returns Array of aggregated price data grouped by product and retailer
   */
  async getPriceDataForAggregation(startDate: Date, endDate: Date, productId?: number): Promise<PriceAggregationData[]> {
    try {
      const conditions = [
        gte(priceHistory.recordedAt, startDate),
        lte(priceHistory.recordedAt, endDate)
      ];

      if (productId !== undefined) {
        this.validateProductId(productId);
        conditions.push(eq(priceHistory.productId, productId));
      }

      const result = await this.db
        .select({
          productId: priceHistory.productId,
          retailerId: priceHistory.retailerId,
          prices: sql<string>`array_agg(${priceHistory.price}::numeric ORDER BY ${priceHistory.recordedAt})`,
          recordCount: sql<number>`count(*)::int`,
        })
        .from(priceHistory)
        .where(and(...conditions))
        .groupBy(priceHistory.productId, priceHistory.retailerId);

      return result;
    } catch (error) {
      this.handleError(error, 'getPriceDataForAggregation');
    }
  }

  /**
   * Get weekly aggregate records for a specific week
   *
   * @param year - Year (4-digit)
   * @param week - Week number (1-53)
   * @returns Array of weekly aggregate records
   */
  async getWeeklyAggregatesData(year: number, week: number): Promise<WeeklyAggregateRecord[]> {
    try {
      const result = await this.db
        .select()
        .from(priceAggregatesWeekly)
        .where(and(
          eq(priceAggregatesWeekly.year, year),
          eq(priceAggregatesWeekly.week, week)
        ));
      return result;
    } catch (error) {
      this.handleError(error, 'getWeeklyAggregatesData');
    }
  }

  /**
   * Get daily aggregate records for a specific date
   *
   * @param date - Date string (YYYY-MM-DD)
   * @returns Array of daily aggregate records
   */
  async getDailyAggregatesData(date: string): Promise<DailyAggregateRecord[]> {
    try {
      const result = await this.db
        .select()
        .from(priceAggregatesDaily)
        .where(eq(priceAggregatesDaily.date, date));
      return result;
    } catch (error) {
      this.handleError(error, 'getDailyAggregatesData');
    }
  }

  /**
   * Get monthly aggregate records for a specific month
   *
   * @param year - Year (4-digit)
   * @param month - Month number (1-12)
   * @returns Array of monthly aggregate records
   */
  async getMonthlyAggregatesData(year: number, month: number): Promise<MonthlyAggregateRecord[]> {
    try {
      const result = await this.db
        .select()
        .from(priceAggregatesMonthly)
        .where(and(
          eq(priceAggregatesMonthly.year, year),
          eq(priceAggregatesMonthly.month, month)
        ));
      return result;
    } catch (error) {
      this.handleError(error, 'getMonthlyAggregatesData');
    }
  }

  /**
   * Upsert daily price aggregates (insert or update on conflict)
   *
   * @param values - Array of daily aggregate records to upsert
   */
  async upsertDailyAggregates(values: DailyAggregateInsert[]): Promise<void> {
    try {
      if (values.length === 0) return;

      await this.db
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
    } catch (error) {
      this.handleError(error, 'upsertDailyAggregates');
    }
  }

  /**
   * Upsert weekly price aggregates (insert or update on conflict)
   *
   * @param values - Array of weekly aggregate records to upsert
   */
  async upsertWeeklyAggregates(values: WeeklyAggregateInsert[]): Promise<void> {
    try {
      if (values.length === 0) return;

      await this.db
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
    } catch (error) {
      this.handleError(error, 'upsertWeeklyAggregates');
    }
  }

  /**
   * Upsert monthly price aggregates (insert or update on conflict)
   *
   * @param values - Array of monthly aggregate records to upsert
   */
  async upsertMonthlyAggregates(values: MonthlyAggregateInsert[]): Promise<void> {
    try {
      if (values.length === 0) return;

      await this.db
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
    } catch (error) {
      this.handleError(error, 'upsertMonthlyAggregates');
    }
  }

  /**
   * Mark price history records as aggregated
   * Sets aggregatedAt timestamp for records in date range
   *
   * @param startDate - Start date of range to mark
   * @param endDate - End date of range to mark
   */
  async markPriceHistoryAsAggregated(startDate: Date, endDate: Date): Promise<void> {
    try {
      await this.db
        .update(priceHistory)
        .set({ aggregatedAt: new Date() })
        .where(and(
          gte(priceHistory.recordedAt, startDate),
          lte(priceHistory.recordedAt, endDate)
        ));
    } catch (error) {
      this.handleError(error, 'markPriceHistoryAsAggregated');
    }
  }

  /**
   * Delete old aggregated price history records
   * Only deletes records that have been aggregated (aggregatedAt is not null)
   *
   * @param cutoffDate - Delete records older than this date
   * @returns Number of records deleted
   */
  async deleteOldAggregatedPriceHistory(cutoffDate: Date): Promise<number> {
    try {
      const result = await this.db
        .delete(priceHistory)
        .where(and(
          lte(priceHistory.recordedAt, cutoffDate),
          isNotNull(priceHistory.aggregatedAt)
        ));
      return result.rowCount || 0;
    } catch (error) {
      this.handleError(error, 'deleteOldAggregatedPriceHistory');
    }
  }

  // ============================================================================
  // Price Snapshot Operations
  // ============================================================================

  /**
   * Get existing price snapshots for a specific date
   *
   * @param date - Date to check for snapshots
   * @returns Array of price snapshot records for the date
   */
  async getExistingSnapshotsForDate(date: Date): Promise<PriceSnapshotRecord[]> {
    try {
      const result = await this.db
        .select()
        .from(priceSnapshots)
        .where(sql`DATE(${priceSnapshots.snapshotDate}) = DATE(${date})`);
      return result;
    } catch (error) {
      this.handleError(error, 'getExistingSnapshotsForDate');
    }
  }

  /**
   * Batch insert price snapshots
   *
   * @param snapshots - Array of price snapshot records to insert
   */
  async insertPriceSnapshots(snapshots: PriceSnapshotInsert[]): Promise<void> {
    try {
      if (snapshots.length === 0) return;
      await this.db.insert(priceSnapshots).values(snapshots);
    } catch (error) {
      this.handleError(error, 'insertPriceSnapshots');
    }
  }

  /**
   * Update price snapshot record
   *
   * @param id - Snapshot ID to update
   * @param data - Partial snapshot data to update
   */
  async updatePriceSnapshot(id: number, data: Partial<PriceSnapshotInsert>): Promise<void> {
    try {
      if (id <= 0) {
        throw new Error('id must be greater than 0');
      }

      await this.db
        .update(priceSnapshots)
        .set(data)
        .where(eq(priceSnapshots.id, id));
    } catch (error) {
      this.handleError(error, 'updatePriceSnapshot');
    }
  }

  /**
   * Get product offers for snapshot processing (paginated)
   *
   * @param batchSize - Number of offers to retrieve
   * @param offset - Number of offers to skip
   * @returns Array of product offers
   */
  async getProductOffersForSnapshot(batchSize: number, offset: number): Promise<ProductOffer[]> {
    try {
      if (batchSize <= 0) {
        throw new Error('batchSize must be greater than 0');
      }
      if (offset < 0) {
        throw new Error('offset must be greater than or equal to 0');
      }

      return await this.db
        .select()
        .from(productOffers)
        .limit(batchSize)
        .offset(offset);
    } catch (error) {
      this.handleError(error, 'getProductOffersForSnapshot');
    }
  }

  /**
   * Batch get latest price for multiple offers
   * N+1 Prevention: Uses inArray for batch query
   *
   * @param offerIds - Array of offer IDs to get prices for
   * @returns Array of price records with offer ID and price
   */
  async getPriceHistoryForOffers(offerIds: number[]): Promise<Array<{ productOfferId: number; price: string }>> {
    try {
      if (offerIds.length === 0) return [];

      // Validate all IDs
      offerIds.forEach(id => this.validateOfferId(id));

      return await this.db
        .select({
          productOfferId: priceHistory.productOfferId,
          price: priceHistory.price,
        })
        .from(priceHistory)
        .where(inArray(priceHistory.productOfferId, offerIds))
        .orderBy(priceHistory.productOfferId, desc(priceHistory.recordedAt));
    } catch (error) {
      this.handleError(error, 'getPriceHistoryForOffers');
    }
  }

  // ============================================================================
  // Trend Analysis Operations
  // ============================================================================

  /**
   * Get grouped price data for trend analysis
   * Database-level aggregation using json_agg
   *
   * @param cutoffDate - Only include data after this date
   * @returns Array of trend price data grouped by product and retailer
   */
  async getPriceDataGroupedForTrend(cutoffDate: Date): Promise<TrendPriceData[]> {
    try {
      const result = await this.db
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
        .having(sql`count(*) >= 5`);

      return result;
    } catch (error) {
      this.handleError(error, 'getPriceDataGroupedForTrend');
    }
  }

  /**
   * Upsert price trend records (insert or update on conflict)
   * Handles large batches by chunking to avoid PostgreSQL parameter limits
   *
   * @param values - Array of price trend records to upsert
   */
  async upsertPriceTrends(values: PriceTrendInsert[]): Promise<void> {
    try {
      if (values.length === 0) return;

      // Split into smaller chunks if needed (PostgreSQL has param limits)
      const CHUNK_SIZE = 100;
      for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const chunk = values.slice(i, i + CHUNK_SIZE);

        await this.db
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
    } catch (error) {
      this.handleError(error, 'upsertPriceTrends');
    }
  }

  /**
   * Get price trend with retailer details for a specific product and retailer
   *
   * @param productId - Product ID (validated as positive integer)
   * @param retailerId - Retailer ID (validated as positive integer)
   * @returns Price trend with retailer name and logo, or null if not found
   */
  async getPriceTrendWithRetailer(productId: number, retailerId: number): Promise<PriceTrendWithRetailer | null> {
    try {
      this.validateProductId(productId);
      this.validateRetailerId(retailerId);

      const [result] = await this.db
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

      return result || null;
    } catch (error) {
      this.handleError(error, 'getPriceTrendWithRetailer');
    }
  }

  /**
   * Get all price trends for a product across all retailers
   *
   * @param productId - Product ID (validated as positive integer)
   * @returns Array of price trends with retailer details, ordered by last analyzed (descending)
   */
  async getPriceTrendsForProduct(productId: number): Promise<PriceTrendWithRetailer[]> {
    try {
      this.validateProductId(productId);

      return await this.db
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
    } catch (error) {
      this.handleError(error, 'getPriceTrendsForProduct');
    }
  }
}
