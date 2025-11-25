import { db } from "../db";
import { BaseStorage } from "./base-storage";
import {
  forumTopics,
  forumPosts,
  forumCategories,
  productWatches,
  notifications,
  type ForumTopic,
  type ForumPost,
} from "@shared/schema";
import {
  type ForumTopicResult,
  type ForumPostResult,
  type ForumActivityData,
  type TopCategory,
  type PriceDropForumPostData,
} from "./types";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { retryWithBackoff, isTransientDatabaseError } from "../middleware/retry";
import { logger } from "../utils/logger";

/**
 * Forum Storage Repository
 *
 * Manages forum topics, posts, and community interactions with
 * transactional integrity and performance optimization.
 *
 * Key Features:
 * - Atomic topic+post creation with slug generation
 * - SERIALIZABLE transactions for post count updates (prevents race conditions)
 * - Automated price drop forum post generation with notifications
 * - Forum activity analytics with date aggregation
 * - Category statistics with JOIN optimization
 *
 * Performance Characteristics:
 * - createForumPost: SERIALIZABLE with exponential backoff retry (3 attempts)
 * - createTopicWithFirstPost: Transaction with slug collision handling
 * - getForumActivityData: Aggregated GROUP BY date for analytics
 * - getTopCategories: LEFT JOIN with COUNT aggregation
 * - createPriceDropForumPostTransaction: Complex multi-step transaction
 *
 * Caching Strategy:
 * - getForumActivityData() is a good candidate for Redis caching (aggregation-heavy)
 * - Cache key pattern: `forum:activity:data`
 * - Suggested TTL: 5 minutes (balance between accuracy and performance)
 * - Invalidate on: new forum post created
 *
 * - getTopCategories() could benefit from short-term caching (2 minutes)
 * - Cache key pattern: `forum:categories:top:${limit}`
 * - Invalidate on: new topic created
 *
 * Implementation Example:
 * ```typescript
 * import { getRedisClient } from '../config/redis';
 * import { forumStorage } from './storage/forum-storage';
 *
 * // Cached getForumActivityData wrapper
 * async function getCachedForumActivityData(): Promise<ForumActivityData[]> {
 *   const redis = getRedisClient();
 *   const cacheKey = 'forum:activity:data';
 *
 *   // Try cache first
 *   const cached = await redis.get(cacheKey);
 *   if (cached) {
 *     return JSON.parse(cached);
 *   }
 *
 *   // Cache miss - compute and store
 *   const data = await forumStorage.getForumActivityData();
 *   await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min TTL
 *   return data;
 * }
 *
 * // Invalidate cache when new post created
 * async function createPostWithInvalidation(topicId: number, authorId: number, content: string, rawContent: string) {
 *   const redis = getRedisClient();
 *   const post = await forumStorage.createForumPost(topicId, authorId, content, rawContent);
 *
 *   // Invalidate activity cache
 *   await redis.del('forum:activity:data');
 *   return post;
 * }
 * ```
 *
 * Database Schema Requirements:
 * - forumTopics table with unique constraint on slug
 * - forumPosts table with indexes on (topicId, postNumber)
 * - forumCategories table with name and description
 * - Foreign keys with CASCADE on delete for topics → posts
 * - Composite indexes for date range queries and analytics
 *
 * PostgreSQL Features Used:
 * - DATE() function for date grouping
 * - COUNT() aggregation for analytics
 * - LEFT JOIN for category statistics
 * - INTERVAL arithmetic for date filtering
 * - SERIALIZABLE isolation level for concurrent post creation
 */

/**
 * Constants for forum operations
 */
