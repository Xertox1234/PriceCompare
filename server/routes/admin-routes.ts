import { Express } from "express";
import { db } from "../db";
import { forumStorage } from "../forum-storage";
import { withAdmin } from "./helpers";
import { insertProductSchema, insertRetailerSchema } from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, sql, desc, asc } from 'drizzle-orm';
import { parseIntSafe } from "../utils/validation-helpers";
import { getPerformanceStats, getSlowestEndpoints } from "../middleware/performance";

/**
 * Admin Routes
 *
 * Handles admin-only functionality including analytics, product/retailer management,
 * and performance monitoring.
 */
export function registerAdminRoutes(app: Express): void {
  // Get forum categories
  app.get("/api/admin/categories", withAdmin(async (req, res) => {
    try {
      const categories = await forumStorage.getCategories();
      res.json(Array.isArray(categories) ? categories : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.json([]);
    }
  }));

  // Get all users
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
}
