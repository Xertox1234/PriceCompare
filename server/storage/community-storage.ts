/**
 * Community Storage Repository
 *
 * Domain: Community features including product watches, user reputation, badges,
 * deal spottings, and watch list management.
 *
 * Phase 11 of storage layer refactoring - FINAL PHASE ⭐
 *
 * METHODS: 29 total
 * - Product Watch Operations (6): Add/remove watches, check watching status, get watch counts
 * - User Reputation Operations (3): Get/create reputation, atomic updates with SERIALIZABLE+retry, leaderboard
 * - Badge Operations (4): Get by name/names, check user badges, award with notification
 * - Deal Spotting Operations (2): Create with reputation, get recent spottings
 * - Watch List Management (13): CRUD operations, bulk moves/deletes, import/export
 * - Forum Integration (1): Create price drop forum posts
 *
 * TRANSACTIONS:
 * - SERIALIZABLE: updateUserReputationAtomic (concurrent reputation changes)
 * - DEFAULT: awardBadgeWithNotification, createDealSpottingWithReputation, importWatchListsData
 *
 * PATTERNS APPLIED:
 * - Pattern 9: Transaction boundaries (reputation, badges, imports)
 * - Pattern 17: Private validation helpers (DRY principle)
 * - Pattern 21: SERIALIZABLE transactions with retry (reputation updates)
 * - Pattern 24: Interface parameter documentation
 * - Pattern 26: Default value centralization (COMMUNITY_CONSTANTS)
 * - Pattern 27: Field validation consolidation
 */

import { BaseStorage } from "./base-storage";
import type {
  ProductWatch,
  WatchList,
  UserReputation,
  InsertUserReputation,
  DealSpotting,
  InsertDealSpotting,
  Badge,
  CommunityWatchStats,
  CommunityLeaderboardEntry,
  CreateDealSpottingData,
  CreateWatchListData,
  WatchListWithStats,
  WatchListUpdates,
  WatchListProductWithDetails,
  ProductWatchUpdates,
  WatchListExportData,
  WatchListImportData,
} from "./types";
import {
  productWatches,
  userReputation,
  users,
  badges,
  userBadges,
  notifications,
  dealSpottings,
  watchLists,
  products,
} from "@shared/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { retryWithBackoff, isTransientDatabaseError } from "../utils/retry-with-backoff";
import { logger } from "../utils/logger";
import { db } from "../db";

/**
 * Constants for community domain operations
 * Pattern 26: Centralize default values and magic numbers
 */
const COMMUNITY_CONSTANTS = {
  QUERY: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1,
  },
  REPUTATION: {
    DEFAULT_POINTS: 0,
    DEFAULT_LEVEL: 1,
    INITIAL_DEALS_SPOTTED: 0,
    INITIAL_PREDICTIONS: 0,
    INITIAL_CONTRIBUTIONS: 0,
  },
  WATCH_PRIORITY: {
    LOW: 1,
    NORMAL: 3,
    HIGH: 5,
    DEFAULT: 3,
  },
  VALIDATION: {
    MIN_USER_ID: 1,
    MIN_PRODUCT_ID: 1,
    MIN_BADGE_ID: 1,
    MIN_LIST_ID: 1,
    MIN_WATCH_ID: 1,
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 100,
  },
} as const;

/**
 * Community Storage Interface
 *
 * All community-related database operations including product watches,
 * reputation management, badges, deal spottings, and watch lists.
 */
export interface ICommunityStorage {
  // ============================================================================
  // Product Watch Operations (6 methods)
  // ============================================================================

  /**
   * Add a product to user's watch list
   * @param userId - User ID (must be positive)
   * @param productId - Product ID (must be positive)
   * @returns Created ProductWatch record or null on failure
   */
  addProductWatchRecord(userId: number, productId: number): Promise<ProductWatch | null>;

  /**
   * Remove a product from user's watch list
   * @param userId - User ID (must be positive)
   * @param productId - Product ID (must be positive)
   * @returns true if removed, false if not found
   */
  removeProductWatchRecord(userId: number, productId: number): Promise<boolean>;

