import { db } from "../db";
import { storage } from "../storage";
import { getFirstResult } from "../utils/db-helpers";
import {
  productWatches,
  watchLists,
  userReputation,
  dealSpottings,
  products,
  productOffers,
  forumTopics,
  forumPosts,
  notifications,
  badges,
  userBadges,
  type ProductWatch,
  type WatchList,
  type UserReputation,
  type DealSpotting,
  type InsertProductWatch,
  type InsertWatchList,
  type InsertUserReputation,
  type InsertDealSpotting,
  type InsertForumTopic,
  type InsertForumPost,
  type InsertNotification,
} from "@shared/schema";
import { eq, and, desc, count, sql, gte } from "drizzle-orm";
import { createLogger } from "../utils/logger";
import { retryWithBackoff, isTransientDatabaseError } from "../utils/retry-with-backoff";

const log = createLogger('Community');

/**
 * Community Service
 *
 * Handles product watches, user reputation, deal spotting,
 * and community features.
 */

export interface WatchStats {
  productId: number;
  watchCount: number;
  rank: number;
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  reputationPoints: number;
  dealsSpotted: number;
  level: number;
  rank: number;
}

export interface DealPost {
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number;
  dropPercent: number;
  dropAmount: number;
  retailer: string;
}

/**
 * Add a product to user's watch list
 */
export async function addProductWatch(
  userId: number,
  productId: number
): Promise<ProductWatch> {
  const created = await storage.addProductWatchRecord(userId, productId);
  if (!created) {
    throw new Error('Failed to create product watch');
  }
  return created;
}

/**
 * Remove a product from user's watch list
 */
export async function removeProductWatch(
  userId: number,
  productId: number
): Promise<boolean> {
  return await storage.removeProductWatchRecord(userId, productId);
}

/**
 * Get user's watched products
 */
export async function getUserWatchedProducts(userId: number): Promise<number[]> {
  return await storage.getUserProductWatchIds(userId);
}

/**
 * Get watch count for a product
 */
export async function getProductWatchCount(productId: number): Promise<number> {
  return await storage.getProductWatchCountByProduct(productId);
}

/**
 * Get most watched products
 */
export async function getMostWatchedProducts(limit: number = 10): Promise<WatchStats[]> {
  return await storage.getMostWatchedProductStats(limit);
}

/**
 * Check if user is watching a product
 */
export async function isUserWatchingProduct(
  userId: number,
  productId: number
): Promise<boolean> {
  return await storage.isUserWatchingProductCheck(userId, productId);
}

/**
 * Get user's reputation
 */
export async function getUserReputation(userId: number): Promise<UserReputation> {
  return await storage.getOrCreateUserReputation(userId);
}

/**
 * Award reputation points to a user
 *
 * Uses atomic SQL operations within a SERIALIZABLE transaction to prevent
 * race conditions where concurrent awards could cause lost updates.
 * (e.g., two +10 awards on 100 points both writing 110 instead of 120)
 */
