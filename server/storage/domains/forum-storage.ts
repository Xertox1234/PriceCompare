/**
 * Forum Storage Domain
 *
 * Handles all forum-related database operations including topic creation, post creation,
 * forum analytics, and integration with price drop notifications.
 *
 * IMPLEMENTATION GUIDANCE (from BaseStorage):
 * 1. **Input Validation**: Validate all numeric IDs are positive integers
 * 2. **N+1 Prevention**: Use JOINs, batch queries, never query in loops
 * 3. **Security**: Verify user ownership on mutations
 * 4. **Error Handling**: Use handleError() for database errors
 * 5. **Transactions**: Wrap multi-step operations in db.transaction()
 * 6. **Type Safety**: Import proper types, never use 'any'
 * 7. **Database Aggregation**: Use PostgreSQL functions for stats
 *
 * Phase 3D: Forum Domain Extraction - 6 methods migrated from monolithic storage.ts
 */

import { and, eq, desc, gte, sql, isNotNull, count } from "drizzle-orm";
import {
  forumTopics,
  forumPosts,
  forumCategories,
  products,
  productWatches,
  notifications,
  type ForumTopic,
  type ForumPost,
} from "@shared/schema";
import { BaseStorage } from "../base-storage";
import { logger } from "../../utils/logger";
import { retryWithBackoff, isTransientDatabaseError } from "../../utils/retry-with-backoff";
import type {
  ForumTopicResult,
  ForumPostResult,
  ForumActivityData,
  TopCategory,
  PriceDropForumPostData,
  ProductCategoryCount,
} from "../types";

/**
 * ForumStorage - Domain repository for forum operations
 *
 * Extends BaseStorage to inherit error handling and logging utilities.
 * Implements the 7-point implementation guidance from base-storage.ts.
 */
export class ForumStorage extends BaseStorage {
  // ============================================================================
  // Validation Helpers
  // ============================================================================