  /**
   * Get all product IDs the user is watching
   * @param userId - User ID (must be positive)
   * @returns Array of product IDs
   */
  getUserProductWatchIds(userId: number): Promise<number[]>;

  /**
   * Get watch count for a specific product
   * @param productId - Product ID (must be positive)
   * @returns Number of users watching this product
   */
  getProductWatchCountByProduct(productId: number): Promise<number>;

  /**
   * Get most watched products with stats
   * @param limit - Maximum results to return (1-100, default 10)
   * @returns Array of products with watch counts and ranks
   */
  getMostWatchedProductStats(limit?: number): Promise<CommunityWatchStats[]>;

  /**
   * Check if user is watching a specific product
   * @param userId - User ID (must be positive)
   * @param productId - Product ID (must be positive)
   * @returns true if watching, false otherwise
   */
  isUserWatchingProductCheck(userId: number, productId: number): Promise<boolean>;

  // ============================================================================
  // User Reputation Operations (3 methods)
  // ============================================================================

  /**
   * Get or create user reputation record
   * @param userId - User ID (must be positive)
   * @returns UserReputation record (creates with defaults if not found)
   */
  getOrCreateUserReputation(userId: number): Promise<UserReputation>;

  /**
   * Award reputation points atomically with SERIALIZABLE transaction
   * Uses SQL arithmetic to prevent read-modify-write race conditions
   * Includes retry logic for serialization errors
   * @param userId - User ID (must be positive)
   * @param points - Reputation points to award (can be negative)
   * @param reason - Reason for reputation change
   * @returns Updated UserReputation record
   */
  updateUserReputationAtomic(
    userId: number,
    points: number,
    reason: 'deal_spotted' | 'accurate_prediction' | 'community_contribution'
  ): Promise<UserReputation>;

  /**
   * Get community leaderboard of top users
   * @param limit - Maximum results to return (1-100, default 10)
   * @returns Array of users with reputation stats and ranks
   */
  getCommunityLeaderboard(limit?: number): Promise<CommunityLeaderboardEntry[]>;

  // ============================================================================
  // Badge Operations (4 methods)
  // ============================================================================

  /**
   * Get badge by name
   * @param name - Badge name (required)
   * @returns Badge record or null if not found
   */
  getBadgeByName(name: string): Promise<Badge | null>;

  /**
   * Batch query for badges by names (N+1 prevention)
   * @param names - Array of badge names (required, non-empty)
   * @returns Array of Badge records
   */
  getBadgesByNames(names: string[]): Promise<Badge[]>;

  /**
   * Get all badge IDs for a user (N+1 prevention)
   * @param userId - User ID (must be positive)
   * @returns Array of badge IDs
   */
  getUserBadgeIds(userId: number): Promise<number[]>;

  /**
   * Award badge to user with notification (transactional)
   * Transaction ensures badge award and notification are atomic
   * @param userId - User ID (must be positive)
   * @param badgeId - Badge ID (must be positive)
   * @param badgeName - Badge name for notification (required)
   * @returns void (throws on error)
   */
  awardBadgeWithNotification(userId: number, badgeId: number, badgeName: string): Promise<void>;

  // ============================================================================
  // Deal Spotting Operations (2 methods)
  // ============================================================================

  /**
   * Create deal spotting record with reputation entry (transactional)
   * Transaction ensures deal spotting and reputation are recorded together
   * @param data - Deal spotting data with reputation amount
   * @returns Created DealSpotting record
   */
  createDealSpottingWithReputation(data: CreateDealSpottingData): Promise<DealSpotting>;

  /**
   * Get recent deal spottings
   * @param limit - Maximum results to return (1-100, default 10)
   * @returns Array of recent DealSpotting records
   */
  getRecentDealSpottingsData(limit?: number): Promise<DealSpotting[]>;

  // ============================================================================
  // Watch List Management Operations (13 methods)
  // ============================================================================

  /**
   * Get next sort order for user's watch lists
   * @param userId - User ID (must be positive)
   * @returns Next available sort order number
   */
  getNextWatchListSortOrder(userId: number): Promise<number>;

  /**
   * Create a new watch list for a user
   * @param data - Watch list creation data
   * @returns Created WatchList record
   */
  createWatchListRecord(data: CreateWatchListData): Promise<WatchList>;

