import { db } from './db';
import { 
  users, 
  forumCategories, 
  forumTopics, 
  forumPosts, 
  priceAlerts,
  products
} from '../shared/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
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
    let query = db
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
          passwordHash: users.passwordHash,
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
      .leftJoin(forumCategories, eq(forumTopics.categoryId, forumCategories.id));

    if (categoryId) {
      query = query.where(eq(forumTopics.categoryId, categoryId));
    }

    if (productId) {
      query = query.where(eq(forumTopics.productId, productId));
    }

    const results = await query
      .orderBy(desc(forumTopics.isPinned), desc(forumTopics.lastPostAt))
      .execute();

    return results.map(result => ({
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
          passwordHash: users.passwordHash,
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
      .limit(1);

    if (!result.length) return null;

    const topic = result[0];
    return {
      ...topic,
      author: topic.author!,
      category: topic.category || undefined,
    };
  }

  async createTopic(topic: InsertForumTopic): Promise<ForumTopic> {
    const slug = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
      .orderBy(asc(forumPosts.createdAt));

    return results.map(result => ({
      ...result,
      author: result.author!,
    }));
  }

  async createPost(post: InsertForumPost): Promise<ForumPost> {
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

  async getProductDiscussionCount(productId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(forumTopics)
      .where(eq(forumTopics.productId, productId));
    
    return result[0]?.count || 0;
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