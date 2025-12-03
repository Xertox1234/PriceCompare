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
  priceAlerts,
  products,
  type PriceHistory,
  type ProductOffer,
  type PriceAlert,
  type InsertPriceAlert,
  type Retailer,
} from "@shared/schema";
import { BaseStorage } from "../base-storage";
import { logger } from "../../utils/logger";
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
  NormalizedPricePoint,
  TrendPriceData,
  PriceTrendInsert,
  PriceTrendWithRetailer,
} from "../types";
import type { db as DbType } from "../../db";

/**
 * Type for the getProductOffers callback to avoid circular dependency
 * Injected from parent storage to allow price analytics to access current offers
 */
export type GetProductOffersCallback = (productId: number) => Promise<(ProductOffer & { retailer: Retailer })[]>;

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
   * Callback to get product offers from ProductStorage
   * Injected to avoid circular dependency between price-storage and storage.ts
   */
  private getProductOffers?: GetProductOffersCallback;

  /**
   * Constructor with optional dependency injection
   * @param db - Drizzle database connection
   * @param getProductOffers - Optional callback to get product offers (for cross-domain queries)
   */
  constructor(db: typeof DbType, getProductOffers?: GetProductOffersCallback) {
    super(db);
    this.getProductOffers = getProductOffers;
  }

  /**
   * Set the getProductOffers callback (alternative to constructor injection)
   * Useful when storage instances are created before dependencies are available
   */
  setGetProductOffersCallback(callback: GetProductOffersCallback): void {
    this.getProductOffers = callback;
  }

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
   *
   * STRATEGY: Automatically selects the most appropriate data source based on date range
   * to optimize query performance while maintaining data granularity where it matters.
   *
   * DATA SOURCE SELECTION:
   * - Last 30 days: Raw priceHistory only (most granular)
   * - 30-90 days: Daily aggregates + recent raw
   * - 90-365 days: Weekly aggregates + daily + raw
   * - 1+ years: Monthly aggregates + weekly + daily + raw
   *
   * @param productId - Product ID (validated as positive integer)
   * @param days - Number of days of history to retrieve (default: 30)
   * @param retailerId - Optional retailer filter for single-retailer queries
   * @returns Array of normalized price data points sorted chronologically
   */
  async getPriceHistoryOptimized(
    productId: number,
    days = 30,
    retailerId?: number
  ): Promise<NormalizedPricePoint[]> {
    try {
      this.validateProductId(productId);

      if (!Number.isFinite(days) || days <= 0) {
        throw new Error(`Invalid days: ${days}. Must be a positive number.`);
      }
      if (days > 3650) {
        throw new Error(`Invalid days: ${days}. Maximum allowed is 3650 (10 years).`);
      }
      if (retailerId !== undefined) {
        this.validateRetailerId(retailerId);
      }

      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - days);

      logger.debug(`[PriceStorage] Fetching ${days} days of data for product ${productId}${retailerId ? ` from retailer ${retailerId}` : ''}`);

      // Strategy 1: Last 30 days - use raw data only
      if (days <= 30) {
        return await this.getRawPriceHistoryNormalized(productId, startDate, now, retailerId);
      }

      // Strategy 2: 30-90 days - use daily aggregates + recent raw
      if (days <= 90) {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const recentRaw = await this.getRawPriceHistoryNormalized(productId, thirtyDaysAgo, now, retailerId);
        const dailyAgg = await this.getDailyAggregatesNormalized(productId, startDate, thirtyDaysAgo, retailerId);

        return [...dailyAgg, ...recentRaw];
      }

      // Strategy 3: 90-365 days - use weekly aggregates + daily + raw
      if (days <= 365) {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(now.getDate() - 90);

        const recentRaw = await this.getRawPriceHistoryNormalized(productId, thirtyDaysAgo, now, retailerId);
        const dailyAgg = await this.getDailyAggregatesNormalized(productId, ninetyDaysAgo, thirtyDaysAgo, retailerId);
        const weeklyAgg = await this.getWeeklyAggregatesNormalized(productId, startDate, ninetyDaysAgo, retailerId);

        return [...weeklyAgg, ...dailyAgg, ...recentRaw];
      }

      // Strategy 4: 1+ years - use monthly aggregates + weekly + daily + raw
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);

      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(now.getDate() - 90);

      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);

      const recentRaw = await this.getRawPriceHistoryNormalized(productId, thirtyDaysAgo, now, retailerId);
      const dailyAgg = await this.getDailyAggregatesNormalized(productId, ninetyDaysAgo, thirtyDaysAgo, retailerId);
      const weeklyAgg = await this.getWeeklyAggregatesNormalized(productId, oneYearAgo, ninetyDaysAgo, retailerId);
      const monthlyAgg = await this.getMonthlyAggregatesNormalized(productId, startDate, oneYearAgo, retailerId);

      return [...monthlyAgg, ...weeklyAgg, ...dailyAgg, ...recentRaw];
    } catch (error) {
      this.handleError(error, 'getPriceHistoryOptimized');
    }
  }

  /**
   * Get raw price history normalized to NormalizedPricePoint format
   * @private
   */
  private async getRawPriceHistoryNormalized(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<NormalizedPricePoint[]> {
    const result = await this.getRawPriceHistoryWithRetailers(productId, startDate, endDate, retailerId);

    return result.map(row => ({
      date: row.history.recordedAt || new Date(),
      price: parseFloat(row.history.price),
      retailerId: row.history.retailerId,
      retailerName: row.retailer.name,
      availability: row.history.availability,
      source: 'raw' as const
    }));
  }

  /**
   * Get daily aggregates normalized to NormalizedPricePoint format
   * @private
   */
  private async getDailyAggregatesNormalized(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<NormalizedPricePoint[]> {
    const result = await this.getDailyAggregatesWithRetailers(productId, startDate, endDate, retailerId);

    return result.map(row => ({
      date: new Date(row.agg.date + 'T00:00:00'),
      price: parseFloat(row.agg.avgPrice),
      minPrice: parseFloat(row.agg.minPrice),
      maxPrice: parseFloat(row.agg.maxPrice),
      avgPrice: parseFloat(row.agg.avgPrice),
      medianPrice: row.agg.medianPrice ? parseFloat(row.agg.medianPrice) : undefined,
      retailerId: row.agg.retailerId,
      retailerName: row.retailer.name,
      source: 'daily' as const
    }));
  }

  /**
   * Get weekly aggregates normalized to NormalizedPricePoint format
   * @private
   */
  private async getWeeklyAggregatesNormalized(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<NormalizedPricePoint[]> {
    const result = await this.getWeeklyAggregatesWithRetailers(productId, startDate, endDate, retailerId);

    return result.map(row => {
      const weekDate = this.getDateFromWeek(row.agg.year, row.agg.week);

      return {
        date: weekDate,
        price: parseFloat(row.agg.avgPrice || '0'),
        minPrice: parseFloat(row.agg.minPrice || '0'),
        maxPrice: parseFloat(row.agg.maxPrice || '0'),
        avgPrice: parseFloat(row.agg.avgPrice || '0'),
        medianPrice: row.agg.medianPrice ? parseFloat(row.agg.medianPrice) : undefined,
        retailerId: row.agg.retailerId,
        retailerName: row.retailer.name,
        source: 'weekly' as const
      };
    });
  }

  /**
   * Get monthly aggregates normalized to NormalizedPricePoint format
   * @private
   */
  private async getMonthlyAggregatesNormalized(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<NormalizedPricePoint[]> {
    const result = await this.getMonthlyAggregatesWithRetailers(productId, startDate, endDate, retailerId);

    return result.map(row => ({
      date: new Date(row.agg.year, row.agg.month - 1, 1),
      price: parseFloat(row.agg.avgPrice || '0'),
      minPrice: parseFloat(row.agg.minPrice || '0'),
      maxPrice: parseFloat(row.agg.maxPrice || '0'),
      avgPrice: parseFloat(row.agg.avgPrice || '0'),
      medianPrice: row.agg.medianPrice ? parseFloat(row.agg.medianPrice) : undefined,
      retailerId: row.agg.retailerId,
      retailerName: row.retailer.name,
      source: 'monthly' as const
    }));
  }

  /**
   * Helper: Get date from ISO week number
   * @private
   */
  private getDateFromWeek(year: number, week: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  }

  /**
   * Get price history with smart data source selection (legacy interface)
   * Automatically uses aggregated data for longer time ranges
   *
   * @param productId - Product ID (validated as positive integer)
   * @param days - Number of days of history to retrieve (default: 30)
   * @returns Array of price history with retailer details
   */
  async getPriceHistory(productId: number, days?: number): Promise<PriceHistoryWithDetails[]> {
    try {
      this.validateProductId(productId);

      // Use the internal optimized query
      const optimizedData = await this.getPriceHistoryOptimized(productId, days || 30);

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

      // Use the internal optimized query with retailer filter
      const optimizedData = await this.getPriceHistoryOptimized(productId, days || 30, retailerId);

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
        if (!this.getProductOffers) {
          logger.warn('getProductOffers callback not set, returning zero price for product', { productId });
          return {
            productId,
            currentPrice: 0,
            averagePrice: 0,
            lowestPrice: 0,
            highestPrice: 0,
            trend: 'stable',
            changePercentage: 0,
            daysAnalyzed: 0,
          };
        }
        
        const offers = await this.getProductOffers(productId);
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

      // Get current price (requires ProductStorage integration via injected callback)
      let currentPrice = 0;
      if (this.getProductOffers) {
        const offers = await this.getProductOffers(productId);
        currentPrice = offers.length > 0
          ? Math.min(...offers.map(o => parseFloat(o.price)))
          : 0;
      } else {
        logger.warn('getProductOffers callback not set, using zero for current price', { productId });
      }

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

  /**
   * Get price history with timestamps for price change analysis
   * Used for: Price snapshot analysis, anomaly detection
   *
   * @param offerIds - Array of product offer IDs
   * @returns Array of price records with productOfferId, price, and recordedAt
   */
  async getPriceHistoryForAnalysis(offerIds: number[]): Promise<Array<{
    productOfferId: number;
    price: string;
    recordedAt: Date | null;
  }>> {
    try {
      if (offerIds.length === 0) return [];

      // Validate all IDs
      offerIds.forEach(id => this.validateOfferId(id));

      return await this.db
        .select({
          productOfferId: priceHistory.productOfferId,
          price: priceHistory.price,
          recordedAt: priceHistory.recordedAt,
        })
        .from(priceHistory)
        .where(inArray(priceHistory.productOfferId, offerIds))
        .orderBy(priceHistory.productOfferId, desc(priceHistory.recordedAt));
    } catch (error) {
      this.handleError(error, 'getPriceHistoryForAnalysis');
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

  // ============================================================================
  // Smart Alerts Operations (Phase 8D)
  // ============================================================================

  /**
   * Get product offer IDs for a product (for smart alerts analysis)
   * Used for: Smart threshold suggestions
   *
   * @param productId - Product ID (validated as positive integer)
   * @returns Array of offer IDs
   */
  async getProductOfferIds(productId: number): Promise<number[]> {
    try {
      this.validateProductId(productId);

      const offers = await this.db
        .select({ id: productOffers.id })
        .from(productOffers)
        .where(eq(productOffers.productId, productId));

      return offers.map(o => o.id);
    } catch (error) {
      this.handleError(error, 'getProductOfferIds');
    }
  }

  /**
   * Get price history for offer IDs with limit (for smart alerts analysis)
   * Used for: Smart threshold suggestions, seasonal pattern analysis
   *
   * @param offerIds - Array of offer IDs
   * @param limit - Maximum number of records to return (default: 365)
   * @returns Array of price history records
   */
  async getPriceHistoryForOfferIds(offerIds: number[], limit = 365): Promise<PriceHistory[]> {
    try {
      if (offerIds.length === 0) return [];

      // Validate all IDs
      offerIds.forEach(id => this.validateOfferId(id));

      return await this.db
        .select()
        .from(priceHistory)
        .where(sql`${priceHistory.productOfferId} = ANY(${offerIds})`)
        .orderBy(desc(priceHistory.recordedAt))
        .limit(limit);
    } catch (error) {
      this.handleError(error, 'getPriceHistoryForOfferIds');
    }
  }

  /**
   * Get user's active price alerts with product names (for predictive alerts)
   * Used for: Generating predictive alerts
   *
   * @param userId - User ID
   * @returns Array of alerts with product IDs, target prices, and product names
   */
  async getUserActiveAlertsWithProducts(userId: number): Promise<Array<{
    productId: number;
    targetPrice: string;
    productName: string | null;
  }>> {
    try {
      if (!userId || userId < 1) {
        throw new Error(`Invalid userId: ${userId}`);
      }

      return await this.db
        .select({
          productId: priceAlerts.productId,
          targetPrice: priceAlerts.targetPrice,
          productName: products.name,
        })
        .from(priceAlerts)
        .innerJoin(products, eq(priceAlerts.productId, products.id))
        .where(and(
          eq(priceAlerts.userId, userId),
          eq(priceAlerts.isActive, true)
        ));
    } catch (error) {
      this.handleError(error, 'getUserActiveAlertsWithProducts');
    }
  }

  /**
   * Batch get lowest-priced offers for multiple products
   * N+1 Prevention: Returns all offers ordered by product ID and price
   *
   * @param productIds - Array of product IDs
   * @returns Array of offers with product ID, offer ID, and price
   */
  async getLowestPricedOffersForProducts(productIds: number[]): Promise<Array<{
    productId: number;
    id: number;
    price: string;
  }>> {
    try {
      if (productIds.length === 0) return [];

      // Validate all IDs
      productIds.forEach(id => this.validateProductId(id));

      return await this.db
        .select({
          productId: productOffers.productId,
          id: productOffers.id,
          price: productOffers.price,
        })
        .from(productOffers)
        .where(inArray(productOffers.productId, productIds))
        .orderBy(productOffers.productId, productOffers.price);
    } catch (error) {
      this.handleError(error, 'getLowestPricedOffersForProducts');
    }
  }

  /**
   * Batch get price history for multiple offer IDs (for predictive alerts)
   * N+1 Prevention: Returns all history ordered by offer ID and recorded date
   *
   * @param offerIds - Array of offer IDs
   * @returns Array of price history records
   */
  async getBatchPriceHistoryForOffers(offerIds: number[]): Promise<PriceHistory[]> {
    try {
      if (offerIds.length === 0) return [];

      // Validate all IDs
      offerIds.forEach(id => this.validateOfferId(id));

      return await this.db
        .select()
        .from(priceHistory)
        .where(inArray(priceHistory.productOfferId, offerIds))
        .orderBy(priceHistory.productOfferId, desc(priceHistory.recordedAt));
    } catch (error) {
      this.handleError(error, 'getBatchPriceHistoryForOffers');
    }
  }

  /**
   * Get all price alerts for a user (for effectiveness analysis)
   * Ordered by times triggered (descending)
   *
   * @param userId - User ID
   * @returns Array of price alerts
   */
  async getUserPriceAlertsForEffectiveness(userId: number): Promise<PriceAlert[]> {
    try {
      if (!userId || userId < 1) {
        throw new Error(`Invalid userId: ${userId}`);
      }

      return await this.db
        .select()
        .from(priceAlerts)
        .where(eq(priceAlerts.userId, userId))
        .orderBy(desc(priceAlerts.timesTriggered));
    } catch (error) {
      this.handleError(error, 'getUserPriceAlertsForEffectiveness');
    }
  }

  /**
   * Get all price alerts for a user (for analytics)
   *
   * @param userId - User ID
   * @returns Array of price alerts
   */
  async getUserPriceAlerts(userId: number): Promise<PriceAlert[]> {
    try {
      if (!userId || userId < 1) {
        throw new Error(`Invalid userId: ${userId}`);
      }

      // Use LEFT JOIN to include product details with each alert
      // Separate query approach to avoid Drizzle nested object issues
      const alertsWithProducts = await this.db
        .select({
          alert: priceAlerts,
          product: products,
        })
        .from(priceAlerts)
        .leftJoin(products, eq(priceAlerts.productId, products.id))
        .where(eq(priceAlerts.userId, userId));

      // Map results to include product details in alert objects
      return alertsWithProducts.map(({ alert, product }) => ({
        ...alert,
        product: product || undefined, // Include product if exists, undefined if deleted
      })) as PriceAlert[];
    } catch (error) {
      this.handleError(error, 'getUserPriceAlerts');
    }
  }

  /**
   * Create a suggested price alert
   *
   * @param alert - Price alert data to insert
   * @returns Created price alert
   */
  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    try {
      const [result] = await this.db
        .insert(priceAlerts)
        .values(alert)
        .returning();

      if (!result) {
        throw new Error('Failed to create price alert');
      }

      return result;
    } catch (error) {
      this.handleError(error, 'createPriceAlert');
    }
  }

  // ============================================================================
  // Price History Service Support (Phase 8B)
  // ============================================================================

  /**
   * Get raw price history data with retailer details
   * Used for: price-history-service.ts getRawPriceHistory()
   *
   * @param productId - Product ID (validated as positive integer)
   * @param startDate - Start date for range
   * @param endDate - End date for range
   * @param retailerId - Optional retailer filter
   * @returns Array of price history with retailer info, ordered by recordedAt (ascending)
   */
  async getRawPriceHistoryWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{
    history: PriceHistory;
    retailer: Retailer;
  }>> {
    try {
      this.validateProductId(productId);

      const conditions = [
        eq(priceHistory.productId, productId),
        gte(priceHistory.recordedAt, startDate),
        lte(priceHistory.recordedAt, endDate)
      ];

      if (retailerId !== undefined) {
        this.validateRetailerId(retailerId);
        conditions.push(eq(priceHistory.retailerId, retailerId));
      }

      const result = await this.db
        .select({
          history: priceHistory,
          retailer: retailers
        })
        .from(priceHistory)
        .innerJoin(retailers, eq(priceHistory.retailerId, retailers.id))
        .where(and(...conditions))
        .orderBy(asc(priceHistory.recordedAt));

      return result;
    } catch (error) {
      this.handleError(error, 'getRawPriceHistoryWithRetailers');
    }
  }

  /**
   * Get daily aggregates with retailer details
   * Used for: price-history-service.ts getDailyAggregates()
   *
   * @param productId - Product ID (validated as positive integer)
   * @param startDate - Start date for range
   * @param endDate - End date for range
   * @param retailerId - Optional retailer filter
   * @returns Array of daily aggregates with retailer info, ordered by date (ascending)
   */
  async getDailyAggregatesWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{
    agg: DailyAggregateRecord;
    retailer: Retailer;
  }>> {
    try {
      this.validateProductId(productId);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const conditions = [
        eq(priceAggregatesDaily.productId, productId),
        gte(priceAggregatesDaily.date, startDateStr),
        lte(priceAggregatesDaily.date, endDateStr)
      ];

      if (retailerId !== undefined) {
        this.validateRetailerId(retailerId);
        conditions.push(eq(priceAggregatesDaily.retailerId, retailerId));
      }

      const result = await this.db
        .select({
          agg: priceAggregatesDaily,
          retailer: retailers
        })
        .from(priceAggregatesDaily)
        .innerJoin(retailers, eq(priceAggregatesDaily.retailerId, retailers.id))
        .where(and(...conditions))
        .orderBy(asc(priceAggregatesDaily.date));

      return result;
    } catch (error) {
      this.handleError(error, 'getDailyAggregatesWithRetailers');
    }
  }

  /**
   * Get weekly aggregates with retailer details
   * Used for: price-history-service.ts getWeeklyAggregates()
   *
   * @param productId - Product ID (validated as positive integer)
   * @param startDate - Start date for range (used to calculate year range)
   * @param endDate - End date for range (used to calculate year range)
   * @param retailerId - Optional retailer filter
   * @returns Array of weekly aggregates with retailer info, ordered by year/week (ascending)
   */
  async getWeeklyAggregatesWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{
    agg: WeeklyAggregateRecord;
    retailer: Retailer;
  }>> {
    try {
      this.validateProductId(productId);

      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();

      const conditions = [
        eq(priceAggregatesWeekly.productId, productId),
        gte(priceAggregatesWeekly.year, startYear),
        lte(priceAggregatesWeekly.year, endYear)
      ];

      if (retailerId !== undefined) {
        this.validateRetailerId(retailerId);
        conditions.push(eq(priceAggregatesWeekly.retailerId, retailerId));
      }

      const result = await this.db
        .select({
          agg: priceAggregatesWeekly,
          retailer: retailers
        })
        .from(priceAggregatesWeekly)
        .innerJoin(retailers, eq(priceAggregatesWeekly.retailerId, retailers.id))
        .where(and(...conditions))
        .orderBy(asc(priceAggregatesWeekly.year), asc(priceAggregatesWeekly.week));

      return result;
    } catch (error) {
      this.handleError(error, 'getWeeklyAggregatesWithRetailers');
    }
  }

  /**
   * Get monthly aggregates with retailer details
   * Used for: price-history-service.ts getMonthlyAggregates()
   *
   * @param productId - Product ID (validated as positive integer)
   * @param startDate - Start date for range (used to calculate year range)
   * @param endDate - End date for range (used to calculate year range)
   * @param retailerId - Optional retailer filter
   * @returns Array of monthly aggregates with retailer info, ordered by year/month (ascending)
   */
  async getMonthlyAggregatesWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{
    agg: MonthlyAggregateRecord;
    retailer: Retailer;
  }>> {
    try {
      this.validateProductId(productId);

      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();

      const conditions = [
        eq(priceAggregatesMonthly.productId, productId),
        gte(priceAggregatesMonthly.year, startYear),
        lte(priceAggregatesMonthly.year, endYear)
      ];

      if (retailerId !== undefined) {
        this.validateRetailerId(retailerId);
        conditions.push(eq(priceAggregatesMonthly.retailerId, retailerId));
      }

      const result = await this.db
        .select({
          agg: priceAggregatesMonthly,
          retailer: retailers
        })
        .from(priceAggregatesMonthly)
        .innerJoin(retailers, eq(priceAggregatesMonthly.retailerId, retailers.id))
        .where(and(...conditions))
        .orderBy(asc(priceAggregatesMonthly.year), asc(priceAggregatesMonthly.month));

      return result;
    } catch (error) {
      this.handleError(error, 'getMonthlyAggregatesWithRetailers');
    }
  }

  /**
   * Get active product offers grouped by product and retailer
   * Used for: price-history-service.ts generateDailySnapshots()
   *
   * @returns Array of active offers with product ID, retailer ID, and price
   */
  async getActiveProductOffersGrouped(): Promise<Array<{
    productId: number;
    retailerId: number;
    price: string;
  }>> {
    try {
      const result = await this.db
        .select({
          productId: products.id,
          retailerId: productOffers.retailerId,
          price: productOffers.price
        })
        .from(productOffers)
        .innerJoin(products, eq(productOffers.productId, products.id))
        .where(eq(productOffers.availability, 'in_stock'));

      return result;
    } catch (error) {
      this.handleError(error, 'getActiveProductOffersGrouped');
    }
  }

  /**
   * Get price snapshots with filters
   * Used for: price-history-service.ts getPriceSnapshots()
   *
   * @param productId - Product ID (validated as positive integer)
   * @param retailerId - Optional retailer ID filter
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @returns Array of price snapshots ordered by snapshotDate (descending)
   */
  async getPriceSnapshotsByFilters(
    productId: number,
    retailerId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<PriceSnapshotRecord[]> {
    try {
      this.validateProductId(productId);

      const conditions = [eq(priceSnapshots.productId, productId)];

      if (retailerId !== undefined) {
        this.validateRetailerId(retailerId);
        conditions.push(eq(priceSnapshots.retailerId, retailerId));
      }

      if (startDate !== undefined) {
        conditions.push(gte(priceSnapshots.snapshotDate, startDate));
      }

      if (endDate !== undefined) {
        conditions.push(lte(priceSnapshots.snapshotDate, endDate));
      }

      return await this.db
        .select()
        .from(priceSnapshots)
        .where(and(...conditions))
        .orderBy(desc(priceSnapshots.snapshotDate));
    } catch (error) {
      this.handleError(error, 'getPriceSnapshotsByFilters');
    }
  }

  /**
   * Delete old price history records
   * Used for: price-history-service.ts cleanupOldPriceHistory()
   *
   * @param cutoffDate - Delete records older than this date
   * @returns Number of records deleted
   */
  async deleteOldPriceHistory(cutoffDate: Date): Promise<number> {
    try {
      const result = await this.db
        .delete(priceHistory)
        .where(lte(priceHistory.recordedAt, cutoffDate));

      return result.rowCount ?? 0;
    } catch (error) {
      this.handleError(error, 'deleteOldPriceHistory');
    }
  }

  /**
   * Get recent price changes for drop detection
   * Used for: price-history-service.ts detectSignificantPriceDrops()
   *
   * @param cutoffDate - Only include price changes after this date
   * @returns Array of recent price changes with offer ID, price, and recordedAt
   */
  async getRecentPriceChanges(cutoffDate: Date): Promise<Array<{
    productOfferId: number;
    price: string;
    recordedAt: Date | null;
  }>> {
    try {
      const result = await this.db
        .select({
          productOfferId: priceHistory.productOfferId,
          price: priceHistory.price,
          recordedAt: priceHistory.recordedAt
        })
        .from(priceHistory)
        .where(gte(priceHistory.recordedAt, cutoffDate))
        .orderBy(priceHistory.productOfferId, desc(priceHistory.recordedAt));

      return result;
    } catch (error) {
      this.handleError(error, 'getRecentPriceChanges');
    }
  }
}
