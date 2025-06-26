import { Express, Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest, ApiResponse, AuthResponse } from "@shared/types";
import { createServer, type Server } from "http";
import { db } from "./db";
import { insertProductSchema, insertRetailerSchema, insertProductOfferSchema, insertUserSchema } from "@shared/schema";
import { storage } from "./storage";
import { forumStorage } from "./forum-storage";
import { passport, createUser, findUserByEmail, findUserById } from "./auth";
import type { SearchFilters, User } from "@shared/schema";
import { z } from "zod";
import * as schema from "@shared/schema";
import { eq, sql, like, and, desc, asc } from 'drizzle-orm';


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
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
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
      const userCount = await db.select({ count: sql`count(*)` }).from(schema.users);
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
        email: user.email,
        role: user.role || 'user'
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
        role: user.role || 'user',
        reputation: user.reputation || 0,
        isActive: user.isActive !== false
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
      // Set longer cache for retailers as they change less frequently
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=1800');
      
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

  // Admin routes
  app.get("/api/admin/categories", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const categories = await forumStorage.getCategories();
      res.json(Array.isArray(categories) ? categories : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.json([]);
    }
  });

  app.get("/api/admin/users", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const usersData = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        role: schema.users.role,
        isActive: schema.users.isActive,
        reputation: schema.users.reputation,
        createdAt: schema.users.createdAt
      }).from(schema.users);
      res.json(Array.isArray(usersData) ? usersData : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.json([]);
    }
  });

  // Admin analytics endpoints
  app.get("/api/admin/analytics/overview", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [userCount, topicCount, postCount, categoryCount] = await Promise.all([
        db.select({ count: sql`count(*)` }).from(schema.users),
        db.select({ count: sql`count(*)` }).from(schema.forumTopics),
        db.select({ count: sql`count(*)` }).from(schema.forumPosts),
        db.select({ count: sql`count(*)` }).from(schema.forumCategories)
      ]);

      res.json({
        totalUsers: userCount[0]?.count || 0,
        totalTopics: topicCount[0]?.count || 0,
        totalPosts: postCount[0]?.count || 0,
        totalCategories: categoryCount[0]?.count || 0
      });
    } catch (error) {
      console.error('Error fetching overview analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  app.get("/api/admin/analytics/user-growth", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userGrowth = await db.select({
        date: sql`DATE(${schema.users.createdAt})`.as('date'),
        count: sql`count(*)`.as('count')
      })
      .from(schema.users)
      .groupBy(sql`DATE(${schema.users.createdAt})`)
      .orderBy(sql`DATE(${schema.users.createdAt})`);

      res.json(userGrowth);
    } catch (error) {
      console.error('Error fetching user growth:', error);
      res.status(500).json({ error: 'Failed to fetch user growth data' });
    }
  });

  app.get("/api/admin/analytics/forum-activity", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const postActivity = await db.select({
        date: sql`DATE(${schema.forumPosts.createdAt})`.as('date'),
        count: sql`count(*)`.as('count')
      })
      .from(schema.forumPosts)
      .groupBy(sql`DATE(${schema.forumPosts.createdAt})`)
      .orderBy(sql`DATE(${schema.forumPosts.createdAt})`);

      res.json(postActivity);
    } catch (error) {
      console.error('Error fetching forum activity:', error);
      res.status(500).json({ error: 'Failed to fetch forum activity data' });
    }
  });

  app.get("/api/admin/analytics/top-categories", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const topCategories = await db.select({
        categoryName: schema.forumCategories.name,
        topicCount: sql`count(${schema.forumTopics.id})`.as('topicCount')
      })
      .from(schema.forumCategories)
      .leftJoin(schema.forumTopics, eq(schema.forumCategories.id, schema.forumTopics.categoryId))
      .groupBy(schema.forumCategories.id, schema.forumCategories.name)
      .orderBy(sql`count(${schema.forumTopics.id}) DESC`)
      .limit(10);

      res.json(topCategories);
    } catch (error) {
      console.error('Error fetching top categories:', error);
      res.status(500).json({ error: 'Failed to fetch top categories data' });
    }
  });

  // Admin Product Management Endpoints
  app.get("/api/admin/products", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const products = await db.select({
        id: schema.products.id,
        name: schema.products.name,
        description: schema.products.description,
        category: schema.products.category,
        brand: schema.products.brand,
        model: schema.products.model,
        imageUrl: schema.products.imageUrl,
        status: schema.products.status,
        createdAt: schema.products.createdAt,
        updatedAt: schema.products.updatedAt
      })
      .from(schema.products)
      .orderBy(desc(schema.products.createdAt));

      res.json(products);
    } catch (error) {
      console.error('Error fetching admin products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  app.get("/api/admin/products/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      
      const [product] = await db.select()
        .from(schema.products)
        .where(eq(schema.products.id, productId));

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Get product offers for this product
      const offers = await db.select({
        id: schema.productOffers.id,
        price: schema.productOffers.price,
        originalPrice: schema.productOffers.originalPrice,
        availability: schema.productOffers.availability,
        url: schema.productOffers.url,
        affiliateUrl: schema.productOffers.affiliateUrl,
        retailer: {
          id: schema.retailers.id,
          name: schema.retailers.name,
          logoUrl: schema.retailers.logoUrl
        }
      })
      .from(schema.productOffers)
      .leftJoin(schema.retailers, eq(schema.productOffers.retailerId, schema.retailers.id))
      .where(eq(schema.productOffers.productId, productId));

      res.json({ ...product, offers });
    } catch (error) {
      console.error('Error fetching product details:', error);
      res.status(500).json({ error: 'Failed to fetch product details' });
    }
  });

  app.post("/api/admin/products", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      
      const [newProduct] = await db.insert(schema.products)
        .values(productData)
        .returning();

      res.status(201).json(newProduct);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  app.put("/api/admin/products/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const updateData = insertProductSchema.partial().parse(req.body);
      
      const [updatedProduct] = await db.update(schema.products)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(schema.products.id, productId))
        .returning();

      if (!updatedProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  app.delete("/api/admin/products/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      
      // First delete related offers
      await db.delete(schema.productOffers)
        .where(eq(schema.productOffers.productId, productId));
      
      // Then delete the product
      const [deletedProduct] = await db.delete(schema.products)
        .where(eq(schema.products.id, productId))
        .returning();

      if (!deletedProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // Admin Retailer Management Endpoints
  app.get("/api/admin/retailers", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const retailers = await db.select()
        .from(schema.retailers)
        .orderBy(asc(schema.retailers.name));

      res.json(retailers);
    } catch (error) {
      console.error('Error fetching retailers:', error);
      res.status(500).json({ error: 'Failed to fetch retailers' });
    }
  });

  app.post("/api/admin/retailers", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const retailerData = insertRetailerSchema.parse(req.body);
      
      const [newRetailer] = await db.insert(schema.retailers)
        .values(retailerData)
        .returning();

      res.status(201).json(newRetailer);
    } catch (error) {
      console.error('Error creating retailer:', error);
      res.status(500).json({ error: 'Failed to create retailer' });
    }
  });

  app.put("/api/admin/retailers/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const retailerId = parseInt(req.params.id);
      const updateData = insertRetailerSchema.partial().parse(req.body);
      
      const [updatedRetailer] = await db.update(schema.retailers)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(schema.retailers.id, retailerId))
        .returning();

      if (!updatedRetailer) {
        return res.status(404).json({ error: 'Retailer not found' });
      }

      res.json(updatedRetailer);
    } catch (error) {
      console.error('Error updating retailer:', error);
      res.status(500).json({ error: 'Failed to update retailer' });
    }
  });

  app.delete("/api/admin/retailers/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const retailerId = parseInt(req.params.id);
      
      // First delete related offers
      await db.delete(schema.productOffers)
        .where(eq(schema.productOffers.retailerId, retailerId));
      
      // Then delete the retailer
      const [deletedRetailer] = await db.delete(schema.retailers)
        .where(eq(schema.retailers.id, retailerId))
        .returning();

      if (!deletedRetailer) {
        return res.status(404).json({ error: 'Retailer not found' });
      }

      res.json({ success: true, message: 'Retailer deleted successfully' });
    } catch (error) {
      console.error('Error deleting retailer:', error);
      res.status(500).json({ error: 'Failed to delete retailer' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