const FORUM_CONSTANTS = {
  VALIDATION: {
    MIN_ID: 1,
    MIN_TITLE_LENGTH: 3,
    MAX_TITLE_LENGTH: 200,
    MIN_CONTENT_LENGTH: 1,
    MAX_CONTENT_LENGTH: 50000,
    MIN_DAYS_AGO: 1,
    MAX_DAYS_AGO: 365,
  },
  QUERY: {
    DEFAULT_CATEGORY_LIMIT: 10,
    MAX_CATEGORY_LIMIT: 50,
    RECENT_TOPIC_DAYS: 7, // Days to consider a topic "recent" for price drops
  },
  SLUG: {
    RANDOM_SUFFIX_BYTES: 4, // Bytes for random hex suffix on collision
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 100,
  },
  DEALS: {
    CATEGORY_ID: 1, // Default category for price drop posts
    SYSTEM_USER_ID: 1, // System user for automated posts
    PIN_THRESHOLD_PERCENT: 50, // Pin topics with >= 50% price drops
    MASSIVE_DROP_THRESHOLD: 50, // "MASSIVE DEAL" indicator
    GREAT_DROP_MIN: 30, // "Great Deal" minimum threshold
    GREAT_DROP_MAX: 49, // "Great Deal" maximum threshold
  },
  CALCULATIONS: {
    PERCENTAGE_DECIMAL_PLACES: 1, // Decimal places for percentage display
    PRICE_DECIMAL_PLACES: 2, // Decimal places for price display
  },
} as const;

/**
 * Forum Storage Interface
 *
 * Comprehensive forum data access layer for topics, posts, and community features.
 */
export interface IForumStorage {
  /**
   * Topic and Post Creation Operations
   */

  /**
   * Create a new forum topic with its first post atomically
   * @param topicData - Topic metadata (title, authorId, categoryId, productId)
   * @param topicData.title - Topic title (3-200 characters)
   * @param topicData.authorId - Author user ID (must be positive)
   * @param topicData.categoryId - Optional category ID (must be positive or null)
   * @param topicData.productId - Optional related product ID (must be positive or null)
   * @param content - First post content (1-50000 characters)
   * @returns Created topic with metadata
   * @throws Error if title/content invalid or author doesn't exist
   */
  createTopicWithFirstPost(
    topicData: {
      title: string;
      authorId: number;
      categoryId?: number | null;
      productId?: number | null;
    },
    content: string
  ): Promise<ForumTopicResult>;

  /**
   * Create a new post in an existing topic with SERIALIZABLE isolation
   * @param topicId - Topic ID (must be positive)
   * @param authorId - Author user ID (must be positive)
   * @param content - Post content HTML (1-50000 characters)
   * @param rawContent - Post content markdown (1-50000 characters)
   * @returns Created post with postNumber assigned
   * @throws Error if topic doesn't exist or content invalid
   */
  createForumPost(
    topicId: number,
    authorId: number,
    content: string,
    rawContent: string
  ): Promise<ForumPostResult>;

  /**
   * Analytics and Reporting Operations
   */

  /**
   * Get forum activity data grouped by date (for charts/analytics)
   * @returns Array of date+count pairs for all forum posts
   */
  getForumActivityData(): Promise<ForumActivityData[]>;

  /**
   * Get top forum categories by topic count
   * @param limit - Maximum number of categories to return (default: 10, max: 50)
   * @returns Categories sorted by topic count descending
   */
  getTopCategories(limit?: number): Promise<TopCategory[]>;

  /**
   * Product-Related Forum Operations
   */

  /**
   * Get most recent forum topic for a product within date range
   * @param productId - Product ID (must be positive)
   * @param daysAgo - Number of days to look back (1-365)
   * @returns Most recent topic for product or null if none found
   * @throws Error if productId or daysAgo invalid
   */
  getRecentTopicForProduct(productId: number, daysAgo: number): Promise<ForumTopic | null>;

  /**
   * Create automated price drop forum post with notifications (transactional)
   * @param data - Price drop data including dealPost metadata and userId
   * @param data.dealPost - Product, retailer, price change information
   * @param data.userId - User ID to associate with post (defaults to system user)
   * @returns Created post ID or null if failed
   */
  createPriceDropForumPostTransaction(data: PriceDropForumPostData): Promise<number | null>;
}

/**
 * Forum Storage Implementation
 */
