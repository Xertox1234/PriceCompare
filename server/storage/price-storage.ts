import { db } from "../db";
import { BaseStorage } from "./base-storage";
import {
  priceHistory,
  priceSnapshots,
  priceAggregatesDaily,
  priceAggregatesWeekly,
  priceAggregatesMonthly,
  priceTrends,
  productOffers,
  retailers,
  type PriceHistory,
  type ProductOffer,
} from "@shared/schema";
import {
  type PriceHistoryWithDetails,
  type PriceTrendAnalysis,
  type PriceAggregationData,
  type WeeklyAggregateRecord,
  type DailyAggregateRecord,
  type MonthlyAggregateRecord,
  type DailyAggregateInsert,
  type WeeklyAggregateInsert,
  type MonthlyAggregateInsert,
  type InsertPriceHistoryWithRecordedAt,
  type PriceHistoryQueryParams,
  type PriceSnapshotRecord,
  type PriceSnapshotInsert,
  type TrendPriceData,
  type PriceTrendInsert,
  type PriceTrendWithRetailer,
} from "./types";
import { eq, and, gte, lte, desc, asc, or, inArray, sql, isNotNull } from "drizzle-orm";

/**
 * Price Storage Repository
 *
 * Manages price history, snapshots, aggregations, and trend analysis with
 * performance-optimized time-series data operations.
 *
 * Key Features:
 * - Time-series price history tracking
 * - Automated price snapshot management
 * - Multi-level aggregations (daily, weekly, monthly)
 * - Trend analysis and prediction
 * - Batch upsert operations with conflict resolution
 *
 * Performance Characteristics:
 * - getPriceHistory: Delegates to price-history-service for optimization
 * - getPriceTrend: 30-day and 90-day analysis with in-memory calculations
 * - getPriceDataGroupedForTrend: Aggregated JSON objects for trend calculation
 * - upsertPriceTrends: Chunked batch operations (100 items per chunk)
 *
 * Caching Strategy:
 * - getPriceTrend() is a good candidate for Redis caching (computation-heavy)
 * - Cache key pattern: `price:trend:${productId}`
 * - Suggested TTL: 5 minutes (balance between accuracy and performance)
 * - Invalidate on: new price history inserted for product
 *
 * - getWeeklyAggregatesData/getDailyAggregatesData/getMonthlyAggregatesData
 *   could benefit from short-term caching (1-2 minutes)
 * - Cache key pattern: `price:aggregates:${type}:${key}`
 * - Invalidate on: aggregate upsert operations
 *
 * Implementation Example:
 * ```typescript
 * import { getRedisClient } from './config/redis';
 * import { priceStorage } from './storage/price-storage';
 *
 * // Cached getPriceTrend wrapper
 * async function getCachedPriceTrend(productId: number): Promise<PriceTrendAnalysis> {
 *   const redis = getRedisClient();
 *   const cacheKey = `price:trend:${productId}`;
 *
 *   // Try cache first
 *   const cached = await redis.get(cacheKey);
 *   if (cached) {
 *     return JSON.parse(cached);
 *   }
 *
 *   // Cache miss - compute and store
 *   const trend = await priceStorage.getPriceTrend(productId);
 *   await redis.setex(cacheKey, 300, JSON.stringify(trend)); // 5 min TTL
 *   return trend;
 * }
 *
 * // Invalidate cache when new price inserted
 * async function insertPriceWithInvalidation(data: InsertPriceHistoryWithRecordedAt) {
 *   const redis = getRedisClient();
 *   const price = await priceStorage.insertPriceHistory(data);
 *
 *   // Invalidate trend cache for this product
 *   await redis.del(`price:trend:${data.productId}`);
 *   return price;
 * }
 * ```
 *
 * Database Schema Requirements:
 * - priceHistory table with indexes on (productOfferId, recordedAt), (productId, recordedAt)
 * - priceSnapshots table for daily price snapshots
 * - priceAggregatesDaily/Weekly/Monthly tables for pre-computed aggregations
 * - priceTrends table with unique constraint on (productId, retailerId)
 * - Composite indexes for date range queries
 *
 * PostgreSQL Features Used:
 * - array_agg() for price grouping
 * - json_agg() and json_build_object() for structured aggregation
 * - Date/time functions for range filtering
 * - Conflict resolution (DO UPDATE) for upserts
 */

/**
 * Constants for price operations
 */
