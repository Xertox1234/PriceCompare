/**
 * User State Storage Domain
 *
 * Handles user state operations for compare list and recently viewed products.
 * These features enable AI agents to access state that was previously localStorage-only.
 *
 * TODO 272: Agent-Native APIs for localStorage-Only Features
 *
 * CONSTRAINTS:
 * - Compare list: Max 4 items (enforced at storage layer)
 * - Recently viewed: Max 50 items with FIFO eviction
 *
 * PERFORMANCE:
 * - Uses batch queries to prevent N+1 patterns
 * - Indexes on user_id for efficient lookups
 *
 * Phase 2: User State Domain - New domain for agent-native features
 */

import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import {
  userCompareItems,
  userProductViews,
  products,
  type UserCompareItem,
  type UserProductView,
  type UserCompareItemWithProduct,
  type UserProductViewWithProduct,
} from '@shared/schema';
import { BaseStorage } from '../base-storage';
import { logger } from '../../utils/logger';

// Constants for feature limits
const COMPARE_LIST_MAX_ITEMS = 4;
const RECENTLY_VIEWED_MAX_ITEMS = 50;

/**
 * UserStateStorage - Domain repository for user state operations
 *
 * Extends BaseStorage to inherit error handling and logging utilities.
 */
export class UserStateStorage extends BaseStorage {
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

  // ============================================================================
  // Compare List Operations
  // ============================================================================

  /**
   * Get user's compare list with hydrated product data
   * Uses batch query to prevent N+1
   *
   * @param userId - User ID
   * @returns Array of compare items with product data, ordered by added_at DESC
   */
  async getUserCompareItems(userId: number): Promise<UserCompareItemWithProduct[]> {
    try {
      this.validateUserId(userId);

      const items = await this.db
        .select({
          id: userCompareItems.id,
          userId: userCompareItems.userId,
          productId: userCompareItems.productId,
          addedAt: userCompareItems.addedAt,
          product: {
            id: products.id,
            name: products.name,
            description: products.description,
            category: products.category,
            image: products.image,
            brand: products.brand,
            model: products.model,
            embedding: products.embedding,
            embeddingUpdatedAt: products.embeddingUpdatedAt,
            searchVector: products.searchVector,
            createdAt: products.createdAt,
          },
        })
        .from(userCompareItems)
        .innerJoin(products, eq(userCompareItems.productId, products.id))
        .where(eq(userCompareItems.userId, userId))
        .orderBy(desc(userCompareItems.addedAt));

      return items;
    } catch (error) {
      this.handleError(error, 'getUserCompareItems');
    }
  }

  /**
   * Get count of items in user's compare list
   *
   * @param userId - User ID
   * @returns Number of items in compare list
   */
  async getCompareCount(userId: number): Promise<number> {
    try {
      this.validateUserId(userId);

      const [result] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(userCompareItems)
        .where(eq(userCompareItems.userId, userId));

      return result?.count ?? 0;
    } catch (error) {
      this.handleError(error, 'getCompareCount');
    }
  }