export class ForumStorage extends BaseStorage implements IForumStorage {
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
   * Validate topic title length and content
   * @private
   */
  private validateTitle(title: string): void {
    if (!title || title.trim().length < FORUM_CONSTANTS.VALIDATION.MIN_TITLE_LENGTH) {
      throw new Error(
        `Topic title must be at least ${FORUM_CONSTANTS.VALIDATION.MIN_TITLE_LENGTH} characters`
      );
    }
    if (title.length > FORUM_CONSTANTS.VALIDATION.MAX_TITLE_LENGTH) {
      throw new Error(
        `Topic title cannot exceed ${FORUM_CONSTANTS.VALIDATION.MAX_TITLE_LENGTH} characters`
      );
    }
  }

  /**
   * Validate post content length
   * @private
   */
  private validateContent(content: string, fieldName: string): void {
    if (!content || content.trim().length < FORUM_CONSTANTS.VALIDATION.MIN_CONTENT_LENGTH) {
      throw new Error(
        `${fieldName} must be at least ${FORUM_CONSTANTS.VALIDATION.MIN_CONTENT_LENGTH} characters`
      );
    }
    if (content.length > FORUM_CONSTANTS.VALIDATION.MAX_CONTENT_LENGTH) {
      throw new Error(
        `${fieldName} cannot exceed ${FORUM_CONSTANTS.VALIDATION.MAX_CONTENT_LENGTH} characters`
      );
    }
  }

  /**
   * Generate URL-friendly slug from title
   * @private
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Create a new forum topic with its first post atomically
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
    return this.handleError('createTopicWithFirstPost', async () => {
      // Validation
      this.validateTitle(topicData.title);
      this.validatePositiveId(topicData.authorId, 'Author ID');
      this.validateContent(content, 'Post content');

      if (topicData.categoryId !== undefined && topicData.categoryId !== null) {
        this.validatePositiveId(topicData.categoryId, 'Category ID');
      }
      if (topicData.productId !== undefined && topicData.productId !== null) {
        this.validatePositiveId(topicData.productId, 'Product ID');
      }

      let topic: ForumTopic;

      // DATA INTEGRITY: Topic + first post + stats update must be atomic
      await this.executeTransaction(async (tx) => {
        // Generate slug from title
        let slug = this.generateSlug(topicData.title);

        // Check for existing slug and append random suffix if needed
        const existing = await tx
          .select()
          .from(forumTopics)
          .where(eq(forumTopics.slug, slug))
          .limit(1);

        if (existing.length > 0) {
          const crypto = await import('crypto');
          const suffix = crypto.randomBytes(FORUM_CONSTANTS.SLUG.RANDOM_SUFFIX_BYTES).toString('hex');
          slug = `${slug}-${suffix}`;
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

        // Create the first post - must succeed or rollback topic
        await tx.insert(forumPosts).values({
          topicId: topic.id,
          authorId: topicData.authorId,
          content: content || '',
          rawContent: content || '',
          isFirstPost: true,
          postNumber: 1,
        });

        // Update topic post count and last post time - must succeed or rollback all
        await tx
          .update(forumTopics)
          .set({
            postCount: sql`${forumTopics.postCount} + 1`,
            lastPostAt: new Date(),
          })
          .where(eq(forumTopics.id, topic.id));
      });

      return { topic: topic! };
    });
  }

  /**
   * Create a new post in an existing topic with SERIALIZABLE isolation
   */
  async createForumPost(
    topicId: number,
    authorId: number,
    content: string,
    rawContent: string
  ): Promise<ForumPostResult> {
    return this.handleError('createForumPost', async () => {
      // Validation
      this.validatePositiveId(topicId, 'Topic ID');
      this.validatePositiveId(authorId, 'Author ID');
      this.validateContent(content, 'Post content');
      this.validateContent(rawContent, 'Raw content');

      let post: ForumPost;

      // SERIALIZABLE transaction with retry to prevent race conditions on postNumber
      await retryWithBackoff(
        async () =>
          this.executeTransaction(
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

              // Update topic stats - must succeed or rollback post
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
          maxAttempts: FORUM_CONSTANTS.RETRY.MAX_ATTEMPTS,
          initialDelayMs: FORUM_CONSTANTS.RETRY.INITIAL_DELAY_MS,
          isRetryable: isTransientDatabaseError,
          context: { operation: 'createForumPost', topicId, authorId },
          onRetry: (error, attempt, delayMs) => {
            logger.warn('[ForumStorage] Retrying post creation after serialization error', {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delayMs,
              topicId,
            });
          },
        }
      );

      return { post: post! };
    });
  }

