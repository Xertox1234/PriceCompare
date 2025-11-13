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

export class ForumStorage {
  // Categories
  async getCategories(): Promise<ForumCategory[]> {
    return db.select().from(forumCategories).where(eq(forumCategories.isActive, true));
  }

  async createCategory(category: InsertForumCategory): Promise<ForumCategory> {
    const result = await db.insert(forumCategories).values(category).returning();
    return result[0];
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
      .execute() /* TODO: Add proper return type */;

    return results.map((result: unknown) => ({
      ...result,
      author: result.author!,
      category: result.category || undefined,
    }));
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
      .limit(1) /* TODO: Add proper return type */;

    if (!result.length) return null;

    const topic = result[0];
    return {
      ...topic,
      author: topic.author!,
      category: topic.category || undefined,
    } as any;
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
    return result[0];
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
          passwordHash: users.passwordHash,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        }
      })
      .from(forumPosts)
      .leftJoin(users, eq(forumPosts.authorId, users.id))
      .where(eq(forumPosts.topicId, topicId))
      .orderBy(asc(forumPosts.createdAt)) /* TODO: Add proper return type */;

    return results.map((result: unknown) => ({
      ...result,
      author: result.author!,
    }));
  }

  async createPost(post: InsertForumPost): Promise<ForumPost> {
    console.log("ForumStorage.createPost called with:", JSON.stringify(post, null, 2));
    console.log("Schema field names:", Object.keys(forumPosts));
    const result = await db.insert(forumPosts).values(post).returning();
    
    // Update topic post count and last post time
    await db.update(forumTopics)
      .set({
        postCount: sql`${forumTopics.postCount} + 1`,
        lastPostAt: new Date(),
      })
      .where(eq(forumTopics.id, post.topicId));

    return result[0];
  }

  // Price Alerts
  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    const result = await db.insert(priceAlerts).values(alert).returning();
    return result[0];
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
    return result[0] || null;
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

    for (const category of defaultCategories) {
      const existing = await db.select().from(forumCategories)
        .where(eq(forumCategories.slug, category.slug))
        .limit(1);
      
      if (!existing.length) {
        await this.createCategory(category);
      }
    }
  }
}

export const forumStorage = new ForumStorage();