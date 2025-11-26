import { Express } from "express";
import { forumStorage } from "../forum-storage";
import { storage } from "../storage";
import { withAdmin, handleRouteError, notFound } from "./helpers";
import { insertProductSchema, insertRetailerSchema } from "@shared/schema";
import { parseIntSafe } from "../utils/validation-helpers";
import { getPerformanceStats, getSlowestEndpoints } from "../middleware/performance";
import { logger } from "../utils/logger";

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
    } catch (error: unknown) {
      logger.error('Error fetching categories', { error: error instanceof Error ? error.message : String(error) });
      res.json([]);
    }
  }));

  // Get all users
  app.get("/api/admin/users", withAdmin(async (req, res) => {
    try {
      const usersData = await storage.getAllUsers();
      res.json(Array.isArray(usersData) ? usersData : []);
    } catch (error: unknown) {
      logger.error('Error fetching users', { error: error instanceof Error ? error.message : String(error) });
      res.json([]);
    }
  }));

  // Admin analytics endpoints
  app.get("/api/admin/analytics/overview", withAdmin(async (req, res) => {
    try {
      const overview = await storage.getAdminAnalyticsOverview();
      res.json(overview);
    } catch (error: unknown) {
      handleRouteError(res, error, 'FetchAnalyticsOverview');
    }
  }));

  app.get("/api/admin/analytics/user-growth", withAdmin(async (req, res) => {
    try {
      const userGrowth = await storage.getUserGrowthData();
      res.json(userGrowth);
    } catch (error: unknown) {
      handleRouteError(res, error, 'FetchUserGrowth');
    }
  }));

  app.get("/api/admin/analytics/forum-activity", withAdmin(async (req, res) => {
    try {
      const postActivity = await storage.getForumActivityData();
      res.json(postActivity);
    } catch (error: unknown) {
      handleRouteError(res, error, 'FetchForumActivity');
    }
  }));

  app.get("/api/admin/analytics/top-categories", withAdmin(async (req, res) => {
    try {
      const topCategories = await storage.getTopCategories(10);
      res.json(topCategories);
    } catch (error: unknown) {
      handleRouteError(res, error, 'FetchTopCategories');
    }
  }));

  // Admin Product Management Endpoints
  app.get("/api/admin/products", withAdmin(async (req, res) => {
    try {
      const products = await storage.getAdminProducts();
      res.json(products);
    } catch (error: unknown) {
      handleRouteError(res, error, 'FetchAdminProducts');
    }
  }));

  app.get("/api/admin/products/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

      const product = await storage.getAdminProductById(productId);

      if (!product) {
        notFound(res, 'Product');
        return;
      }

      res.json(product);
    } catch (error: unknown) {
      handleRouteError(res, error, 'FetchProductDetails');
    }
  }));

  app.post("/api/admin/products", withAdmin(async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const newProduct = await storage.createAdminProduct(productData);
      res.status(201).json(newProduct);
    } catch (error: unknown) {
      handleRouteError(res, error, 'CreateProduct');
    }
  }));

  app.put("/api/admin/products/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const updateData = insertProductSchema.partial().parse(req.body);

      const updatedProduct = await storage.updateAdminProduct(productId, updateData);

      if (!updatedProduct) {
        notFound(res, 'Product');
        return;
      }

      res.json(updatedProduct);
    } catch (error: unknown) {
      handleRouteError(res, error, 'UpdateProduct');
    }
  }));

  app.delete("/api/admin/products/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

      // CASCADE rule on product_offers.product_id handles offer deletion automatically
      const deletedProduct = await storage.deleteAdminProduct(productId);

      if (!deletedProduct) {
        notFound(res, 'Product');
        return;
      }

      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error: unknown) {
      handleRouteError(res, error, 'DeleteProduct');
    }
  }));

  // Admin Retailer Management Endpoints
  app.get("/api/admin/retailers", withAdmin(async (req, res) => {
    try {
      const allRetailers = await storage.getAdminRetailers();
      res.json(allRetailers);
    } catch (error: unknown) {
      handleRouteError(res, error, 'FetchRetailers');
    }
  }));

  app.post("/api/admin/retailers", withAdmin(async (req, res) => {
    try {
      const retailerData = insertRetailerSchema.parse(req.body);
      const newRetailer = await storage.createAdminRetailer(retailerData);
      res.status(201).json(newRetailer);
    } catch (error: unknown) {
      handleRouteError(res, error, 'CreateRetailer');
    }
  }));

  app.put("/api/admin/retailers/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });
      const updateData = insertRetailerSchema.partial().parse(req.body);

      const updatedRetailer = await storage.updateAdminRetailer(retailerId, updateData);

      if (!updatedRetailer) {
        notFound(res, 'Retailer');
        return;
      }

      res.json(updatedRetailer);
    } catch (error: unknown) {
      handleRouteError(res, error, 'UpdateRetailer');
    }
  }));

  app.delete("/api/admin/retailers/:id", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });

      // CASCADE rule on product_offers.retailer_id handles offer deletion automatically
      const deletedRetailer = await storage.deleteAdminRetailer(retailerId);

      if (!deletedRetailer) {
        notFound(res, 'Retailer');
        return;
      }

      res.json({ success: true, message: 'Retailer deleted successfully' });
    } catch (error: unknown) {
      handleRouteError(res, error, 'DeleteRetailer');
    }
  }));

  // Performance monitoring endpoints (admin only)
  app.get("/api/admin/performance/stats", withAdmin(async (req, res) => {
    try {
      const stats = getPerformanceStats();
      res.json(stats);
    } catch (error: unknown) {
      handleRouteError(res, error, 'GetPerformanceStats');
    }
  }));

  app.get("/api/admin/performance/slowest", withAdmin(async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation and cap
      const limit = req.query.limit ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 }) : 10;
      const slowest = getSlowestEndpoints(limit);
      res.json(slowest);
    } catch (error: unknown) {
      handleRouteError(res, error, 'GetSlowestEndpoints');
    }
  }));
}
