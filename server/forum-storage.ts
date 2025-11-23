import { db } from './db';
import {
  users,
  forumCategories,
  forumTopics,
  forumPosts,
  priceAlerts,
  products
} from '../shared/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { createLogger } from './utils/logger';

const log = createLogger('ForumStorage');
import type {
  User,
  ForumCategory,
  InsertForumCategory,
  ForumTopic,
  InsertForumTopic,
  ForumPost,
  InsertForumPost,
  ForumTopicWithDetails,
  ForumPostWithAuthor,
  PriceAlert,
  InsertPriceAlert
} from '../shared/schema';
import { getFirstResult } from './utils/db-helpers.js';

// Type definitions for raw query results before mapping
// SECURITY: These types intentionally exclude passwordHash
type TopicQueryAuthor = {
  id: number | null;
  username: string | null;
  email: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type TopicQueryCategory = {
  id: number | null;
  name: string | null;
  slug: string | null;
  description: string | null;
  color: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
};

type TopicQueryResult = {
  id: number;
  title: string;
  slug: string;
  categoryId: number | null;
  authorId: number | null;
  productId: number | null;
  isPinned: boolean;
  isLocked: boolean;
  postCount: number;
  lastPostAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: TopicQueryAuthor | null;
  category: TopicQueryCategory | null;
};

type PostQueryAuthor = {
  id: number | null;
  username: string | null;
  email: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type PostQueryResult = {
  id: number;
  topicId: number;
  authorId: number | null;
  content: string;
  isFirstPost: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: PostQueryAuthor | null;
};

export class ForumStorage {
  // Categories
  async getCategories(): Promise<ForumCategory[]> {
    return db.select().from(forumCategories).where(eq(forumCategories.isActive, true));
  }

  async createCategory(category: InsertForumCategory): Promise<ForumCategory> {
    const result = await db.insert(forumCategories).values(category).returning();
    const createdCategory = getFirstResult(result);
    if (!createdCategory) {
      throw new Error('Failed to create category');
    }
    return createdCategory;
  }

  // Topics
  async getTopics(categoryId?: number, productId?: number): Promise<ForumTopicWithDetails[]> {
    const conditions = [];
    if (categoryId) {
      conditions.push(eq(forumTopics.categoryId, categoryId));
    }
    if (productId) {
      conditions.push(eq(forumTopics.productId, productId));
    }

    const results = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        slug: forumTopics.slug,
        categoryId: forumTopics.categoryId,
        authorId: forumTopics.authorId,
        productId: forumTopics.productId,
        isPinned: forumTopics.isPinned,
        isLocked: forumTopics.isLocked,
        postCount: forumTopics.postCount,
        lastPostAt: forumTopics.lastPostAt,
        createdAt: forumTopics.createdAt,
        updatedAt: forumTopics.updatedAt,
        author: {
          id: users.id,
          username: users.username,
          email: users.email,
          // SECURITY: Never expose password hashes in API responses
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        category: {
          id: forumCategories.id,
          name: forumCategories.name,
          slug: forumCategories.slug,
          description: forumCategories.description,
          color: forumCategories.color,
          isActive: forumCategories.isActive,
          createdAt: forumCategories.createdAt,
        }
      })
      .from(forumTopics)
      .leftJoin(users, eq(forumTopics.authorId, users.id))
      .leftJoin(forumCategories, eq(forumTopics.categoryId, forumCategories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(forumTopics.isPinned), desc(forumTopics.lastPostAt))
      .execute() as unknown as TopicQueryResult[];

    return results.map((result) => ({
      ...result,
      author: result.author!,
      category: result.category || undefined,
    })) as ForumTopicWithDetails[];
  }

  async getTopicById(id: number): Promise<ForumTopicWithDetails | null> {
    const result = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        slug: forumTopics.slug,
        categoryId: forumTopics.categoryId,
        authorId: forumTopics.authorId,
        productId: forumTopics.productId,
        isPinned: forumTopics.isPinned,
        isLocked: forumTopics.isLocked,
        postCount: forumTopics.postCount,
        lastPostAt: forumTopics.lastPostAt,
        createdAt: forumTopics.createdAt,
        updatedAt: forumTopics.updatedAt,
        author: {
          id: users.id,
          username: users.username,
          email: users.email,
          // SECURITY: Never expose password hashes in API responses
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        category: {
          id: forumCategories.id,
          name: forumCategories.name,
          slug: forumCategories.slug,
          description: forumCategories.description,
          color: forumCategories.color,
          isActive: forumCategories.isActive,
          createdAt: forumCategories.createdAt,
        }
      })
      .from(forumTopics)
      .leftJoin(users, eq(forumTopics.authorId, users.id))
      .leftJoin(forumCategories, eq(forumTopics.categoryId, forumCategories.id))
      .where(eq(forumTopics.id, id))
      .limit(1) as unknown as TopicQueryResult[];

    const topic = getFirstResult(result);
    if (!topic) return null;

    return {
      ...topic,
      author: topic.author!,
      category: topic.category || undefined,
    } as ForumTopicWithDetails;
  }

  async createTopic(topic: Omit<InsertForumTopic, 'slug'>): Promise<ForumTopic> {
    // Generate base slug from title
    let slug = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // SECURITY: Check for existing slug and append random suffix if needed to prevent collisions
    const existing = await db.select().from(forumTopics).where(eq(forumTopics.slug, slug)).limit(1);
    if (existing.length > 0) {
      // Generate a unique suffix using crypto for collision-resistant slugs
      const crypto = await import('crypto');
      slug = `${slug}-${crypto.randomBytes(4).toString('hex')}`;
    }

    const result = await db.insert(forumTopics).values({
      ...topic,
      slug,
    }).returning();
    const newTopic = getFirstResult(result);
    if (!newTopic) {
      throw new Error('Failed to create topic');
    }
    return newTopic;
  }

  // Posts
  async getPostsByTopic(topicId: number): Promise<ForumPostWithAuthor[]> {
    const results = await db
      .select({
        id: forumPosts.id,
        topicId: forumPosts.topicId,
        authorId: forumPosts.authorId,
        content: forumPosts.content,
        isFirstPost: forumPosts.isFirstPost,
        createdAt: forumPosts.createdAt,
        updatedAt: forumPosts.updatedAt,
        author: {
          id: users.id,
          username: users.username,
          email: users.email,
          // SECURITY: Never expose passwordHash
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        }
      })
      .from(forumPosts)
      .leftJoin(users, eq(forumPosts.authorId, users.id))
      .where(eq(forumPosts.topicId, topicId))
      .orderBy(asc(forumPosts.createdAt)) as unknown as PostQueryResult[];

    return results.map((result) => ({
      ...result,
      author: result.author!,
    })) as ForumPostWithAuthor[];
  }

  async createPost(post: InsertForumPost): Promise<ForumPost> {
    log.info("ForumStorage.createPost called with:", { post: JSON.stringify(post, null, 2) });
    log.info("Schema field names:", { fieldNames: Object.keys(forumPosts) });

    // DATA INTEGRITY: Use transaction to ensure post creation and topic update are atomic
    // If topic update fails, post should not exist (leads to incorrect post counts)
    let newPost: ForumPost;
    await db.transaction(async (tx) => {
      const result = await tx.insert(forumPosts).values(post).returning();

      // Update topic post count and last post time - must succeed or rollback post creation
      await tx.update(forumTopics)
        .set({
          postCount: sql`${forumTopics.postCount} + 1`,
          lastPostAt: new Date(),
        })
        .where(eq(forumTopics.id, post.topicId));

      const post = getFirstResult(result);
      if (!post) {
        throw new Error('Failed to create post');
      }
      newPost = post;
    });

    return newPost!;
  }

  // Price Alerts
  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    const result = await db.insert(priceAlerts).values(alert).returning();
    const newAlert = getFirstResult(result);
    if (!newAlert) {
      throw new Error('Failed to create price alert');
    }
    return newAlert;
  }

  async getUserPriceAlerts(userId: number): Promise<PriceAlert[]> {
    return db.select().from(priceAlerts)
      .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.isActive, true)));
  }

  async updatePriceAlert(alertId: number, userId: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | null> {
    const result = await db.update(priceAlerts)
      .set(updates)
      .where(and(eq(priceAlerts.id, alertId), eq(priceAlerts.userId, userId)))
      .returning();
    return getFirstResult(result);
  }

  async deletePriceAlert(alertId: number, userId: number): Promise<boolean> {
    const result = await db.delete(priceAlerts)
      .where(and(eq(priceAlerts.id, alertId), eq(priceAlerts.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getProductDiscussionCount(productId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(forumTopics)
      .where(eq(forumTopics.productId, productId));

    return result[0]?.count || 0;
  }

  /**
   * Get discussion counts for multiple products in a single query (avoids N+1 problem)
   * @param productIds - Array of product IDs to get counts for
   * @returns Map of product ID to discussion count
   */
  async getProductDiscussionCounts(productIds: number[]): Promise<Map<number, number>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const results = await db
      .select({
        productId: forumTopics.productId,
        count: sql<number>`count(*)`
      })
      .from(forumTopics)
      .where(inArray(forumTopics.productId, productIds))
      .groupBy(forumTopics.productId);

    return new Map(results.map(r => [r.productId!, r.count]));
  }

  // Initialize default categories
  async initializeDefaultCategories(): Promise<void> {
    const defaultCategories = [
      {
        name: 'General Discussion',
        slug: 'general',
        description: 'General discussions about products and shopping',
        color: '#3b82f6',
      },
      {
        name: 'Product Reviews',
        slug: 'reviews',
        description: 'Share your product reviews and experiences',
        color: '#10b981',
      },
      {
        name: 'Price Alerts',
        slug: 'price-alerts',
        description: 'Community price drop notifications',
        color: '#f59e0b',
      },
      {
        name: 'Deals & Discounts',
        slug: 'deals',
        description: 'Share great deals and discount codes',
        color: '#ef4444',
      },
    ];

    // Batch query for all existing slugs to avoid N+1 queries
    const existingSlugs = await db
      .select({ slug: forumCategories.slug })
      .from(forumCategories)
      .where(inArray(forumCategories.slug, defaultCategories.map(c => c.slug)));

    const existingSet = new Set(existingSlugs.map(e => e.slug));

    // Filter to only new categories and batch insert
    const newCategories = defaultCategories.filter(c => !existingSet.has(c.slug));

    if (newCategories.length > 0) {
      await db.insert(forumCategories).values(newCategories);
    }
  }
}

export const forumStorage = new ForumStorage();