  /**
   * Add product to compare list
   * Enforces max 4 items limit via database trigger (migration 0033)
   *
   * NOTE: Application-level check provides fast UX feedback.
   * Database trigger (trigger_enforce_compare_list_limit) is the authoritative
   * enforcement, preventing race conditions at the lowest level.
   *
   * @param userId - User ID
   * @param productId - Product ID to add
   * @throws Error if compare list already has 4 items
   */
  async addToCompare(userId: number, productId: number): Promise<UserCompareItem> {
    try {
      this.validateUserId(userId);
      this.validateProductId(productId);

      // NOTE: Application-level check for fast UX feedback only.
      // Database trigger (migration 0033) has authoritative enforcement.
      // Race condition between check and insert is handled by the trigger.
      const count = await this.getCompareCount(userId);
      if (count >= COMPARE_LIST_MAX_ITEMS) {
        throw new Error(`Compare list is full. Maximum ${COMPARE_LIST_MAX_ITEMS} items allowed.`);
      }

      // Insert with ON CONFLICT DO NOTHING (idempotent for same product)
      const [item] = await this.db
        .insert(userCompareItems)
        .values({ userId, productId })
        .onConflictDoNothing({ target: [userCompareItems.userId, userCompareItems.productId] })
        .returning();

      // If no item returned, it already exists - fetch it
      if (!item) {
        const [existing] = await this.db
          .select()
          .from(userCompareItems)
          .where(
            and(
              eq(userCompareItems.userId, userId),
              eq(userCompareItems.productId, productId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new Error('Failed to add product to compare list');
        }
        return existing;
      }

      logger.info('Product added to compare list', { userId, productId });
      return item;
    } catch (error) {
      // Handle database trigger violation (check_violation from migration 0033)
      if (this.isCompareListLimitError(error)) {
        throw new Error(`Compare list is full. Maximum ${COMPARE_LIST_MAX_ITEMS} items allowed.`);
      }
      this.handleError(error, 'addToCompare');
    }
  }

  /**
   * Check if error is from the compare list limit trigger
   * @private
   */
  private isCompareListLimitError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const pgError = error as { code?: string; message?: string };
      // PostgreSQL check_violation error code is '23514'
      // Our trigger uses 'check_violation' ERRCODE
      return (
        pgError.code === '23514' ||
        (pgError.message?.includes('Compare list limit exceeded') ?? false)
      );
    }
    return false;
  }

  /**
   * Remove product from compare list
   *
   * @param userId - User ID
   * @param productId - Product ID to remove
   * @returns true if removed, false if not found
   */
  async removeFromCompare(userId: number, productId: number): Promise<boolean> {
    try {
      this.validateUserId(userId);
      this.validateProductId(productId);

      const result = await this.db
        .delete(userCompareItems)
        .where(
          and(
            eq(userCompareItems.userId, userId),
            eq(userCompareItems.productId, productId)
          )
        )
        .returning({ id: userCompareItems.id });

      const removed = result.length > 0;
      if (removed) {
        logger.info('Product removed from compare list', { userId, productId });
      }
      return removed;
    } catch (error) {
      this.handleError(error, 'removeFromCompare');
    }
  }

  /**
   * Clear user's compare list
   *
   * @param userId - User ID
   * @returns Number of items removed
   */
  async clearCompare(userId: number): Promise<number> {
    try {
      this.validateUserId(userId);

      const result = await this.db
        .delete(userCompareItems)
        .where(eq(userCompareItems.userId, userId))
        .returning({ id: userCompareItems.id });

      logger.info('Compare list cleared', { userId, itemsRemoved: result.length });
      return result.length;
    } catch (error) {
      this.handleError(error, 'clearCompare');
    }
  }

  /**
   * Check if product is in user's compare list
   *
   * @param userId - User ID
   * @param productId - Product ID
   * @returns true if in compare list
   */
  async isInCompare(userId: number, productId: number): Promise<boolean> {
    try {
      this.validateUserId(userId);
      this.validateProductId(productId);

      const [result] = await this.db
        .select({ id: userCompareItems.id })
        .from(userCompareItems)
        .where(
          and(
            eq(userCompareItems.userId, userId),
            eq(userCompareItems.productId, productId)
          )
        )
        .limit(1);

      return !!result;
    } catch (error) {
      this.handleError(error, 'isInCompare');
    }
  }

  // ============================================================================
  // Recently Viewed Operations
  // ============================================================================