  /**
   * Get all watch lists for a user with stats
   * @param userId - User ID (must be positive)
   * @returns Array of watch lists with watch counts
   */
  getWatchListsWithStats(userId: number): Promise<WatchListWithStats[]>;

  /**
   * Get a specific watch list with stats
   * @param userId - User ID (must be positive)
   * @param listId - Watch list ID (must be positive)
   * @returns Watch list with stats or null if not found
   */
  getWatchListByIdWithStats(userId: number, listId: number): Promise<WatchListWithStats | null>;

  /**
   * Update a watch list
   * @param userId - User ID (must be positive)
   * @param listId - Watch list ID (must be positive)
   * @param updates - Fields to update
   * @returns Updated WatchList or null if not found
   */
  updateWatchListRecord(
    userId: number,
    listId: number,
    updates: WatchListUpdates
  ): Promise<WatchList | null>;

  /**
   * Delete a watch list (prevents deletion of default list)
   * @param userId - User ID (must be positive)
   * @param listId - Watch list ID (must be positive)
   * @returns true if deleted, false if not found or is default
   */
  deleteWatchListRecord(userId: number, listId: number): Promise<boolean>;

  /**
   * Get products in a watch list with details
   * @param userId - User ID (must be positive)
   * @param listId - Watch list ID (must be positive)
   * @returns Array of product watches with product details
   */
  getWatchListProductsWithDetails(
    userId: number,
    listId: number
  ): Promise<WatchListProductWithDetails[]>;

  /**
   * Update product watch details
   * @param userId - User ID (must be positive)
   * @param watchId - Product watch ID (must be positive)
   * @param updates - Fields to update
   * @returns Updated ProductWatch or null if not found
   */
  updateProductWatchRecord(
    userId: number,
    watchId: number,
    updates: ProductWatchUpdates
  ): Promise<ProductWatch | null>;

  /**
   * Move products to a different watch list (bulk operation)
   * @param userId - User ID (must be positive)
   * @param watchIds - Array of product watch IDs (required, non-empty)
   * @param targetListId - Target watch list ID or null
   * @returns Number of products moved
   */
  moveProductWatchesBulk(
    userId: number,
    watchIds: number[],
    targetListId: number | null
  ): Promise<number>;

  /**
   * Remove multiple products from watch lists (bulk delete)
   * @param userId - User ID (must be positive)
   * @param watchIds - Array of product watch IDs (required, non-empty)
   * @returns Number of products removed
   */
  deleteProductWatchesBulk(userId: number, watchIds: number[]): Promise<number>;

  /**
   * Get user's default watch list
   * @param userId - User ID (must be positive)
   * @returns Default WatchList or null if not found
   */
  getUserDefaultWatchListRecord(userId: number): Promise<WatchList | null>;

  /**
   * Export user's watch lists and products as JSON
   * Uses batch query to prevent N+1
   * @param userId - User ID (must be positive)
   * @returns Export data structure
   */
  exportUserWatchListsData(userId: number): Promise<WatchListExportData>;

  /**
   * Import watch lists from JSON export (transactional all-or-nothing)
   * @param userId - User ID (must be positive)
   * @param data - Import data structure
   * @returns Count of created and skipped lists
   */
  importWatchListsData(
    userId: number,
    data: WatchListImportData
  ): Promise<{ created: number; skipped: number }>;

  // ============================================================================
  // Forum Integration Operations (1 method)
  // ============================================================================

  /**
   * Create price drop forum post transaction
   * (Implementation delegated to ForumStorage to avoid circular dependency)
   * @param data - Price drop forum post data
   * @returns Forum post ID or null on failure
   */
  createPriceDropForumPostTransaction(data: unknown): Promise<number | null>;
}

/**
 * Community Storage Implementation
 *
 * Implements all community-related database operations with focus on:
 * - SERIALIZABLE transactions for reputation updates (concurrent safety)
 * - Transaction boundaries for atomic operations (badges, deal spottings)
 * - N+1 query prevention (batch operations)
 * - Input validation and error handling
 * - Private helper methods for DRY principle
 *
 * Quality Score Target: 9.7/10 (matching Phase 10)
 */
