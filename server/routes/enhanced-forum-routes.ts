import type { Express, Request, Response } from "express";
import { requireAuth } from '../auth';
import { enhancedForumStorage } from "../enhanced-forum-storage";
import { storage } from "../storage";
import { validateRequestBody } from "../validation";
import { logger } from "../utils/logger";
import {
  insertForumTopicSchema, insertForumPostSchema, insertPrivateMessageSchema,
  insertNotificationSchema, insertTopicTagSchema, insertBadgeSchema,
} from "@shared/schema";
import { z } from "zod";
import type { AuthenticatedRequest } from "@shared/types";
import { parseIntSafe, parseIntOptional } from '../utils/validation-helpers';
import { createErrorResponse } from '../utils/error-sanitizer';
import { csrfProtection } from "../middleware/security";

// Validation schemas for enhanced forum routes
const updateProfileSchema = z.object({
  bio: z.string().max(1000, 'Bio must be 1000 characters or less').optional().nullable(),
  location: z.string().max(100, 'Location must be 100 characters or less').optional().nullable(),
  website: z.string().url('Website must be a valid URL').optional().nullable().or(z.literal('')),
  avatarUrl: z.string().url('Avatar URL must be a valid URL').optional().nullable().or(z.literal('')),
});

const createEnhancedTopicSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less').transform(s => s.trim()),
  content: z.string().optional().default(''),
  categoryId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  tags: z.array(z.string().max(50)).max(10, 'Maximum 10 tags allowed').optional().default([]),
});

const createEnhancedPostSchema = z.object({
  topicId: z.number().int().positive(),
  content: z.string().optional(),
  rawContent: z.string().optional(),
  mentions: z.array(z.string()).max(20, 'Maximum 20 mentions allowed').optional().default([]),
});

const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.number().int().positive()).min(1, 'At least one notification ID required'),
});

const awardBadgeSchema = z.object({
  badgeId: z.number().int().positive('Badge ID must be a positive integer'),
});

const updateTrustLevelSchema = z.object({
  trustLevel: z.number().int().min(0, 'Trust level must be at least 0').max(4, 'Trust level must be at most 4'),
});

const suspendUserSchema = z.object({
  reason: z.string().max(500, 'Reason must be 500 characters or less').optional(),
});

