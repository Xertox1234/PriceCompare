import { Express, Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest, ApiResponse, AuthResponse } from "@shared/types";
import { createServer, type Server } from "http";
import { db } from "./db";
import { insertProductSchema, insertRetailerSchema, insertProductOfferSchema, insertUserSchema } from "@shared/schema";
import { storage } from "./storage";
import { forumStorage } from "./forum-storage";
import { passport, createUser, findUserByEmail, findUserById, hashPassword } from "./auth";
import { generateCsrfToken } from "./middleware/security";
import { logSecurityEvent, SecurityEventType } from "./utils/security-logger";
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  getUserByResetToken,
  isRateLimitExceeded
} from "./services/password-reset-service";
import { emailService } from "./services/email-service";
import type { SearchFilters, User } from "@shared/schema";
import { z } from "zod";
import * as schema from "@shared/schema";
import { eq, sql, like, and, desc, asc } from 'drizzle-orm';
import { getPerformanceStats, getSlowestEndpoints } from "./middleware/performance";
import { parseIntSafe, parseIntOptional, parseFloatSafe } from "./utils/validation-helpers";
import { cacheChartData } from "./middleware/chart-cache";


// Use the actual User type from schema
import type { User as SchemaUser } from "@shared/schema";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface User extends SchemaUser {}
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

// Type predicate to check if request is authenticated
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return !!req.user;
}

// Wrapper to enforce authentication with proper typing
function withAuth(handler: (req: AuthenticatedRequest, res: Response) => Promise<any> | any) {
  return async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    // req is now typed as AuthenticatedRequest
    await handler(req, res);
  };
}