  /**
   * Get forum activity data grouped by date (for charts/analytics)
   */
  async getForumActivityData(): Promise<ForumActivityData[]> {
    return this.handleError('getForumActivityData', async () => {
      const result = await db
        .select({
          date: sql<string>`DATE(${forumPosts.createdAt})`.as('date'),
          count: sql<number>`count(*)`.as('count'),
        })
        .from(forumPosts)
        .groupBy(sql`DATE(${forumPosts.createdAt})`)
        .orderBy(sql`DATE(${forumPosts.createdAt})`);

      return result.map((row) => ({
        date: String(row.date),
        count: Number(row.count),
      }));
    });
  }

  /**
   * Get top forum categories by topic count
   */
  async getTopCategories(limit?: number): Promise<TopCategory[]> {
    return this.handleError('getTopCategories', async () => {
      // Validate and bound limit
      const validLimit = Math.min(
        limit || FORUM_CONSTANTS.QUERY.DEFAULT_CATEGORY_LIMIT,
        FORUM_CONSTANTS.QUERY.MAX_CATEGORY_LIMIT
      );

      if (validLimit <= 0) {
        throw new Error('Limit must be a positive number');
      }

      const result = await db
        .select({
          categoryName: forumCategories.name,
          topicCount: sql<number>`count(${forumTopics.id})`.as('topicCount'),
        })
        .from(forumCategories)
        .leftJoin(forumTopics, eq(forumCategories.id, forumTopics.categoryId))
        .groupBy(forumCategories.id, forumCategories.name)
        .orderBy(sql`count(${forumTopics.id}) DESC`)
        .limit(validLimit);

      return result.map((row) => ({
        categoryName: row.categoryName,
        topicCount: Number(row.topicCount),
      }));
    });
  }

  /**
   * Get most recent forum topic for a product within date range
   */
  async getRecentTopicForProduct(productId: number, daysAgo: number): Promise<ForumTopic | null> {
    return this.handleError('getRecentTopicForProduct', async () => {
      // Validation
      this.validatePositiveId(productId, 'Product ID');

      if (daysAgo < FORUM_CONSTANTS.VALIDATION.MIN_DAYS_AGO) {
        throw new Error(
          `daysAgo must be at least ${FORUM_CONSTANTS.VALIDATION.MIN_DAYS_AGO} days`
        );
      }

      if (daysAgo > FORUM_CONSTANTS.VALIDATION.MAX_DAYS_AGO) {
        throw new Error(`daysAgo cannot exceed ${FORUM_CONSTANTS.VALIDATION.MAX_DAYS_AGO} days`);
      }

      const result = await db
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
    });
  }