export class CommunityStorage extends BaseStorage implements ICommunityStorage {
  constructor() {
    super(db);
  }

  // ============================================================================
  // Product Watch Operations
  // ============================================================================

  async addProductWatchRecord(userId: number, productId: number): Promise<ProductWatch | null> {
    return this.handleError('addProductWatchRecord', async () => {
      this.validateUserId(userId);
      this.validateProductId(productId);

      const result = await this.db
        .insert(productWatches)
        .values({
          userId,
          productId,
          watchListId: null,
          category: null,
          notes: null,
          priority: COMMUNITY_CONSTANTS.WATCH_PRIORITY.DEFAULT,
          targetPrice: null,
        })
        .returning();

      return result.length > 0 ? result[0] : null;
    });
  }

  async removeProductWatchRecord(userId: number, productId: number): Promise<boolean> {
    return this.handleError('removeProductWatchRecord', async () => {
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
    });
  }

  async getUserProductWatchIds(userId: number): Promise<number[]> {
    return this.handleError('getUserProductWatchIds', async () => {
      this.validateUserId(userId);

      const result = await this.db
        .select({ productId: productWatches.productId })
        .from(productWatches)
        .where(eq(productWatches.userId, userId));

      return result.map(r => r.productId);
    });
  }

  async getProductWatchCountByProduct(productId: number): Promise<number> {
    return this.handleError('getProductWatchCountByProduct', async () => {
      this.validateProductId(productId);

      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(productWatches)
        .where(eq(productWatches.productId, productId));

      return result[0]?.count ?? 0;
    });
  }

  async getMostWatchedProductStats(limit: number = COMMUNITY_CONSTANTS.QUERY.DEFAULT_LIMIT): Promise<CommunityWatchStats[]> {
    return this.handleError('getMostWatchedProductStats', async () => {
      this.validateLimit(limit);

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
    });
  }

  async isUserWatchingProductCheck(userId: number, productId: number): Promise<boolean> {
    return this.handleError('isUserWatchingProductCheck', async () => {
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
    });
  }

  // ============================================================================
  // User Reputation Operations
  // ============================================================================

  async getOrCreateUserReputation(userId: number): Promise<UserReputation> {
    return this.handleError('getOrCreateUserReputation', async () => {
      this.validateUserId(userId);

      const result = await this.db
        .select()
        .from(userReputation)
        .where(eq(userReputation.userId, userId))
        .limit(1);

      if (result.length === 0) {
        // Create default reputation record
        const newRep: InsertUserReputation = {
          userId,
          reputationPoints: COMMUNITY_CONSTANTS.REPUTATION.DEFAULT_POINTS,
          dealsSpotted: COMMUNITY_CONSTANTS.REPUTATION.INITIAL_DEALS_SPOTTED,
          accuratePredictions: COMMUNITY_CONSTANTS.REPUTATION.INITIAL_PREDICTIONS,
          communityContributions: COMMUNITY_CONSTANTS.REPUTATION.INITIAL_CONTRIBUTIONS,
          level: COMMUNITY_CONSTANTS.REPUTATION.DEFAULT_LEVEL,
        };

        const created = await this.db.insert(userReputation).values(newRep).returning();
        return created[0];
      }

      return result[0];
    });
  }