export async function awardReputation(
  userId: number,
  points: number,
  reason: 'deal_spotted' | 'accurate_prediction' | 'community_contribution'
): Promise<UserReputation> {
  // Ensure user has a reputation record before updating
  await getUserReputation(userId);

  // DATA INTEGRITY: Use SERIALIZABLE isolation to prevent concurrent update race conditions
  // RETRY: SERIALIZABLE transactions can fail with serialization errors under concurrent load
  const result = await retryWithBackoff(
    async () => db.transaction(async (tx) => {
      // Build atomic update with SQL arithmetic to prevent read-modify-write race condition
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
      maxAttempts: 3,
      initialDelayMs: 100,
      isRetryable: isTransientDatabaseError,
      context: { operation: 'awardReputation', userId, reason },
      onRetry: (error, attempt, delayMs) => {
        log.warn('[Community] Retrying awardReputation after serialization error', {
          error: error instanceof Error ? error.message : String(error),
          attempt,
          delayMs,
          userId,
        });
      },
    }
  );

  // Check for badge achievements (outside transaction - has its own transaction)
  await checkAndAwardBadges(userId, result);

  return result;
}

/**
 * Check and award badges based on achievements
 */
async function checkAndAwardBadges(
  userId: number,
  reputation: UserReputation
): Promise<void> {
  const badgesToCheck: Array<{ name: string; condition: boolean }> = [
    {
      name: 'Deal Spotter',
      condition: (reputation.dealsSpotted ?? 0) >= 1,
    },
    {
      name: 'Deal Hunter',
      condition: (reputation.dealsSpotted ?? 0) >= 10,
    },
    {
      name: 'Deal Master',
      condition: (reputation.dealsSpotted ?? 0) >= 50,
    },
    {
      name: 'Community Contributor',
      condition: (reputation.communityContributions ?? 0) >= 10,
    },
    {
      name: 'Reputation Rookie',
      condition: (reputation.reputationPoints ?? 0) >= 100,
    },
    {
      name: 'Reputation Expert',
      condition: (reputation.reputationPoints ?? 0) >= 1000,
    },
    {
      name: 'Reputation Legend',
      condition: (reputation.reputationPoints ?? 0) >= 10000,
    },
  ];

  for (const badge of badgesToCheck) {
    if (badge.condition) {
      const badgeResult = await db
        .select()
        .from(badges)
        .where(eq(badges.name, badge.name))
        .limit(1);

      if (badgeResult.length > 0) {
        const badgeId = badgeResult[0].id;

        // Check if user already has this badge
        const hasBadge = await db
          .select()
          .from(userBadges)
          .where(
            and(
              eq(userBadges.userId, userId),
              eq(userBadges.badgeId, badgeId)
            )
          )
          .limit(1);

        if (hasBadge.length === 0) {
          // UX: Use transaction to ensure badge award and notification are atomic
          // If notification fails, user gets badge but never knows about it (poor UX)
          await db.transaction(async (tx) => {
            // Award badge
            await tx.insert(userBadges).values({
              userId,
              badgeId,
            });

            // Send notification - must succeed or rollback badge award
            await tx.insert(notifications).values({
              userId,
              type: 'badge_earned',
              title: `Badge Earned: ${badge.name}!`,
              content: `Congratulations! You've earned the "${badge.name}" badge!`,
            });
          });
        }
      }
    }
  }
}

/**
 * Record a deal spotting event
 */
export async function recordDealSpotting(
  userId: number,
  productId: number,
  priceDropPercent: number,
  priceDropAmount: number,
  forumPostId?: number
): Promise<DealSpotting> {
  // Calculate reputation to award (more significant drops = more points)
  let reputationAwarded = 10; // Base points
  if (priceDropPercent >= 50) reputationAwarded = 100;
  else if (priceDropPercent >= 30) reputationAwarded = 50;
  else if (priceDropPercent >= 20) reputationAwarded = 25;

  const spotting: InsertDealSpotting = {
    userId,
    productId,
    priceDropPercent: priceDropPercent.toFixed(2),
    priceDropAmount: priceDropAmount.toFixed(2),
    forumPostId: forumPostId || null,
    reputationAwarded,
  };

  // DATA INTEGRITY: Use transaction to ensure deal spotting and reputation award are atomic
  // If reputation award fails, deal should not be recorded (inconsistent data)
  let dealSpotting: DealSpotting;
  await db.transaction(async (tx) => {
    const result = await tx.insert(dealSpottings).values(spotting).returning();
    dealSpotting = result[0];

    // Award reputation - must succeed or rollback deal spotting
    const reputationEntry: InsertUserReputation = {
      userId,
      reputationChange: reputationAwarded,
      reason: 'deal_spotted',
      relatedEntityType: 'deal_spotting',
      relatedEntityId: dealSpotting.id,
    };

    await tx.insert(userReputation).values(reputationEntry);
  });

  // Check and award badges after transaction (badge award itself has its own transaction)
  const currentReputation = await getUserReputation(userId);
  await checkAndAwardBadges(userId, currentReputation);

  return dealSpotting!;
}

/**
 * Get leaderboard of top users
 */
export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  return await storage.getCommunityLeaderboard(limit);
}

/**
 * Auto-post a major price drop to the forum
 */