const PRICE_CONSTANTS = {
  QUERY: {
    DEFAULT_DAYS: 30,
    TREND_ANALYSIS_DAYS_SHORT: 30,
    TREND_ANALYSIS_DAYS_LONG: 90,
    SPARKLINE_DAYS: 7,
    MIN_TREND_DATA_POINTS: 5, // Minimum records for trend analysis
  },
  BATCH: {
    UPSERT_CHUNK_SIZE: 100, // PostgreSQL parameter limit consideration
  },
  TREND: {
    STABLE_THRESHOLD: 0.05, // 5% change = stable
    PERCENTAGE_MULTIPLIER: 100,
  },
  VALIDATION: {
    MIN_PRODUCT_OFFER_ID: 1,
    MIN_PRODUCT_ID: 1,
    MIN_RETAILER_ID: 1,
  },
} as const;

/**
 * Price Storage Interface
 *
 * Comprehensive price data access layer for time-series price tracking,
 * aggregation, and trend analysis operations.
 */
export interface IPriceStorage {
  /**
   * Price History Operations
   */

  /**
   * Get price history for a product with retailer details
   * @param productId - Product ID (must be positive)
   * @param days - Number of days to look back (default: 30)
   */
  getPriceHistory(productId: number, days?: number): Promise<PriceHistoryWithDetails[]>;

  /**
   * Get price history for a specific product and retailer combination
   * @param productId - Product ID (must be positive)
   * @param retailerId - Retailer ID (must be positive)
   * @param days - Number of days to look back (default: 30)
   */
  getRetailerPriceHistory(
    productId: number,
    retailerId: number,
    days?: number
  ): Promise<PriceHistory[]>;

  /**
   * Analyze price trend for a product (30-day and 90-day analysis)
   * @param productId - Product ID (must be positive)
   */
  getPriceTrend(productId: number): Promise<PriceTrendAnalysis>;

  /**
   * Get the most recent price for a product offer
   * @param offerId - Product offer ID (must be positive)
   */
  getLatestPriceForOffer(offerId: number): Promise<PriceHistory | null>;

  /**
   * Insert a new price history record
   * @param data - Price history data to insert
   */
  insertPriceHistory(data: InsertPriceHistoryWithRecordedAt): Promise<PriceHistory>;

  /**
   * Query price history with flexible filters
   * @param query - Query parameters (productOfferId, productId, retailerId, dateRange, source, limit)
   */
  getPriceHistoryByQuery(query: PriceHistoryQueryParams): Promise<PriceHistory[]>;

  /**
   * Get price history for a specific product offer with limit
   * @param productOfferId - Product offer ID (must be positive)
   * @param limit - Maximum number of records to return (must be positive)
   */
  getPriceHistoryByOfferId(productOfferId: number, limit: number): Promise<PriceHistory[]>;

  /**
   * Price Snapshot Operations
   */

  /**
   * Get existing price snapshots for a specific date
   * @param date - Date to check for snapshots
   */
  getExistingSnapshotsForDate(date: Date): Promise<PriceSnapshotRecord[]>;

  /**
   * Insert multiple price snapshots (batch operation)
   * @param snapshots - Array of snapshot records to insert
   */
  insertPriceSnapshots(snapshots: PriceSnapshotInsert[]): Promise<void>;

  /**
   * Update an existing price snapshot
   * @param id - Snapshot ID (must be positive)
   * @param data - Partial snapshot data to update
   */
  updatePriceSnapshot(id: number, data: Partial<PriceSnapshotInsert>): Promise<void>;

  /**
   * Get product offers for snapshot processing (pagination support)
   * @param batchSize - Number of offers to fetch (must be positive)
   * @param offset - Offset for pagination (must be non-negative)
   */
  getProductOffersForSnapshot(batchSize: number, offset: number): Promise<ProductOffer[]>;

  /**
   * Price Aggregation Operations
   */

  /**
   * Get price data for aggregation processing
   * @param startDate - Start of date range
   * @param endDate - End of date range (must be >= startDate)
   * @param productId - Optional product filter (must be positive if provided)
   */
  getPriceDataForAggregation(
    startDate: Date,
    endDate: Date,
    productId?: number
  ): Promise<PriceAggregationData[]>;

  /**
   * Mark price history records as aggregated
   * @param startDate - Start of date range
   * @param endDate - End of date range (must be >= startDate)
   */
  markPriceHistoryAsAggregated(startDate: Date, endDate: Date): Promise<void>;

  /**
   * Delete old aggregated price history records
   * @param cutoffDate - Delete records older than this date
   * @returns Number of records deleted
   */
  deleteOldAggregatedPriceHistory(cutoffDate: Date): Promise<number>;

  /**
   * Upsert daily price aggregates (conflict resolution)
   * @param values - Array of daily aggregate records
   */
  upsertDailyAggregates(values: DailyAggregateInsert[]): Promise<void>;

  /**
   * Upsert weekly price aggregates (conflict resolution)
   * @param values - Array of weekly aggregate records
   */
  upsertWeeklyAggregates(values: WeeklyAggregateInsert[]): Promise<void>;

