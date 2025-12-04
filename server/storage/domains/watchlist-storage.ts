/**
 * Watch List Storage Domain
 *
 * Handles all watch list and product watch operations including CRUD, bulk operations,
 * import/export, and community features.
 *
 * IMPLEMENTATION GUIDANCE (from BaseStorage):
 * 1. **Input Validation**: Validate all numeric IDs are positive integers
 * 2. **N+1 Prevention**: Use JOINs, batch queries, never query in loops
 * 3. **Security**: User ownership verification on all operations
 * 4. **Error Handling**: Use handleError() for database errors
 * 5. **Transactions**: Wrap multi-step operations in db.transaction()
 * 6. **Type Safety**: Import proper types, never use 'any'
 * 7. **Database Aggregation**: Use PostgreSQL functions for stats
 *
 * Phase 3C: Watch List Domain Extraction - 30 methods migrated from monolithic storage.ts
 */

import { and, eq, desc, asc, sql, inArray, count, gt } from "drizzle-orm";
import {
  watchLists,
  productWatches,
  products,
  productOffers,
  priceHistory,
  priceAlerts,
  notifications,
  type WatchList,
  type ProductWatch,
  type InsertWatchList,
  type InsertProductWatch,
} from "@shared/schema";
import { BaseStorage } from "../base-storage";
import { logger } from "../../utils/logger";
import { eventBus, AppEvents } from "../../utils/event-bus";
import { retryWithBackoff, isTransientDatabaseError } from "../../utils/retry-with-backoff";
import type {
  WatchListWithCount,
  WatchListWithProducts,
  WatchedProductsOptions,
  WatchedProductsResult,
  WatchListStats,
  WatchListWithStats,
  CreateWatchListData,
  WatchListUpdates,
  ProductWatchUpdates,
  WatchListProductWithDetails,
  WatchListExportData,
  WatchListImportData,
  CommunityWatchStats,
  WatcherNotificationData,
} from "../types";

/**
 * WatchListStorage - Domain repository for watch list operations
 *
 * Extends BaseStorage to inherit error handling and logging utilities.
 * Implements the 7-point implementation guidance from base-storage.ts.
 */
export class WatchListStorage extends BaseStorage {
  // ============================================================================
  // Validation Helpers
  // ============================================================================