  /**
   * Create automated price drop forum post with notifications (transactional)
   */
  async createPriceDropForumPostTransaction(
    data: PriceDropForumPostData
  ): Promise<number | null> {
    return this.handleError('createPriceDropForumPostTransaction', async () => {
      const { dealPost, userId } = data;

      // Validation
      this.validatePositiveId(dealPost.productId, 'Product ID');
      if (userId !== undefined && userId !== null) {
        this.validatePositiveId(userId, 'User ID');
      }

      let postId: number | null = null;

      // DATA INTEGRITY: Use transaction for topic+post+notification creation
      // If any step fails, rollback all changes (prevents orphaned topics/posts)
      await this.executeTransaction(async (tx) => {
        // Check if there's already a recent topic for this product
        const recentTopic = await tx
          .select()
          .from(forumTopics)
          .where(
            and(
              eq(forumTopics.productId, dealPost.productId),
              gte(
                forumTopics.createdAt,
                sql`NOW() - INTERVAL '${FORUM_CONSTANTS.QUERY.RECENT_TOPIC_DAYS} days'`
              )
            )
          )
          .limit(1);

        let topicId: number;

        if (recentTopic.length > 0) {
          topicId = recentTopic[0].id;
        } else {
          // Create new topic
          const dropPercentFormatted = dealPost.dropPercent.toFixed(
            FORUM_CONSTANTS.CALCULATIONS.PERCENTAGE_DECIMAL_PLACES
          );
          const topicTitle = `🔥 ${dropPercentFormatted}% Price Drop: ${dealPost.productName}`;
          const slug = this.generateSlug(topicTitle);

          const topicResult = await tx
            .insert(forumTopics)
            .values({
              categoryId: FORUM_CONSTANTS.DEALS.CATEGORY_ID,
              title: topicTitle,
              slug,
              authorId: userId || FORUM_CONSTANTS.DEALS.SYSTEM_USER_ID,
              productId: dealPost.productId,
              isPinned: dealPost.dropPercent >= FORUM_CONSTANTS.DEALS.PIN_THRESHOLD_PERCENT,
            })
            .returning();

          topicId = topicResult[0].id;
        }

        // Create post in the topic - must succeed or rollback topic
        const oldPriceFormatted = dealPost.oldPrice.toFixed(
          FORUM_CONSTANTS.CALCULATIONS.PRICE_DECIMAL_PLACES
        );
        const newPriceFormatted = dealPost.newPrice.toFixed(
          FORUM_CONSTANTS.CALCULATIONS.PRICE_DECIMAL_PLACES
        );
        const dropAmountFormatted = dealPost.dropAmount.toFixed(
          FORUM_CONSTANTS.CALCULATIONS.PRICE_DECIMAL_PLACES
        );
        const dropPercentFormatted = dealPost.dropPercent.toFixed(
          FORUM_CONSTANTS.CALCULATIONS.PERCENTAGE_DECIMAL_PLACES
        );

        const postContent = `
## Major Price Drop Alert! 🎉

**Product:** ${dealPost.productName}
**Retailer:** ${dealPost.retailer}

**Price Change:**
- Old Price: $${oldPriceFormatted}
- New Price: $${newPriceFormatted}
- **You Save: $${dropAmountFormatted} (${dropPercentFormatted}%)**

${
  dealPost.dropPercent >= FORUM_CONSTANTS.DEALS.MASSIVE_DROP_THRESHOLD
    ? '🔥 **MASSIVE DEAL!** This is an exceptional price drop!'
    : ''
}
${
  dealPost.dropPercent >= FORUM_CONSTANTS.DEALS.GREAT_DROP_MIN &&
  dealPost.dropPercent <= FORUM_CONSTANTS.DEALS.GREAT_DROP_MAX
    ? '💰 **Great Deal!** Significant savings on this product.'
    : ''
}

_This deal was automatically detected by our price tracking system._
        `.trim();

        const postResult = await tx
          .insert(forumPosts)
          .values({
            topicId,
            authorId: userId || FORUM_CONSTANTS.DEALS.SYSTEM_USER_ID,
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
          const notificationValues = watchers.map((watcher) => ({
            userId: watcher.userId,
            type: 'price_drop' as const,
            title: `Price Drop: ${dealPost.productName}`,
            content: `${dropPercentFormatted}% off at ${dealPost.retailer}`,
            relatedProductId: dealPost.productId,
            relatedPostId: postId,
          }));

          // Insert notifications in batch - must succeed or rollback all
          await tx.insert(notifications).values(notificationValues);
        }
      });

      return postId;
    });
  }
}

// Export singleton instance
export const forumStorage = new ForumStorage();
