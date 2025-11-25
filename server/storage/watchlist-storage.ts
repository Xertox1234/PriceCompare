import { db } from "../db";
import { BaseStorage } from "./base-storage";
import {
  watchLists,
  productWatches,
  products,
  productOffers,
  priceHistory,
  priceAlerts,
  type WatchList,
  type ProductWatch,
} from "@shared/schema";
import {
  type WatchListWithCount,
  type WatchListWithProducts,
  type WatchedProductsOptions,
  type WatchedProductInfo,
  type WatchListStats,
} from "./types";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { retryWithBackoff, isTransientDatabaseError } from "../utils/retry-with-backoff";
import { logger } from "../utils/logger";

/**
 * Watchlist Storage Repository
 *
 * Manages watch list and product watch operations with comprehensive
 * validation, ownership checks, and performance-optimized aggregations.
 *
 * Key Features:
 * - User-scoped watch lists with product counts
 * - Multi-step atomic operations with SERIALIZABLE isolation
 * - Complex price aggregations with sparkline data
 * - WebSocket integration for real-time updates
 * - Cascade delete documentation
 *
 * Performance Characteristics:
 * - getUserWatchLists: Single query with LEFT JOIN aggregation
 * - getWatchedProducts: Complex query with subqueries for sparkline data
 * - getWatchListStats: CTE-based aggregations for dashboard stats
 * - addProductToWatchList: SERIALIZABLE transaction with retry logic
 *
 * Database Schema Requirements:
 * - watchLists.userId indexed for performance
 * - productWatches has CASCADE delete on watchListId
 * - Unique constraint on (watchListId, productId) prevents duplicates
 */

/**
 * Constants for watchlist operations
 */
const WATCHLIST_CONSTANTS = {
  LIMITS: {
    MAX_LISTS_PER_USER: 20,
    MAX_PRODUCTS_PER_LIST: 100,
    MAX_NAME_LENGTH: 100,
    DEFAULT_RESULTS_LIMIT: 50,
    MAX_RESULTS_LIMIT: 100,
  },
  VALIDATION: {
    MIN_NAME_LENGTH: 1,
  },
  HISTORY: {
    SPARKLINE_DAYS: 7,
    LOWEST_PRICE_DAYS: 90,
    AVERAGE_PRICE_DAYS: 30,
    WEEKLY_STATS_DAYS: 7,
  },
  WEBSOCKET: {
    EVENTS: {
      LIST_CREATED: 'created',
      LIST_UPDATED: 'updated',
      LIST_DELETED: 'deleted',
      PRODUCT_ADDED: 'product_added',
      PRODUCT_REMOVED: 'product_removed',
    },
  },
} as const;

/**
 * Watchlist Storage Interface
 */
export interface IWatchlistStorage {
  /**
   * Get all watch lists for a user with product counts
   */
  getUserWatchLists(userId: number): Promise<WatchListWithCount[]>;

  /**
   * Get watch list by ID with full product details
   */
  getWatchListById(watchListId: number, userId: number): Promise<WatchListWithProducts | null>;

  /**
   * Create a new watch list
   */
  createWatchList(userId: number, data: { name: string; description?: string }): Promise<WatchList>;

  /**
   * Update watch list name/description
   */
  updateWatchList(
    watchListId: number,
    userId: number,
    updates: { name?: string; description?: string }
  ): Promise<WatchList>;

  /**
   * Delete watch list
   */
  deleteWatchList(watchListId: number, userId: number): Promise<WatchList>;

  /**
   * Add product to watch list
   */
  addProductToWatchList(
    watchListId: number,
    productId: number,
    userId: number
  ): Promise<ProductWatch>;

  /**
   * Remove product from watch list
   */
  removeProductFromWatchList(
    watchListId: number,
    productId: number,
    userId: number
  ): Promise<ProductWatch>;

  /**
   * Get all watched products with pricing and sparkline data
   */
  getWatchedProducts(
    userId: number,
    options?: WatchedProductsOptions
  ): Promise<WatchedProductInfo[]>;

  /**
   * Get aggregated statistics for user's watch lists
   */
  getWatchListStats(userId: number): Promise<WatchListStats>;
}

/**
 * Watchlist Storage Implementation
 */
