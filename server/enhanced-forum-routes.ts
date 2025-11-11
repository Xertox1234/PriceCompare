import type { Express } from "express";
import { requireAuth } from './auth';
import { enhancedForumStorage } from "./enhanced-forum-storage";
import { storage } from "./storage";
import { validateRequestBody } from "./validation";
import {
  insertForumTopicSchema, insertForumPostSchema, insertPrivateMessageSchema,
  insertNotificationSchema, insertTopicTagSchema, insertBadgeSchema,
  users, notifications
} from "@shared/schema";
import { z } from "zod";
import type { AuthenticatedRequest } from "@shared/types";
import { db } from "./db";
import { eq } from "drizzle-orm";

export function registerEnhancedForumRoutes(app: Express) {
  // Enhanced user profile routes
  app.get("/api/users/:id/profile", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const userProfile = await enhancedForumStorage.getUserWithProfile(userId);
      
      if (!userProfile) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(userProfile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  app.put("/api/users/profile", requireAuth, async (req: any, res: any) => {
    try {
      const { bio, location, website, avatarUrl } = req.body;

      // Update user profile
      await db.update(users)
        .set({
          bio,
          location,
          website,
          avatarUrl,
          updatedAt: new Date()
        })
        .where(eq(users.id, req.user.id));

      const updatedProfile = await enhancedForumStorage.getUserWithProfile(req.user.id);
      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Enhanced topic routes with tags
  app.get("/api/forum/topics/enhanced", async (req, res) => {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
      const userId = req.user?.id;

      const topics = await enhancedForumStorage.getTopicsWithDetails(categoryId, productId, userId);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching enhanced topics:", error);
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  app.post("/api/forum/topics/enhanced", requireAuth, async (req: any, res: any) => {
    try {
      // SECURITY: Removed request body logging (may contain user content)

      // Basic validation - just check required fields manually
      if (!req.body.title || req.body.title.trim() === '') {
        return res.status(400).json({ error: ["Title is required"] });
      }
      
      if (!req.body.categoryId || isNaN(parseInt(req.body.categoryId))) {
        return res.status(400).json({ error: ["Category ID is required"] });
      }

      const { tags = [], title, content, categoryId } = req.body;
      const topicData = {
        title: title.trim(),
        content: content || '',
        categoryId: parseInt(categoryId)
      };
      
      const topic = await enhancedForumStorage.createTopicWithTags(
        {
          ...topicData,
          authorId: req.user.id
        },
        tags
      );

      res.status(201).json(topic);
    } catch (error) {
      console.error("Error creating enhanced topic:", error);
      res.status(500).json({ error: "Failed to create topic" });
    }
  });

  // Enhanced post routes with mentions and likes
  app.get("/api/forum/topics/:id/posts/enhanced", async (req, res) => {
    try {
      const topicId = parseInt(req.params.id);
      const userId = req.user?.id;

      const posts = await enhancedForumStorage.getPostsWithDetails(topicId, userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching enhanced posts:", error);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.post("/api/forum/posts/enhanced", requireAuth, async (req: any, res: any) => {
    try {
      const validation = validateRequestBody(insertForumPostSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.errors });
      }

      const { mentions = [], ...postData } = req.body;
      
      const post = await enhancedForumStorage.createPostWithMentions(
        {
          ...postData,
          authorId: req.user.id
        },
        mentions
      );

      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating enhanced post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // Post like system
  app.post("/api/forum/posts/:id/like", requireAuth, async (req: any, res: any) => {
    try {
      const postId = parseInt(req.params.id);
      const result = await enhancedForumStorage.togglePostLike(postId, req.user.id);
      res.json(result);
    } catch (error) {
      console.error("Error toggling post like:", error);
      res.status(500).json({ error: "Failed to toggle like" });
    }
  });

  // Notification system
  app.get("/api/notifications", requireAuth, async (req: any, res: any) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await enhancedForumStorage.getUserNotifications(req.user.id, unreadOnly);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.put("/api/notifications/mark-read", requireAuth, async (req: any, res: any) => {
    try {
      const { notificationIds } = req.body;
      await enhancedForumStorage.markNotificationsAsRead(req.user.id, notificationIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });

  // Private messaging
  app.get("/api/messages", requireAuth, async (req: any, res: any) => {
    try {
      const messages = await enhancedForumStorage.getUserPrivateMessages(req.user.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching private messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", requireAuth, async (req: any, res: any) => {
    try {
      const validation = validateRequestBody(insertPrivateMessageSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.errors });
      }

      const message = await enhancedForumStorage.createPrivateMessage({
        ...req.body,
        senderId: req.user.id
      });

      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating private message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // Tag system
  app.get("/api/forum/tags", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const tags = await enhancedForumStorage.getPopularTags(limit);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.get("/api/forum/tags/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }

      const tags = await enhancedForumStorage.searchTags(query);
      res.json(tags);
    } catch (error) {
      console.error("Error searching tags:", error);
      res.status(500).json({ error: "Failed to search tags" });
    }
  });

  // Badge system
  app.post("/api/users/:id/badges", requireAuth, async (req: any, res: any) => {
    try {
      // Only admins can award badges
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const userId = parseInt(req.params.id);
      const { badgeId } = req.body;

      const userBadge = await enhancedForumStorage.awardBadge(userId, badgeId);
      res.status(201).json(userBadge);
    } catch (error) {
      console.error("Error awarding badge:", error);
      res.status(500).json({ error: "Failed to award badge" });
    }
  });

  // Search functionality
  app.get("/api/forum/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;

      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }

      const posts = await enhancedForumStorage.searchPosts(query, categoryId);
      res.json(posts);
    } catch (error) {
      console.error("Error searching posts:", error);
      res.status(500).json({ error: "Failed to search posts" });
    }
  });

  // User statistics and leaderboard
  app.get("/api/forum/leaderboard", async (req, res) => {
    try {
      const type = req.query.type as string || 'reputation';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      // This would require additional storage methods for leaderboard queries
      // For now, return a simple response
      res.json({ message: "Leaderboard functionality coming soon" });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Trust level management (admin only)
  app.put("/api/users/:id/trust-level", requireAuth, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const userId = parseInt(req.params.id);
      const { trustLevel } = req.body;

      if (trustLevel < 0 || trustLevel > 4) {
        return res.status(400).json({ error: "Trust level must be between 0 and 4" });
      }

      await db.update(users)
        .set({ trustLevel, updatedAt: new Date() })
        .where(eq(users.id, userId));
      const updatedUser = await enhancedForumStorage.getUserWithProfile(userId);
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating trust level:", error);
      res.status(500).json({ error: "Failed to update trust level" });
    }
  });

  // User moderation (admin/moderator only)
  app.put("/api/users/:id/suspend", requireAuth, async (req: any, res: any) => {
    try {
      if (!['admin', 'moderator'].includes(req.user.role)) {
        return res.status(403).json({ error: "Moderator access required" });
      }

      const userId = parseInt(req.params.id);
      const { reason } = req.body;

      await db.update(users)
        .set({ isSuspended: true, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Create notification
      await db.insert(notifications).values({
        userId,
        type: 'moderation',
        title: 'Account suspended',
        content: reason || 'Your account has been suspended',
        relatedUserId: req.user.id
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error suspending user:", error);
      res.status(500).json({ error: "Failed to suspend user" });
    }
  });

  // Initialize default badges on startup
  app.post("/api/admin/initialize-badges", requireAuth, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      await enhancedForumStorage.initializeDefaultBadges();
      res.json({ success: true, message: "Default badges initialized" });
    } catch (error) {
      console.error("Error initializing badges:", error);
      res.status(500).json({ error: "Failed to initialize badges" });
    }
  });
}