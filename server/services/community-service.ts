import { db } from "../db";
import {
  productWatches,
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
  type UserReputation,
  type DealSpotting,
  type InsertProductWatch,
  type InsertUserReputation,
  type InsertDealSpotting,
  type InsertForumTopic,
  type InsertForumPost,
  type InsertNotification,
} from "@shared/schema";
import { eq, and, desc, count, sql, gte } from "drizzle-orm";

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
  const watch: InsertProductWatch = {
    userId,
    productId,
  };

  const result = await db
    .insert(productWatches)
    .values(watch)
    .onConflictDoNothing()
    .returning();

  return result[0];
}

/**
 * Remove a product from user's watch list
 */
export async function removeProductWatch(
  userId: number,
  productId: number
): Promise<boolean> {
  const result = await db
    .delete(productWatches)
    .where(
      and(
        eq(productWatches.userId, userId),
        eq(productWatches.productId, productId)
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Get user's watched products
 */
export async function getUserWatchedProducts(userId: number): Promise<number[]> {
  const watches = await db
    .select({ productId: productWatches.productId })
    .from(productWatches)
    .where(eq(productWatches.userId, userId));

  return watches.map(w => w.productId);
}

/**
 * Get watch count for a product
 */
export async function getProductWatchCount(productId: number): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(productWatches)
    .where(eq(productWatches.productId, productId));

  return result[0]?.count || 0;
}

/**
 * Get most watched products
 */
export async function getMostWatchedProducts(limit: number = 10): Promise<WatchStats[]> {
  const result = await db
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
}

/**
 * Check if user is watching a product
 */
export async function isUserWatchingProduct(
  userId: number,
  productId: number
): Promise<boolean> {
  const result = await db
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
}

/**
 * Get user's reputation
 */
export async function getUserReputation(userId: number): Promise<UserReputation> {
  const result = await db
    .select()
    .from(userReputation)
    .where(eq(userReputation.userId, userId))
    .limit(1);

  if (result.length === 0) {
    // Create default reputation
    const newRep: InsertUserReputation = {
      userId,
      reputationPoints: 0,
      dealsSpotted: 0,
      accuratePredictions: 0,
      communityContributions: 0,
      level: 1,
    };

    const created = await db.insert(userReputation).values(newRep).returning();
    return created[0];
  }

  return result[0];
}

/**
 * Award reputation points to a user
 */
export async function awardReputation(
  userId: number,
  points: number,
  reason: 'deal_spotted' | 'accurate_prediction' | 'community_contribution'
): Promise<UserReputation> {
  const current = await getUserReputation(userId);

  const updates: Partial<InsertUserReputation> = {
    reputationPoints: (current.reputationPoints ?? 0) + points,
  };

  if (reason === 'deal_spotted') {
    updates.dealsSpotted = (current.dealsSpotted ?? 0) + 1;
  } else if (reason === 'accurate_prediction') {
    updates.accuratePredictions = (current.accuratePredictions ?? 0) + 1;
  } else if (reason === 'community_contribution') {
    updates.communityContributions = (current.communityContributions ?? 0) + 1;
  }

  const result = await db
    .update(userReputation)
    .set(updates)
    .where(eq(userReputation.userId, userId))
    .returning();

  // Check for badge achievements
  await checkAndAwardBadges(userId, result[0]);

  return result[0];
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
          // Award badge
          await db.insert(userBadges).values({
            userId,
            badgeId,
          });

          // Send notification
          await db.insert(notifications).values({
            userId,
            type: 'badge_earned',
            title: `Badge Earned: ${badge.name}!`,
            content: `Congratulations! You've earned the "${badge.name}" badge!`,
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

  const result = await db.insert(dealSpottings).values(spotting).returning();

  // Award reputation
  await awardReputation(userId, reputationAwarded, 'deal_spotted');

  return result[0];
}

/**
 * Get leaderboard of top users
 */
export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const result = await db
    .select({
      userId: userReputation.userId,
      username: sql<string>`users.username`,
      reputationPoints: userReputation.reputationPoints,
      dealsSpotted: userReputation.dealsSpotted,
      level: userReputation.level,
    })
    .from(userReputation)
    .innerJoin(sql`users`, sql`users.id = ${userReputation.userId}`)
    .orderBy(desc(userReputation.reputationPoints))
    .limit(limit);

  return result.map((r, index) => ({
    userId: r.userId,
    username: r.username,
    reputationPoints: r.reputationPoints ?? 0,
    dealsSpotted: r.dealsSpotted ?? 0,
    level: r.level ?? 0,
    rank: index + 1,
  }));
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

      const topicResult = await db.insert(forumTopics).values(newTopic).returning();
      topicId = topicResult[0].id;
    }

    // Create post in the topic
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

    const postResult = await db.insert(forumPosts).values(newPost).returning();

    // Notify all users watching this product
    await notifyWatchers(dealPost.productId, topicId, dealPost);

    return postResult[0].id;
  } catch (error) {
    console.error('Error auto-posting price drop to forum:', error);
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