export class WatchlistStorage extends BaseStorage implements IWatchlistStorage {
  /**
   * Get all watch lists for a user with product counts
   *
   * Performance characteristics:
   * - Single query with LEFT JOIN aggregation
   * - Product count calculated via COUNT() GROUP BY
   * - Sorted by sortOrder and createdAt
   *
   * @param userId - User ID
   * @returns Array of watch lists with product counts
   *
   * @example
   * const lists = await watchlistStorage.getUserWatchLists(123);
   * // Returns: [{ id: 1, name: "My List", productCount: 5 }, ...]
   */
  async getUserWatchLists(userId: number): Promise<WatchListWithCount[]> {
    return this.handleError('getUserWatchLists', async () => {
      // Validation
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

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
    });
  }

  /**
   * Get watch list by ID with full product details
   *
   * Performance characteristics:
   * - Two queries: list ownership check + products with pricing
   * - Subquery for lowest historical price (90 days)
   * - Aggregates current price from active offers
   *
   * Security:
   * - Verifies userId ownership before returning data
   *
   * @param watchListId - Watch list ID
   * @param userId - User ID (for ownership verification)
   * @returns Watch list with products or null if not found/unauthorized
   *
   * @example
   * const list = await watchlistStorage.getWatchListById(1, 123);
   * if (list) {
   *   console.log(`${list.name} has ${list.products.length} products`);
   * }
   */
  async getWatchListById(
    watchListId: number,
    userId: number
  ): Promise<WatchListWithProducts | null> {
    return this.handleError('getWatchListById', async () => {
      // Validation
      if (!watchListId || watchListId <= 0) {
        throw new Error('Watch list ID must be a positive number');
      }
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

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
        this.logDebug('getWatchListById', {
          watchListId,
          userId,
          reason: 'Watch list not found or unauthorized',
        });
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
                AND ${priceHistory.recordedAt} >= NOW() - INTERVAL '${WATCHLIST_CONSTANTS.HISTORY.LOWEST_PRICE_DAYS} days'
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
    });
  }