  /**
   * Get user's recently viewed products with hydrated product data
   * Uses batch query to prevent N+1
   *
   * @param userId - User ID
   * @param limit - Maximum items to return (default 50)
   * @returns Array of view records with product data, ordered by viewed_at DESC
   */
  async getUserRecentlyViewed(
    userId: number,
    limit: number = RECENTLY_VIEWED_MAX_ITEMS
  ): Promise<UserProductViewWithProduct[]> {
    try {
      this.validateUserId(userId);

      const items = await this.db
        .select({
          id: userProductViews.id,
          userId: userProductViews.userId,
          productId: userProductViews.productId,
          viewedAt: userProductViews.viewedAt,
          product: {
            id: products.id,
            name: products.name,
            description: products.description,
            category: products.category,
            image: products.image,
            brand: products.brand,
            model: products.model,
            embedding: products.embedding,
            embeddingUpdatedAt: products.embeddingUpdatedAt,
            searchVector: products.searchVector,
            createdAt: products.createdAt,
          },
        })
        .from(userProductViews)
        .innerJoin(products, eq(userProductViews.productId, products.id))
        .where(eq(userProductViews.userId, userId))
        .orderBy(desc(userProductViews.viewedAt))
        .limit(Math.min(limit, RECENTLY_VIEWED_MAX_ITEMS));

      return items;
    } catch (error) {
      this.handleError(error, 'getUserRecentlyViewed');
    }
  }

  /**
   * Record a product view (upsert pattern - updates viewed_at if exists)
   * Enforces max 50 items with FIFO eviction
   *
   * @param userId - User ID
   * @param productId - Product ID that was viewed
   */
  async recordProductView(userId: number, productId: number): Promise<UserProductView> {
    try {
      this.validateUserId(userId);
      this.validateProductId(productId);

      // Use transaction for atomicity (count check + insert/update + eviction)
      return await this.db.transaction(async (tx) => {
        // Upsert the view record (update viewed_at if exists)
        const [view] = await tx
          .insert(userProductViews)
          .values({ userId, productId, viewedAt: new Date() })
          .onConflictDoUpdate({
            target: [userProductViews.userId, userProductViews.productId],
            set: { viewedAt: new Date() },
          })
          .returning();

        // Check count and evict oldest if over limit
        const [countResult] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(userProductViews)
          .where(eq(userProductViews.userId, userId));

        const count = countResult?.count ?? 0;

        if (count > RECENTLY_VIEWED_MAX_ITEMS) {
          // Find the oldest items to delete (FIFO eviction)
          const itemsToDelete = count - RECENTLY_VIEWED_MAX_ITEMS;

          const oldestItems = await tx
            .select({ id: userProductViews.id })
            .from(userProductViews)
            .where(eq(userProductViews.userId, userId))
            .orderBy(userProductViews.viewedAt)
            .limit(itemsToDelete);

          if (oldestItems.length > 0) {
            const idsToDelete = oldestItems.map((item) => item.id);
            await tx
              .delete(userProductViews)
              .where(inArray(userProductViews.id, idsToDelete));

            logger.debug('FIFO eviction applied to recently viewed', {
              userId,
              evictedCount: idsToDelete.length,
            });
          }
        }

        return view;
      });
    } catch (error) {
      this.handleError(error, 'recordProductView');
    }
  }

  /**
   * Remove a specific product from recently viewed
   *
   * @param userId - User ID
   * @param productId - Product ID to remove
   * @returns true if removed, false if not found
   */
  async removeFromRecentlyViewed(userId: number, productId: number): Promise<boolean> {
    try {
      this.validateUserId(userId);
      this.validateProductId(productId);

      const result = await this.db
        .delete(userProductViews)
        .where(
          and(
            eq(userProductViews.userId, userId),
            eq(userProductViews.productId, productId)
          )
        )
        .returning({ id: userProductViews.id });

      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'removeFromRecentlyViewed');
    }
  }

  /**
   * Clear user's recently viewed history
   *
   * @param userId - User ID
   * @returns Number of items removed
   */
  async clearRecentlyViewed(userId: number): Promise<number> {
    try {
      this.validateUserId(userId);

      const result = await this.db
        .delete(userProductViews)
        .where(eq(userProductViews.userId, userId))
        .returning({ id: userProductViews.id });

      logger.info('Recently viewed history cleared', { userId, itemsRemoved: result.length });
      return result.length;
    } catch (error) {
      this.handleError(error, 'clearRecentlyViewed');
    }
  }
}