  /**
   * Validate topic ID is positive integer
   * @private
   */
  private validateTopicId(topicId: number): void {
    if (!topicId || topicId < 1 || !Number.isInteger(topicId)) {
      throw new Error(`Invalid topicId: ${topicId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate post ID is positive integer
   * @private
   */
  private validatePostId(postId: number): void {
    if (!postId || postId < 1 || !Number.isInteger(postId)) {
      throw new Error(`Invalid postId: ${postId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate category ID is positive integer
   * @private
   */
  private validateCategoryId(categoryId: number): void {
    if (!categoryId || categoryId < 1 || !Number.isInteger(categoryId)) {
      throw new Error(`Invalid categoryId: ${categoryId}. Must be a positive integer.`);
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
   * Validate limit parameter is positive
   * @private
   */
  private validateLimit(limit: number, paramName: string = 'limit'): void {
    if (limit <= 0 || !Number.isInteger(limit)) {
      throw new Error(`${paramName} must be a positive integer`);
    }
  }

  /**
   * Validate days ago parameter is positive
   * @private
   */
  private validateDaysAgo(daysAgo: number): void {
    if (daysAgo <= 0 || !Number.isInteger(daysAgo)) {
      throw new Error('daysAgo must be a positive integer');
    }
  }

  // ============================================================================
  // Forum Topic & Post Operations
  // ============================================================================

  /**
   * Create a forum topic with first post (atomic transaction)
   *
   * DATA INTEGRITY: Topic and first post must both succeed or rollback
   * PERFORMANCE: Uses transaction to ensure atomicity
   *
   * @param topicData - Topic metadata (title, authorId, categoryId, productId)
   * @param content - Content for the first post
   * @returns Created topic wrapped in ForumTopicResult
   */
  async createTopicWithFirstPost(
    topicData: {
      title: string;
      authorId: number;
      categoryId?: number | null;
      productId?: number | null;
    },
    content: string
  ): Promise<ForumTopicResult> {
    // Validate inputs
    this.validateUserId(topicData.authorId);
    if (topicData.categoryId) {
      this.validateCategoryId(topicData.categoryId);
    }
    if (topicData.productId) {
      this.validateProductId(topicData.productId);
    }

    let topic: ForumTopic;

    try {
      await this.db.transaction(async (tx) => {
        // Generate slug from title
        let slug = topicData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        // Check for existing slug and append random suffix if needed
        const existing = await tx
          .select()
          .from(forumTopics)
          .where(eq(forumTopics.slug, slug))
          .limit(1);

        if (existing.length > 0) {
          const crypto = await import('crypto');
          slug = `${slug}-${crypto.randomBytes(4).toString('hex')}`;
        }

        // Create topic
        const topicResult = await tx
          .insert(forumTopics)
          .values({
            title: topicData.title,
            authorId: topicData.authorId,
            categoryId: topicData.categoryId || null,
            productId: topicData.productId || null,
            slug,
          })
          .returning();

        topic = topicResult[0];

        // Create the first post
        await tx.insert(forumPosts).values({
          topicId: topic.id,
          authorId: topicData.authorId,
          content: content || '',
          rawContent: content || '',
          isFirstPost: true,
          postNumber: 1,
        });

        // Update topic post count and last post time
        await tx
          .update(forumTopics)
          .set({
            postCount: sql`${forumTopics.postCount} + 1`,
            lastPostAt: new Date(),
          })
          .where(eq(forumTopics.id, topic.id));
      });

      this.logSuccess('createTopicWithFirstPost', { topicId: topic!.id });
      return { topic: topic! };
    } catch (error) {
      this.handleError(error, 'createTopicWithFirstPost');
    }
  }

  /**
   * Create a forum post in an existing topic (with SERIALIZABLE transaction)
   *
   * DATA INTEGRITY: Uses SERIALIZABLE isolation to prevent race conditions on postNumber calculation
   * PERFORMANCE: Retries up to 3 times on serialization conflicts
   *
   * @param topicId - ID of the topic to post in
   * @param authorId - ID of the post author
   * @param content - Post content (HTML/formatted)
   * @param rawContent - Raw post content (plain text)
   * @returns Created post wrapped in ForumPostResult
   */
  async createForumPost(
    topicId: number,
    authorId: number,
    content: string,
    rawContent: string
  ): Promise<ForumPostResult> {
    // Validate inputs
    this.validateTopicId(topicId);
    this.validateUserId(authorId);

    let post: ForumPost;

    try {
      await retryWithBackoff(
        async () =>
          this.db.transaction(
            async (tx) => {
              // Get the next post number within transaction to prevent race conditions
              const existingPosts = await tx
                .select()
                .from(forumPosts)
                .where(eq(forumPosts.topicId, topicId));
              const postNumber = existingPosts.length + 1;

              // Create post with calculated postNumber
              const result = await tx
                .insert(forumPosts)
                .values({
                  topicId,
                  authorId,
                  content,
                  rawContent,
                  postNumber,
                  isFirstPost: false,
                })
                .returning();

              post = result[0];

              // Update topic stats
              await tx
                .update(forumTopics)
                .set({
                  postCount: sql`${forumTopics.postCount} + 1`,
                  lastPostAt: new Date(),
                })
                .where(eq(forumTopics.id, topicId));
            },
            {
              isolationLevel: 'serializable',
            }
          ),
        {
          maxAttempts: 3,
          initialDelayMs: 100,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'createForumPost', topicId, authorId },
          onRetry: (error: unknown, attempt: number, delayMs: number) => {
            logger.warn('[ForumStorage] Retrying post creation after serialization error', {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              topicId,
            });
          },
        }
      );

      this.logSuccess('createForumPost', { postId: post!.id, topicId });
      return { post: post! };
    } catch (error) {
      this.handleError(error, 'createForumPost');
    }
  }

  // ============================================================================
  // Forum Analytics
  // ============================================================================

  /**
   * Get forum activity data (posts per day)
   *
   * PERFORMANCE: Database-level aggregation using DATE_TRUNC
   * N+1 PREVENTION: Single query with GROUP BY
   *
   * @returns Array of date/count pairs for forum activity
   */
  async getForumActivityData(): Promise<ForumActivityData[]> {
    try {
      const result = await this.db.execute(sql`
        SELECT
          DATE_TRUNC('day', created_at)::date AS date,
          COUNT(*)::int AS count
        FROM ${forumPosts}
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date DESC
      `);

      const rows = result.rows as Array<{ date: string; count: number }>;
      return rows.map((row) => ({
        date: row.date,
        count: row.count,
      }));
    } catch (error) {
      this.handleError(error, 'getForumActivityData');
    }
  }

  /**
   * Get top forum categories by topic count
   *
   * PERFORMANCE: Database-level aggregation with GROUP BY
   * N+1 PREVENTION: Single query with JOIN
   *
   * @param limit - Maximum number of categories to return
   * @returns Array of categories with topic counts
   */
  async getTopCategories(limit: number): Promise<TopCategory[]> {
    // Validate inputs
    this.validateLimit(limit, 'limit');

    try {
      const result = await this.db.execute(sql`
        SELECT
          fc.name AS category_name,
          COUNT(ft.id)::int AS topic_count
        FROM ${forumCategories} fc
        LEFT JOIN ${forumTopics} ft ON fc.id = ft.category_id
        GROUP BY fc.id, fc.name
        ORDER BY topic_count DESC
        LIMIT ${limit}
      `);

      const rows = result.rows as Array<{ category_name: string; topic_count: number }>;
      return rows.map((row) => ({
        categoryName: row.category_name,
        topicCount: row.topic_count,
      }));
    } catch (error) {
      this.handleError(error, 'getTopCategories');
    }
  }

  // ============================================================================
  // Forum Integration (Price Drops & Product Topics)
  // ============================================================================

  /**
   * Get recent topic for a product
   *
   * Used to check if a product already has a recent forum topic before creating a new one.
   *
   * @param productId - ID of the product
   * @param daysAgo - Number of days to look back
   * @returns Most recent topic for the product, or null
   */
  async getRecentTopicForProduct(productId: number, daysAgo: number): Promise<ForumTopic | null> {
    // Validate inputs
    this.validateProductId(productId);
    this.validateDaysAgo(daysAgo);

    try {
      const result = await this.db
        .select()
        .from(forumTopics)
        .where(
          and(
            eq(forumTopics.productId, productId),
            gte(forumTopics.createdAt, sql`NOW() - INTERVAL '${sql.raw(daysAgo.toString())} days'`)
          )
        )
        .limit(1);

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.handleError(error, 'getRecentTopicForProduct');
    }
  }

  /**
   * Create price drop forum post with notification (transactional)
   *
   * DATA INTEGRITY: Topic, post, and notifications must all succeed or rollback
   * TRANSACTION: Ensures atomicity of topic creation, post creation, and watcher notifications
   *
   * @param data - Price drop data including product details and price changes
   * @returns Post ID of the created post, or null if failed
   */
  async createPriceDropForumPostTransaction(data: PriceDropForumPostData): Promise<number | null> {
    const { dealPost, userId } = data;

    // Validate inputs
    this.validateProductId(dealPost.productId);
    if (userId) {
      this.validateUserId(userId);
    }

    let postId: number | null = null;

    try {
      // DATA INTEGRITY: Use transaction for topic+post+notification creation
      // If any step fails, rollback all changes (prevents orphaned topics/posts)
      await this.db.transaction(async (tx) => {
        // Check if there's already a recent topic for this product
        const recentTopic = await tx
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
          const slug = topicTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

          const topicResult = await tx
            .insert(forumTopics)
            .values({
              categoryId: 1, // FORUM.DEALS_CATEGORY_ID
              title: topicTitle,
              slug,
              authorId: userId || 1, // System user
              productId: dealPost.productId,
              isPinned: dealPost.dropPercent >= 50, // Pin massive drops
            })
            .returning();

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

        const postResult = await tx
          .insert(forumPosts)
          .values({
            topicId,
            authorId: userId || 1, // System user
            content: postContent,
            rawContent: postContent,
            postNumber: 1,
          })
          .returning();

        postId = postResult[0].id;

        // Notify all users watching this product - must succeed or rollback all
        const watchers = await tx
          .select({ userId: productWatches.userId })
          .from(productWatches)
          .where(eq(productWatches.productId, dealPost.productId));

        if (watchers.length > 0) {
          const notificationList = watchers.map((w) => ({
            userId: w.userId,
            type: 'price_drop',
            title: `${dealPost.dropPercent.toFixed(0)}% Price Drop on ${dealPost.productName}!`,
            content: `The price dropped from $${dealPost.oldPrice.toFixed(2)} to $${dealPost.newPrice.toFixed(2)}`,
            relatedPostId: postId!,
          }));

          await tx.insert(notifications).values(notificationList);
        }
      });

      this.logSuccess('createPriceDropForumPostTransaction', {
        postId,
        productId: dealPost.productId,
        notificationsSent: postId !== null,
      });
      return postId;
    } catch (error) {
      this.handleError(error, 'createPriceDropForumPostTransaction');
    }
  }

  /**
   * Get trending product categories
   *
   * PERFORMANCE: Database-level aggregation with GROUP BY and ORDER BY
   * N+1 PREVENTION: Single query to get category counts
   *
   * @param limit - Maximum number of categories to return
   * @returns Array of categories with product counts
   */
  async getTrendingProductCategories(limit: number): Promise<ProductCategoryCount[]> {
    // Validate inputs
    this.validateLimit(limit, 'limit');

    try {
      const categoryCounts = await this.db
        .select({
          category: products.category,
          count: count(),
        })
        .from(products)
        .where(isNotNull(products.category))
        .groupBy(products.category)
        .orderBy(desc(count()))
        .limit(limit);

      return categoryCounts.map((row) => ({
        category: row.category as string,
        count: Number(row.count),
      }));
    } catch (error) {
      this.handleError(error, 'getTrendingProductCategories');
    }
  }
}