  /**
   * Validate watch list ID is positive integer
   * @private
   */
  private validateWatchListId(watchListId: number): void {
    if (!watchListId || watchListId < 1 || !Number.isInteger(watchListId)) {
      throw new Error(`Invalid watchListId: ${watchListId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate user ID is positive integer
   * @private
   */
  private validateUserId(userId: number): void {
    if (!userId || userId < 1 || !Number.isInteger(userId)) {
      throw new Error(`Invalid userId: ${userId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate product ID is positive integer
   * @private
   */
  private validateProductId(productId: number): void {
    if (!productId || productId < 1 || !Number.isInteger(productId)) {
      throw new Error(`Invalid productId: ${productId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate watch ID is positive integer
   * @private
   */
  private validateWatchId(watchId: number): void {
    if (!watchId || watchId < 1 || !Number.isInteger(watchId)) {
      throw new Error(`Invalid watchId: ${watchId}. Must be a positive integer.`);
    }
  }

  // ============================================================================
  // Core Watch List Operations (9 methods)
  // ============================================================================

  /**
   * Get all watch lists for a user with product counts
   * Used for: Watch list dashboard, navigation
   * PERFORMANCE: LEFT JOIN with COUNT aggregation, GROUP BY, ORDER BY sortOrder
   */
  async getUserWatchLists(userId: number): Promise<WatchListWithCount[]> {
    try {
      this.validateUserId(userId);

      const results = await this.db
        .select({
          id: watchLists.id,
          userId: watchLists.userId,
          name: watchLists.name,
          description: watchLists.description,
          color: watchLists.color,
          icon: watchLists.icon,
          isDefault: watchLists.isDefault,
          sortOrder: watchLists.sortOrder,
          createdAt: watchLists.createdAt,
          updatedAt: watchLists.updatedAt,
          productCount: sql<number>`COUNT(${productWatches.id})::int`.as('product_count'),
        })
        .from(watchLists)
        .leftJoin(productWatches, eq(watchLists.id, productWatches.watchListId))
        .where(eq(watchLists.userId, userId))
        .groupBy(watchLists.id)
        .orderBy(asc(watchLists.sortOrder), asc(watchLists.createdAt));

      return results;
    } catch (error) {
      this.handleError(error, 'getUserWatchLists');
    }
  }

  /**
   * Get watch list by ID with full product details and pricing
   * Used for: Watch list detail page
   * SECURITY: Verifies userId ownership
   * PERFORMANCE: Two-query pattern (verify ownership, then get products)
   */
  async getWatchListById(watchListId: number, userId: number): Promise<WatchListWithProducts | null> {
    try {
      this.validateWatchListId(watchListId);
      this.validateUserId(userId);

      // First verify ownership and get watch list
      const [watchList] = await this.db
        .select({
          id: watchLists.id,
          name: watchLists.name,
          description: watchLists.description,
          color: watchLists.color,
          icon: watchLists.icon,
          isDefault: watchLists.isDefault,
          sortOrder: watchLists.sortOrder,
          createdAt: watchLists.createdAt,
          updatedAt: watchLists.updatedAt,
        })
        .from(watchLists)
        .where(and(
          eq(watchLists.id, watchListId),
          eq(watchLists.userId, userId) // Ownership verification
        ))
        .limit(1);

      if (!watchList) {
        return null;
      }

      // Get products with enriched data
      // PERFORMANCE: Single query with aggregations for current/historical prices
      const productResults = await this.db
        .select({
          id: products.id,
          name: products.name,
          image: products.image,
          addedAt: productWatches.createdAt,
          // Current price from lowest active offer
          currentPrice: sql<number | null>`
            MIN(CAST(${productOffers.price} AS DECIMAL))
          `.as('current_price'),
          // Lowest historical price from price history (last 90 days)
          lowestHistoricalPrice: sql<number | null>`
            (
              SELECT MIN(CAST(price AS DECIMAL))
              FROM ${priceHistory}
              WHERE ${priceHistory.productId} = ${products.id}
                AND ${priceHistory.recordedAt} >= NOW() - INTERVAL '90 days'
            )
          `.as('lowest_historical_price'),
        })
        .from(productWatches)
        .innerJoin(products, eq(productWatches.productId, products.id))
        .leftJoin(productOffers, eq(products.id, productOffers.productId))
        .where(eq(productWatches.watchListId, watchListId))
        .groupBy(products.id, productWatches.createdAt)
        .orderBy(desc(productWatches.createdAt));

      // Calculate price drop percentage
      const productsWithCalcs = productResults.map(p => {
        const currentPrice = p.currentPrice || 0;
        const lowestPrice = p.lowestHistoricalPrice || currentPrice;
        const priceDropPercent = lowestPrice > 0
          ? Math.round(((currentPrice - lowestPrice) / lowestPrice) * 100)
          : 0;

        return {
          id: p.id,
          name: p.name,
          imageUrl: p.image || '',
          addedAt: p.addedAt || new Date(),
          currentPrice,
          lowestHistoricalPrice: lowestPrice,
          priceDropPercent,
        };
      });

      return {
        id: watchList.id,
        name: watchList.name,
        description: watchList.description,
        color: watchList.color,
        icon: watchList.icon,
        products: productsWithCalcs,
      };
    } catch (error) {
      this.handleError(error, 'getWatchListById');
    }
  }

  /**
   * Create new watch list
   * Used for: Watch list creation
   * VALIDATION: Max 20 lists per user, name required (1-100 chars)
   * WEBSOCKET: Emits real-time update (don't fail if WS unavailable)
   */
  async createWatchList(userId: number, data: { name: string; description?: string }): Promise<WatchList> {
    try {
      this.validateUserId(userId);

      // Check user limit (max 20 lists)
      const [countResult] = await this.db
        .select({
          count: sql<number>`COUNT(*)::int`
        })
        .from(watchLists)
        .where(eq(watchLists.userId, userId));

      if (countResult.count >= 20) {
        throw new Error('Maximum watch list limit reached (20 lists per user)');
      }

      // VALIDATION: Name trimming and validation now handled by Zod schema in routes
      const [result] = await this.db
        .insert(watchLists)
        .values({
          userId,
          name: data.name, // Already trimmed by Zod
          description: data.description || null,
        })
        .returning();

      // Emit event via event bus for real-time updates (decoupled from WebSocket)
      eventBus.emit(AppEvents.WATCHLIST_UPDATED, {
        userId,
        watchlistId: result.id,
        action: 'created',
        watchlist: {
          id: result.id,
          name: result.name,
          productCount: 0,
        }
      });

      return result;
    } catch (error) {
      this.handleError(error, 'createWatchList');
    }
  }

  /**
   * Update watch list name/description
   * Used for: Watch list editing
   * SECURITY: Verifies userId ownership
   * WEBSOCKET: Emits real-time update
   */
  async updateWatchList(
    watchListId: number,
    userId: number,
    updates: { name?: string; description?: string }
  ): Promise<WatchList> {
    try {
      this.validateWatchListId(watchListId);
      this.validateUserId(userId);

      // VALIDATION: Name and description trimming/validation now handled by Zod schema in routes
      // Build update object with only provided fields
      const updateData: Partial<typeof watchLists.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (updates.name !== undefined) {
        updateData.name = updates.name; // Already trimmed by Zod
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description || null;
      }

      const [result] = await this.db
        .update(watchLists)
        .set(updateData)
        .where(and(
          eq(watchLists.id, watchListId),
          eq(watchLists.userId, userId) // Ownership verification
        ))
        .returning();

      if (!result) {
        throw new Error('Watch list not found or unauthorized');
      }

      // Emit event via event bus for real-time updates (decoupled from WebSocket)
      eventBus.emit(AppEvents.WATCHLIST_UPDATED, {
        userId,
        watchlistId: result.id,
        action: 'updated',
        watchlist: {
          id: result.id,
          name: result.name,
          productCount: 0, // We don't have the count here, but it's optional
        }
      });

      return result;
    } catch (error) {
      this.handleError(error, 'updateWatchList');
    }
  }

  /**
   * Delete watch list
   * Used for: Watch list deletion
   * SECURITY: Verifies userId ownership
   * CASCADE: productWatches deleted automatically by FK constraint
   * WEBSOCKET: Emits real-time update
   */
  async deleteWatchList(watchListId: number, userId: number): Promise<WatchList> {
    try {
      this.validateWatchListId(watchListId);
      this.validateUserId(userId);

      const [result] = await this.db
        .delete(watchLists)
        .where(and(
          eq(watchLists.id, watchListId),
          eq(watchLists.userId, userId) // Ownership verification
        ))
        .returning();

      if (!result) {
        throw new Error('Watch list not found or unauthorized');
      }

      // Emit event via event bus for real-time updates (decoupled from WebSocket)
      eventBus.emit(AppEvents.WATCHLIST_UPDATED, {
        userId,
        watchlistId: result.id,
        action: 'deleted',
        watchlist: {
          id: result.id,
          name: result.name,
          productCount: 0,
        }
      });

      return result;
    } catch (error) {
      this.handleError(error, 'deleteWatchList');
    }
  }

  /**
   * Get watch list statistics for user
   * Used for: Dashboard summary
   * DATABASE AGGREGATION: Use PostgreSQL aggregation functions with CTEs
   */
  async getWatchListStats(userId: number): Promise<WatchListStats> {
    try {
      this.validateUserId(userId);

      // Get one week ago for weekly stats
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Complex query with multiple aggregations using CTEs
      const stats = await this.db.execute(sql`
        WITH user_products AS (
          SELECT DISTINCT pw.product_id
          FROM ${productWatches} pw
          WHERE pw.user_id = ${userId}
        ),
        price_data AS (
          SELECT
            up.product_id,
            p.name AS product_name,
            (
              SELECT MIN(CAST(price AS DECIMAL))
              FROM ${productOffers}
              WHERE product_id = up.product_id
            ) AS current_price,
            (
              SELECT MIN(CAST(price AS DECIMAL))
              FROM ${priceHistory}
              WHERE product_id = up.product_id
                AND recorded_at >= NOW() - INTERVAL '90 days'
            ) AS lowest_price
          FROM user_products up
          INNER JOIN ${products} p ON up.product_id = p.id
        ),
        best_deals_data AS (
          SELECT
            product_id,
            product_name,
            current_price,
            lowest_price,
            CASE
              WHEN lowest_price > 0 AND current_price IS NOT NULL
              THEN ((current_price - lowest_price) / lowest_price * 100)
              ELSE 0
            END AS discount_percent
          FROM price_data
          WHERE current_price IS NOT NULL
            AND lowest_price IS NOT NULL
            AND lowest_price > 0
          ORDER BY discount_percent DESC
          LIMIT 5
        ),
        weekly_deals AS (
          SELECT COUNT(DISTINCT ph.product_id) AS new_deals
          FROM ${priceHistory} ph
          INNER JOIN user_products up ON ph.product_id = up.product_id
          WHERE ph.recorded_at >= ${oneWeekAgo}
            AND CAST(ph.price AS DECIMAL) < (
              SELECT AVG(CAST(price AS DECIMAL))
              FROM ${priceHistory} ph2
              WHERE ph2.product_id = ph.product_id
                AND ph2.recorded_at >= NOW() - INTERVAL '30 days'
            )
        )
        SELECT
          (SELECT COUNT(*) FROM ${watchLists} WHERE user_id = ${userId})::int AS total_watch_lists,
          (SELECT COUNT(*) FROM user_products)::int AS total_products,
          (
            SELECT COALESCE(SUM(
              CASE WHEN current_price > lowest_price
              THEN current_price - lowest_price
              ELSE 0 END
            ), 0)
            FROM price_data
          )::numeric AS total_potential_savings,
          (
            SELECT COUNT(*)
            FROM ${priceAlerts}
            WHERE user_id = ${userId}
              AND is_active = true
          )::int AS active_alerts,
          (
            SELECT COUNT(*)
            FROM ${priceAlerts}
            WHERE user_id = ${userId}
              AND last_triggered_at >= ${oneWeekAgo}
          )::int AS triggered_alerts,
          (
            SELECT json_agg(
              json_build_object(
                'productId', product_id,
                'productName', product_name,
                'currentPrice', current_price,
                'lowestPrice', lowest_price,
                'discountPercent', ROUND(discount_percent::numeric, 2)
              )
            )
            FROM best_deals_data
          ) AS best_deals,
          (SELECT COALESCE(new_deals, 0) FROM weekly_deals)::int AS weekly_new_deals
      `);

      const row = stats.rows[0] as {
        total_watch_lists: number;
        total_products: number;
        total_potential_savings: string;
        active_alerts: number;
        triggered_alerts: number;
        best_deals: Array<{
          productId: number;
          productName: string;
          currentPrice: string;
          lowestPrice: string;
          discountPercent: number;
        }> | null;
        weekly_new_deals: number;
      };

      // NOTE: db.execute() with json_agg returns already-parsed JSON objects, not strings
      const bestDeals = row.best_deals || [];

      return {
        totalWatchLists: row.total_watch_lists,
        totalProducts: row.total_products,
        totalPotentialSavings: parseFloat(row.total_potential_savings),
        activeAlerts: row.active_alerts,
        triggeredAlerts: row.triggered_alerts,
        bestDeals: bestDeals.map((deal: {
          productId: number;
          productName: string;
          currentPrice: string;
          lowestPrice: string;
          discountPercent: number;
        }) => ({
          productId: deal.productId,
          productName: deal.productName,
          currentPrice: parseFloat(deal.currentPrice),
          lowestPrice: parseFloat(deal.lowestPrice),
          discountPercent: deal.discountPercent,
        })),
        weeklyStats: {
          newDeals: row.weekly_new_deals,
          triggeredAlerts: row.triggered_alerts,
        },
      };
    } catch (error) {
      this.handleError(error, 'getWatchListStats');
    }
  }

  /**
   * Get all watched products with enriched data
   * Used for: Combined product view across all lists
   * PERFORMANCE: Complex aggregations with price history for sparkline data
   * PAGINATION: Cursor-based pagination using product watch ID
   */
  async getWatchedProducts(userId: number, options?: WatchedProductsOptions): Promise<WatchedProductsResult> {
    try {
      this.validateUserId(userId);

      const sortBy = options?.sortBy || 'priceDropPercent';
      const limit = Math.min(options?.limit || 50, 100);
      const cursor = options?.cursor;

      // Fetch limit + 1 to check if more products exist
      const fetchLimit = limit + 1;

      // Get 7 days ago for sparkline data
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Build complex query with price aggregations
      const results = await this.db
        .select({
          id: productWatches.id, // For cursor pagination
          productId: productWatches.productId,
          watchListId: productWatches.watchListId,
          watchListName: watchLists.name,
          productName: products.name,
          imageUrl: products.image,
          addedAt: productWatches.createdAt,
          // Current price (lowest active offer)
          currentPrice: sql<number | null>`
            (
              SELECT MIN(CAST(price AS DECIMAL))
              FROM ${productOffers}
              WHERE ${productOffers.productId} = ${products.id}
            )
          `.as('current_price'),
          // Lowest price in last 90 days
          lowestPrice: sql<number | null>`
            (
              SELECT MIN(CAST(price AS DECIMAL))
              FROM ${priceHistory}
              WHERE ${priceHistory.productId} = ${products.id}
                AND ${priceHistory.recordedAt} >= NOW() - INTERVAL '90 days'
            )
          `.as('lowest_price'),
          // Average price in last 30 days
          averagePrice: sql<number | null>`
            (
              SELECT AVG(CAST(price AS DECIMAL))
              FROM ${priceHistory}
              WHERE ${priceHistory.productId} = ${products.id}
                AND ${priceHistory.recordedAt} >= NOW() - INTERVAL '30 days'
            )
          `.as('average_price'),
          // Last 7 days price history for sparkline
          last7Days: sql<string>`
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'date', DATE(recorded_at),
                    'price', CAST(price AS DECIMAL)
                  )
                  ORDER BY recorded_at
                )
                FROM (
                  SELECT DISTINCT ON (DATE(recorded_at))
                    recorded_at,
                    price
                  FROM ${priceHistory}
                  WHERE ${priceHistory.productId} = ${products.id}
                    AND ${priceHistory.recordedAt} >= ${sevenDaysAgo}
                  ORDER BY DATE(recorded_at), recorded_at DESC
                ) AS daily_prices
              ),
              '[]'::json
            )
          `.as('last_7_days'),
          // Alert status
          hasActiveAlert: sql<boolean>`
            EXISTS(
              SELECT 1 FROM ${priceAlerts}
              WHERE ${priceAlerts.productId} = ${products.id}
                AND ${priceAlerts.userId} = ${userId}
                AND ${priceAlerts.isActive} = true
            )
          `.as('has_active_alert'),
          hasTriggeredAlert: sql<boolean>`
            EXISTS(
              SELECT 1 FROM ${priceAlerts}
              WHERE ${priceAlerts.productId} = ${products.id}
                AND ${priceAlerts.userId} = ${userId}
                AND ${priceAlerts.lastTriggeredAt} >= NOW() - INTERVAL '7 days'
            )
          `.as('has_triggered_alert'),
          // Alert details (for inline editing)
          alertId: sql<number | null>`
            (
              SELECT id FROM ${priceAlerts}
              WHERE ${priceAlerts.productId} = ${products.id}
                AND ${priceAlerts.userId} = ${userId}
              ORDER BY ${priceAlerts.createdAt} DESC
              LIMIT 1
            )
          `.as('alert_id'),
          alertTargetPrice: sql<string | null>`
            (
              SELECT ${priceAlerts.targetPrice} FROM ${priceAlerts}
              WHERE ${priceAlerts.productId} = ${products.id}
                AND ${priceAlerts.userId} = ${userId}
              ORDER BY ${priceAlerts.createdAt} DESC
              LIMIT 1
            )
          `.as('alert_target_price'),
        })
        .from(productWatches)
        .innerJoin(products, eq(productWatches.productId, products.id))
        .innerJoin(watchLists, eq(productWatches.watchListId, watchLists.id))
        .where(
          cursor
            ? and(
                eq(productWatches.userId, userId),
                gt(productWatches.id, cursor)
              )
            : eq(productWatches.userId, userId)
        )
        .limit(fetchLimit);

      // Post-process to calculate derived values and sort
      const enrichedResults = results.map(r => {
        const currentPrice = r.currentPrice || 0;
        const lowestPrice = r.lowestPrice || currentPrice;
        const averagePrice = r.averagePrice || currentPrice;
        const priceDropPercent = lowestPrice > 0
          ? ((currentPrice - lowestPrice) / lowestPrice) * 100
          : 0;
        const savingsPotential = currentPrice > lowestPrice ? currentPrice - lowestPrice : 0;

        // Determine alert status
        let alertStatus: 'active' | 'triggered' | 'none' = 'none';
        if (r.hasTriggeredAlert) {
          alertStatus = 'triggered';
        } else if (r.hasActiveAlert) {
          alertStatus = 'active';
        }

        // Sparkline data is already parsed by Drizzle (json_agg returns JSON object, not string)
        // Double type assertion needed: Drizzle json_agg() returns unknown, cast through unknown to target type
        const last7Days = (r.last7Days as unknown as Array<{ date: string; price: number }>) || [];

        return {
          id: r.id, // Include ID for cursor pagination
          productId: r.productId,
          watchListId: r.watchListId,
          watchListName: r.watchListName,
          productName: r.productName,
          imageUrl: r.imageUrl || '',
          addedAt: r.addedAt || new Date(),
          currentPrice,
          lowestPrice,
          averagePrice,
          priceDropPercent,
          savingsPotential,
          last7Days,
          alertStatus,
          alertId: r.alertId || null,
          // Type assertion: Drizzle returns numeric fields as strings, convert to number for API response
          alertTargetPrice: r.alertTargetPrice ? parseFloat(r.alertTargetPrice) : null,
        };
      });

      // Sort based on sortBy option
      enrichedResults.sort((a, b) => {
        switch (sortBy) {
          case 'priceDropPercent':
            return b.priceDropPercent - a.priceDropPercent; // Descending
          case 'savings':
            return b.savingsPotential - a.savingsPotential; // Descending
          case 'dateAdded':
            return b.addedAt.getTime() - a.addedAt.getTime(); // Most recent first
          default:
            return 0;
        }
      });

      // Check if more products exist beyond the requested limit
      const hasMore = enrichedResults.length > limit;
      const resultProducts = hasMore ? enrichedResults.slice(0, limit) : enrichedResults;
      const nextCursor = hasMore && resultProducts.length > 0
        ? resultProducts[resultProducts.length - 1].id
        : null;

      return {
        products: resultProducts,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      this.handleError(error, 'getWatchedProducts');
    }
  }

  /**
   * Get next sort order for user's watch lists
   * Used for: New list creation ordering
   */
  async getNextWatchListSortOrder(userId: number): Promise<number> {
    try {
      this.validateUserId(userId);

      const maxOrderResult = await this.db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${watchLists.sortOrder}), 0)` })
        .from(watchLists)
        .where(eq(watchLists.userId, userId));

      return (maxOrderResult[0]?.maxOrder ?? 0) + 1;
    } catch (error) {
      this.handleError(error, 'getNextWatchListSortOrder');
    }
  }

  /**
   * Get user's default watch list
   * Used for: Quick add operations
   */
  async getUserDefaultWatchListRecord(userId: number): Promise<WatchList | null> {
    try {
      this.validateUserId(userId);

      const result = await this.db
        .select()
        .from(watchLists)
        .where(and(eq(watchLists.userId, userId), eq(watchLists.isDefault, true)))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.handleError(error, 'getUserDefaultWatchListRecord');
    }
  }

  // ============================================================================
  // Product Watch Operations (7 methods)
  // ============================================================================

  /**
   * Add product to specific watch list
   * Used for: Adding products to lists
   * SECURITY: Verifies watch list ownership
   * TRANSACTION: Check exists + insert atomically with SERIALIZABLE isolation
   * WEBSOCKET: Emits real-time update
   */
  async addProductToWatchList(
    watchListId: number,
    productId: number,
    userId: number
  ): Promise<ProductWatch> {
    try {
      this.validateWatchListId(watchListId);
      this.validateProductId(productId);
      this.validateUserId(userId);

      // RETRY: SERIALIZABLE transactions can fail with serialization errors under concurrent load
      const result = await retryWithBackoff(
        async () => this.db.transaction(async (tx) => {
          // Verify watch list ownership
          const [watchList] = await tx
            .select({ id: watchLists.id })
            .from(watchLists)
            .where(and(
              eq(watchLists.id, watchListId),
              eq(watchLists.userId, userId)
            ))
            .limit(1);

          if (!watchList) {
            throw new Error('Watch list not found or unauthorized');
          }

          // Check product exists and get details for WebSocket event
          const [product] = await tx
            .select({
              id: products.id,
              name: products.name,
              image: products.image,
            })
            .from(products)
            .where(eq(products.id, productId))
            .limit(1);

          if (!product) {
            throw new Error('Product not found');
          }

          // Check if already in watch list
          const [existing] = await tx
            .select({ id: productWatches.id })
            .from(productWatches)
            .where(and(
              eq(productWatches.watchListId, watchListId),
              eq(productWatches.productId, productId)
            ))
            .limit(1);

          if (existing) {
            throw new Error('Product already in watch list');
          }

          // Check product limit per list (max 100 products)
          const [countResult] = await tx
            .select({
              count: sql<number>`COUNT(*)::int`
            })
            .from(productWatches)
            .where(eq(productWatches.watchListId, watchListId));

          if (countResult.count >= 100) {
            throw new Error('Watch list is full (max 100 products per list)');
          }

          // Add product to watch list
          const [result] = await tx
            .insert(productWatches)
            .values({
              userId,
              productId,
              watchListId,
            })
            .returning();

          // Get current price for WebSocket event (optional - outside transaction critical path)
          const offers = await tx
            .select({ price: productOffers.price })
            .from(productOffers)
            .where(eq(productOffers.productId, productId))
            .orderBy(asc(sql`CAST(${productOffers.price} AS DECIMAL)`))
            .limit(1);

          const currentPrice = offers.length > 0 ? parseFloat(offers[0].price) : null;

          return { result, product, currentPrice };
        }, {
          isolationLevel: 'serializable' // Prevent race conditions on concurrent adds
        }),
        {
          maxAttempts: 3,
          initialDelayMs: 100,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'addProductToWatchList', watchListId, productId, userId },
          onRetry: (error: unknown, attempt: number, delayMs: number) => {
            logger.warn('[WatchListStorage] Retrying addProductToWatchList after serialization error', {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              watchListId,
              productId,
            });
          },
        }
      );

      // Emit event via event bus for real-time updates (decoupled from WebSocket)
      eventBus.emit(AppEvents.WATCHLIST_PRODUCT_ADDED, {
        userId,
        watchlistId: watchListId,
        productId: result.product.id,
        product: {
          id: result.product.id,
          name: result.product.name,
          imageUrl: result.product.image ?? undefined,
        }
      });

      return result.result;
    } catch (error: unknown) {
      // Handle constraint violation errors
      if (error instanceof Error && 'code' in error) {
        const dbError = error as { code?: string; constraint?: string };

        if (dbError.code === '23505') { // Unique violation
          // Check multiple ways constraint info might be provided (defensive)
          const constraintName = (dbError.constraint || '').toLowerCase();
          const errorMsg = error.message.toLowerCase();

          if (constraintName.includes('unique_user_product') ||
              errorMsg.includes('unique_user_product') ||
              constraintName.includes('product_watch')) {
            logger.warn('Duplicate product watch detected', {
              userId,
              watchListId,
              productId,
              constraint: dbError.constraint
            });
            // Return 400 validation error instead of 500
            throw new Error('Product already added to this watch list');
          }
        }
      }

      this.handleError(error, 'addProductToWatchList');
    }
  }

  /**
   * Remove product from watch list
   * Used for: Removing products from lists
   * SECURITY: Verifies watch list ownership
   * WEBSOCKET: Emits real-time update
   */
  async removeProductFromWatchList(
    watchListId: number,
    productId: number,
    userId: number
  ): Promise<ProductWatch> {
    try {
      this.validateWatchListId(watchListId);
      this.validateProductId(productId);
      this.validateUserId(userId);

      const [result] = await this.db
        .delete(productWatches)
        .where(and(
          eq(productWatches.watchListId, watchListId),
          eq(productWatches.productId, productId),
          eq(productWatches.userId, userId) // Ownership verification
        ))
        .returning();

      if (!result) {
        throw new Error('Product watch not found or unauthorized');
      }

      // Emit event via event bus for real-time updates (decoupled from WebSocket)
      eventBus.emit(AppEvents.WATCHLIST_PRODUCT_REMOVED, {
        userId,
        watchlistId: watchListId,
        productId,
      });

      return result;
    } catch (error) {
      this.handleError(error, 'removeProductFromWatchList');
    }
  }

  /**
   * Add product watch record (simple add without list assignment)
   * Used for: Quick watch operations
   */
  async addProductWatchRecord(userId: number, productId: number): Promise<ProductWatch | null> {
    try {
      this.validateUserId(userId);
      this.validateProductId(productId);

      const watch: InsertProductWatch = {
        userId,
        productId,
      };

      const result = await this.db
        .insert(productWatches)
        .values(watch)
        .onConflictDoNothing()
        .returning();

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.handleError(error, 'addProductWatchRecord');
    }
  }

  /**
   * Remove a product from user's watch list (simple remove)
   * Used for: Quick unwatch operations
   */
  async removeProductWatchRecord(userId: number, productId: number): Promise<boolean> {
    try {
      this.validateUserId(userId);
      this.validateProductId(productId);

      const result = await this.db
        .delete(productWatches)
        .where(
          and(
            eq(productWatches.userId, userId),
            eq(productWatches.productId, productId)
          )
        )
        .returning();

      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'removeProductWatchRecord');
    }
  }

  /**
   * Get user's watched product IDs
   * Used for: Checking if products are watched
   */
  async getUserProductWatchIds(userId: number): Promise<number[]> {
    try {
      this.validateUserId(userId);

      const watches = await this.db
        .select({ productId: productWatches.productId })
        .from(productWatches)
        .where(eq(productWatches.userId, userId));

      return watches.map(w => w.productId);
    } catch (error) {
      this.handleError(error, 'getUserProductWatchIds');
    }
  }

  /**
   * Check if user is watching a product
   * Used for: UI state (watch button enabled/disabled)
   */
  async isUserWatchingProductCheck(userId: number, productId: number): Promise<boolean> {
    try {
      this.validateUserId(userId);
      this.validateProductId(productId);

      const result = await this.db
        .select()
        .from(productWatches)
        .where(
          and(
            eq(productWatches.userId, userId),
            eq(productWatches.productId, productId)
          )
        )
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'isUserWatchingProductCheck');
    }
  }

  /**
   * Update product watch details (notes, priority, target price)
   * Used for: Product watch customization
   * SECURITY: Verifies userId ownership
   */
  async updateProductWatchRecord(
    userId: number,
    watchId: number,
    updates: ProductWatchUpdates
  ): Promise<ProductWatch | null> {
    try {
      this.validateUserId(userId);
      this.validateWatchId(watchId);

      const result = await this.db
        .update(productWatches)
        .set(updates)
        .where(and(eq(productWatches.id, watchId), eq(productWatches.userId, userId)))
        .returning();

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.handleError(error, 'updateProductWatchRecord');
    }
  }

  // ============================================================================
  // Enhanced Watch List Features (7 methods)
  // ============================================================================

  /**
   * Create watch list with full options (color, icon, sortOrder)
   * Used for: Advanced watch list creation
   */
  async createWatchListRecord(data: CreateWatchListData): Promise<WatchList> {
    try {
      this.validateUserId(data.userId);

      if (!data.name) {
        throw new Error('name is required');
      }

      const watchList: InsertWatchList = {
        userId: data.userId,
        name: data.name,
        description: data.description || null,
        color: data.color || null,
        icon: data.icon || null,
        isDefault: false,
        sortOrder: data.sortOrder,
      };

      const result = await this.db.insert(watchLists).values(watchList).returning();
      return result[0];
    } catch (error) {
      this.handleError(error, 'createWatchListRecord');
    }
  }

  /**
   * Get all watch lists for a user with stats (watch count, high priority count)
   * Used for: Dashboard with priority indicators
   */
  async getWatchListsWithStats(userId: number): Promise<WatchListWithStats[]> {
    try {
      this.validateUserId(userId);

      const result = await this.db
        .select({
          id: watchLists.id,
          userId: watchLists.userId,
          name: watchLists.name,
          description: watchLists.description,
          color: watchLists.color,
          icon: watchLists.icon,
          isDefault: watchLists.isDefault,
          sortOrder: watchLists.sortOrder,
          createdAt: watchLists.createdAt,
          updatedAt: watchLists.updatedAt,
          watchCount: sql<number>`COUNT(${productWatches.id})::int`,
          highPriorityCount: sql<number>`COUNT(CASE WHEN ${productWatches.priority} = 5 THEN 1 END)::int`,
        })
        .from(watchLists)
        .leftJoin(productWatches, eq(productWatches.watchListId, watchLists.id))
        .where(eq(watchLists.userId, userId))
        .groupBy(watchLists.id)
        .orderBy(watchLists.sortOrder);

      return result;
    } catch (error) {
      this.handleError(error, 'getWatchListsWithStats');
    }
  }

  /**
   * Get a specific watch list with stats
   * Used for: Watch list detail view with stats
   * SECURITY: Verifies userId ownership
   */
  async getWatchListByIdWithStats(userId: number, listId: number): Promise<WatchListWithStats | null> {
    try {
      this.validateUserId(userId);
      this.validateWatchListId(listId);

      const result = await this.db
        .select({
          id: watchLists.id,
          userId: watchLists.userId,
          name: watchLists.name,
          description: watchLists.description,
          color: watchLists.color,
          icon: watchLists.icon,
          isDefault: watchLists.isDefault,
          sortOrder: watchLists.sortOrder,
          createdAt: watchLists.createdAt,
          updatedAt: watchLists.updatedAt,
          watchCount: sql<number>`COUNT(${productWatches.id})::int`,
          highPriorityCount: sql<number>`COUNT(CASE WHEN ${productWatches.priority} = 5 THEN 1 END)::int`,
        })
        .from(watchLists)
        .leftJoin(productWatches, eq(productWatches.watchListId, watchLists.id))
        .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
        .groupBy(watchLists.id)
        .limit(1);

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.handleError(error, 'getWatchListByIdWithStats');
    }
  }

  /**
   * Update a watch list with extended options
   * Used for: Watch list customization
   * SECURITY: Verifies userId ownership
   */
  async updateWatchListRecord(
    userId: number,
    listId: number,
    updates: WatchListUpdates
  ): Promise<WatchList | null> {
    try {
      this.validateUserId(userId);
      this.validateWatchListId(listId);

      const result = await this.db
        .update(watchLists)
        .set(updates)
        .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
        .returning();

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.handleError(error, 'updateWatchListRecord');
    }
  }

  /**
   * Delete a watch list (prevents deletion of default list)
   * Used for: Watch list deletion with safety check
   * SECURITY: Verifies userId ownership
   */
  async deleteWatchListRecord(userId: number, listId: number): Promise<boolean> {
    try {
      this.validateUserId(userId);
      this.validateWatchListId(listId);

      // Prevent deletion of default list
      const list = await this.db
        .select()
        .from(watchLists)
        .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
        .limit(1);

      if (list.length === 0) {
        return false;
      }

      if (list[0].isDefault) {
        throw new Error("Cannot delete default watch list");
      }

      const result = await this.db
        .delete(watchLists)
        .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
        .returning();

      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'deleteWatchListRecord');
    }
  }

  /**
   * Get products in a watch list with details
   * Used for: Watch list detail page with product info
   * SECURITY: Verifies userId ownership
   */
  async getWatchListProductsWithDetails(
    userId: number,
    listId: number
  ): Promise<WatchListProductWithDetails[]> {
    try {
      this.validateUserId(userId);
      this.validateWatchListId(listId);

      const result = await this.db
        .select({
          id: productWatches.id,
          userId: productWatches.userId,
          productId: productWatches.productId,
          watchListId: productWatches.watchListId,
          category: productWatches.category,
          notes: productWatches.notes,
          priority: productWatches.priority,
          targetPrice: productWatches.targetPrice,
          createdAt: productWatches.createdAt,
          updatedAt: productWatches.updatedAt,
          productName: products.name,
          productImage: products.image,
        })
        .from(productWatches)
        .innerJoin(products, eq(products.id, productWatches.productId))
        .where(
          and(
            eq(productWatches.userId, userId),
            eq(productWatches.watchListId, listId)
          )
        )
        .orderBy(desc(productWatches.priority), desc(productWatches.updatedAt));

      // Map null to undefined for productImage to match interface
      return result.map(row => ({
        ...row,
        productImage: row.productImage ?? undefined
      }));
    } catch (error) {
      this.handleError(error, 'getWatchListProductsWithDetails');
    }
  }

  /**
   * Get watchers for a product
   * Used for: Notification targeting
   */
  async getWatchersForProduct(productId: number): Promise<number[]> {
    try {
      this.validateProductId(productId);

      const watchers = await this.db
        .select({ userId: productWatches.userId })
        .from(productWatches)
        .where(eq(productWatches.productId, productId));

      return watchers.map(w => w.userId);
    } catch (error) {
      this.handleError(error, 'getWatchersForProduct');
    }
  }

  // ============================================================================
  // Bulk Operations (2 methods)
  // ============================================================================

  /**
   * Move multiple products between watch lists
   * Used for: Bulk organization
   * SECURITY: Verifies target list ownership
   */
  async moveProductWatchesBulk(
    userId: number,
    watchIds: number[],
    targetListId: number | null
  ): Promise<number> {
    try {
      this.validateUserId(userId);

      if (!watchIds || watchIds.length === 0) {
        throw new Error('watchIds array cannot be empty');
      }

      // Verify the target list belongs to the user if specified
      if (targetListId !== null) {
        this.validateWatchListId(targetListId);

        const targetList = await this.db
          .select()
          .from(watchLists)
          .where(and(eq(watchLists.id, targetListId), eq(watchLists.userId, userId)))
          .limit(1);

        if (targetList.length === 0) {
          throw new Error("Target watch list not found");
        }
      }

      const result = await this.db
        .update(productWatches)
        .set({ watchListId: targetListId })
        .where(
          and(
            inArray(productWatches.id, watchIds),
            eq(productWatches.userId, userId)
          )
        )
        .returning();

      return result.length;
    } catch (error) {
      this.handleError(error, 'moveProductWatchesBulk');
    }
  }

  /**
   * Remove multiple products from watch lists (bulk delete)
   * Used for: Bulk cleanup operations
   * SECURITY: Verifies userId ownership
   */
  async deleteProductWatchesBulk(userId: number, watchIds: number[]): Promise<number> {
    try {
      this.validateUserId(userId);

      if (!watchIds || watchIds.length === 0) {
        throw new Error('watchIds array cannot be empty');
      }

      const result = await this.db
        .delete(productWatches)
        .where(
          and(
            inArray(productWatches.id, watchIds),
            eq(productWatches.userId, userId)
          )
        )
        .returning();

      return result.length;
    } catch (error) {
      this.handleError(error, 'deleteProductWatchesBulk');
    }
  }

  // ============================================================================
  // Import/Export (2 methods)
  // ============================================================================

  /**
   * Export all user watch lists to JSON
   * Used for: Data portability, backups
   * PERFORMANCE: Batch queries to avoid N+1 (single query for all products)
   */
  async exportUserWatchListsData(userId: number): Promise<WatchListExportData> {
    try {
      this.validateUserId(userId);

      // Step 1: Get all watch lists
      const lists = await this.getWatchListsWithStats(userId);

      // Step 2: Batch query ALL products for ALL lists at once (prevents N+1)
      const listIds = lists.map(list => list.id);
      const allProducts = listIds.length > 0
        ? await this.db
            .select({
              watchListId: productWatches.watchListId,
              productId: productWatches.productId,
              productName: products.name,
              category: productWatches.category,
              notes: productWatches.notes,
              priority: productWatches.priority,
              targetPrice: productWatches.targetPrice,
            })
            .from(productWatches)
            .innerJoin(products, eq(products.id, productWatches.productId))
            .where(
              and(
                eq(productWatches.userId, userId),
                inArray(productWatches.watchListId, listIds)
              )
            )
        : [];

      // Step 3: Group products by listId using Map for O(n) lookup
      const productsByListId = new Map<number, typeof allProducts>();
      for (const product of allProducts) {
        if (!product.watchListId) {
          logger.warn(`Storage: Product ${product.productId} has null watchListId, skipping`);
          continue;
        }

        if (!productsByListId.has(product.watchListId)) {
          productsByListId.set(product.watchListId, []);
        }

        const listProducts = productsByListId.get(product.watchListId);
        if (listProducts) {
          listProducts.push(product);
        } else {
          logger.warn(`Storage: Missing products array for watchlist ID: ${product.watchListId}, initializing`);
          productsByListId.set(product.watchListId, [product]);
        }
      }

      // Step 4: Build export data
      const exportData = lists.map(list => ({
        name: list.name,
        description: list.description,
        color: list.color,
        icon: list.icon,
        products: (productsByListId.get(list.id) || []).map(p => ({
          productId: p.productId,
          productName: p.productName,
          category: p.category,
          notes: p.notes,
          priority: p.priority,
          targetPrice: p.targetPrice,
        })),
      }));

      return {
        exportDate: new Date().toISOString(),
        userId,
        watchLists: exportData,
      };
    } catch (error) {
      this.handleError(error, 'exportUserWatchListsData');
    }
  }

  /**
   * Import watch lists from JSON
   * Used for: Data restoration, migration
   * TRANSACTION: All-or-nothing import
   */
  async importWatchListsData(
    userId: number,
    data: WatchListImportData
  ): Promise<{ created: number; skipped: number }> {
    try {
      this.validateUserId(userId);

      if (!data.watchLists || !Array.isArray(data.watchLists)) {
        throw new Error('watchLists must be an array');
      }

      // DATA INTEGRITY: Use transaction to ensure all-or-nothing import
      // If mid-import failure occurs, rollback prevents partial data corruption
      return await this.db.transaction(async (tx) => {
        let created = 0;
        let skipped = 0;

        for (const listData of data.watchLists) {
          try {
            // Check if list with this name already exists
            const existing = await tx
              .select()
              .from(watchLists)
              .where(
                and(
                  eq(watchLists.userId, userId),
                  eq(watchLists.name, listData.name)
                )
              )
              .limit(1);

            let listId: number;

            if (existing.length > 0) {
              listId = existing[0].id;
              skipped++;
            } else {
              // Create new list within transaction
              const newListResult = await tx.insert(watchLists).values({
                userId,
                name: listData.name,
                description: listData.description || null,
                color: listData.color || null,
                icon: listData.icon || null,
              }).returning();
              listId = newListResult[0].id;
              created++;
            }

            // Import products into the list
            if (listData.products && Array.isArray(listData.products)) {
              for (const productData of listData.products) {
                try {
                  const watch: InsertProductWatch = {
                    userId,
                    productId: productData.productId,
                    watchListId: listId,
                    category: productData.category || null,
                    notes: productData.notes || null,
                    priority: productData.priority || 3,
                    targetPrice: productData.targetPrice || null,
                  };

                  await tx
                    .insert(productWatches)
                    .values(watch)
                    .onConflictDoNothing();
                } catch (error) {
                  logger.error('[WatchListStorage] Error importing product watch', {
                    error: error instanceof Error ? error.message : String(error)
                  });
                  // Continue with next product
                }
              }
            }
          } catch (error) {
            logger.error('[WatchListStorage] Error importing watch list', {
              error: error instanceof Error ? error.message : String(error)
            });
            skipped++;
          }
        }

        return { created, skipped };
      });
    } catch (error) {
      this.handleError(error, 'importWatchListsData');
    }
  }

  // ============================================================================
  // Community & Analytics (4 methods)
  // ============================================================================

  /**
   * Get watch count for a specific product
   * Used for: Product popularity metrics
   */
  async getProductWatchCountByProduct(productId: number): Promise<number> {
    try {
      this.validateProductId(productId);

      const result = await this.db
        .select({ count: count() })
        .from(productWatches)
        .where(eq(productWatches.productId, productId));

      return result[0]?.count || 0;
    } catch (error) {
      this.handleError(error, 'getProductWatchCountByProduct');
    }
  }

  /**
   * Get most watched products
   * Used for: Community trending products
   * DATABASE AGGREGATION: Use GROUP BY with ORDER BY aggregated count
   */
  async getMostWatchedProductStats(limit = 10): Promise<CommunityWatchStats[]> {
    try {
      if (limit <= 0 || limit > 100) {
        throw new Error('limit must be between 1 and 100');
      }

      const result = await this.db
        .select({
          productId: productWatches.productId,
          watchCount: sql<number>`count(*)::int`,
        })
        .from(productWatches)
        .groupBy(productWatches.productId)
        .orderBy(sql`count(*) DESC`)
        .limit(limit);

      return result.map((r, index) => ({
        productId: r.productId,
        watchCount: r.watchCount,
        rank: index + 1,
      }));
    } catch (error) {
      this.handleError(error, 'getMostWatchedProductStats');
    }
  }

  /**
   * Notify all product watchers
   * Used for: Price drop notifications, availability alerts
   * VALIDATION: Checks notification has required fields
   */
  async notifyProductWatchers(productId: number, notification: WatcherNotificationData): Promise<void> {
    try {
      this.validateProductId(productId);

      if (!notification.type || !notification.title || !notification.content) {
        throw new Error('notification must have type, title, and content');
      }

      const watchers = await this.getWatchersForProduct(productId);

      if (watchers.length > 0) {
        const notificationList = watchers.map(userId => ({
          userId,
          type: notification.type,
          title: notification.title,
          content: notification.content,
          relatedProductId: notification.relatedProductId || null,
        }));

        await this.db.insert(notifications).values(notificationList);
      }
    } catch (error) {
      this.handleError(error, 'notifyProductWatchers');
    }
  }

  /**
   * Get users watching a product (user IDs only)
   * Used for: Notification targeting, analytics
   */
  async getUsersWatchingProduct(productId: number): Promise<number[]> {
    try {
      this.validateProductId(productId);

      return await this.getWatchersForProduct(productId);
    } catch (error) {
      this.handleError(error, 'getUsersWatchingProduct');
    }
  }
}