  /**
   * Upsert monthly price aggregates (conflict resolution)
   * @param values - Array of monthly aggregate records
   */
  upsertMonthlyAggregates(values: MonthlyAggregateInsert[]): Promise<void>;

  /**
   * Price Analytics Operations
   */

  /**
   * Get weekly aggregates for a specific year and week
   * @param year - Year (e.g., 2024, range: 2000-2100)
   * @param week - Week number (range: 1-53)
   */
  getWeeklyAggregatesData(year: number, week: number): Promise<WeeklyAggregateRecord[]>;

  /**
   * Get daily aggregates for a specific date
   * @param date - Date string in YYYY-MM-DD format
   */
  getDailyAggregatesData(date: string): Promise<DailyAggregateRecord[]>;

  /**
   * Get monthly aggregates for a specific year and month
   * @param year - Year (e.g., 2024, range: 2000-2100)
   * @param month - Month (range: 1-12)
   */
  getMonthlyAggregatesData(year: number, month: number): Promise<MonthlyAggregateRecord[]>;

  /**
   * Get latest price for multiple offers (batch operation)
   * @param offerIds - Array of product offer IDs (all must be positive)
   */
  getPriceHistoryForOffers(
    offerIds: number[]
  ): Promise<Array<{ productOfferId: number; price: string }>>;

  /**
   * Price Trend Operations
   */

  /**
   * Get grouped price data for trend analysis
   * @param cutoffDate - Only include records after this date
   */
  getPriceDataGroupedForTrend(cutoffDate: Date): Promise<TrendPriceData[]>;

  /**
   * Upsert price trends (batch operation with chunking)
   * @param values - Array of price trend records (automatically chunked at 100 items)
   */
  upsertPriceTrends(values: PriceTrendInsert[]): Promise<void>;

  /**
   * Get price trend with retailer details for a specific product-retailer pair
   * @param productId - Product ID (must be positive)
   * @param retailerId - Retailer ID (must be positive)
   */
  getPriceTrendWithRetailer(
    productId: number,
    retailerId: number
  ): Promise<PriceTrendWithRetailer | null>;

  /**
   * Get all price trends for a product across all retailers
   * @param productId - Product ID (must be positive)
   */
  getPriceTrendsForProduct(productId: number): Promise<PriceTrendWithRetailer[]>;
}

/**
 * Price Storage Implementation
 */
export class PriceStorage extends BaseStorage implements IPriceStorage {
  // ============================================================================
  // Private Validation Helpers (Pattern 17: DRY principle)
  // ============================================================================

  /**
   * Validate that an ID is a positive number
   * @private
   */
  private validatePositiveId(id: number, fieldName: string): void {
    if (!id || id <= 0) {
      throw new Error(`${fieldName} must be a positive number`);
    }
  }

