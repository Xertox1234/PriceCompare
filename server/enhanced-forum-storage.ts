import { db } from './db';
import { eq, desc, asc, sql, and, or, count, isNull, inArray, ilike } from 'drizzle-orm';
import {
  users, forumCategories, forumTopics, forumPosts, postLikes, notifications,
  topicTags, topicTagRelations, postMentions, privateMessages, badges, userBadges,
  postRevisions, products
} from '@shared/schema';
import type {
  User, ForumCategory, ForumTopic, ForumPost, PostLike, Notification,
  TopicTag, PostMention, PrivateMessage, Badge, UserBadge, PostRevision,
  InsertUser, InsertForumCategory, InsertForumTopic, InsertForumPost,
  InsertPostLike, InsertNotification, InsertTopicTag, InsertPrivateMessage,
  InsertBadge, InsertPostRevision,
  UserWithProfile, ForumTopicWithDetails, ForumPostWithDetails,
  NotificationWithDetails, PrivateMessageWithUsers
} from '@shared/schema';

export class EnhancedForumStorage {
  // User management with enhanced profiles
  async getUserWithProfile(id: number): Promise<UserWithProfile | null> {
    const [userResult] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        trustLevel: users.trustLevel,
        isActive: users.isActive,
        isBanned: users.isBanned,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        postCount: users.postCount,
        topicCount: users.topicCount,
        likesReceived: users.likesReceived,
        likesGiven: users.likesGiven,
        // SECURITY: Never expose passwordHash
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!userResult) return null;

    // Get user badges
    const userBadgesResult = await db
      .select({
        userBadge: userBadges,
        badge: badges
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, id));

