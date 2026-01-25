/**
 * User State Routes
 *
 * Agent-native APIs for localStorage-only features (TODO 272).
 * Enables AI agents to access Compare List and Recently Viewed features
 * that were previously browser-only via localStorage.
 *
 * Features:
 * - Compare List: Max 4 products for side-by-side comparison
 * - Recently Viewed: Max 50 products with FIFO eviction
 *
 * Security:
 * - All mutating endpoints require CSRF protection
 * - All endpoints require authentication
 */
import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { withAuth } from './helpers';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { parseIntSafe } from '../utils/validation-helpers';
import { logger } from '../utils/logger';
import { csrfProtection } from '../middleware/security';
import { flexibleAuth } from '../middleware/flexible-auth';

// Validation schemas
const addToCompareSchema = z.object({
  productId: z.number().int().positive(),
});

const recordProductViewSchema = z.object({
  productId: z.number().int().positive(),
});

const recentlyViewedQuerySchema = z.object({
  limit: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    return Number.isNaN(num) ? undefined : num;
  }),
});

/**
 * Register user state routes
 */
export function registerUserStateRoutes(app: Express): void {
  // ============================================================================
  // Compare List Endpoints
  // ============================================================================

  /**
   * GET /api/user/compare - Get user's compare list
   * Returns array of products in compare list with full product data
   */
  app.get(
    '/api/user/compare',
    flexibleAuth,
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const items = await storage.getUserCompareItems(userId);
        sendSuccess(res, { items, count: items.length, maxItems: 4 });
      } catch (error) {
        sendErrorFromException(res, error, 'GetUserCompareItems');
      }
    })
  );

  /**
   * GET /api/user/compare/check/:productId - Check if product is in compare list
   * Quick check without fetching full data
   */
  app.get(
    '/api/user/compare/check/:productId',
    flexibleAuth,
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });
        const isInCompare = await storage.isInCompare(userId, productId);
        sendSuccess(res, { isInCompare });
      } catch (error) {
        sendErrorFromException(res, error, 'CheckCompare');
      }
    })
  );

  /**
   * POST /api/user/compare - Add product to compare list
   * Max 4 items enforced at storage layer
   */
  app.post(
    '/api/user/compare',
    flexibleAuth,
    csrfProtection,
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const data = addToCompareSchema.parse(req.body);

        // Check if list is full before attempting add
        const count = await storage.getCompareCount(userId);
        if (count >= 4) {
          sendError(res, 'Compare list is full. Maximum 4 items allowed.', 400);
          return;
        }

        const item = await storage.addToCompare(userId, data.productId);
        logger.info('Product added to compare list', { userId, productId: data.productId });
        sendSuccess(res, item, 201);
      } catch (error) {
        sendErrorFromException(res, error, 'AddToCompare');
      }
    })
  );

  /**
   * DELETE /api/user/compare/:productId - Remove product from compare list
   */
  app.delete(
    '/api/user/compare/:productId',
    flexibleAuth,
    csrfProtection,
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

        const removed = await storage.removeFromCompare(userId, productId);
        if (!removed) {
          sendError(res, 'Product not in compare list', 404);
          return;
        }

        logger.info('Product removed from compare list', { userId, productId });
        sendSuccess(res, {});
      } catch (error) {
        sendErrorFromException(res, error, 'RemoveFromCompare');
      }
    })
  );

  /**
   * DELETE /api/user/compare - Clear entire compare list
   */
  app.delete(
    '/api/user/compare',
    flexibleAuth,
    csrfProtection,
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const removedCount = await storage.clearCompare(userId);
        logger.info('Compare list cleared', { userId, removedCount });
        sendSuccess(res, { removedCount });
      } catch (error) {
        sendErrorFromException(res, error, 'ClearCompare');
      }
    })
  );

  // ============================================================================
  // Recently Viewed Endpoints
  // ============================================================================

  /**
   * GET /api/user/recently-viewed - Get user's recently viewed products
   * Returns array of products ordered by most recent view
   * Optional limit query param (default 50, max 50)
   */
  app.get(
    '/api/user/recently-viewed',
    flexibleAuth,
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const query = recentlyViewedQuerySchema.parse(req.query);

        // Enforce max limit of 50
        const limit = query.limit ? Math.min(query.limit, 50) : 50;

        const items = await storage.getUserRecentlyViewed(userId, limit);
        sendSuccess(res, { items, count: items.length, maxItems: 50 });
      } catch (error) {
        sendErrorFromException(res, error, 'GetUserRecentlyViewed');
      }
    })
  );

  /**
   * POST /api/user/recently-viewed - Record a product view
   * Updates viewed_at timestamp if product already viewed (upsert)
   * FIFO eviction when exceeding 50 items
   */
  app.post(
    '/api/user/recently-viewed',
    flexibleAuth,
    csrfProtection,
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const data = recordProductViewSchema.parse(req.body);

        const view = await storage.recordProductView(userId, data.productId);
        sendSuccess(res, view, 201);
      } catch (error) {
        sendErrorFromException(res, error, 'RecordProductView');
      }
    })
  );

  /**
   * DELETE /api/user/recently-viewed/:productId - Remove specific product from history
   */
  app.delete(
    '/api/user/recently-viewed/:productId',
    flexibleAuth,
    csrfProtection,
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

        const removed = await storage.removeFromRecentlyViewed(userId, productId);
        if (!removed) {
          sendError(res, 'Product not in recently viewed', 404);
          return;
        }

        sendSuccess(res, {});
      } catch (error) {
        sendErrorFromException(res, error, 'RemoveFromRecentlyViewed');
      }
    })
  );

  /**
   * DELETE /api/user/recently-viewed - Clear entire recently viewed history
   */
  app.delete(
    '/api/user/recently-viewed',
    flexibleAuth,
    csrfProtection,
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const removedCount = await storage.clearRecentlyViewed(userId);
        logger.info('Recently viewed history cleared', { userId, removedCount });
        sendSuccess(res, { removedCount });
      } catch (error) {
        sendErrorFromException(res, error, 'ClearRecentlyViewed');
      }
    })
  );
}