export async function autoPostPriceDropToForum(
  dealPost: DealPost,
  userId?: number
): Promise<number | null> {
  try {
    // Only auto-post drops of 20% or more
    if (dealPost.dropPercent < 20) {
      return null;
    }

    // Check if there's already a recent topic for this product
    const recentTopic = await db
      .select()
      .from(forumTopics)
      .where(
        and(
          eq(forumTopics.productId, dealPost.productId),
          gte(forumTopics.createdAt, sql`NOW() - INTERVAL '7 days'`)
        )
      )
      .limit(1);

    let topicId: number;
    let postId: number;

    // DATA INTEGRITY: Use transaction for topic+post+notification creation
    // If any step fails, rollback all changes (prevents orphaned topics/posts)
    await db.transaction(async (tx) => {
      if (recentTopic.length > 0) {
        topicId = recentTopic[0].id;
      } else {
        // Create new topic
        const topicTitle = `🔥 ${dealPost.dropPercent.toFixed(0)}% Price Drop: ${dealPost.productName}`;
        const newTopic: InsertForumTopic = {
          categoryId: 1, // Deals category (assuming ID 1)
          title: topicTitle,
          slug: topicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          authorId: userId || 1, // System user
          productId: dealPost.productId,
          isPinned: dealPost.dropPercent >= 50, // Pin massive drops
        };

        const topicResult = await tx.insert(forumTopics).values(newTopic).returning();
        topicId = topicResult[0].id;
      }

      // Create post in the topic - must succeed or rollback topic
      const postContent = `
## Major Price Drop Alert! 🎉

**Product:** ${dealPost.productName}
**Retailer:** ${dealPost.retailer}

**Price Change:**
- Old Price: $${dealPost.oldPrice.toFixed(2)}
- New Price: $${dealPost.newPrice.toFixed(2)}
- **You Save: $${dealPost.dropAmount.toFixed(2)} (${dealPost.dropPercent.toFixed(1)}%)**

${dealPost.dropPercent >= 50 ? '🔥 **MASSIVE DEAL!** This is an exceptional price drop!' : ''}
${dealPost.dropPercent >= 30 && dealPost.dropPercent < 50 ? '💰 **Great Deal!** Significant savings on this product.' : ''}

_This deal was automatically detected by our price tracking system._
      `.trim();

      const newPost: InsertForumPost = {
        topicId,
        authorId: userId || 1, // System user
        content: postContent,
        rawContent: postContent,
        postNumber: 1,
      };

      const postResult = await tx.insert(forumPosts).values(newPost).returning();
      postId = postResult[0].id;

      // Notify all users watching this product - must succeed or rollback all
      const watchers = await tx
        .select({ userId: productWatches.userId })
        .from(productWatches)
        .where(eq(productWatches.productId, dealPost.productId));

      if (watchers.length > 0) {
        const notificationList: InsertNotification[] = watchers.map(w => ({
          userId: w.userId,
          type: 'price_drop',
          title: `${dealPost.dropPercent.toFixed(0)}% Price Drop on ${dealPost.productName}!`,
          content: `The price dropped from $${dealPost.oldPrice.toFixed(2)} to $${dealPost.newPrice.toFixed(2)}`,
          relatedPostId: postId,
        }));

        await tx.insert(notifications).values(notificationList);
      }
    });

    return postId!;
  } catch (error) {
    log.error('Error auto-posting price drop to forum:', { error });
    return null;
  }
}

/**
 * Notify all users watching a product about a price drop
 */
async function notifyWatchers(
  productId: number,
  topicId: number,
  dealPost: DealPost
): Promise<void> {
  const watchers = await db
    .select({ userId: productWatches.userId })
    .from(productWatches)
    .where(eq(productWatches.productId, productId));

  const notificationList: InsertNotification[] = watchers.map(w => ({
    userId: w.userId,
    type: 'price_drop',
    title: `${dealPost.dropPercent.toFixed(0)}% Price Drop on ${dealPost.productName}!`,
    content: `The price dropped from $${dealPost.oldPrice.toFixed(2)} to $${dealPost.newPrice.toFixed(2)}. Check the forum for details!`,
    relatedProductId: productId,
    relatedTopicId: topicId,
  }));

  if (notificationList.length > 0) {
    await db.insert(notifications).values(notificationList);
  }
}

/**
 * Get recent deal spottings
 */
export async function getRecentDealSpottings(limit: number = 10): Promise<DealSpotting[]> {
  return await db
    .select()
    .from(dealSpottings)
    .orderBy(desc(dealSpottings.createdAt))
    .limit(limit);
}

/**
 * WATCH LIST MANAGEMENT FUNCTIONS
 */

export interface WatchListWithStats extends WatchList {
  watchCount: number;
  highPriorityCount: number;
}

/**
 * Create a new watch list for a user
 */