  /**
   * Create a new watch list for a user
   *
   * Validation:
   * - Enforces max 20 lists per user
   * - Name must be 1-100 characters
   * - Trims whitespace from name and description
   *
   * WebSocket Integration:
   * - Emits 'created' event on success (non-blocking)
   *
   * @param userId - User ID
   * @param data - Watch list data (name, optional description)
   * @returns Created watch list
   * @throws Error if validation fails or limit exceeded
   *
   * @example
   * const list = await watchlistStorage.createWatchList(123, {
   *   name: "Deals to Watch",
   *   description: "Black Friday deals"
   * });
   */
  async createWatchList(
    userId: number,
    data: { name: string; description?: string }
  ): Promise<WatchList> {
    return this.handleError('createWatchList', async () => {
      // Validation: userId
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

      // Validation: name required
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Watch list name is required');
      }

      // Validation: name length
      if (data.name.length > WATCHLIST_CONSTANTS.LIMITS.MAX_NAME_LENGTH) {
        throw new Error(
          `Watch list name must be ${WATCHLIST_CONSTANTS.LIMITS.MAX_NAME_LENGTH} characters or less`
        );
      }

      // Check user limit (max 20 lists)
      const [countResult] = await this.db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(watchLists)
        .where(eq(watchLists.userId, userId));

      if (countResult.count >= WATCHLIST_CONSTANTS.LIMITS.MAX_LISTS_PER_USER) {
        throw new Error(
          `Maximum watch list limit reached (${WATCHLIST_CONSTANTS.LIMITS.MAX_LISTS_PER_USER} lists per user)`
        );
      }

      const [result] = await this.db
        .insert(watchLists)
        .values({
          userId,
          name: data.name.trim(),
          description: data.description?.trim() || null,
        })
        .returning();

      // Emit WebSocket event for real-time updates (non-blocking)
      this.emitWebSocketEvent('createWatchList', async () => {
        const { getSocketIO } = await import('../websocket');
        const { emitWatchListUpdate } = await import('../websocket/handlers/watch-list-handler');
        const io = getSocketIO();
        if (io) {
          emitWatchListUpdate(io, userId, WATCHLIST_CONSTANTS.WEBSOCKET.EVENTS.LIST_CREATED, {
            id: result.id,
            name: result.name,
            description: result.description,
            productCount: 0,
          });
        }
      });

      return result;
    });
  }

  /**
   * Update watch list name/description
   *
   * Security:
   * - Verifies userId ownership before update
   *
   * Validation:
   * - Name must be 1-100 characters if provided
   * - Updates updatedAt timestamp automatically
   *
   * WebSocket Integration:
   * - Emits 'updated' event on success (non-blocking)
   *
   * @param watchListId - Watch list ID
   * @param userId - User ID (for ownership verification)
   * @param updates - Fields to update (name, description)
   * @returns Updated watch list
   * @throws Error if validation fails or not found/unauthorized
   *
   * @example
   * const updated = await watchlistStorage.updateWatchList(1, 123, {
   *   name: "Updated Name",
   *   description: "New description"
   * });
   */
  async updateWatchList(
    watchListId: number,
    userId: number,
    updates: { name?: string; description?: string }
  ): Promise<WatchList> {
    return this.handleError('updateWatchList', async () => {
      // Validation: IDs
      if (!watchListId || watchListId <= 0) {
        throw new Error('Watch list ID must be a positive number');
      }
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

      // Validation: name if provided
      if (updates.name !== undefined) {
        if (updates.name.trim().length === 0) {
          throw new Error('Watch list name cannot be empty');
        }
        if (updates.name.length > WATCHLIST_CONSTANTS.LIMITS.MAX_NAME_LENGTH) {
          throw new Error(
            `Watch list name must be ${WATCHLIST_CONSTANTS.LIMITS.MAX_NAME_LENGTH} characters or less`
          );
        }
      }

      // Build update object with only provided fields
      const updateData: Partial<typeof watchLists.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (updates.name !== undefined) {
        updateData.name = updates.name.trim();
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description.trim() || null;
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

      // Emit WebSocket event for real-time updates (non-blocking)
      this.emitWebSocketEvent('updateWatchList', async () => {
        const { getSocketIO } = await import('../websocket');
        const { emitWatchListUpdate } = await import('../websocket/handlers/watch-list-handler');
        const io = getSocketIO();
        if (io) {
          emitWatchListUpdate(io, userId, WATCHLIST_CONSTANTS.WEBSOCKET.EVENTS.LIST_UPDATED, {
            id: result.id,
            name: result.name,
            description: result.description,
          });
        }
      });

      return result;
    });
  }

  /**
   * Delete watch list
   *
   * Security:
   * - Verifies userId ownership before deletion
   *
   * Database CASCADE:
   * - productWatches entries deleted automatically by FK constraint
   * - See schema.ts for cascade configuration
   *
   * WebSocket Integration:
   * - Emits 'deleted' event on success (non-blocking)
   *
   * @param watchListId - Watch list ID
   * @param userId - User ID (for ownership verification)
   * @returns Deleted watch list
   * @throws Error if not found or unauthorized
   *
   * @example
   * const deleted = await watchlistStorage.deleteWatchList(1, 123);
   * // All productWatches for this list are CASCADE deleted
   */
  async deleteWatchList(watchListId: number, userId: number): Promise<WatchList> {
    return this.handleError('deleteWatchList', async () => {
      // Validation
      if (!watchListId || watchListId <= 0) {
        throw new Error('Watch list ID must be a positive number');
      }
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

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

      // Emit WebSocket event for real-time updates (non-blocking)
      this.emitWebSocketEvent('deleteWatchList', async () => {
        const { getSocketIO } = await import('../websocket');
        const { emitWatchListUpdate } = await import('../websocket/handlers/watch-list-handler');
        const io = getSocketIO();
        if (io) {
          emitWatchListUpdate(io, userId, WATCHLIST_CONSTANTS.WEBSOCKET.EVENTS.LIST_DELETED, {
            id: result.id,
            name: result.name,
            description: result.description,
          });
        }
      });

      return result;
    });
  }

  /**
   * Add product to watch list
   *
   * Transaction:
   * - SERIALIZABLE isolation to prevent race conditions
   * - Atomic check-and-insert operation
   * - Retry logic for serialization errors (max 3 attempts)
   *
   * Validation:
   * - Watch list exists and user owns it
   * - Product exists in database
   * - Product not already in watch list
   * - Watch list not full (max 100 products)
   *
   * Performance:
   * - Single transaction with 4 database operations
   * - Optimized for concurrent access with retry logic
   *
   * WebSocket Integration:
   * - Emits 'product_added' event after transaction commits (non-blocking)
   *
   * @param watchListId - Watch list ID
   * @param productId - Product ID to add
   * @param userId - User ID (for ownership verification)
   * @returns Created product watch record
   * @throws Error if validation fails or operation not permitted
   *
   * @example
   * const productWatch = await watchlistStorage.addProductToWatchList(1, 456, 123);
   * // Returns: { id: 789, watchListId: 1, productId: 456, userId: 123 }
   */
  async addProductToWatchList(
    watchListId: number,
    productId: number,
    userId: number
  ): Promise<ProductWatch> {
    return this.handleError('addProductToWatchList', async () => {
      // Validation
      if (!watchListId || watchListId <= 0) {
        throw new Error('Watch list ID must be a positive number');
      }
      if (!productId || productId <= 0) {
        throw new Error('Product ID must be a positive number');
      }
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

      // RETRY: SERIALIZABLE transactions can fail with serialization errors under concurrent load
      const result = await retryWithBackoff(
        async () => this.executeTransaction(async (tx) => {
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
              count: sql<number>`COUNT(*)::int`,
            })
            .from(productWatches)
            .where(eq(productWatches.watchListId, watchListId));

          if (countResult.count >= WATCHLIST_CONSTANTS.LIMITS.MAX_PRODUCTS_PER_LIST) {
            throw new Error(
              `Watch list is full (max ${WATCHLIST_CONSTANTS.LIMITS.MAX_PRODUCTS_PER_LIST} products per list)`
            );
          }

          // Add product to watch list
          const [productWatchResult] = await tx
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

          return { productWatchResult, product, currentPrice };
        }, {
          isolationLevel: 'serializable', // Prevent race conditions on concurrent adds
        }),
        {
          maxAttempts: 3,
          initialDelayMs: 100,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'addProductToWatchList', watchListId, productId, userId },
          onRetry: (error, attempt, delayMs) => {
            logger.warn('[WatchlistStorage] Retrying addProductToWatchList after serialization error', {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              watchListId,
              productId,
            });
          },
        }
      );

      // Emit WebSocket event after transaction commits (non-blocking)
      this.emitWebSocketEvent('addProductToWatchList', async () => {
        const { getSocketIO } = await import('../websocket');
        const { emitProductAdded } = await import('../websocket/handlers/watch-list-handler');
        const io = getSocketIO();
        if (io) {
          emitProductAdded(io, userId, watchListId, {
            id: result.product.id,
            name: result.product.name,
            image: result.product.image,
            currentPrice: result.currentPrice,
          });
        }
      });

      return result.productWatchResult;
    });
  }

  /**
   * Remove product from watch list
   *
   * Security:
   * - Verifies userId ownership via triple AND condition
   *
   * WebSocket Integration:
   * - Emits 'product_removed' event on success (non-blocking)
   *
   * @param watchListId - Watch list ID
   * @param productId - Product ID to remove
   * @param userId - User ID (for ownership verification)
   * @returns Deleted product watch record
   * @throws Error if not found or unauthorized
   *
   * @example
   * const removed = await watchlistStorage.removeProductFromWatchList(1, 456, 123);
   */
  async removeProductFromWatchList(
    watchListId: number,
    productId: number,
    userId: number
  ): Promise<ProductWatch> {
    return this.handleError('removeProductFromWatchList', async () => {
      // Validation
      if (!watchListId || watchListId <= 0) {
        throw new Error('Watch list ID must be a positive number');
      }
      if (!productId || productId <= 0) {
        throw new Error('Product ID must be a positive number');
      }
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

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

      // Emit WebSocket event for real-time updates (non-blocking)
      this.emitWebSocketEvent('removeProductFromWatchList', async () => {
        const { getSocketIO } = await import('../websocket');
        const { emitProductRemoved } = await import('../websocket/handlers/watch-list-handler');
        const io = getSocketIO();
        if (io) {
          emitProductRemoved(io, userId, watchListId, productId);
        }
      });

      return result;
    });
  }

  /**
   * Get all watched products across all user's lists with mini-chart data
   *
   * Performance characteristics:
   * - Complex single query with subqueries for aggregations
   * - Sparkline data (7 days) via json_agg with DISTINCT ON
   * - Price calculations (current, lowest, average) via subqueries
   * - Alert status checks via EXISTS subqueries
   * - Post-processing for derived values and sorting
   *
   * Sorting Options:
   * - priceDropPercent: Descending (biggest drops first)
   * - savings: Descending (highest savings first)
   * - dateAdded: Descending (most recent first)
   *
   * @param userId - User ID
   * @param options - Optional filters (sortBy, limit)
   * @returns Array of watched products with enriched data
   *
   * @example
   * const products = await watchlistStorage.getWatchedProducts(123, {
   *   sortBy: 'priceDropPercent',
   *   limit: 20
   * });
   * // Returns products sorted by biggest price drops
   */
  async getWatchedProducts(
    userId: number,
    options?: WatchedProductsOptions
  ): Promise<WatchedProductInfo[]> {
    return this.handleError('getWatchedProducts', async () => {
      // Validation
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

      const sortBy = options?.sortBy || 'priceDropPercent';
      const limit = Math.min(
        options?.limit || WATCHLIST_CONSTANTS.LIMITS.DEFAULT_RESULTS_LIMIT,
        WATCHLIST_CONSTANTS.LIMITS.MAX_RESULTS_LIMIT
      );

      // Get 7 days ago for sparkline data
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - WATCHLIST_CONSTANTS.HISTORY.SPARKLINE_DAYS);

      // Build complex query with price aggregations
      const results = await this.db
        .select({
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
                AND ${priceHistory.recordedAt} >= NOW() - INTERVAL '${WATCHLIST_CONSTANTS.HISTORY.LOWEST_PRICE_DAYS} days'
            )
          `.as('lowest_price'),
          // Average price in last 30 days
          averagePrice: sql<number | null>`
            (
              SELECT AVG(CAST(price AS DECIMAL))
              FROM ${priceHistory}
              WHERE ${priceHistory.productId} = ${products.id}
                AND ${priceHistory.recordedAt} >= NOW() - INTERVAL '${WATCHLIST_CONSTANTS.HISTORY.AVERAGE_PRICE_DAYS} days'
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
                AND ${priceAlerts.lastTriggeredAt} >= NOW() - INTERVAL '${WATCHLIST_CONSTANTS.HISTORY.WEEKLY_STATS_DAYS} days'
            )
          `.as('has_triggered_alert'),
        })
        .from(productWatches)
        .innerJoin(products, eq(productWatches.productId, products.id))
        .innerJoin(watchLists, eq(productWatches.watchListId, watchLists.id))
        .where(eq(productWatches.userId, userId))
        .limit(limit);

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
        const last7Days = (r.last7Days as unknown as Array<{ date: string; price: number }>) || [];

        return {
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

      return enrichedResults;
    });
  }

  /**
   * Get aggregated statistics for user's watch lists
   *
   * Performance characteristics:
   * - Uses CTEs (Common Table Expressions) for query organization
   * - Multiple aggregations in single query
   * - Database-level calculations for efficiency
   *
   * Includes:
   * - Total watch lists and products
   * - Total potential savings (current vs lowest price)
   * - Active and triggered alert counts
   * - Top 5 best deals (by discount percent)
   * - Weekly stats (new deals, triggered alerts)
   *
   * @param userId - User ID
   * @returns Aggregated dashboard statistics
   *
   * @example
   * const stats = await watchlistStorage.getWatchListStats(123);
   * console.log(`Potential savings: $${stats.totalPotentialSavings}`);
   * console.log(`Best deal: ${stats.bestDeals[0].productName} (${stats.bestDeals[0].discountPercent}% off)`);
   */
  async getWatchListStats(userId: number): Promise<WatchListStats> {
    return this.handleError('getWatchListStats', async () => {
      // Validation
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

      // Get one week ago for weekly stats
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - WATCHLIST_CONSTANTS.HISTORY.WEEKLY_STATS_DAYS);

      // Complex query with multiple aggregations
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
                AND recorded_at >= NOW() - INTERVAL '${WATCHLIST_CONSTANTS.HISTORY.LOWEST_PRICE_DAYS} days'
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
                AND ph2.recorded_at >= NOW() - INTERVAL '${WATCHLIST_CONSTANTS.HISTORY.AVERAGE_PRICE_DAYS} days'
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
    });
  }

  /**
   * Helper method to emit WebSocket events without failing the operation
   * @private
   */
  private emitWebSocketEvent(operation: string, emitFn: () => Promise<void>): void {
    emitFn().catch(error => {
      // Don't fail the operation if WebSocket emit fails
      logger.error(`[WatchlistStorage] Failed to emit WebSocket event for ${operation}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

/**
 * Singleton instance of WatchlistStorage
 *
 * Use this instance throughout the application:
 * ```typescript
 * import { watchlistStorage } from './storage/watchlist-storage';
 *
 * const lists = await watchlistStorage.getUserWatchLists(userId);
 * ```
 */
export const watchlistStorage = new WatchlistStorage(db);
