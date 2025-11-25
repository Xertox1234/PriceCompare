import { Express } from "express";
import { storage, forumStorage } from "../storage";
import { withAuth } from "./helpers";
import { parseIntOptional, parseIntSafe } from "../utils/validation-helpers";
import { logger } from "../utils/logger";
import { createErrorResponse } from "../utils/error-sanitizer";
import { csrfProtection } from "../middleware/security";

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
      res.json(categories);
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'GetForumCategories');
      res.status(errorResponse.status).json({ error: errorResponse.error });
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
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch topics";
      res.status(400).json({ error: message });
    }
  });

  // Get a specific topic by ID
  app.get("/api/forum/topics/:id", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const topicId = parseIntSafe(req.params.id, 'topicId', { min: 1 });
      const topic = await forumStorage.getTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      res.json(topic);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch topic";
      const status = message.includes('must be') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  // Get all posts for a topic
  app.get("/api/forum/topics/:id/posts", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const topicId = parseIntSafe(req.params.id, 'topicId', { min: 1 });
      const posts = await forumStorage.getPostsByTopic(topicId);
      res.json(posts);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch posts";
      const status = message.includes('must be') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  // Create a new forum topic
  app.post("/api/forum/topics", csrfProtection, withAuth(async (req, res) => {
    try {
      // SECURITY: Removed request body logging (may contain user content)

      const { title, content, categoryId, productId } = req.body;
      const user = req.user;

      if (!title || title.trim() === '') {
        return res.status(400).json({ error: "Title is required" });
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

      res.json({ success: true, topic: result.topic });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'CreateForumTopic');
      res.status(errorResponse.status).json({ error: errorResponse.error });
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
      const result = await forumStorage.createForumPost(topicId, user.id, sanitizedContent, content);

      res.json({ success: true, post: result.post });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'CreateForumPost');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));
}
