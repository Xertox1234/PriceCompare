import { Express } from "express";
import { forumStorage } from "../forum-storage";
import { storage } from "../storage";
import { withAuth, handleRouteError, notFound } from "./helpers";
import { parseIntOptional, parseIntSafe } from "../utils/validation-helpers";
import { logger } from "../utils/logger";
import { csrfProtection } from "../middleware/security";
import { sendSuccess, sendError, sendErrorFromException } from "../utils/api-response";

/**
 * Forum Routes
 *
 * Handles forum categories, topics, and posts functionality.
 */
export function registerForumRoutes(app: Express): void {
  // Get all forum categories
  app.get("/api/forum/categories", async (req, res) => {
    try {
      const categories = await forumStorage.getCategories();
      sendSuccess(res, categories);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetForumCategories');
    }
  });

  // Get topics (optionally filtered by category or product) with pagination
  app.get("/api/forum/topics", async (req, res) => {
    try {
      const { categoryId, productId, page, limit } = req.query;
      // SECURITY: Safe integer parsing with validation
      const result = await forumStorage.getTopics(
        parseIntOptional(categoryId as string, 'categoryId', { min: 1 }),
        parseIntOptional(productId as string, 'productId', { min: 1 }),
        parseIntOptional(page as string, 'page', { min: 1 }) ?? 1,
        parseIntOptional(limit as string, 'limit', { min: 1, max: 100 }) ?? 50
      );
      sendSuccess(res, result);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetForumTopics');
    }
  });

  // Get a specific topic by ID
  app.get("/api/forum/topics/:id", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const topicId = parseIntSafe(req.params.id, 'topicId', { min: 1 });
      const topic = await forumStorage.getTopicById(topicId);
      if (!topic) {
        sendError(res, 'Topic not found', 404);
        return;
      }
      sendSuccess(res, topic);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetForumTopic');
    }
  });

  // Get all posts for a topic
  app.get("/api/forum/topics/:id/posts", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const topicId = parseIntSafe(req.params.id, 'topicId', { min: 1 });
      const posts = await forumStorage.getPostsByTopic(topicId);
      sendSuccess(res, posts);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetTopicPosts');
    }
  });

  // Create a new forum topic
  app.post("/api/forum/topics", csrfProtection, withAuth(async (req, res) => {
    try {
      // SECURITY: Removed request body logging (may contain user content)

      const { title, content, categoryId, productId } = req.body;
      const user = req.user;

      if (!title || title.trim() === '') {
        sendError(res, "Title is required", 400);
        return;
      }

      // DATA INTEGRITY: Use storage layer which handles transaction atomically
      const result = await storage.createTopicWithFirstPost(
        {
          title,
          authorId: user.id,
          categoryId: categoryId || null,
          productId: productId || null,
        },
        content || ''
      );

      logger.info("Topic created", { topicId: result.topic.id, title: result.topic.title });

      sendSuccess(res, result.topic, 201);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CreateForumTopic');
    }
  }));

  // Create a new post in a topic
  app.post("/api/forum/posts", csrfProtection, withAuth(async (req, res) => {
    try {
      const { topicId, content } = req.body;
      const user = req.user;

      // SECURITY: Sanitize forum post content with DOMPurify
      const { sanitizeForumPost } = require('../utils/sanitization');
      const { html: sanitizedContent } = sanitizeForumPost(content);

      // RACE CONDITION: Storage layer handles SERIALIZABLE transaction with retry
      const result = await storage.createForumPost(topicId, user.id, sanitizedContent, content);

      sendSuccess(res, result.post, 201);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CreateForumPost');
    }
  }));
}
