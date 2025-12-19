import { Express } from 'express';
import { storage } from '../storage';
import { withAdmin } from './helpers';
import { insertProductSchema, insertRetailerSchema } from '@shared/schema';
import { parseIntSafe } from '../utils/validation-helpers';
import { getPerformanceStats, getSlowestEndpoints } from '../middleware/performance';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { csrfProtection } from '../middleware/security';
import { z } from 'zod';

/**
 * Admin Routes
 *
 * Handles admin-only functionality including analytics, product/retailer management,
 * and performance monitoring.
 */
export function registerAdminRoutes(app: Express): void {
  // Get all users
  app.get(
    '/api/admin/users',
    withAdmin(async (req, res) => {
      try {
        const usersData = await storage.getAllUsers();
        sendSuccess(res, Array.isArray(usersData) ? usersData : []);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchUsers');
      }
    })
  );

  app.patch(
    '/api/admin/users/:id/role',
    csrfProtection,
    withAdmin(async (req, res) => {
      try {
        const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
        const body = z.object({ role: z.enum(['user', 'moderator', 'admin']) }).parse(req.body);

        await storage.updateUserRole(userId, body.role);
        sendSuccess(res, { message: 'User role updated' });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'UpdateUserRole');
      }
    })
  );

  app.patch(
    '/api/admin/users/:id/suspension',
    csrfProtection,
    withAdmin(async (req, res) => {
      try {
        const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
        const body = z
          .object({ isSuspended: z.boolean(), reason: z.string().optional() })
          .parse(req.body);

        if (body.isSuspended) {
          await storage.suspendUser(
            userId,
            body.reason ?? 'Suspended by administrator',
            req.user.id
          );
        } else {
          await storage.unsuspendUser(userId, req.user.id);
        }

        sendSuccess(res, {
          message: body.isSuspended ? 'User suspended' : 'User reinstated',
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'UpdateUserSuspension');
      }
    })
  );

  // Admin analytics endpoints
  app.get(
    '/api/admin/analytics/overview',
    withAdmin(async (req, res) => {
      try {
        const overview = await storage.getAdminAnalyticsOverview();
        sendSuccess(res, overview);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchAnalyticsOverview');
      }
    })
  );

  app.get(
    '/api/admin/analytics/user-growth',
    withAdmin(async (req, res) => {
      try {
        const userGrowth = await storage.getUserGrowthData();
        sendSuccess(res, userGrowth);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchUserGrowth');
      }
    })
  );

  app.get(
    '/api/admin/analytics/product-activity',
    withAdmin(async (req, res) => {
      try {
        const productActivity = await storage.getProductActivityData();
        sendSuccess(res, productActivity);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchProductActivity');
      }
    })
  );

  app.get(
    '/api/admin/analytics/top-categories',
    withAdmin(async (req, res) => {
      try {
        const topCategories = await storage.getTopProductCategories(10);
        sendSuccess(res, topCategories);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchTopCategories');
      }
    })
  );

  // Admin Product Management Endpoints
  app.get(
    '/api/admin/products',
    withAdmin(async (req, res) => {
      try {
        const products = await storage.getAdminProducts();
        sendSuccess(res, products);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchAdminProducts');
      }
    })
  );

  app.get(
    '/api/admin/products/:id',
    withAdmin(async (req, res) => {
      try {
        // SECURITY: Safe integer parsing with validation
        const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

        const product = await storage.getAdminProductById(productId);

        if (!product) {
          sendError(res, 'Product not found', 404);
          return;
        }

        sendSuccess(res, product);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchProductDetails');
      }
    })
  );

  app.post(
    '/api/admin/products',
    csrfProtection,
    withAdmin(async (req, res) => {
      try {
        const productData = insertProductSchema.parse(req.body);
        const newProduct = await storage.createAdminProduct(productData);
        sendSuccess(res, newProduct, 201);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'CreateProduct');
      }
    })
  );

  app.put(
    '/api/admin/products/:id',
    csrfProtection,
    withAdmin(async (req, res) => {
      try {
        // SECURITY: Safe integer parsing with validation
        const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });
        const updateData = insertProductSchema.partial().parse(req.body);

        const updatedProduct = await storage.updateAdminProduct(productId, updateData);

        if (!updatedProduct) {
          sendError(res, 'Product not found', 404);
          return;
        }

        sendSuccess(res, updatedProduct);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'UpdateProduct');
      }
    })
  );

  app.delete(
    '/api/admin/products/:id',
    csrfProtection,
    withAdmin(async (req, res) => {
      try {
        // SECURITY: Safe integer parsing with validation
        const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

        // CASCADE rule on product_offers.product_id handles offer deletion automatically
        const deletedProduct = await storage.deleteAdminProduct(productId);

        if (!deletedProduct) {
          sendError(res, 'Product not found', 404);
          return;
        }

        sendSuccess(res, { message: 'Product deleted successfully' });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'DeleteProduct');
      }
    })
  );

  // Admin Retailer Management Endpoints
  app.get(
    '/api/admin/retailers',
    withAdmin(async (req, res) => {
      try {
        const allRetailers = await storage.getAdminRetailers();
        sendSuccess(res, allRetailers);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchRetailers');
      }
    })
  );

  app.post(
    '/api/admin/retailers',
    csrfProtection,
    withAdmin(async (req, res) => {
      try {
        const retailerData = insertRetailerSchema.parse(req.body);
        const newRetailer = await storage.createAdminRetailer(retailerData);
        sendSuccess(res, newRetailer, 201);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'CreateRetailer');
      }
    })
  );

  app.put(
    '/api/admin/retailers/:id',
    csrfProtection,
    withAdmin(async (req, res) => {
      try {
        // SECURITY: Safe integer parsing with validation
        const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });
        const updateData = insertRetailerSchema.partial().parse(req.body);

        const updatedRetailer = await storage.updateAdminRetailer(retailerId, updateData);

        if (!updatedRetailer) {
          sendError(res, 'Retailer not found', 404);
          return;
        }

        sendSuccess(res, updatedRetailer);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'UpdateRetailer');
      }
    })
  );

  app.delete(
    '/api/admin/retailers/:id',
    csrfProtection,
    withAdmin(async (req, res) => {
      try {
        // SECURITY: Safe integer parsing with validation
        const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });

        // CASCADE rule on product_offers.retailer_id handles offer deletion automatically
        const deletedRetailer = await storage.deleteAdminRetailer(retailerId);

        if (!deletedRetailer) {
          sendError(res, 'Retailer not found', 404);
          return;
        }

        sendSuccess(res, { message: 'Retailer deleted successfully' });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'DeleteRetailer');
      }
    })
  );

  // Performance monitoring endpoints (admin only)
  app.get(
    '/api/admin/performance/stats',
    withAdmin((req, res) => {
      try {
        const stats = getPerformanceStats();
        sendSuccess(res, stats);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetPerformanceStats');
      }
    })
  );

  app.get(
    '/api/admin/performance/slowest',
    withAdmin((req, res) => {
      try {
        // SECURITY: Safe integer parsing with validation and cap
        const limit = req.query.limit
          ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 })
          : 10;
        const slowest = getSlowestEndpoints(limit);
        sendSuccess(res, slowest);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetSlowestEndpoints');
      }
    })
  );
}
