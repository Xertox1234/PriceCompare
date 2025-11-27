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
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
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
        sendError(res, "User not found", 404);
        return;
      }

      sendSuccess(res, userProfile);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetUserProfile');
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
      sendSuccess(res, updatedProfile);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'UpdateUserProfile');
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
      sendSuccess(res, topics);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetEnhancedTopics');
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

      sendSuccess(res, topic, 201);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CreateEnhancedTopic');
    }
  });

  // Enhanced post routes with mentions and likes
  app.get("/api/forum/topics/:id/posts/enhanced", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const topicId = parseIntSafe(req.params.id, 'topicId', { min: 1 });
      const userId = req.user?.id;

      const posts = await enhancedForumStorage.getPostsWithDetails(topicId, userId);
      sendSuccess(res, posts);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetEnhancedPosts');
    }
  });

  app.post("/api/forum/posts/enhanced", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate with both the shared schema and our enhanced schema for mentions
      const baseValidation = validateRequestBody(insertForumPostSchema, req.body);
      if (!baseValidation.success) {
        sendError(res, baseValidation.errors, 400);
        return;
      }

      // Validate mentions array specifically
      const enhancedValidation = createEnhancedPostSchema.safeParse(req.body);
      if (!enhancedValidation.success) {
        const errorMessages = enhancedValidation.error.issues
          .map((e: { message: string }) => e.message)
          .join('; ');
        sendError(res, errorMessages, 400);
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

      sendSuccess(res, post, 201);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CreateEnhancedPost');
    }
  });

  // Post like system
  app.post("/api/forum/posts/:id/like", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const postId = parseIntSafe(req.params.id, 'postId', { min: 1 });
      const result = await enhancedForumStorage.togglePostLike(postId, req.user!.id);
      sendSuccess(res, result);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'TogglePostLike');
    }
  });

  // Notification system
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await enhancedForumStorage.getUserNotifications(req.user!.id, unreadOnly);
      sendSuccess(res, notifications);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetNotifications');
    }
  });

  app.put("/api/notifications/mark-read", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = markNotificationsReadSchema.parse(req.body);
      await enhancedForumStorage.markNotificationsAsRead(req.user!.id, validatedData.notificationIds);
      sendSuccess(res, {});
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'MarkNotificationsRead');
    }
  });

  // Private messaging
  app.get("/api/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const messages = await enhancedForumStorage.getUserPrivateMessages(req.user!.id);
      sendSuccess(res, messages);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetPrivateMessages');
    }
  });

  app.post("/api/messages", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      const validation = validateRequestBody(insertPrivateMessageSchema, req.body);
      if (!validation.success) {
        sendError(res, validation.errors, 400);
        return;
      }

      const message = await enhancedForumStorage.createPrivateMessage({
        ...req.body,
        senderId: req.user!.id
      });

      sendSuccess(res, message, 201);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CreatePrivateMessage');
    }
  });

  // Tag system
  app.get("/api/forum/tags", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation and cap
      const limit = req.query.limit ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 }) : 20;
      const tags = await enhancedForumStorage.getPopularTags(limit);
      sendSuccess(res, tags);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetPopularTags');
    }
  });

  app.get("/api/forum/tags/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        sendError(res, "Search query required", 400);
        return;
      }

      const tags = await enhancedForumStorage.searchTags(query);
      sendSuccess(res, tags);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'SearchTags');
    }
  });

  // Badge system
  app.post("/api/users/:id/badges", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      // Only admins can award badges
      if (req.user!.role !== 'admin') {
        sendError(res, "Admin access required", 403);
        return;
      }

      // SECURITY: Safe integer parsing with validation
      const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
      const validatedData = awardBadgeSchema.parse(req.body);

      const userBadge = await enhancedForumStorage.awardBadge(userId, validatedData.badgeId);
      sendSuccess(res, userBadge, 201);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'AwardBadge');
    }
  });

  // Search functionality
  app.get("/api/forum/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      // SECURITY: Safe optional integer parsing with validation
      const categoryId = parseIntOptional(req.query.categoryId as string, 'categoryId', { min: 1 });

      if (!query) {
        sendError(res, "Search query required", 400);
        return;
      }

      const posts = await enhancedForumStorage.searchPosts(query, categoryId);
      sendSuccess(res, posts);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'SearchPosts');
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
      sendSuccess(res, { message: "Leaderboard functionality coming soon" });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetLeaderboard');
    }
  });

  // Trust level management (admin only)
  app.put("/api/users/:id/trust-level", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.user!.role !== 'admin') {
        sendError(res, "Admin access required", 403);
        return;
      }

      // SECURITY: Safe integer parsing with validation
      const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
      const validatedData = updateTrustLevelSchema.parse(req.body);

      await storage.updateUserTrustLevel(userId, validatedData.trustLevel);
      const updatedUser = await enhancedForumStorage.getUserWithProfile(userId);

      sendSuccess(res, updatedUser);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'UpdateTrustLevel');
    }
  });

  // User moderation (admin/moderator only)
  app.put("/api/users/:id/suspend", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!['admin', 'moderator'].includes(req.user!.role ?? '')) {
        sendError(res, "Moderator access required", 403);
        return;
      }

      // SECURITY: Safe integer parsing with validation
      const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
      const validatedData = suspendUserSchema.parse(req.body);

      // UX: Storage layer handles transaction for suspension + notification atomically
      await storage.suspendUser(userId, validatedData.reason || 'Your account has been suspended', req.user!.id);

      sendSuccess(res, {});
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'SuspendUser');
    }
  });

  // Initialize default badges on startup
  app.post("/api/admin/initialize-badges", csrfProtection, requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.user!.role !== 'admin') {
        sendError(res, "Admin access required", 403);
        return;
      }

      await enhancedForumStorage.initializeDefaultBadges();
      sendSuccess(res, { message: "Default badges initialized" });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'InitializeBadges');
    }
  });
}