// Wrapper to enforce admin role with proper typing
function withAdmin(handler: (req: AuthenticatedRequest, res: Response) => Promise<any> | any) {
  return async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    // req is now typed as AuthenticatedRequest with admin role
    await handler(req, res);
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize forum categories
  await forumStorage.initializeDefaultCategories();

  // Health check endpoints
  app.get("/health", async (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.get("/api/health", async (req, res) => {
    try {
      // Check database connection
      await db.execute(sql`SELECT 1`);

      res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: "ok"
        }
      });
    } catch (error) {
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        checks: {
          database: "error"
        }
      });
    }
  });

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      // SECURITY: Do not log request bodies in production (may contain sensitive data)
      if (process.env.NODE_ENV === 'development') {
        console.log('Registration request for user:', req.body.email ? '[email provided]' : '[no email]');
      }

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

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters long"
        });
      }

      if (!/[a-z]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one lowercase letter"
        });
      }

      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one uppercase letter"
        });
      }

      if (!/[0-9]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one number"
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

      // SECURITY: Log successful registration
      logSecurityEvent(SecurityEventType.REGISTRATION_SUCCESS, req, {
        userId: user.id,
        username: user.username,
        email: user.email,
        success: true,
        metadata: {
          role: user.role,
          isFirstUser,
        }
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

  app.post("/api/auth/login", (req, res, next) => {
    // Use custom callback to capture authentication result for logging
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }

      if (!user) {
        // SECURITY: Log failed login attempt
        logSecurityEvent(SecurityEventType.LOGIN_FAILED, req, {
          email: req.body.email,
          success: false,
          message: info?.message || 'Authentication failed',
          metadata: {
            reason: info?.message,
            locked: info?.locked,
            remainingAttempts: info?.remainingAttempts,
          }
        });

        return res.status(401).json({
          error: info?.message || 'Authentication failed',
          locked: info?.locked,
          remainingTime: info?.remainingTime,
          remainingAttempts: info?.remainingAttempts,
        });
      }

      // Log in the user
      req.login(user, (err) => {
        if (err) {
          console.error('Session creation error:', err);
          return next(err);
        }

        // SECURITY: Log successful login
        logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, req, {
          userId: user.id,
          username: user.username,
          email: user.email,
          success: true,
        });

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
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    const user = req.user as any;

    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }

      // SECURITY: Log successful logout
      if (user) {
        logSecurityEvent(SecurityEventType.LOGOUT, req, {
          userId: user.id,
          username: user.username,
          email: user.email,
          success: true,
        });
      }

      res.json({ success: true });
    });
  });

  // Password reset - Request token
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // SECURITY: Always return success to prevent email enumeration
      // Even if the user doesn't exist, we return a success message
      const user = await findUserByEmail(email);

      if (user) {
        // Check rate limiting to prevent abuse
        const rateLimitExceeded = await isRateLimitExceeded(user.id);
        if (rateLimitExceeded) {
          // Log the rate limit event
          logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
            email,
            success: false,
            message: "Rate limit exceeded",
            metadata: {
              rateLimitExceeded: true,
            },
          });

          // SECURITY: Still return success to prevent email enumeration
          return res.json({
            success: true,
            message: "If an account exists with this email, a password reset link has been sent.",
          });
        }

        // Check if email service is configured
        if (!emailService.isReady()) {
          logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
            email,
            success: false,
            message: "Email service not configured",
          });

          return res.status(503).json({
            error: "Password reset is temporarily unavailable. Please contact support.",
          });
        }

        // Create a password reset token
        const token = await createPasswordResetToken(
          user.id,
          req.ip,
          req.get("user-agent")
        );

        // Send the password reset email
        const emailSent = await emailService.sendPasswordResetEmail(
          user.email,
          token,
          user.username
        );

        if (emailSent) {
          logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
            userId: user.id,
            email: user.email,
            username: user.username,
            success: true,
          });
        } else {
          logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
            userId: user.id,
            email: user.email,
            username: user.username,
            success: false,
            message: "Failed to send email",
          });
        }
      } else {
        // User doesn't exist, but log this attempt
        logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
          email,
          success: false,
          message: "User not found",
        });
      }

      // SECURITY: Always return the same response regardless of whether user exists
      res.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      // SECURITY: Don't reveal internal errors
      res.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }
  });

  // Password reset - Validate token
  app.get("/api/auth/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      const tokenRecord = await validatePasswordResetToken(token);

      if (!tokenRecord) {
        return res.status(400).json({
          error: "Invalid or expired password reset token",
          expired: true,
        });
      }

      // Get user info (without sensitive data)
      const user = await getUserByResetToken(token);

      if (!user) {
        return res.status(400).json({
          error: "Invalid password reset token",
        });
      }

      res.json({
        success: true,
        email: user.email,
        username: user.username,
      });
    } catch (error) {
      console.error("Validate reset token error:", error);
      res.status(500).json({ error: "An error occurred" });
    }
  });

  // Password reset - Complete reset
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          error: "Token and password are required",
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters long",
        });
      }

      if (!/[a-z]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one lowercase letter",
        });
      }

      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one uppercase letter",
        });
      }

      if (!/[0-9]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one number",
        });
      }

      // Validate the token
      const user = await getUserByResetToken(token);

      if (!user) {
        logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
          success: false,
          message: "Invalid or expired token",
        });

        return res.status(400).json({
          error: "Invalid or expired password reset token",
        });
      }

      // Hash the new password
      const newPasswordHash = await hashPassword(password);

      // Update the user's password
      await db
        .update(schema.users)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));

      // Mark the token as used
      await markTokenAsUsed(token);

      // Log the successful password reset
      logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
        userId: user.id,
        email: user.email,
        username: user.username,
        success: true,
      });

      // Send confirmation email
      if (emailService.isReady()) {
        await emailService.sendPasswordResetConfirmationEmail(
          user.email,
          user.username
        );
      }

      res.json({
        success: true,
        message: "Password has been reset successfully. You can now log in with your new password.",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "An error occurred while resetting password" });
    }
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
      // SECURITY: Include CSRF token in response for client convenience
      const csrfToken = generateCsrfToken(req);

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        reputation: user.reputation || 0,
        isActive: user.isActive !== false,
        csrfToken, // Provide token for use in subsequent requests
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

  // Price alerts
  app.post("/api/price-alerts", withAuth(async (req, res) => {
    try {
      const { productId, targetPrice, notifyForum } = req.body;
      const user = req.user;

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
  }));

  app.get("/api/price-alerts", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alerts = await forumStorage.getUserPriceAlerts(user.id);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price alerts" });
    }
  }));

  app.patch("/api/price-alerts/:id", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alertId = parseInt(req.params.id);
      const updates = req.body;

      const updatedAlert = await forumStorage.updatePriceAlert(alertId, user.id, updates);
      if (!updatedAlert) {
        return res.status(404).json({ error: "Alert not found or unauthorized" });
      }

      res.json(updatedAlert);
    } catch (error) {
      res.status(500).json({ error: "Failed to update price alert" });
    }
  }));

  app.delete("/api/price-alerts/:id", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alertId = parseInt(req.params.id);

      const deleted = await forumStorage.deletePriceAlert(alertId, user.id);
      if (!deleted) {
        return res.status(404).json({ error: "Alert not found or unauthorized" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete price alert" });
    }
  }));

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

  // Search products with filters (supports URL-based search for browser extension)
  app.get("/api/products/search", async (req, res) => {
    try {
      // If URL parameter is provided, search by product URL (for browser extension)
      if (req.query.url) {
        const productUrl = decodeURIComponent(req.query.url as string);

        // Search for product by URL in product offers
        const allProductOffers = await db
          .select({
            offer: schema.productOffers,
            product: schema.products,
            retailer: schema.retailers
          })
          .from(schema.productOffers)
          .innerJoin(schema.products, eq(schema.productOffers.productId, schema.products.id))
          .innerJoin(schema.retailers, eq(schema.productOffers.retailerId, schema.retailers.id))
          .where(like(schema.productOffers.productUrl, `%${productUrl}%`));

        if (allProductOffers.length === 0) {
          return res.json({ product: null });
        }

        // Get the first matching product
        const { product, offer, retailer } = allProductOffers[0];

        // Get all offers for this product
        const offers = await storage.getProductOffers(product.id);
        const prices = offers.map(o => parseFloat(o.price));
        const bestPrice = Math.min(...prices);

        return res.json({
          product: {
            ...product,
            offers,
            bestPrice
          }
        });
      }

      // Otherwise, use normal search filters
      // SECURITY: Safe number parsing with validation and constraints
      const filters: SearchFilters = {
        query: req.query.query as string,
        category: req.query.category as string,
        minPrice: req.query.minPrice ? parseFloatSafe(req.query.minPrice as string, 'minPrice', { min: 0 }) : undefined,
        maxPrice: req.query.maxPrice ? parseFloatSafe(req.query.maxPrice as string, 'maxPrice', { min: 0 }) : undefined,
        retailers: req.query.retailers ?
          (Array.isArray(req.query.retailers) ?
            req.query.retailers.map(id => parseIntSafe(id as string, 'retailerId', { min: 1 })) :
            [parseIntSafe(req.query.retailers as string, 'retailerId', { min: 1 })]) : undefined,
        minRating: req.query.minRating ? parseFloatSafe(req.query.minRating as string, 'minRating', { min: 0, max: 5 }) : undefined,
        availability: req.query.availability ?
          (Array.isArray(req.query.availability) ?
            req.query.availability as string[] :
            [req.query.availability as string]) : undefined,
        sortBy: req.query.sortBy as "price_low" | "price_high" | "rating" | "popularity",
        page: req.query.page ? parseIntSafe(req.query.page as string, 'page', { min: 1 }) : 1,
        limit: req.query.limit ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 }) : 20,
      };

      const { products, pagination } = await storage.searchProducts(filters);

      // Add discussion counts to products (batch query to avoid N+1 problem)
      const productIds = products.map(p => p.id);
      const discussionCounts = await forumStorage.getProductDiscussionCounts(productIds);

      const productsWithDiscussions = products.map(product => ({
        ...product,
        discussionCount: discussionCounts.get(product.id) || 0,
        hasActiveDiscussion: (discussionCounts.get(product.id) || 0) > 0,
      }));

      // Return response in the format expected by the frontend
      res.json({
        results: productsWithDiscussions,
        metadata: pagination,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Get product by ID
  app.get("/api/products/:id", async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });

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

  // Price History Endpoints
  // Get price history for a product (with caching)
  app.get("/api/products/:id/price-history", cacheChartData(3600), async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string);
      const retailerId = parseIntOptional(req.query.retailerId as string);

      let history;
      if (retailerId) {
        // Get history for specific retailer
        history = await storage.getRetailerPriceHistory(id, retailerId, days);
      } else {
        // Get history for all retailers
        history = await storage.getPriceHistory(id, days);
      }

      // Format for extension compatibility
      const formattedHistory = history.map(h => ({
        date: h.recordedAt instanceof Date ? h.recordedAt.toISOString() : h.recordedAt,
        price: parseFloat(h.price),
        retailerId: h.retailerId,
        retailerName: 'retailerName' in h ? h.retailerName : undefined,
        availability: h.availability
      }));

      res.json({ history: formattedHistory });
    } catch (error) {
      console.error('Error fetching price history:', error);
      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  // Get price trend analysis for a product
  app.get("/api/products/:id/price-trend", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const trendData = await storage.getPriceTrend(id);

      // Format for extension compatibility
      res.json({
        trend: {
          direction: trendData.trend,
          change: trendData.changePercentage,
          changePercent: trendData.changePercentage,
          currentPrice: trendData.currentPrice,
          averagePrice: trendData.averagePrice,
          lowestPrice: trendData.lowestPrice,
          highestPrice: trendData.highestPrice
        },
        prediction: trendData.trend === 'falling' ? 'might_drop' :
                   trendData.trend === 'rising' ? 'wait' : 'good_time'
      });
    } catch (error) {
      console.error('Error fetching price trend:', error);
      res.status(500).json({ message: "Failed to fetch price trend" });
    }
  });

  // Get best time to buy analysis for a product
  app.get("/api/products/:id/best-time-to-buy", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const analysis = await storage.getBestTimeToBuy(id);
      res.json(analysis);
    } catch (error) {
      console.error('Error fetching best time to buy:', error);
      res.status(500).json({ message: "Failed to fetch best time to buy analysis" });
    }
  });

  // Get price volatility score for a product
  app.get("/api/products/:id/volatility", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string);

      // Get price history
      const history = await storage.getPriceHistory(id, days);

      if (!history || history.length < 2) {
        return res.json(null);
      }

      // Calculate volatility using the calculator
      const { calculateVolatility } = await import('./utils/volatility-calculator');
      const volatility = calculateVolatility(history);

      res.json(volatility);
    } catch (error) {
      console.error('Error calculating volatility:', error);
      res.status(500).json({ message: "Failed to calculate price volatility" });
    }
  });

  // Get seasonal patterns for a product
  app.get("/api/products/:id/seasonal-patterns", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string);

      // Get price history (need at least several months for seasonal analysis)
      const history = await storage.getPriceHistory(id, days || 365); // Default to 1 year

      if (!history || history.length < 10) {
        return res.json(null);
      }

      // Detect seasonal patterns
      const { detectSeasonalPatterns } = await import('./utils/seasonal-pattern-detector');
      const patterns = detectSeasonalPatterns(history);

      res.json(patterns);
    } catch (error) {
      console.error('Error detecting seasonal patterns:', error);
      res.status(500).json({ message: "Failed to detect seasonal patterns" });
    }
  });

  // Get retailer reliability scores for a product
  app.get("/api/products/:id/retailer-reliability", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string);

      // Get price history for all retailers
      const history = await storage.getPriceHistory(id, days);

      if (!history || history.length < 5) {
        return res.json(null);
      }

      // Group data by retailer
      const retailerDataMap = new Map<number, any>();
      history.forEach(entry => {
        if (!retailerDataMap.has(entry.retailerId)) {
          retailerDataMap.set(entry.retailerId, {
            retailerId: entry.retailerId,
            retailerName: entry.retailerName,
            priceHistory: [],
          });
        }
        retailerDataMap.get(entry.retailerId)!.priceHistory.push({
          price: entry.price,
          recordedAt: entry.recordedAt,
          availability: entry.availability,
        });
      });

      const allRetailersData = Array.from(retailerDataMap.values());

      // Calculate reliability scores
      const { calculateAllRetailerReliability } = await import('./utils/retailer-reliability-calculator');
      const scores = calculateAllRetailerReliability(allRetailersData);

      res.json(scores);
    } catch (error) {
      console.error('Error calculating retailer reliability:', error);
      res.status(500).json({ message: "Failed to calculate retailer reliability" });
    }
  });

  // Get product offers (for browser extension)
  app.get("/api/products/:id/offers", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const offers = await storage.getProductOffers(id);

      // Format for extension
      const formattedOffers = offers.map(offer => ({
        id: offer.id,
        retailerId: offer.retailerId,
        retailerName: offer.retailer.name,
        retailerLogo: offer.retailer.logo,
        price: parseFloat(offer.price),
        originalPrice: offer.originalPrice ? parseFloat(offer.originalPrice) : null,
        rating: offer.rating ? parseFloat(offer.rating) : null,
        reviewCount: offer.reviewCount,
        availability: offer.availability,
        shippingInfo: offer.shippingInfo,
        dealType: offer.dealType,
        url: offer.productUrl,
        affiliateUrl: offer.affiliateUrl
      }));

      res.json({ offers: formattedOffers });
    } catch (error) {
      console.error('Error fetching product offers:', error);
      res.status(500).json({ message: "Failed to fetch product offers" });
    }
  });

  // Get price predictions for a product (for browser extension)
  app.get("/api/products/:id/price-predictions", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string) || 7;

      // Get historical price data
      const history = await storage.getPriceHistory(id, 90); // Get 90 days of history

      if (history.length < 7) {
        // Not enough data for predictions
        return res.json({
          predictions: [],
          confidence: 'low',
          message: 'Not enough historical data for predictions'
        });
      }

      // Simple linear regression prediction
      const predictions = [];
      const prices = history.map(h => parseFloat(h.price));
      const recentPrices = prices.slice(-30); // Last 30 days

      // Calculate average change per day
      const avgChange = recentPrices.length >= 2
        ? (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices.length
        : 0;

      const lastPrice = prices[prices.length - 1];
      const today = new Date();

      for (let i = 1; i <= days; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + i);

        // Simple linear prediction with some randomness dampening
        const predictedPrice = lastPrice + (avgChange * i * 0.8); // 0.8 dampening factor

        predictions.push({
          date: futureDate.toISOString().split('T')[0],
          predictedPrice: Math.max(0, predictedPrice), // Ensure non-negative
          confidence: Math.max(0.3, 1 - (i / days) * 0.5) // Decreasing confidence
        });
      }

      res.json({
        predictions,
        confidence: recentPrices.length >= 30 ? 'medium' : 'low',
        basePrice: lastPrice,
        averageDailyChange: avgChange
      });
    } catch (error) {
      console.error('Error fetching price predictions:', error);
      res.status(500).json({ message: "Failed to fetch price predictions" });
    }
  });

  // Track product view (analytics for browser extension)
  app.post("/api/analytics/product-view", async (req, res) => {
    try {
      const { productId, source, retailer } = req.body;

      if (!productId) {
        return res.status(400).json({ error: "productId is required" });
      }

      // Log the view (in a production app, this would go to an analytics service)
      console.log('Product view tracked:', {
        productId,
        source: source || 'unknown',
        retailer: retailer || 'unknown',
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      // In the future, you could store this in a database table for analytics
      // For now, just acknowledge receipt
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking product view:', error);
      res.status(500).json({ error: "Failed to track product view" });
    }
  });

  // Admin routes - require admin role
  app.get("/api/admin/categories", withAdmin(async (req, res) => {
    try {
      const categories = await forumStorage.getCategories();
      res.json(Array.isArray(categories) ? categories : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.json([]);
    }
  }));

  app.get("/api/admin/users", withAdmin(async (req, res) => {
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
  }));

  // Admin analytics endpoints
  app.get("/api/admin/analytics/overview", withAdmin(async (req, res) => {
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
  }));

  app.get("/api/admin/analytics/user-growth", withAdmin(async (req, res) => {
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
  }));

  app.get("/api/admin/analytics/forum-activity", withAdmin(async (req, res) => {
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
  }));

  app.get("/api/admin/analytics/top-categories", withAdmin(async (req, res) => {
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
  }));

  // Admin Product Management Endpoints
  app.get("/api/admin/products", withAdmin(async (req, res) => {
    try {
      const products = await db.select({
        id: schema.products.id,
        name: schema.products.name,
        description: schema.products.description,
        category: schema.products.category,
        brand: schema.products.brand,
        model: schema.products.model,
        image: schema.products.image,
        createdAt: schema.products.createdAt
      })
      .from(schema.products)
      .orderBy(desc(schema.products.createdAt));

      res.json(products);
    } catch (error) {
      console.error('Error fetching admin products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  }));

  app.get("/api/admin/products/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

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
        productUrl: schema.productOffers.productUrl,
        affiliateUrl: schema.productOffers.affiliateUrl,
        retailer: {
          id: schema.retailers.id,
          name: schema.retailers.name,
          logo: schema.retailers.logo
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
  }));

  app.post("/api/admin/products", withAdmin(async (req, res) => {
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
  }));

  app.put("/api/admin/products/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const updateData = insertProductSchema.partial().parse(req.body);
      
      const [updatedProduct] = await db.update(schema.products)
        .set(updateData)
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
  }));

  app.delete("/api/admin/products/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

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
  }));

  // Admin Retailer Management Endpoints
  app.get("/api/admin/retailers", withAdmin(async (req, res) => {
    try {
      const retailers = await db.select()
        .from(schema.retailers)
        .orderBy(asc(schema.retailers.name));

      res.json(retailers);
    } catch (error) {
      console.error('Error fetching retailers:', error);
      res.status(500).json({ error: 'Failed to fetch retailers' });
    }
  }));

  app.post("/api/admin/retailers", withAdmin(async (req, res) => {
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
  }));

  app.put("/api/admin/retailers/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });
      const updateData = insertRetailerSchema.partial().parse(req.body);
      
      const [updatedRetailer] = await db.update(schema.retailers)
        .set(updateData)
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
  }));

  app.delete("/api/admin/retailers/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });
      
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
  }));

  // Performance monitoring endpoints (admin only)
  app.get("/api/admin/performance/stats", withAdmin(async (req, res) => {
    try {
      const stats = getPerformanceStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting performance stats:', error);
      res.status(500).json({ error: 'Failed to get performance stats' });
    }
  }));

  app.get("/api/admin/performance/slowest", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation and cap
      const limit = req.query.limit ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 }) : 10;
      const slowest = getSlowestEndpoints(limit);
      res.json(slowest);
    } catch (error) {
      console.error('Error getting slowest endpoints:', error);
      res.status(500).json({ error: 'Failed to get slowest endpoints' });
    }
  }));

  const httpServer = createServer(app);
  return httpServer;
}
