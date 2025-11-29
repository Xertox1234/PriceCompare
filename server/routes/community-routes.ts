import type { Express, Request, Response } from "express";
import { logger } from "../utils/logger";
import * as communityService from "../services/community-service";
import { parseIntSafe, parseIntOptional } from "../utils/validation-helpers";
import { sendSuccess, sendError, sendErrorFromException } from "../utils/api-response";
import { withAuth } from "./helpers";
import { csrfProtection } from "../middleware/security";
import { z } from "zod";

// Validation schemas for community routes

// Create watch list schema
const createWatchListSchema = z.object({
  name: z.string().min(1, 'Watch list name is required').max(100, 'Name must be 100 characters or less').transform(s => s.trim()),
  description: z.string().max(500, 'Description must be 500 characters or less').optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional().nullable(),
  icon: z.string().max(50, 'Icon must be 50 characters or less').optional().nullable(),
});

// Update watch list schema
const updateWatchListSchema = z.object({
  name: z.string().min(1).max(100, 'Name must be 100 characters or less').transform(s => s.trim()).optional(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional().nullable(),
  icon: z.string().max(50, 'Icon must be 50 characters or less').optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

// Update product watch schema
const updateProductWatchSchema = z.object({
  category: z.string().max(50, 'Category must be 50 characters or less').optional().nullable(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional().nullable(),
  priority: z.number().int().min(1, 'Priority must be between 1 and 5').max(5, 'Priority must be between 1 and 5').optional(),
  targetPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Target price must be a valid decimal').optional().nullable(),
  watchListId: z.number().int().positive().optional().nullable(),
});

// Bulk move products schema
const bulkMoveProductsSchema = z.object({
  productWatchIds: z.array(z.number().int().positive()).min(1, 'At least one product watch ID is required').max(100, 'Maximum 100 items per bulk operation'),
  targetListId: z.number().int().positive().optional().nullable(),
});

// Bulk delete products schema
const bulkDeleteProductsSchema = z.object({
  productWatchIds: z.array(z.number().int().positive()).min(1, 'At least one product watch ID is required').max(100, 'Maximum 100 items per bulk operation'),
});

// Import watch lists schema
const importWatchListsSchema = z.object({
  watchLists: z.array(z.object({
    name: z.string(),
    description: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    products: z.array(z.object({
      productId: z.number().int().positive(),
      category: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      priority: z.number().int().min(1).max(5).optional(),
      targetPrice: z.string().optional().nullable(),
    })).optional(),
  })).min(1, 'At least one watch list is required'),
});

/**
 * Community Routes
 *
 * API endpoints for product watches, reputation, leaderboard,
 * and community features.
 */

export function registerCommunityRoutes(app: Express) {

  /**
   * POST /api/community/watch/:productId
   * Add product to watch list
   */
  app.post("/api/community/watch/:productId", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user; // Auth verified by withAuth middleware
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const watch = await communityService.addProductWatch(user.id, productId);

      sendSuccess(res, watch);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'AddProductWatch');
    }
  }));

  /**
   * DELETE /api/community/watch/:productId
   * Remove product from watch list
   */
  app.delete("/api/community/watch/:productId", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user; // Auth verified by withAuth middleware
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const removed = await communityService.removeProductWatch(user.id, productId);

      if (!removed) {
        sendError(res, "Watch not found", 404);
        return;
      }

      res.status(204).send();
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'RemoveProductWatch');
    }
  }));

  /**
   * GET /api/community/watches
   * Get user's watched products
   */
  app.get("/api/community/watches", withAuth(async (req, res) => {
    try {
      const user = req.user; // Auth verified by withAuth middleware
      const productIds = await communityService.getUserWatchedProducts(user.id);

      sendSuccess(res, {
        productIds,
        count: productIds.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchWatches');
    }
  }));

  /**
   * GET /api/community/watch-count/:productId
   * Get watch count for a product
   */
  app.get("/api/community/watch-count/:productId", async (req, res) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const count = await communityService.getProductWatchCount(productId);

      sendSuccess(res, { count });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchWatchCount');
    }
  });

  /**
   * GET /api/community/is-watching/:productId
   * Check if user is watching a product
   */
  app.get("/api/community/is-watching/:productId", withAuth(async (req, res) => {
    try {
      const user = req.user; // Auth verified by withAuth middleware
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const isWatching = await communityService.isUserWatchingProduct(user.id, productId);

      sendSuccess(res, { isWatching });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CheckWatchStatus');
    }
  }));

  /**
   * GET /api/community/most-watched
   * Get most watched products
   */
  app.get("/api/community/most-watched", async (req, res) => {
    try {
      const limit = parseIntOptional(req.query.limit as string, 'limit', { min: 1, max: 100 }) ?? 10;
      const products = await communityService.getMostWatchedProducts(limit);

      sendSuccess(res, {
        products,
        count: products.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchMostWatched');
    }
  });

  /**
   * GET /api/community/reputation
   * Get user's reputation
   */
  app.get("/api/community/reputation", withAuth(async (req, res) => {
    try {
      const user = req.user; // Auth verified by withAuth middleware
      const reputation = await communityService.getUserReputation(user.id);

      sendSuccess(res, reputation);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchReputation');
    }
  }));

  /**
   * GET /api/community/leaderboard
   * Get reputation leaderboard
   */
  app.get("/api/community/leaderboard", async (req, res) => {
    try {
      const limit = parseIntOptional(req.query.limit as string, 'limit', { min: 1, max: 100 }) ?? 10;
      const leaderboard = await communityService.getLeaderboard(limit);

      sendSuccess(res, {
        leaderboard,
        count: leaderboard.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchLeaderboard');
    }
  });

  /**
   * GET /api/community/recent-deals
   * Get recent deal spottings
   */
  app.get("/api/community/recent-deals", async (req, res) => {
    try {
      const limit = parseIntOptional(req.query.limit as string, 'limit', { min: 1, max: 100 }) ?? 10;
      const deals = await communityService.getRecentDealSpottings(limit);

      sendSuccess(res, {
        deals,
        count: deals.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchRecentDeals');
    }
  });

  /**
   * WATCH LIST MANAGEMENT ROUTES
   */

  /**
   * POST /api/community/watch-lists
   * Create a new watch list
   */
  app.post("/api/community/watch-lists", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const validatedData = createWatchListSchema.parse(req.body);

      const watchList = await communityService.createWatchList(
        user.id,
        validatedData.name,
        validatedData.description ?? undefined,
        validatedData.color ?? undefined,
        validatedData.icon ?? undefined
      );

      sendSuccess(res, watchList, 201);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CreateWatchList');
    }
  }));

  /**
   * GET /api/community/watch-lists
   * Get all watch lists for the user
   */
  app.get("/api/community/watch-lists", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const watchLists = await communityService.getUserWatchLists(user.id);

      sendSuccess(res, {
        watchLists,
        count: watchLists.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchWatchLists');
    }
  }));

  /**
   * GET /api/community/watch-lists/:listId
   * Get a specific watch list with details
   */
  app.get("/api/community/watch-lists/:listId", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const listId = parseIntSafe(req.params.listId, 'listId', { min: 1 });

      const watchList = await communityService.getWatchListById(user.id, listId);

      if (!watchList) {
        sendError(res, "Watch list not found", 404);
        return;
      }

      sendSuccess(res, watchList);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchWatchList');
    }
  }));

  /**
   * PATCH /api/community/watch-lists/:listId
   * Update a watch list
   */
  app.patch("/api/community/watch-lists/:listId", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const listId = parseIntSafe(req.params.listId, 'listId', { min: 1 });
      const validatedData = updateWatchListSchema.parse(req.body);

      const updated = await communityService.updateWatchList(user.id, listId, validatedData);

      if (!updated) {
        sendError(res, "Watch list not found", 404);
        return;
      }

      sendSuccess(res, updated);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'UpdateWatchList');
    }
  }));

  /**
   * DELETE /api/community/watch-lists/:listId
   * Delete a watch list
   */
  app.delete("/api/community/watch-lists/:listId", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const listId = parseIntSafe(req.params.listId, 'listId', { min: 1 });

      const deleted = await communityService.deleteWatchList(user.id, listId);

      if (!deleted) {
        sendError(res, "Watch list not found or cannot be deleted", 404);
        return;
      }

      res.status(204).send();
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'DeleteWatchList');
    }
  }));

  /**
   * GET /api/community/watch-lists/:listId/products
   * Get all products in a watch list
   */
  app.get("/api/community/watch-lists/:listId/products", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const listId = parseIntSafe(req.params.listId, 'listId', { min: 1 });

      const products = await communityService.getWatchListProducts(user.id, listId);

      sendSuccess(res, {
        products,
        count: products.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchWatchListProducts');
    }
  }));

  /**
   * PATCH /api/community/product-watches/:watchId
   * Update a product watch (category, notes, priority, target price, list)
   */
  app.patch("/api/community/product-watches/:watchId", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const watchId = parseIntSafe(req.params.watchId, 'watchId', { min: 1 });
      const validatedData = updateProductWatchSchema.parse(req.body);

      const updated = await communityService.updateProductWatch(user.id, watchId, validatedData);

      if (!updated) {
        sendError(res, "Product watch not found", 404);
        return;
      }

      sendSuccess(res, updated);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'UpdateProductWatch');
    }
  }));

  /**
   * POST /api/community/product-watches/bulk-move
   * Move multiple products to a different watch list
   */
  app.post("/api/community/product-watches/bulk-move", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const validatedData = bulkMoveProductsSchema.parse(req.body);

      const movedCount = await communityService.moveProductsToWatchList(
        user.id,
        validatedData.productWatchIds,
        validatedData.targetListId ?? null
      );

      sendSuccess(res, { movedCount });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'BulkMoveProducts');
    }
  }));

  /**
   * POST /api/community/product-watches/bulk-delete
   * Remove multiple products from watch lists
   */
  app.post("/api/community/product-watches/bulk-delete", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const validatedData = bulkDeleteProductsSchema.parse(req.body);

      const deletedCount = await communityService.bulkRemoveProductWatches(
        user.id,
        validatedData.productWatchIds
      );

      sendSuccess(res, { deletedCount });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'BulkDeleteProducts');
    }
  }));

  /**
   * GET /api/community/watch-lists/export
   * Export all watch lists as JSON
   */
  app.get("/api/community/watch-lists/export", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const exportData = await communityService.exportWatchLists(user.id);

      sendSuccess(res, exportData);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'ExportWatchLists');
    }
  }));

  /**
   * POST /api/community/watch-lists/import
   * Import watch lists from JSON
   */
  app.post("/api/community/watch-lists/import", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const validatedData = importWatchListsSchema.parse(req.body);

      const result = await communityService.importWatchLists(user.id, validatedData);

      sendSuccess(res, result);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'ImportWatchLists');
    }
  }));
}
