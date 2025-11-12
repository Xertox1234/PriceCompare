import { Express } from "express";
import { forumStorage } from "../forum-storage";
import { withAuth } from "./helpers";
import { parseIntOptional, parseIntSafe } from "../utils/validation-helpers";

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

      // Create the topic
      const topic = await forumStorage.createTopic({
        title,
        authorId: user.id,
        categoryId: categoryId || null,
        productId: productId || null,
      });

      console.log("Topic created successfully:", topic.id);

      // Create the first post
      console.log("Creating first post for topic:", topic.id);
      const postData = {
        topicId: topic.id,
        authorId: user.id,
        content: content || '',
        rawContent: content || '', // Store same content for both fields
        isFirstPost: true,
        postNumber: 1, // First post in topic
      };

      console.log("Post data being created:", JSON.stringify(postData, null, 2));

      // Use the correct camelCase field names that match the Drizzle schema
      await forumStorage.createPost(postData);

      console.log("First post created successfully");
      res.json({ success: true, topic });
    } catch (error) {
      console.error('Create topic error:', error);
      res.status(500).json({ error: "Failed to create topic" });
    }
  }));

  // Create a new post in a topic
  app.post("/api/forum/posts", withAuth(async (req, res) => {
    try {
      const { topicId, content } = req.body;
      const user = req.user;

      // Get the next post number for this topic
      const existingPosts = await forumStorage.getPostsByTopic(topicId);
      const postNumber = existingPosts.length + 1;

      const post = await forumStorage.createPost({
        topicId,
        authorId: user.id,
        content,
        rawContent: content, // Store original content
        postNumber,
        isFirstPost: false,
      });

      res.json({ success: true, post });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({ error: "Failed to create post" });
    }
  }));
}