    // Get unread notifications count
    const [unreadCount] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, id), eq(notifications.isRead, false)));

    return {
      ...userResult,
      badges: userBadgesResult.map(r => ({ ...r.userBadge, badge: r.badge })),
      unreadNotifications: Number(unreadCount?.count) || 0,
      trustLevelName: this.getTrustLevelName(userResult.trustLevel ?? 0)
    };
  }

  async updateUserStats(userId: number): Promise<void> {
    // Update post count
    const [postCount] = await db
      .select({ count: count() })
      .from(forumPosts)
      .where(eq(forumPosts.authorId, userId));

    // Update topic count
    const [topicCount] = await db
      .select({ count: count() })
      .from(forumTopics)
      .where(eq(forumTopics.authorId, userId));

    // Update likes received
    const [likesReceived] = await db
      .select({ count: count() })
      .from(postLikes)
      .innerJoin(forumPosts, eq(postLikes.postId, forumPosts.id))
      .where(eq(forumPosts.authorId, userId));

    // Update likes given
    const [likesGiven] = await db
      .select({ count: count() })
      .from(postLikes)
      .where(eq(postLikes.userId, userId));

    await db
      .update(users)
      .set({
        postCount: Number(postCount?.count) || 0,
        topicCount: Number(topicCount?.count) || 0,
        likesReceived: Number(likesReceived?.count) || 0,
        likesGiven: Number(likesGiven?.count) || 0,
        lastSeenAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  private getTrustLevelName(level: number | null): string {
    const levels = ['New User', 'Basic User', 'Member', 'Regular', 'Leader'];
    return levels[level ?? 0] || 'New User';
  }

  // Enhanced topic management with tags and permissions
  async getTopicsWithDetails(categoryId?: number, productId?: number, userId?: number): Promise<ForumTopicWithDetails[]> {
    // Build where conditions
    const conditions = [];
    if (categoryId) {
      conditions.push(eq(forumTopics.categoryId, categoryId));
    }
    if (productId) {
      conditions.push(eq(forumTopics.productId, productId));
    }

    const results = await db
      .select({
        topic: forumTopics,
        author: users,
        category: forumCategories
      })
      .from(forumTopics)
      .innerJoin(users, eq(forumTopics.authorId, users.id))
      .leftJoin(forumCategories, eq(forumTopics.categoryId, forumCategories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(forumTopics.lastPostAt));

    // Get tags for each topic
    const topicIds = results.map(r => r.topic.id);
    const tagsResult = await db
      .select({
        topicId: topicTagRelations.topicId,
        tag: topicTags
      })
      .from(topicTagRelations)
      .innerJoin(topicTags, eq(topicTagRelations.tagId, topicTags.id))
      .where(inArray(topicTagRelations.topicId, topicIds));

    const tagsByTopic = tagsResult.reduce((acc, item) => {
      if (!acc[item.topicId]) acc[item.topicId] = [];
      acc[item.topicId].push(item.tag);
      return acc;
    }, {} as Record<number, TopicTag[]>);

    return results.map(result => ({
      ...result.topic,
      author: {
        ...result.author,
        trustLevelName: this.getTrustLevelName(result.author?.trustLevel ?? null)
      } as UserWithProfile,
      category: result.category || undefined,
      tags: tagsByTopic[result.topic?.id] || [],
      userCanEdit: userId ? result.topic?.authorId === userId || result.author?.role === 'admin' : false,
      userCanDelete: userId ? result.author?.role === 'admin' || result.author?.role === 'moderator' : false
    }));
  }

  async createTopicWithTags(topicData: Omit<InsertForumTopic, 'slug'>, tags: string[]): Promise<ForumTopic> {
    const slug = this.generateSlug(topicData.title);

    return await db.transaction(async (tx) => {
      // Create topic
      const [topic] = await tx
        .insert(forumTopics)
        .values({ ...topicData, slug })
        .returning();

      // Handle tags with batch operations (fixes N+1 query pattern)
      if (tags.length > 0) {
        // 1. Batch fetch all existing tags (1 query instead of N)
        const existingTags = await tx
          .select()
          .from(topicTags)
          .where(inArray(topicTags.name, tags));

        const existingTagMap = new Map(existingTags.map(t => [t.name, t]));
        const newTagNames = tags.filter(name => !existingTagMap.has(name));

        // 2. Batch insert new tags (1 query instead of up to N)
        if (newTagNames.length > 0) {
          const insertedTags = await tx
            .insert(topicTags)
            .values(newTagNames.map(name => ({ name })))
            .onConflictDoNothing()
            .returning();

          // Add newly inserted tags to our map
          for (const tag of insertedTags) {
            existingTagMap.set(tag.name, tag);
          }
        }

        // 3. Collect all tag IDs for batch operations
        const tagIds = tags
          .map(name => existingTagMap.get(name)?.id)
          .filter((id): id is number => id !== undefined);

        // 4. Batch insert tag relations (1 query instead of N)
        if (tagIds.length > 0) {
          await tx
            .insert(topicTagRelations)
            .values(tagIds.map(tagId => ({ topicId: topic.id, tagId })))
            .onConflictDoNothing();

          // 5. Batch update usage counts (1 query instead of N)
          await tx
            .update(topicTags)
            .set({ usageCount: sql`${topicTags.usageCount} + 1` })
            .where(inArray(topicTags.id, tagIds));
        }
      }

      // Update user stats
      await this.updateUserStats(topicData.authorId);

      return topic;
    });
  }

  // Enhanced post management with likes, mentions, and revisions
  async getPostsWithDetails(topicId: number, userId?: number): Promise<ForumPostWithDetails[]> {
    const posts = await db
      .select({
        post: forumPosts,
        author: users
      })
      .from(forumPosts)
      .innerJoin(users, eq(forumPosts.authorId, users.id))
      .where(eq(forumPosts.topicId, topicId))
      .orderBy(asc(forumPosts.postNumber));

    // Get likes for all posts
    const postIds = posts.map(p => p.post.id);
    const likesResult = await db
      .select({
        postId: postLikes.postId,
        like: postLikes,
        user: users
      })
      .from(postLikes)
      .innerJoin(users, eq(postLikes.userId, users.id))
      .where(inArray(postLikes.postId, postIds));

    const likesByPost = likesResult.reduce((acc, item) => {
      if (!acc[item.postId]) acc[item.postId] = [];
      acc[item.postId].push({ ...item.like, user: item.user });
      return acc;
    }, {} as Record<number, (PostLike & { user: User })[]>);

    // Get mentions for all posts
    const mentionsResult = await db
      .select({
        postId: postMentions.postId,
        mention: postMentions,
        mentionedUser: users
      })
      .from(postMentions)
      .innerJoin(users, eq(postMentions.mentionedUserId, users.id))
      .where(inArray(postMentions.postId, postIds));

    const mentionsByPost = mentionsResult.reduce((acc, item) => {
      if (!acc[item.postId]) acc[item.postId] = [];
      acc[item.postId].push({ ...item.mention, mentionedUser: item.mentionedUser });
      return acc;
    }, {} as Record<number, (PostMention & { mentionedUser: User })[]>);

    return posts.map(result => ({
      ...result.post,
      author: {
        ...result.author,
        trustLevelName: this.getTrustLevelName(result.author.trustLevel)
      } as UserWithProfile,
      likes: likesByPost[result.post.id] || [],
      mentions: mentionsByPost[result.post.id] || [],
      userHasLiked: userId ? (likesByPost[result.post.id] || []).some(like => like.userId === userId) : false,
      userCanEdit: userId ? result.post.authorId === userId || result.author.role === 'admin' : false,
      userCanDelete: userId ? result.author.role === 'admin' || result.author.role === 'moderator' : false
    }));
  }

  async createPostWithMentions(postData: Omit<InsertForumPost, 'postNumber'>, mentions: string[] = []): Promise<ForumPost> {
    return await db.transaction(async (tx) => {
      // Get next post number for the topic
      const [result] = await tx
        .select({ maxNumber: sql<number>`COALESCE(MAX(${forumPosts.postNumber}), 0)` })
        .from(forumPosts)
        .where(eq(forumPosts.topicId, postData.topicId));

      const postNumber = Number(result?.maxNumber ?? 0) + 1;

      // Create post
      const [post] = await tx
        .insert(forumPosts)
        .values({
          ...postData,
          postNumber,
          rawContent: postData.content // Store raw content for editing
        })
        .returning();

      // Handle mentions
      if (mentions.length > 0) {
        const mentionedUsers = await tx
          .select({
            id: users.id,
            username: users.username,
            // SECURITY: Never expose passwordHash
          })
          .from(users)
          .where(inArray(users.username, mentions));

        for (const mentionedUser of mentionedUsers) {
          // Create mention record
          await tx
            .insert(postMentions)
            .values({
              postId: post.id,
              mentionedUserId: mentionedUser.id,
              mentioningUserId: postData.authorId
            });

          // Create notification
          await tx
            .insert(notifications)
            .values({
              userId: mentionedUser.id,
              type: 'mention',
              title: 'You were mentioned in a post',
              content: `@${mentionedUser.username} was mentioned in a discussion`,
              relatedPostId: post.id,
              relatedUserId: postData.authorId
            });
        }
      }

      // Update topic stats
      await tx
        .update(forumTopics)
        .set({
          postCount: sql`${forumTopics.postCount} + 1`,
          lastPostAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(forumTopics.id, postData.topicId));

      // Update user stats
      await this.updateUserStats(postData.authorId);

      return post;
    });
  }

  // Like system
  async togglePostLike(postId: number, userId: number): Promise<{ liked: boolean; likeCount: number }> {
    return await db.transaction(async (tx) => {
      // Check if already liked
      const [existing] = await tx
        .select()
        .from(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
        .limit(1);

      let liked: boolean;

      if (existing) {
        // Remove like
        await tx
          .delete(postLikes)
          .where(eq(postLikes.id, existing.id));
        liked = false;
      } else {
        // Add like
        await tx
          .insert(postLikes)
          .values({ postId, userId });
        liked = true;

        // Create notification for post author
        const [post] = await tx
          .select({ authorId: forumPosts.authorId })
          .from(forumPosts)
          .where(eq(forumPosts.id, postId))
          .limit(1);

        if (post && post.authorId !== userId) {
          await tx
            .insert(notifications)
            .values({
              userId: post.authorId,
              type: 'like',
              title: 'Someone liked your post',
              content: 'Your post received a like',
              relatedPostId: postId,
              relatedUserId: userId
            });
        }
      }

      // Update like count on post
      const [likeCount] = await tx
        .select({ count: count() })
        .from(postLikes)
        .where(eq(postLikes.postId, postId));

      await tx
        .update(forumPosts)
        .set({ likeCount: likeCount?.count || 0 })
        .where(eq(forumPosts.id, postId));

      return { liked, likeCount: likeCount?.count || 0 };
    });
  }

  // Notification system
  async getUserNotifications(userId: number, unreadOnly = false): Promise<NotificationWithDetails[]> {
    const conditions = [eq(notifications.userId, userId)];

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const results = await db
      .select({
        notification: notifications,
        relatedUser: users,
        relatedPost: forumPosts,
        relatedTopic: forumTopics
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.relatedUserId, users.id))
      .leftJoin(forumPosts, eq(notifications.relatedPostId, forumPosts.id))
      .leftJoin(forumTopics, eq(notifications.relatedTopicId, forumTopics.id))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));

    return results.map(result => ({
      ...result.notification,
      relatedUser: result.relatedUser || undefined,
      relatedPost: result.relatedPost || undefined,
      relatedTopic: result.relatedTopic || undefined
    }));
  }

  async markNotificationsAsRead(userId: number, notificationIds?: number[]): Promise<void> {
    const conditions = [eq(notifications.userId, userId)];

    if (notificationIds?.length) {
      conditions.push(inArray(notifications.id, notificationIds));
    }

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(...conditions));
  }

  // Private messaging
  async createPrivateMessage(messageData: InsertPrivateMessage): Promise<PrivateMessage> {
    const [message] = await db
      .insert(privateMessages)
      .values(messageData)
      .returning();

    // Create notification for recipient
    await db
      .insert(notifications)
      .values({
        userId: messageData.recipientId,
        type: 'private_message',
        title: 'New private message',
        content: messageData.subject,
        relatedUserId: messageData.senderId
      });

    return message;
  }

  async getUserPrivateMessages(userId: number): Promise<PrivateMessageWithUsers[]> {
    const messages = await db
      .select({
        message: privateMessages,
        sender: users,
        recipient: users
      })
      .from(privateMessages)
      .innerJoin(users, eq(privateMessages.senderId, users.id))
      .innerJoin(users, eq(privateMessages.recipientId, users.id))
      .where(or(eq(privateMessages.senderId, userId), eq(privateMessages.recipientId, userId)))
      .orderBy(desc(privateMessages.createdAt));

    return messages.map(result => ({
      ...result.message,
      sender: result.sender,
      recipient: result.recipient
    }));
  }

  // Tag management
  async getPopularTags(limit = 20): Promise<TopicTag[]> {
    return await db
      .select()
      .from(topicTags)
      .orderBy(desc(topicTags.usageCount))
      .limit(limit);
  }

  async searchTags(query: string): Promise<TopicTag[]> {
    return await db
      .select()
      .from(topicTags)
      .where(ilike(topicTags.name, `%${query}%`))
      .orderBy(desc(topicTags.usageCount))
      .limit(10);
  }

  // Badge system
  async awardBadge(userId: number, badgeId: number): Promise<UserBadge> {
    // Check if user already has this badge
    const [existing] = await db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [userBadge] = await db
      .insert(userBadges)
      .values({ userId, badgeId })
      .returning();

    // Create notification
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, badgeId))
      .limit(1);

    if (badge) {
      await db
        .insert(notifications)
        .values({
          userId,
          type: 'badge',
          title: 'Badge earned!',
          content: `You earned the "${badge.name}" badge!`
        });
    }

    return userBadge;
  }

  // Search functionality
  async searchPosts(query: string, categoryId?: number): Promise<ForumPostWithDetails[]> {
    const conditions = [ilike(forumPosts.content, `%${query}%`)];

    if (categoryId) {
      conditions.push(eq(forumTopics.categoryId, categoryId));
    }

    const results = await db
      .select({
        post: forumPosts,
        author: users,
        topic: forumTopics,
        category: forumCategories
      })
      .from(forumPosts)
      .innerJoin(users, eq(forumPosts.authorId, users.id))
      .innerJoin(forumTopics, eq(forumPosts.topicId, forumTopics.id))
      .leftJoin(forumCategories, eq(forumTopics.categoryId, forumCategories.id))
      .where(and(...conditions))
      .orderBy(desc(forumPosts.createdAt));

    return results.map((result) => ({
      ...result.post,
      author: {
        ...result.author,
        trustLevelName: this.getTrustLevelName(result.author?.trustLevel ?? null)
      } as UserWithProfile,
      likes: [],
      userCanEdit: false,
      userCanDelete: false
    }));
  }

  // Utility methods
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Initialize default badges
  async initializeDefaultBadges(): Promise<void> {
    const defaultBadges = [
      {
        name: 'First Post',
        description: 'Made your first post',
        icon: 'MessageSquare',
        color: '#10b981',
        type: 'bronze'
      },
      {
        name: 'Popular Post',
        description: 'Received 10+ likes on a post',
        icon: 'Heart',
        color: '#f59e0b',
        type: 'silver'
      },
      {
        name: 'Helpful',
        description: 'Received 50+ likes total',
        icon: 'Award',
        color: '#3b82f6',
        type: 'gold'
      },
      {
        name: 'Regular',
        description: 'Visited 50+ days',
        icon: 'Calendar',
        color: '#8b5cf6',
        type: 'gold'
      }
    ];

    for (const badge of defaultBadges) {
      const existing = await db
        .select()
        .from(badges)
        .where(eq(badges.name, badge.name))
        .limit(1);

      if (!existing.length) {
        await db.insert(badges).values(badge);
      }
    }
  }
}

export const enhancedForumStorage = new EnhancedForumStorage();