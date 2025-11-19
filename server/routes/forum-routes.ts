import { Express } from "express";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { ForumTopic, ForumPost } from "@shared/schema";
import { forumStorage } from "../forum-storage";
import { withAuth } from "./helpers";
import { parseIntOptional, parseIntSafe } from "../utils/validation-helpers";
import { logger } from "../utils/logger";

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
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Get topics (optionally filtered by category or product)
  app.get("/api/forum/topics", async (req, res) => {
    try {
      const { categoryId, productId } = req.query;
      // SECURITY: Safe integer parsing with validation
      const topics = await forumStorage.getTopics(
        parseIntOptional(categoryId as string, 'categoryId', { min: 1 }),
        parseIntOptional(productId as string, 'productId', { min: 1 })
      );
      res.json(topics);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch posts";
      const status = message.includes('must be') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  // Create a new forum topic
  app.post("/api/forum/topics", withAuth(async (req, res) => {
    try {
      // SECURITY: Removed request body logging (may contain user content)

      const { title, content, categoryId, productId } = req.body;
      const user = req.user;

      if (!title || title.trim() === '') {
        return res.status(400).json({ error: "Title is required" });
      }

      // DATA INTEGRITY: Use transaction to ensure topic and first post are created atomically
      // If first post creation fails, topic should not exist (violates business logic)
      let topic: ForumTopic;
      await db.transaction(async (tx) => {
        // Create the topic (forumStorage.createTopic uses db directly, need to reimplement here)
        // Generate slug from title
        let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check for existing slug and append random suffix if needed
        const existing = await tx.select().from(schema.forumTopics).where(eq(schema.forumTopics.slug, slug)).limit(1);
        if (existing.length > 0) {
          const crypto = await import('crypto');
          slug = `${slug}-${crypto.randomBytes(4).toString('hex')}`;
        }

        const topicResult = await tx.insert(schema.forumTopics).values({
          title,
          authorId: user.id,
          categoryId: categoryId || null,
          productId: productId || null,
          slug,
        }).returning();
        topic = topicResult[0];

        logger.info("Topic created", { topicId: topic.id, title: topic.title });

        // Create the first post - must succeed or rollback topic creation
        await tx.insert(schema.forumPosts).values({
          topicId: topic.id,
          authorId: user.id,
          content: content || '',
          rawContent: content || '',
          isFirstPost: true,
          postNumber: 1,
        });

        // Update topic post count and last post time
        await tx.update(schema.forumTopics)
          .set({
            postCount: sql`${schema.forumTopics.postCount} + 1`,
            lastPostAt: new Date(),
          })
          .where(eq(schema.forumTopics.id, topic.id));

        logger.info("First post created", { topicId: topic.id });
      });

      res.json({ success: true, topic: topic! });
    } catch (error) {
      logger.error('Create topic error', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to create topic" });
    }
  }));

  // Create a new post in a topic
  app.post("/api/forum/posts", withAuth(async (req, res) => {
    try {
      const { topicId, content } = req.body;
      const user = req.user;

      // SECURITY: Sanitize forum post content with DOMPurify
      const { sanitizeForumPost } = require('../utils/sanitization');
      const { html: sanitizedContent } = sanitizeForumPost(content);

      // RACE CONDITION: Use transaction with SERIALIZABLE isolation for postNumber calculation
      // Without transaction, concurrent posts could get duplicate postNumbers
      let post: ForumPost;
      await db.transaction(async (tx) => {
        // Get the next post number within transaction to prevent race conditions
        const existingPosts = await tx
          .select()
          .from(schema.forumPosts)
          .where(eq(schema.forumPosts.topicId, topicId));
        const postNumber = existingPosts.length + 1;

        // Create post with calculated postNumber - must be atomic with calculation
        const result = await tx.insert(schema.forumPosts).values({
          topicId,
          authorId: user.id,
          content: sanitizedContent,
          rawContent: content,
          postNumber,
          isFirstPost: false,
        }).returning();
        post = result[0];

        // Update topic stats
        await tx.update(schema.forumTopics)
          .set({
            postCount: sql`${schema.forumTopics.postCount} + 1`,
            lastPostAt: new Date(),
          })
          .where(eq(schema.forumTopics.id, topicId));
      }, {
        isolationLevel: 'serializable', // Prevent concurrent postNumber race conditions
      });

      res.json({ success: true, post: post! });
    } catch (error) {
      logger.error('Create post error', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to create post" });
    }
  }));
}