  /**
   * Validate date range
   * @private
   */
  private validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date');
    }
  }

  /**
   * Validate days parameter
   * @private
   */
  private validateDays(days: number | undefined): number {
    if (days === undefined) {
      return PRICE_CONSTANTS.QUERY.DEFAULT_DAYS;
    }
    if (days <= 0) {
      throw new Error('Days must be a positive number');
    }
    return days;
  }

  // ============================================================================
  // Price History Operations (7 methods)
  // ============================================================================

  /**
   * Get price history for a product with retailer details
   *
   * Performance: Delegates to price-history-service for optimized implementation
   * with batching and caching strategies.
   *
   * @param productId - Product ID
   * @param days - Number of days to look back (default: 30)
   * @returns Price history with retailer information
   *
   * @example
   * const history = await priceStorage.getPriceHistory(123, 7);
   */
  async getPriceHistory(productId: number, days?: number): Promise<PriceHistoryWithDetails[]> {
    return this.handleError('getPriceHistory', async () => {
      this.validatePositiveId(productId, 'Product ID');
      const validDays = this.validateDays(days);

      const { getPriceHistoryOptimized } = await import('../services/price-history-service');
      const optimizedData = await getPriceHistoryOptimized(productId, validDays);

      return optimizedData.map((item: {
        id: number;
        productOfferId: number;
        productId: number;
        retailerId: number;
        price: string;
        source: string;
        recordedAt: Date;
        aggregatedAt: Date | null;
        retailerName: string;
        retailerLogo: string | null;
      }) => ({
        id: item.id,
        productOfferId: item.productOfferId,
        productId: item.productId,
        retailerId: item.retailerId,
        price: item.price,
        source: item.source,
        recordedAt: item.recordedAt,
        aggregatedAt: item.aggregatedAt,
        retailerName: item.retailerName,
        retailerLogo: item.retailerLogo,
      }));
    });
  }

  /**
   * Get price history for a specific product and retailer combination
   *
   * @param productId - Product ID
   * @param retailerId - Retailer ID
   * @param days - Number of days to look back (default: 30)
   * @returns Price history for the specific retailer
   *
   * @example
   * const history = await priceStorage.getRetailerPriceHistory(123, 5, 14);
   */
  async getRetailerPriceHistory(
    productId: number,
    retailerId: number,
    days?: number
  ): Promise<PriceHistory[]> {
    return this.handleError('getRetailerPriceHistory', async () => {
      this.validatePositiveId(productId, 'Product ID');
      this.validatePositiveId(retailerId, 'Retailer ID');
      const validDays = this.validateDays(days);

      const { getPriceHistoryOptimized } = await import('../services/price-history-service');
      const optimizedData = await getPriceHistoryOptimized(productId, validDays, retailerId);

      // Extract only PriceHistory fields (no retailer details)
      return optimizedData.map((item: {
        id: number;
        productOfferId: number;
        productId: number;
        retailerId: number;
        price: string;
        source: string;
        recordedAt: Date;
        aggregatedAt: Date | null;
      }) => ({
        id: item.id,
        productOfferId: item.productOfferId,
        productId: item.productId,
        retailerId: item.retailerId,
        price: item.price,
        source: item.source,
        recordedAt: item.recordedAt,
        aggregatedAt: item.aggregatedAt,
      }));
    });
  }

  /**
   * Analyze price trend for a product (30-day and 90-day analysis)
   *
   * Performance: Optimized to use single query with in-memory splitting
   * instead of two separate database roundtrips (saves ~10-20ms per call).
   *
   * Calculates:
   * - Current price (latest record)
   * - Average, lowest, highest prices (30-day)
   * - Trend direction (rising/falling/stable)
   * - Change percentage
   * - 90-day lowest price for additional context
   *
   * @param productId - Product ID
   * @returns Comprehensive price trend analysis
   *
   * @example
   * const trend = await priceStorage.getPriceTrend(123);
   * if (trend.trend === 'falling') {
   *   console.log(`Price dropped ${trend.changePercentage}%`);
   * }
   */
  async getPriceTrend(productId: number): Promise<PriceTrendAnalysis> {
    return this.handleError('getPriceTrend', async () => {
      this.validatePositiveId(productId, 'Product ID');

      const thirtyDaysAgo = new Date(
        Date.now() - PRICE_CONSTANTS.QUERY.TREND_ANALYSIS_DAYS_SHORT * 24 * 60 * 60 * 1000
      );
      const ninetyDaysAgo = new Date(
        Date.now() - PRICE_CONSTANTS.QUERY.TREND_ANALYSIS_DAYS_LONG * 24 * 60 * 60 * 1000
      );

      // Single query fetches 90 days of data, we split in memory
      const allData = await this.db
        .select({
          price: priceHistory.price,
          recordedAt: priceHistory.recordedAt,
        })
        .from(priceHistory)
        .where(and(eq(priceHistory.productId, productId), gte(priceHistory.recordedAt, ninetyDaysAgo)))
        .orderBy(asc(priceHistory.recordedAt));

      if (allData.length === 0) {
        throw new Error('No price history available for this product');
      }

      // Split into 30-day and 90-day datasets
      const recentData = allData.filter((item) => item.recordedAt >= thirtyDaysAgo);

      if (recentData.length === 0) {
        throw new Error('No recent price history (last 30 days) available for this product');
      }

      // Calculate 30-day metrics
      const prices = recentData.map((item) => parseFloat(item.price));
      const currentPrice = prices[prices.length - 1];
      const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);

      // Calculate trend based on first vs last price
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      const changePercentage =
        ((lastPrice - firstPrice) / firstPrice) * PRICE_CONSTANTS.TREND.PERCENTAGE_MULTIPLIER;

      let trend: 'rising' | 'falling' | 'stable';
      if (Math.abs(changePercentage) < PRICE_CONSTANTS.TREND.STABLE_THRESHOLD) {
        trend = 'stable';
      } else if (changePercentage > 0) {
        trend = 'rising';
      } else {
        trend = 'falling';
      }

      // Calculate 90-day lowest price from full dataset
      const longTermPrices = allData.map((item) => parseFloat(item.price));
      const lowestPrice90Days = Math.min(...longTermPrices);

      return {
        productId,
        currentPrice,
        averagePrice,
        lowestPrice,
        highestPrice,
        trend,
        changePercentage: Math.round(changePercentage * 100) / 100, // Round to 2 decimals
        lowestPrice90Days,
      };
    });
  }

  /**
   * Get the most recent price for a product offer
   *
   * @param offerId - Product offer ID
   * @returns Latest price record or null if not found
   *
   * @example
   * const latest = await priceStorage.getLatestPriceForOffer(456);
   */
  async getLatestPriceForOffer(offerId: number): Promise<PriceHistory | null> {
    return this.handleError('getLatestPriceForOffer', async () => {
      this.validatePositiveId(offerId, 'Offer ID');

      const [result] = await this.db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.productOfferId, offerId))
        .orderBy(desc(priceHistory.recordedAt))
        .limit(1);

      return result || null;
    });
  }

  /**
   * Insert a new price history record
   *
   * @param data - Price history data to insert
   * @returns Inserted price history record
   *
   * @example
   * const record = await priceStorage.insertPriceHistory({
   *   productOfferId: 123,
   *   productId: 45,
   *   retailerId: 6,
   *   price: '99.99',
   *   source: 'scraper',
   *   recordedAt: new Date(),
   * });
   */
  async insertPriceHistory(data: InsertPriceHistoryWithRecordedAt): Promise<PriceHistory> {
    return this.handleError('insertPriceHistory', async () => {
      this.validatePositiveId(data.productOfferId, 'Product Offer ID');
      this.validatePositiveId(data.productId, 'Product ID');
      this.validatePositiveId(data.retailerId, 'Retailer ID');

      if (!data.price || parseFloat(data.price) < 0) {
        throw new Error('Price must be a non-negative number');
      }

      const [result] = await this.db.insert(priceHistory).values(data).returning();
      return result;
    });
  }

  /**
   * Query price history with flexible filters
   *
   * Supports filtering by:
   * - productOfferId
   * - productId
   * - retailerId
   * - Date range (startDate, endDate)
   * - source
   * - limit
   *
   * @param query - Query parameters for filtering
   * @returns Filtered price history records
   *
   * @example
   * const records = await priceStorage.getPriceHistoryByQuery({
   *   productId: 123,
   *   startDate: new Date('2024-01-01'),
   *   limit: 100,
   * });
   */
  async getPriceHistoryByQuery(query: PriceHistoryQueryParams): Promise<PriceHistory[]> {
    return this.handleError('getPriceHistoryByQuery', async () => {
      const conditions: ReturnType<typeof eq>[] = [];

      if (query.productOfferId) {
        this.validatePositiveId(query.productOfferId, 'Product Offer ID');
        conditions.push(eq(priceHistory.productOfferId, query.productOfferId));
      }
      if (query.productId) {
        this.validatePositiveId(query.productId, 'Product ID');
        conditions.push(eq(priceHistory.productId, query.productId));
      }
      if (query.retailerId) {
        this.validatePositiveId(query.retailerId, 'Retailer ID');
        conditions.push(eq(priceHistory.retailerId, query.retailerId));
      }
      if (query.startDate) {
        conditions.push(gte(priceHistory.recordedAt, query.startDate));
      }
      if (query.endDate) {
        conditions.push(lte(priceHistory.recordedAt, query.endDate));
      }
      if (query.startDate && query.endDate) {
        this.validateDateRange(query.startDate, query.endDate);
      }
      if (query.source) {
        conditions.push(eq(priceHistory.source, query.source));
      }

      // Build query with all conditions
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
        return this.db.select().from(priceHistory).orderBy(desc(priceHistory.recordedAt));
      }
    });
  }

  /**
   * Get price history for a specific product offer with limit
   *
   * @param productOfferId - Product offer ID
   * @param limit - Maximum number of records to return
   * @returns Price history records
   *
   * @example
   * const recent = await priceStorage.getPriceHistoryByOfferId(123, 10);
   */
  async getPriceHistoryByOfferId(productOfferId: number, limit: number): Promise<PriceHistory[]> {
    return this.handleError('getPriceHistoryByOfferId', async () => {
      this.validatePositiveId(productOfferId, 'Product Offer ID');

      if (limit <= 0) {
        throw new Error('Limit must be a positive number');
      }

      return this.db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.productOfferId, productOfferId))
        .orderBy(desc(priceHistory.recordedAt))
        .limit(limit);
    });
  }

  // ============================================================================
  // Price Snapshot Operations (4 methods)
  // ============================================================================

  /**
   * Get existing price snapshots for a specific date
   *
   * @param date - Date to check for snapshots
   * @returns Array of snapshot records
   *
   * @example
   * const snapshots = await priceStorage.getExistingSnapshotsForDate(new Date());
   */
  async getExistingSnapshotsForDate(date: Date): Promise<PriceSnapshotRecord[]> {
    return this.handleError('getExistingSnapshotsForDate', async () => {
      const result = await this.db
        .select()
        .from(priceSnapshots)
        .where(sql`DATE(${priceSnapshots.snapshotDate}) = DATE(${date})`);
      return result;
    });
  }

  /**
   * Insert multiple price snapshots (batch operation)
   *
   * @param snapshots - Array of snapshot records to insert
   *
   * @example
   * await priceStorage.insertPriceSnapshots([
   *   { productOfferId: 1, price: '99.99', snapshotDate: new Date() },
   *   { productOfferId: 2, price: '149.99', snapshotDate: new Date() },
   * ]);
   */
  async insertPriceSnapshots(snapshots: PriceSnapshotInsert[]): Promise<void> {
    return this.handleError('insertPriceSnapshots', async () => {
      if (snapshots.length === 0) return;

      // Validate all snapshots
      for (const snapshot of snapshots) {
        this.validatePositiveId(snapshot.productOfferId, 'Product Offer ID');
        if (!snapshot.price || parseFloat(snapshot.price) < 0) {
          throw new Error('Price must be a non-negative number');
        }
      }

      await this.db.insert(priceSnapshots).values(snapshots);
    });
  }

  /**
   * Update an existing price snapshot
   *
   * @param id - Snapshot ID
   * @param data - Partial snapshot data to update
   *
   * @example
   * await priceStorage.updatePriceSnapshot(123, { price: '89.99' });
   */
  async updatePriceSnapshot(id: number, data: Partial<PriceSnapshotInsert>): Promise<void> {
    return this.handleError('updatePriceSnapshot', async () => {
      this.validatePositiveId(id, 'Snapshot ID');

      if (data.price !== undefined && parseFloat(data.price) < 0) {
        throw new Error('Price must be a non-negative number');
      }

      await this.db.update(priceSnapshots).set(data).where(eq(priceSnapshots.id, id));
    });
  }

  /**
   * Get product offers for snapshot processing (pagination support)
   *
   * @param batchSize - Number of offers to fetch
   * @param offset - Offset for pagination
   * @returns Array of product offers
   *
   * @example
   * const offers = await priceStorage.getProductOffersForSnapshot(100, 0);
   */
  async getProductOffersForSnapshot(batchSize: number, offset: number): Promise<ProductOffer[]> {
    return this.handleError('getProductOffersForSnapshot', async () => {
      if (batchSize <= 0) {
        throw new Error('Batch size must be a positive number');
      }
      if (offset < 0) {
        throw new Error('Offset cannot be negative');
      }

      return await this.db.select().from(productOffers).limit(batchSize).offset(offset);
    });
  }

  // ============================================================================
  // Price Aggregation Operations (6 methods)
  // ============================================================================

  /**
   * Get price data for aggregation processing
   *
   * Returns grouped price arrays for efficient aggregation calculations.
   * Uses PostgreSQL array_agg() for database-level grouping.
   *
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param productId - Optional product filter
   * @returns Aggregated price data grouped by product and retailer
   *
   * @example
   * const data = await priceStorage.getPriceDataForAggregation(
   *   new Date('2024-01-01'),
   *   new Date('2024-01-31')
   * );
   */
  async getPriceDataForAggregation(
    startDate: Date,
    endDate: Date,
    productId?: number
  ): Promise<PriceAggregationData[]> {
    return this.handleError('getPriceDataForAggregation', async () => {
      this.validateDateRange(startDate, endDate);

      const conditions = [gte(priceHistory.recordedAt, startDate), lte(priceHistory.recordedAt, endDate)];

      if (productId !== undefined) {
        this.validatePositiveId(productId, 'Product ID');
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
    });
  }

  /**
   * Mark price history records as aggregated
   *
   * Updates the aggregatedAt timestamp for records in the given date range.
   * Used to track which records have been processed for aggregations.
   *
   * @param startDate - Start of date range
   * @param endDate - End of date range
   *
   * @example
   * await priceStorage.markPriceHistoryAsAggregated(
   *   new Date('2024-01-01'),
   *   new Date('2024-01-31')
   * );
   */
  async markPriceHistoryAsAggregated(startDate: Date, endDate: Date): Promise<void> {
    return this.handleError('markPriceHistoryAsAggregated', async () => {
      this.validateDateRange(startDate, endDate);

      await this.db
        .update(priceHistory)
        .set({ aggregatedAt: new Date() })
        .where(and(gte(priceHistory.recordedAt, startDate), lte(priceHistory.recordedAt, endDate)));
    });
  }

  /**
   * Delete old aggregated price history records
   *
   * Removes records older than the cutoff date that have been aggregated.
   * Helps manage database size by removing processed historical data.
   *
   * @param cutoffDate - Delete records older than this date
   * @returns Number of records deleted
   *
   * @example
   * const deleted = await priceStorage.deleteOldAggregatedPriceHistory(
   *   new Date('2023-01-01')
   * );
   */
  async deleteOldAggregatedPriceHistory(cutoffDate: Date): Promise<number> {
    return this.handleError('deleteOldAggregatedPriceHistory', async () => {
      const result = await this.db
        .delete(priceHistory)
        .where(and(lte(priceHistory.recordedAt, cutoffDate), isNotNull(priceHistory.aggregatedAt)));

      return result.rowCount || 0;
    });
  }

  /**
   * Upsert daily price aggregates (conflict resolution)
   *
   * Inserts or updates daily aggregated price data.
   * Uses ON CONFLICT DO UPDATE for idempotent operations.
   *
   * @param values - Array of daily aggregate records
   *
   * @example
   * await priceStorage.upsertDailyAggregates([
   *   {
   *     productId: 1,
   *     retailerId: 2,
   *     date: '2024-01-15',
   *     minPrice: '89.99',
   *     avgPrice: '95.50',
   *     maxPrice: '99.99',
   *     // ... other fields
   *   },
   * ]);
   */
  async upsertDailyAggregates(values: DailyAggregateInsert[]): Promise<void> {
    return this.handleError('upsertDailyAggregates', async () => {
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
    });
  }

  /**
   * Upsert weekly price aggregates (conflict resolution)
   *
   * Inserts or updates weekly aggregated price data.
   * Uses ON CONFLICT DO UPDATE for idempotent operations.
   *
   * @param values - Array of weekly aggregate records
   *
   * @example
   * await priceStorage.upsertWeeklyAggregates([
   *   {
   *     productId: 1,
   *     retailerId: 2,
   *     year: 2024,
   *     week: 3,
   *     minPrice: '85.99',
   *     // ... other fields
   *   },
   * ]);
   */
  async upsertWeeklyAggregates(values: WeeklyAggregateInsert[]): Promise<void> {
    return this.handleError('upsertWeeklyAggregates', async () => {
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
    });
  }

  /**
   * Upsert monthly price aggregates (conflict resolution)
   *
   * Inserts or updates monthly aggregated price data.
   * Uses ON CONFLICT DO UPDATE for idempotent operations.
   *
   * @param values - Array of monthly aggregate records
   *
   * @example
   * await priceStorage.upsertMonthlyAggregates([
   *   {
   *     productId: 1,
   *     retailerId: 2,
   *     year: 2024,
   *     month: 1,
   *     minPrice: '79.99',
   *     // ... other fields
   *   },
   * ]);
   */
  async upsertMonthlyAggregates(values: MonthlyAggregateInsert[]): Promise<void> {
    return this.handleError('upsertMonthlyAggregates', async () => {
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
    });
  }

  // ============================================================================
  // Price Analytics Operations (4 methods)
  // ============================================================================

  /**
   * Get weekly aggregates for a specific year and week
   *
   * @param year - Year (e.g., 2024)
   * @param week - Week number (1-53)
   * @returns Weekly aggregate records
   *
   * @example
   * const data = await priceStorage.getWeeklyAggregatesData(2024, 3);
   */
  async getWeeklyAggregatesData(year: number, week: number): Promise<WeeklyAggregateRecord[]> {
    return this.handleError('getWeeklyAggregatesData', async () => {
      if (year < 2000 || year > 2100) {
        throw new Error('Year must be between 2000 and 2100');
      }
      if (week < 1 || week > 53) {
        throw new Error('Week must be between 1 and 53');
      }

      const result = await this.db
        .select()
        .from(priceAggregatesWeekly)
        .where(
          and(eq(priceAggregatesWeekly.year, year), eq(priceAggregatesWeekly.week, week))
        );
      return result;
    });
  }

  /**
   * Get daily aggregates for a specific date
   *
   * @param date - Date string in YYYY-MM-DD format
   * @returns Daily aggregate records
   *
   * @example
   * const data = await priceStorage.getDailyAggregatesData('2024-01-15');
   */
  async getDailyAggregatesData(date: string): Promise<DailyAggregateRecord[]> {
    return this.handleError('getDailyAggregatesData', async () => {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Date must be in YYYY-MM-DD format');
      }

      const result = await this.db
        .select()
        .from(priceAggregatesDaily)
        .where(eq(priceAggregatesDaily.date, date));
      return result;
    });
  }

  /**
   * Get monthly aggregates for a specific year and month
   *
   * @param year - Year (e.g., 2024)
   * @param month - Month (1-12)
   * @returns Monthly aggregate records
   *
   * @example
   * const data = await priceStorage.getMonthlyAggregatesData(2024, 1);
   */
  async getMonthlyAggregatesData(year: number, month: number): Promise<MonthlyAggregateRecord[]> {
    return this.handleError('getMonthlyAggregatesData', async () => {
      if (year < 2000 || year > 2100) {
        throw new Error('Year must be between 2000 and 2100');
      }
      if (month < 1 || month > 12) {
        throw new Error('Month must be between 1 and 12');
      }

      const result = await this.db
        .select()
        .from(priceAggregatesMonthly)
        .where(
          and(
            eq(priceAggregatesMonthly.year, year),
            eq(priceAggregatesMonthly.month, month)
          )
        );
      return result;
    });
  }

  /**
   * Get latest price for multiple offers (batch operation)
   *
   * Optimized query to fetch most recent prices for a list of offers.
   * Uses inArray() for efficient batch fetching.
   *
   * @param offerIds - Array of product offer IDs
   * @returns Array of offer IDs with their latest prices
   *
   * @example
   * const prices = await priceStorage.getPriceHistoryForOffers([1, 2, 3]);
   */
  async getPriceHistoryForOffers(
    offerIds: number[]
  ): Promise<Array<{ productOfferId: number; price: string }>> {
    return this.handleError('getPriceHistoryForOffers', async () => {
      if (offerIds.length === 0) return [];

      // Validate all offer IDs
      for (const id of offerIds) {
        this.validatePositiveId(id, 'Offer ID');
      }

      return await this.db
        .select({
          productOfferId: priceHistory.productOfferId,
          price: priceHistory.price,
        })
        .from(priceHistory)
        .where(inArray(priceHistory.productOfferId, offerIds))
        .orderBy(priceHistory.productOfferId, desc(priceHistory.recordedAt));
    });
  }

  // ============================================================================
  // Price Trend Operations (4 methods)
  // ============================================================================

  /**
   * Get grouped price data for trend analysis
   *
   * Returns price arrays grouped by product and retailer for statistical analysis.
   * Uses json_agg() for structured data with timestamps.
   * Filters for minimum data points to ensure reliable trend calculation.
   *
   * @param cutoffDate - Only include records after this date
   * @returns Grouped price data with timestamps
   *
   * @example
   * const data = await priceStorage.getPriceDataGroupedForTrend(
   *   new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
   * );
   */
  async getPriceDataGroupedForTrend(cutoffDate: Date): Promise<TrendPriceData[]> {
    return this.handleError('getPriceDataGroupedForTrend', async () => {
      const result = await this.db
        .select({
          productId: priceHistory.productId,
          retailerId: priceHistory.retailerId,
          prices: sql<Array<{ price: number; timestamp: string }>>`
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
        .having(sql`count(*) >= ${PRICE_CONSTANTS.QUERY.MIN_TREND_DATA_POINTS}`);

      return result;
    });
  }

  /**
   * Upsert price trends (batch operation with chunking)
   *
   * Inserts or updates price trend analysis results.
   * Handles large batches by chunking to stay within PostgreSQL parameter limits.
   * Uses ON CONFLICT DO UPDATE for idempotent operations.
   *
   * @param values - Array of price trend records
   *
   * @example
   * await priceStorage.upsertPriceTrends([
   *   {
   *     productId: 1,
   *     retailerId: 2,
   *     trendDirection: 'falling',
   *     trendSlope: -2.5,
   *     trendStrength: 0.85,
   *     // ... other fields
   *   },
   * ]);
   */
  async upsertPriceTrends(values: PriceTrendInsert[]): Promise<void> {
    return this.handleError('upsertPriceTrends', async () => {
      if (values.length === 0) return;

      // Split into chunks to avoid PostgreSQL parameter limits
      const CHUNK_SIZE = PRICE_CONSTANTS.BATCH.UPSERT_CHUNK_SIZE;
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
    });
  }

  /**
   * Get price trend with retailer details for a specific product-retailer pair
   *
   * @param productId - Product ID
   * @param retailerId - Retailer ID
   * @returns Price trend with retailer information or null if not found
   *
   * @example
   * const trend = await priceStorage.getPriceTrendWithRetailer(123, 5);
   */
  async getPriceTrendWithRetailer(
    productId: number,
    retailerId: number
  ): Promise<PriceTrendWithRetailer | null> {
    return this.handleError('getPriceTrendWithRetailer', async () => {
      this.validatePositiveId(productId, 'Product ID');
      this.validatePositiveId(retailerId, 'Retailer ID');

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
        .where(and(eq(priceTrends.productId, productId), eq(priceTrends.retailerId, retailerId)))
        .limit(1);

      return result || null;
    });
  }

  /**
   * Get all price trends for a product across all retailers
   *
   * @param productId - Product ID
   * @returns Array of price trends with retailer details
   *
   * @example
   * const trends = await priceStorage.getPriceTrendsForProduct(123);
   */
  async getPriceTrendsForProduct(productId: number): Promise<PriceTrendWithRetailer[]> {
    return this.handleError('getPriceTrendsForProduct', async () => {
      this.validatePositiveId(productId, 'Product ID');

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
    });
  }
}

/**
 * Create singleton instance
 */
export const priceStorage = new PriceStorage(db);