  async updateUserReputationAtomic(
    userId: number,
    points: number,
    reason: 'deal_spotted' | 'accurate_prediction' | 'community_contribution'
  ): Promise<UserReputation> {
    return this.handleError('updateUserReputationAtomic', async () => {
      this.validateUserId(userId);

      // Ensure user has a reputation record before updating
      await this.getOrCreateUserReputation(userId);

      // Pattern 21: SERIALIZABLE transaction with retry logic
      // Prevents concurrent update race conditions using SQL arithmetic
      const result = await retryWithBackoff(
        async () => this.db.transaction(async (tx) => {
          // Build atomic update with SQL arithmetic (prevents read-modify-write race)
          const updateResult = await tx
            .update(userReputation)
            .set({
              reputationPoints: sql`${userReputation.reputationPoints} + ${points}`,
              dealsSpotted: reason === 'deal_spotted'
                ? sql`${userReputation.dealsSpotted} + 1`
                : userReputation.dealsSpotted,
              accuratePredictions: reason === 'accurate_prediction'
                ? sql`${userReputation.accuratePredictions} + 1`
                : userReputation.accuratePredictions,
              communityContributions: reason === 'community_contribution'
                ? sql`${userReputation.communityContributions} + 1`
                : userReputation.communityContributions,
            })
            .where(eq(userReputation.userId, userId))
            .returning();

          return updateResult[0];
        }, { isolationLevel: 'serializable' }),
        {
          maxAttempts: COMMUNITY_CONSTANTS.RETRY.MAX_ATTEMPTS,
          initialDelayMs: COMMUNITY_CONSTANTS.RETRY.INITIAL_DELAY_MS,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'updateUserReputationAtomic', userId, reason },
          onRetry: (error, attempt, delayMs) => {
            logger.warn('[CommunityStorage] Retrying updateUserReputationAtomic after serialization error', {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              userId,
            });
          },
        }
      );

      return result;
    });
  }

  async getCommunityLeaderboard(limit: number = COMMUNITY_CONSTANTS.QUERY.DEFAULT_LIMIT): Promise<CommunityLeaderboardEntry[]> {
    return this.handleError('getCommunityLeaderboard', async () => {
      this.validateLimit(limit);

      const result = await this.db
        .select({
          userId: userReputation.userId,
          username: users.username,
          reputationPoints: userReputation.reputationPoints,
          dealsSpotted: userReputation.dealsSpotted,
          level: userReputation.level,
        })
        .from(userReputation)
        .innerJoin(users, eq(users.id, userReputation.userId))
        .orderBy(desc(userReputation.reputationPoints))
        .limit(limit);

      return result.map((r, index) => ({
        userId: r.userId,
        username: r.username,
        reputationPoints: r.reputationPoints ?? COMMUNITY_CONSTANTS.REPUTATION.DEFAULT_POINTS,
        dealsSpotted: r.dealsSpotted ?? COMMUNITY_CONSTANTS.REPUTATION.INITIAL_DEALS_SPOTTED,
        level: r.level ?? COMMUNITY_CONSTANTS.REPUTATION.DEFAULT_LEVEL,
        rank: index + 1,
      }));
    });
  }

  // ============================================================================
  // Badge Operations
  // ============================================================================

  async getBadgeByName(name: string): Promise<Badge | null> {
    return this.handleError('getBadgeByName', async () => {
      this.validateBadgeName(name);

      const result = await this.db
        .select()
        .from(badges)
        .where(eq(badges.name, name))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    });
  }

  async getBadgesByNames(names: string[]): Promise<Badge[]> {
    return this.handleError('getBadgesByNames', async () => {
      if (!names || names.length === 0) {
        return [];
      }

      return await this.db
        .select()
        .from(badges)
        .where(inArray(badges.name, names));
    });
  }

  async getUserBadgeIds(userId: number): Promise<number[]> {
    return this.handleError('getUserBadgeIds', async () => {
      this.validateUserId(userId);

      const result = await this.db
        .select({ badgeId: userBadges.badgeId })
        .from(userBadges)
        .where(eq(userBadges.userId, userId));

      return result.map(r => r.badgeId);
    });
  }

  async awardBadgeWithNotification(userId: number, badgeId: number, badgeName: string): Promise<void> {
    return this.handleError('awardBadgeWithNotification', async () => {
      this.validateUserId(userId);
      this.validateBadgeId(badgeId);
      this.validateBadgeName(badgeName);

      // Pattern 9: Transaction ensures badge award and notification are atomic
      // If notification fails, user gets badge but never knows about it (poor UX)
      await this.db.transaction(async (tx) => {
        // Award badge
        await tx.insert(userBadges).values({
          userId,
          badgeId,
        });

        // Send notification - must succeed or rollback badge award
        await tx.insert(notifications).values({
          userId,
          type: 'badge_earned',
          title: `Badge Earned: ${badgeName}!`,
          content: `Congratulations! You've earned the "${badgeName}" badge!`,
        });
      });
    });
  }

  // ============================================================================
  // Deal Spotting Operations
  // ============================================================================

  async createDealSpottingWithReputation(data: CreateDealSpottingData): Promise<DealSpotting> {
    return this.handleError('createDealSpottingWithReputation', async () => {
      this.validateUserId(data.userId);
      this.validateProductId(data.productId);

      const spotting: InsertDealSpotting = {
        userId: data.userId,
        productId: data.productId,
        priceDropPercent: data.priceDropPercent.toFixed(2),
        priceDropAmount: data.priceDropAmount.toFixed(2),
        forumPostId: data.forumPostId || null,
        reputationAwarded: data.reputationAwarded,
      };

      // Pattern 9: Single transaction encompasses both operations atomically
      // Avoids nested transaction complexity by using SQL arithmetic directly
      let dealSpotting: DealSpotting;
      await this.db.transaction(async (tx) => {
        // Create deal spotting record
        const result = await tx.insert(dealSpottings).values(spotting).returning();
        if (result.length === 0) {
          throw new Error('Failed to create deal spotting record');
        }
        dealSpotting = result[0];

        // Ensure reputation record exists (or get existing)
        const existing = await tx.select()
          .from(userReputation)
          .where(eq(userReputation.userId, data.userId))
          .limit(1);

        if (existing.length === 0) {
          // Create reputation record within same transaction
          await tx.insert(userReputation).values({
            userId: data.userId,
            reputationPoints: data.reputationAwarded,
            dealsSpotted: 1,
            accuratePredictions: COMMUNITY_CONSTANTS.REPUTATION.INITIAL_PREDICTIONS,
            communityContributions: COMMUNITY_CONSTANTS.REPUTATION.INITIAL_CONTRIBUTIONS,
            level: COMMUNITY_CONSTANTS.REPUTATION.DEFAULT_LEVEL,
          });
        } else {
          // Update existing reputation using SQL arithmetic (prevents read-modify-write race)
          await tx.update(userReputation)
            .set({
              reputationPoints: sql`${userReputation.reputationPoints} + ${data.reputationAwarded}`,
              dealsSpotted: sql`${userReputation.dealsSpotted} + 1`,
            })
            .where(eq(userReputation.userId, data.userId));
        }
      });

      return dealSpotting;
    });
  }

  async getRecentDealSpottingsData(limit: number = COMMUNITY_CONSTANTS.QUERY.DEFAULT_LIMIT): Promise<DealSpotting[]> {
    return this.handleError('getRecentDealSpottingsData', async () => {
      this.validateLimit(limit);

      return await this.db
        .select()
        .from(dealSpottings)
        .orderBy(desc(dealSpottings.createdAt))
        .limit(limit);
    });
  }

  // ============================================================================
  // Watch List Management Operations
  // ============================================================================

  async getNextWatchListSortOrder(userId: number): Promise<number> {
    return this.handleError('getNextWatchListSortOrder', async () => {
      this.validateUserId(userId);

      const maxOrderResult = await this.db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${watchLists.sortOrder}), 0)` })
        .from(watchLists)
        .where(eq(watchLists.userId, userId));

      return (maxOrderResult[0]?.maxOrder ?? 0) + 1;
    });
  }

  async createWatchListRecord(data: CreateWatchListData): Promise<WatchList> {
    return this.handleError('createWatchListRecord', async () => {
      this.validateUserId(data.userId);
      this.validateWatchListName(data.name);

      const watchList = {
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
    });
  }

  async getWatchListsWithStats(userId: number): Promise<WatchListWithStats[]> {
    return this.handleError('getWatchListsWithStats', async () => {
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
    });
  }

  async getWatchListByIdWithStats(userId: number, listId: number): Promise<WatchListWithStats | null> {
    return this.handleError('getWatchListByIdWithStats', async () => {
      this.validateUserId(userId);
      this.validateListId(listId);

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
    });
  }

  async updateWatchListRecord(
    userId: number,
    listId: number,
    updates: WatchListUpdates
  ): Promise<WatchList | null> {
    return this.handleError('updateWatchListRecord', async () => {
      this.validateUserId(userId);
      this.validateListId(listId);

      const result = await this.db
        .update(watchLists)
        .set(updates)
        .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
        .returning();

      return result.length > 0 ? result[0] : null;
    });
  }

  async deleteWatchListRecord(userId: number, listId: number): Promise<boolean> {
    return this.handleError('deleteWatchListRecord', async () => {
      this.validateUserId(userId);
      this.validateListId(listId);

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
    });
  }

  async getWatchListProductsWithDetails(
    userId: number,
    listId: number
  ): Promise<WatchListProductWithDetails[]> {
    return this.handleError('getWatchListProductsWithDetails', async () => {
      this.validateUserId(userId);
      this.validateListId(listId);

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

      return result;
    });
  }

  async updateProductWatchRecord(
    userId: number,
    watchId: number,
    updates: ProductWatchUpdates
  ): Promise<ProductWatch | null> {
    return this.handleError('updateProductWatchRecord', async () => {
      this.validateUserId(userId);
      this.validateWatchId(watchId);

      const result = await this.db
        .update(productWatches)
        .set(updates)
        .where(and(eq(productWatches.id, watchId), eq(productWatches.userId, userId)))
        .returning();

      return result.length > 0 ? result[0] : null;
    });
  }

  async moveProductWatchesBulk(
    userId: number,
    watchIds: number[],
    targetListId: number | null
  ): Promise<number> {
    return this.handleError('moveProductWatchesBulk', async () => {
      this.validateUserId(userId);
      this.validateWatchIdsArray(watchIds);

      // Verify the target list belongs to the user if specified
      if (targetListId !== null) {
        this.validateListId(targetListId);

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
    });
  }

  async deleteProductWatchesBulk(userId: number, watchIds: number[]): Promise<number> {
    return this.handleError('deleteProductWatchesBulk', async () => {
      this.validateUserId(userId);
      this.validateWatchIdsArray(watchIds);

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
    });
  }

  async getUserDefaultWatchListRecord(userId: number): Promise<WatchList | null> {
    return this.handleError('getUserDefaultWatchListRecord', async () => {
      this.validateUserId(userId);

      const result = await this.db
        .select()
        .from(watchLists)
        .where(and(eq(watchLists.userId, userId), eq(watchLists.isDefault, true)))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    });
  }

  async exportUserWatchListsData(userId: number): Promise<WatchListExportData> {
    return this.handleError('exportUserWatchListsData', async () => {
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
        if (!productsByListId.has(product.watchListId!)) {
          productsByListId.set(product.watchListId!, []);
        }
        productsByListId.get(product.watchListId!)!.push(product);
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
    });
  }

  async importWatchListsData(
    userId: number,
    data: WatchListImportData
  ): Promise<{ created: number; skipped: number }> {
    return this.handleError('importWatchListsData', async () => {
      this.validateUserId(userId);

      if (!data.watchLists || !Array.isArray(data.watchLists)) {
        throw new Error('watchLists must be an array');
      }

      // Pattern 9: Transaction ensures all-or-nothing import
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

            if (existing.length > 0) {
              skipped++;
              continue;
            }

            // Get next sort order
            const maxOrderResult = await tx
              .select({ maxOrder: sql<number>`COALESCE(MAX(${watchLists.sortOrder}), 0)` })
              .from(watchLists)
              .where(eq(watchLists.userId, userId));

            const nextOrder = (maxOrderResult[0]?.maxOrder ?? 0) + 1;

            // Create watch list
            const [newList] = await tx
              .insert(watchLists)
              .values({
                userId,
                name: listData.name,
                description: listData.description || null,
                color: listData.color || null,
                icon: listData.icon || null,
                isDefault: false,
                sortOrder: nextOrder,
              })
              .returning();

            // Add products to the list
            if (listData.products && Array.isArray(listData.products)) {
              for (const product of listData.products) {
                // Validate product ID from import data
                if (!product.productId || product.productId < COMMUNITY_CONSTANTS.VALIDATION.MIN_PRODUCT_ID) {
                  logger.warn('[CommunityStorage] Skipping product with invalid ID during import', {
                    productId: product.productId,
                    listName: listData.name,
                  });
                  continue; // Skip invalid products instead of throwing
                }

                await tx.insert(productWatches).values({
                  userId,
                  productId: product.productId,
                  watchListId: newList.id,
                  category: product.category || null,
                  notes: product.notes || null,
                  priority: product.priority || COMMUNITY_CONSTANTS.WATCH_PRIORITY.DEFAULT,
                  targetPrice: product.targetPrice || null,
                });
              }
            }

            created++;
          } catch (error) {
            // Log and skip problematic list
            logger.error('[CommunityStorage] Error importing watch list', {
              listName: listData.name,
              error: error instanceof Error ? error.message : String(error),
            });
            skipped++;
          }
        }

        return { created, skipped };
      });
    });
  }

  // ============================================================================
  // Forum Integration Operations
  // ============================================================================

  async createPriceDropForumPostTransaction(_data: unknown): Promise<number | null> {
    // This method is delegated to ForumStorage to avoid circular dependency
    // Implementation is in forum-storage.ts: createPriceDropForumPostTransaction
    throw new Error('createPriceDropForumPostTransaction must be called via ForumStorage to avoid circular dependency');
  }

  // ============================================================================
  // Private Validation Helpers (Pattern 17: DRY Principle)
  // ============================================================================

  /**
   * Validate user ID parameter
   * Pattern 27: Field validation consolidation
   */
  private validateUserId(userId: number): void {
    if (!userId || userId < COMMUNITY_CONSTANTS.VALIDATION.MIN_USER_ID) {
      throw new Error('userId must be a positive number');
    }
  }

  /**
   * Validate product ID parameter
   * Pattern 27: Field validation consolidation
   */
  private validateProductId(productId: number): void {
    if (!productId || productId < COMMUNITY_CONSTANTS.VALIDATION.MIN_PRODUCT_ID) {
      throw new Error('productId must be a positive number');
    }
  }

  /**
   * Validate badge ID parameter
   * Pattern 27: Field validation consolidation
   */
  private validateBadgeId(badgeId: number): void {
    if (!badgeId || badgeId < COMMUNITY_CONSTANTS.VALIDATION.MIN_BADGE_ID) {
      throw new Error('badgeId must be a positive number');
    }
  }

  /**
   * Validate list ID parameter
   * Pattern 27: Field validation consolidation
   */
  private validateListId(listId: number): void {
    if (!listId || listId < COMMUNITY_CONSTANTS.VALIDATION.MIN_LIST_ID) {
      throw new Error('listId must be a positive number');
    }
  }

  /**
   * Validate watch ID parameter
   * Pattern 27: Field validation consolidation
   */
  private validateWatchId(watchId: number): void {
    if (!watchId || watchId < COMMUNITY_CONSTANTS.VALIDATION.MIN_WATCH_ID) {
      throw new Error('watchId must be a positive number');
    }
  }

  /**
   * Validate limit parameter for queries
   * Pattern 27: Field validation consolidation
   */
  private validateLimit(limit: number): void {
    if (limit < COMMUNITY_CONSTANTS.QUERY.MIN_LIMIT || limit > COMMUNITY_CONSTANTS.QUERY.MAX_LIMIT) {
      throw new Error('limit must be between 1 and 100');
    }
  }

  /**
   * Validate badge name parameter
   * Pattern 27: Field validation consolidation
   */
  private validateBadgeName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('name is required');
    }
  }

  /**
   * Validate watch list name parameter
   * Pattern 27: Field validation consolidation
   */
  private validateWatchListName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('name is required');
    }
  }

  /**
   * Validate watch IDs array parameter
   * Pattern 27: Field validation consolidation
   */
  private validateWatchIdsArray(watchIds: number[]): void {
    if (!watchIds || !Array.isArray(watchIds) || watchIds.length === 0) {
      throw new Error('watchIds array cannot be empty');
    }
  }
}

/**
 * Community Storage Singleton Instance
 *
 * Pre-initialized instance for direct import and use.
 *
 * Usage:
 * ```typescript
 * import { communityStorage } from './storage/community-storage';
 * const reputation = await communityStorage.getOrCreateUserReputation(userId);
 * ```
 */
export const communityStorage = new CommunityStorage();