export function registerEnhancedForumRoutes(app: Express) {
  // Enhanced user profile routes
  app.get("/api/users/:id/profile", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
      const userProfile = await enhancedForumStorage.getUserWithProfile(userId);
      
      if (!userProfile) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json(userProfile);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetUserProfile');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  app.put("/api/users/profile", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = updateProfileSchema.parse(req.body);

      // Update user profile via storage layer
      await storage.updateUserProfile(req.user!.id, {
        bio: validatedData.bio ?? undefined,
        location: validatedData.location ?? undefined,
        website: validatedData.website || undefined,
        avatarUrl: validatedData.avatarUrl || undefined,
      });

      const updatedProfile = await enhancedForumStorage.getUserWithProfile(req.user!.id);
      res.json(updatedProfile);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'UpdateUserProfile');
      res.status(errorResponse.status).json({ error: errorResponse.error, details: errorResponse.details });
    }
  });

  // Enhanced topic routes with tags
  app.get("/api/forum/topics/enhanced", async (req, res) => {
    try {
      // SECURITY: Safe optional integer parsing with validation
      const categoryId = parseIntOptional(req.query.categoryId as string, 'categoryId', { min: 1 });
      const productId = parseIntOptional(req.query.productId as string, 'productId', { min: 1 });
      const userId = req.user?.id;

      const topics = await enhancedForumStorage.getTopicsWithDetails(categoryId, productId, userId);
      res.json(topics);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetEnhancedTopics');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  app.post("/api/forum/topics/enhanced", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod schema
      const validatedData = createEnhancedTopicSchema.parse(req.body);

      const topicData = {
        title: validatedData.title,
        content: validatedData.content,
        categoryId: validatedData.categoryId
      };

      const topic = await enhancedForumStorage.createTopicWithTags(
        {
          ...topicData,
          authorId: req.user!.id
        },
        validatedData.tags
      );

      res.status(201).json(topic);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'CreateEnhancedTopic');
      res.status(errorResponse.status).json({ error: errorResponse.error, details: errorResponse.details });
    }
  });

  // Enhanced post routes with mentions and likes
  app.get("/api/forum/topics/:id/posts/enhanced", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const topicId = parseIntSafe(req.params.id, 'topicId', { min: 1 });
      const userId = req.user?.id;

      const posts = await enhancedForumStorage.getPostsWithDetails(topicId, userId);
      res.json(posts);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetEnhancedPosts');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  app.post("/api/forum/posts/enhanced", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate with both the shared schema and our enhanced schema for mentions
      const baseValidation = validateRequestBody(insertForumPostSchema, req.body);
      if (!baseValidation.success) {
        res.status(400).json({ error: baseValidation.errors });
        return;
      }

      // Validate mentions array specifically
      const enhancedValidation = createEnhancedPostSchema.safeParse(req.body);
      if (!enhancedValidation.success) {
        res.status(400).json({
          error: enhancedValidation.error.issues.map((e: { message: string }) => e.message),
          details: enhancedValidation.error.issues,
        });
        return;
      }

      const { mentions, content, rawContent, ...postData } = enhancedValidation.data;

      // SECURITY: Sanitize forum post content with DOMPurify
      const { sanitizeForumPost } = require('./utils/sanitization');
      const { html: sanitizedContent } = sanitizeForumPost(content || rawContent);

      const post = await enhancedForumStorage.createPostWithMentions(
        {
          ...postData,
          content: sanitizedContent, // Sanitized HTML
          rawContent: rawContent || content || '', // Original for editing
          authorId: req.user!.id
        },
        mentions
      );

      res.status(201).json(post);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'CreateEnhancedPost');
      res.status(errorResponse.status).json({ error: errorResponse.error, details: errorResponse.details });
    }
  });

  // Post like system
  app.post("/api/forum/posts/:id/like", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const postId = parseIntSafe(req.params.id, 'postId', { min: 1 });
      const result = await enhancedForumStorage.togglePostLike(postId, req.user!.id);
      res.json(result);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'TogglePostLike');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  // Notification system
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await enhancedForumStorage.getUserNotifications(req.user!.id, unreadOnly);
      res.json(notifications);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetNotifications');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  app.put("/api/notifications/mark-read", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = markNotificationsReadSchema.parse(req.body);
      await enhancedForumStorage.markNotificationsAsRead(req.user!.id, validatedData.notificationIds);
      res.json({ success: true });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'MarkNotificationsRead');
      res.status(errorResponse.status).json({ error: errorResponse.error, details: errorResponse.details });
    }
  });

  // Private messaging
  app.get("/api/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const messages = await enhancedForumStorage.getUserPrivateMessages(req.user!.id);
      res.json(messages);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetPrivateMessages');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  app.post("/api/messages", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      const validation = validateRequestBody(insertPrivateMessageSchema, req.body);
      if (!validation.success) {
        res.status(400).json({ error: validation.errors });
        return;
      }

      const message = await enhancedForumStorage.createPrivateMessage({
        ...req.body,
        senderId: req.user!.id
      });

      res.status(201).json(message);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'CreatePrivateMessage');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  // Tag system
  app.get("/api/forum/tags", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation and cap
      const limit = req.query.limit ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 }) : 20;
      const tags = await enhancedForumStorage.getPopularTags(limit);
      res.json(tags);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetPopularTags');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  app.get("/api/forum/tags/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        res.status(400).json({ error: "Search query required" });
        return;
      }

      const tags = await enhancedForumStorage.searchTags(query);
      res.json(tags);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'SearchTags');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  // Badge system
  app.post("/api/users/:id/badges", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      // Only admins can award badges
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: "Admin access required" });
        return;
      }

      // SECURITY: Safe integer parsing with validation
      const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
      const validatedData = awardBadgeSchema.parse(req.body);

      const userBadge = await enhancedForumStorage.awardBadge(userId, validatedData.badgeId);
      res.status(201).json(userBadge);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'AwardBadge');
      res.status(errorResponse.status).json({ error: errorResponse.error, details: errorResponse.details });
    }
  });

  // Search functionality
  app.get("/api/forum/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      // SECURITY: Safe optional integer parsing with validation
      const categoryId = parseIntOptional(req.query.categoryId as string, 'categoryId', { min: 1 });

      if (!query) {
        res.status(400).json({ error: "Search query required" });
        return;
      }

      const posts = await enhancedForumStorage.searchPosts(query, categoryId);
      res.json(posts);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'SearchPosts');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  // User statistics and leaderboard
  app.get("/api/forum/leaderboard", async (req, res) => {
    try {
      const type = req.query.type as string || 'reputation';
      // SECURITY: Safe integer parsing with validation and cap
      const limit = req.query.limit ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 }) : 10;

      // This would require additional storage methods for leaderboard queries
      // For now, return a simple response
      res.json({ message: "Leaderboard functionality coming soon" });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetLeaderboard');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  // Trust level management (admin only)
  app.put("/api/users/:id/trust-level", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: "Admin access required" });
        return;
      }

      // SECURITY: Safe integer parsing with validation
      const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
      const validatedData = updateTrustLevelSchema.parse(req.body);

      await storage.updateUserTrustLevel(userId, validatedData.trustLevel);
      const updatedUser = await enhancedForumStorage.getUserWithProfile(userId);

      res.json(updatedUser);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'UpdateTrustLevel');
      res.status(errorResponse.status).json({ error: errorResponse.error, details: errorResponse.details });
    }
  });

  // User moderation (admin/moderator only)
  app.put("/api/users/:id/suspend", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!['admin', 'moderator'].includes(req.user!.role ?? '')) {
        res.status(403).json({ error: "Moderator access required" });
        return;
      }

      // SECURITY: Safe integer parsing with validation
      const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
      const validatedData = suspendUserSchema.parse(req.body);

      // UX: Storage layer handles transaction for suspension + notification atomically
      await storage.suspendUser(userId, validatedData.reason || 'Your account has been suspended', req.user!.id);

      res.json({ success: true });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'SuspendUser');
      res.status(errorResponse.status).json({ error: errorResponse.error, details: errorResponse.details });
    }
  });

  // Initialize default badges on startup
  app.post("/api/admin/initialize-badges", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: "Admin access required" });
        return;
      }

      await enhancedForumStorage.initializeDefaultBadges();
      res.json({ success: true, message: "Default badges initialized" });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'InitializeBadges');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });
}