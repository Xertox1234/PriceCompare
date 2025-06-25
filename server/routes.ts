import { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { insertProductSchema, insertRetailerSchema, insertProductOfferSchema, insertUserSchema } from "@shared/schema";
import { storage } from "./storage";
import { forumStorage } from "./forum-storage";
import { passport, createUser, findUserByEmail, findUserById } from "./auth";
import type { SearchFilters, User } from "@shared/schema";
import { z } from "zod";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      passwordHash: string;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

const searchFiltersSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  retailers: z.array(z.number()).optional(),
  minRating: z.number().min(0).max(5).optional(),
  availability: z.array(z.string()).optional(),
  sortBy: z.enum(["price_low", "price_high", "rating", "popularity"]).optional(),
});

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize forum categories
  await forumStorage.initializeDefaultCategories();

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log('Registration request body:', req.body);
      
      // Validate required fields manually first
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ 
          error: "Missing required fields",
          details: {
            username: !username ? "Username is required" : null,
            email: !email ? "Email is required" : null,
            password: !password ? "Password is required" : null
          }
        });
      }

      // Check if user already exists
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Check if this is the first user (make them admin)
      const userCount = await db.select({ count: sql`count(*)` }).from(users);
      const isFirstUser = parseInt(userCount[0].count as string) === 0;
      
      const user = await createUser({ 
        username, 
        email, 
        password,
        role: isFirstUser ? 'admin' : 'user'
      });
      
      // Log the user in after registration
      req.login(user, (err) => {
        if (err) {
          console.error('Login after registration failed:', err);
          return res.status(500).json({ error: 'Registration successful but login failed' });
        }
        res.json({ 
          success: true, 
          user: { 
            id: user.id, 
            username: user.username, 
            email: user.email,
            role: user.role || 'user'
          } 
        });
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({ error: 'Registration failed' });
    }
  });

  app.post("/api/auth/login", passport.authenticate('local'), (req, res) => {
    const user = req.user as User;
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email 
      } 
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    if (req.user) {
      // Refresh session with latest user data from database
      const userId = (req.user as any).id;
      const updatedUser = await findUserById(userId);
      if (updatedUser) {
        req.user = updatedUser;
      }
      
      const user = req.user as any;
      res.json({ 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role || 'user'
      });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  // Forum routes
  app.get("/api/forum/categories", async (req, res) => {
    try {
      const categories = await forumStorage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/forum/topics", async (req, res) => {
    try {
      const { categoryId, productId } = req.query;
      const topics = await forumStorage.getTopics(
        categoryId ? parseInt(categoryId as string) : undefined,
        productId ? parseInt(productId as string) : undefined
      );
      res.json(topics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  app.get("/api/forum/topics/:id", async (req, res) => {
    try {
      const topicId = parseInt(req.params.id);
      const topic = await forumStorage.getTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      res.json(topic);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch topic" });
    }
  });

  app.get("/api/forum/topics/:id/posts", async (req, res) => {
    try {
      const topicId = parseInt(req.params.id);
      const posts = await forumStorage.getPostsByTopic(topicId);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.post("/api/forum/topics", requireAuth, async (req, res) => {
    try {
      const { title, content, categoryId, productId } = req.body;
      const user = req.user as User;

      // Create the topic
      const topic = await forumStorage.createTopic({
        title,
        authorId: user.id,
        categoryId: categoryId || null,
        productId: productId || null,
      });

      // Create the first post
      await forumStorage.createPost({
        topicId: topic.id,
        authorId: user.id,
        content,
        isFirstPost: true,
      });

      res.json({ success: true, topic });
    } catch (error) {
      console.error('Create topic error:', error);
      res.status(500).json({ error: "Failed to create topic" });
    }
  });

  app.post("/api/forum/posts", requireAuth, async (req, res) => {
    try {
      const { topicId, content } = req.body;
      const user = req.user as User;

      const post = await forumStorage.createPost({
        topicId,
        authorId: user.id,
        content,
        isFirstPost: false,
      });

      res.json({ success: true, post });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // Price alerts
  app.post("/api/price-alerts", requireAuth, async (req, res) => {
    try {
      const { productId, targetPrice, notifyForum } = req.body;
      const user = req.user as User;

      const alert = await forumStorage.createPriceAlert({
        userId: user.id,
        productId,
        targetPrice,
        notifyForum: notifyForum || false,
      });

      res.json({ success: true, alert });
    } catch (error) {
      console.error('Create price alert error:', error);
      res.status(500).json({ error: "Failed to create price alert" });
    }
  });

  app.get("/api/price-alerts", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const alerts = await forumStorage.getUserPriceAlerts(user.id);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price alerts" });
    }
  });

  // Get all retailers
  app.get("/api/retailers", async (req, res) => {
    try {
      const retailers = await storage.getRetailers();
      res.json(retailers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch retailers" });
    }
  });

  // Search products with filters
  app.get("/api/products/search", async (req, res) => {
    try {
      const filters: SearchFilters = {
        query: req.query.query as string,
        category: req.query.category as string,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        retailers: req.query.retailers ? 
          (Array.isArray(req.query.retailers) ? 
            req.query.retailers.map(id => parseInt(id as string)) : 
            [parseInt(req.query.retailers as string)]) : undefined,
        minRating: req.query.minRating ? parseFloat(req.query.minRating as string) : undefined,
        availability: req.query.availability ? 
          (Array.isArray(req.query.availability) ? 
            req.query.availability as string[] : 
            [req.query.availability as string]) : undefined,
        sortBy: req.query.sortBy as "price_low" | "price_high" | "rating" | "popularity",
      };

      const products = await storage.searchProducts(filters);
      
      // Add discussion counts to products
      const productsWithDiscussions = await Promise.all(
        products.map(async (product) => {
          const discussionCount = await forumStorage.getProductDiscussionCount(product.id);
          return {
            ...product,
            discussionCount,
            hasActiveDiscussion: discussionCount > 0,
          };
        })
      );

      res.json(productsWithDiscussions);
    } catch (error) {
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Get product by ID
  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const product = await storage.getProductById(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const discussionCount = await forumStorage.getProductDiscussionCount(id);
      const productWithDiscussions = {
        ...product,
        discussionCount,
        hasActiveDiscussion: discussionCount > 0,
      };

      res.json(productWithDiscussions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Get all products (for initial load)
  app.get("/api/products", async (req, res) => {
    try {
      const filters: SearchFilters = {
        sortBy: "popularity",
      };
      const products = await storage.searchProducts(filters);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