export async function createWatchList(
  userId: number,
  name: string,
  description?: string,
  color?: string,
  icon?: string
): Promise<WatchList> {
  // Get the current max sort order for the user
  const maxOrderResult = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${watchLists.sortOrder}), 0)` })
    .from(watchLists)
    .where(eq(watchLists.userId, userId));

  const nextOrder = (maxOrderResult[0]?.maxOrder ?? 0) + 1;

  const watchList: InsertWatchList = {
    userId,
    name,
    description: description || null,
    color: color || null,
    icon: icon || null,
    isDefault: false,
    sortOrder: nextOrder,
  };

  const result = await db.insert(watchLists).values(watchList).returning();
  return getFirstResult(result);
}

/**
 * Get all watch lists for a user
 */
export async function getUserWatchLists(userId: number): Promise<WatchListWithStats[]> {
  const result = await db
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
}

/**
 * Get a specific watch list with details
 */
export async function getWatchListById(
  userId: number,
  listId: number
): Promise<WatchListWithStats | null> {
  const result = await db
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
}

/**
 * Update a watch list
 */
export async function updateWatchList(
  userId: number,
  listId: number,
  updates: {
    name?: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    sortOrder?: number;
  }
): Promise<WatchList | null> {
  const result = await db
    .update(watchLists)
    .set(updates)
    .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
    .returning();

  return result.length > 0 ? result[0] : null;
}

/**
 * Delete a watch list (products will be set to null watch_list_id)
 */
export async function deleteWatchList(
  userId: number,
  listId: number
): Promise<boolean> {
  // Prevent deletion of default list
  const list = await db
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

  const result = await db
    .delete(watchLists)
    .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
    .returning();

  return result.length > 0;
}

/**
 * Get products in a watch list with full details
 */
export async function getWatchListProducts(
  userId: number,
  listId: number
): Promise<Array<ProductWatch & { productName?: string; productImage?: string }>> {
  const result = await db
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
}

/**
 * Update product watch details (category, notes, priority, target price)
 */
export async function updateProductWatch(
  userId: number,
  watchId: number,
  updates: {
    category?: string | null;
    notes?: string | null;
    priority?: number;
    targetPrice?: string | null;
    watchListId?: number | null;
  }
): Promise<ProductWatch | null> {
  const result = await db
    .update(productWatches)
    .set(updates)
    .where(and(eq(productWatches.id, watchId), eq(productWatches.userId, userId)))
    .returning();

  return result.length > 0 ? result[0] : null;
}

/**
 * Move products to a different watch list (bulk operation)
 */
export async function moveProductsToWatchList(
  userId: number,
  productWatchIds: number[],
  targetListId: number | null
): Promise<number> {
  // Verify the target list belongs to the user if specified
  if (targetListId !== null) {
    const targetList = await db
      .select()
      .from(watchLists)
      .where(and(eq(watchLists.id, targetListId), eq(watchLists.userId, userId)))
      .limit(1);

    if (targetList.length === 0) {
      throw new Error("Target watch list not found");
    }
  }

  const result = await db
    .update(productWatches)
    .set({ watchListId: targetListId })
    .where(
      and(
        sql`${productWatches.id} = ANY(${productWatchIds})`,
        eq(productWatches.userId, userId)
      )
    )
    .returning();

  return result.length;
}

/**
 * Remove multiple products from watch lists (bulk delete)
 */
export async function bulkRemoveProductWatches(
  userId: number,
  productWatchIds: number[]
): Promise<number> {
  const result = await db
    .delete(productWatches)
    .where(
      and(
        sql`${productWatches.id} = ANY(${productWatchIds})`,
        eq(productWatches.userId, userId)
      )
    )
    .returning();

  return result.length;
}

/**
 * Get user's default watch list
 */
export async function getUserDefaultWatchList(userId: number): Promise<WatchList | null> {
  const result = await db
    .select()
    .from(watchLists)
    .where(and(eq(watchLists.userId, userId), eq(watchLists.isDefault, true)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Export user's watch lists and products as JSON
 */
export async function exportWatchLists(userId: number): Promise<Record<string, unknown>> {
  const lists = await getUserWatchLists(userId);
  const exportData = [];

  for (const list of lists) {
    const products = await getWatchListProducts(userId, list.id);
    exportData.push({
      name: list.name,
      description: list.description,
      color: list.color,
      icon: list.icon,
      products: products.map(p => ({
        productId: p.productId,
        productName: p.productName,
        category: p.category,
        notes: p.notes,
        priority: p.priority,
        targetPrice: p.targetPrice,
      })),
    });
  }

  return {
    exportDate: new Date().toISOString(),
    userId,
    watchLists: exportData,
  };
}

/**
 * Import watch lists from JSON export
 */
export async function importWatchLists(
  userId: number,
  importData: Record<string, unknown>
): Promise<{ created: number; skipped: number }> {
  // DATA INTEGRITY: Use transaction to ensure all-or-nothing import
  // If mid-import failure occurs, rollback prevents partial data corruption
  return await db.transaction(async (tx) => {
    let created = 0;
    let skipped = 0;

    for (const listData of importData.watchLists) {
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
          // Inline createWatchList logic within transaction
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
            log.error('Error importing product watch:', { error });
            // Continue with next product
          }
        }
      } catch (error) {
        log.error('Error importing watch list:', { error });
        skipped++;
      }
    }

    return { created, skipped };
  });
}
