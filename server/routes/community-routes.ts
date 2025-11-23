import type { Express, Request, Response } from "express";
import { logger } from "../utils/logger";
import * as communityService from "../services/community-service";
import { parseIntSafe, parseIntOptional } from "../utils/validation-helpers";
import { createErrorResponse } from "../utils/error-sanitizer";
import { withAuth } from "./helpers";

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
  app.post("/api/community/watch/:productId", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const watch = await communityService.addProductWatch(user.id, productId);

      res.json({
        success: true,
        data: watch,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'AddProductWatch');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * DELETE /api/community/watch/:productId
   * Remove product from watch list
   */
  app.delete("/api/community/watch/:productId", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const removed = await communityService.removeProductWatch(user.id, productId);

      if (!removed) {
        return res.status(404).json({ error: "Watch not found" });
      }

      res.json({ success: true });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'RemoveProductWatch');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * GET /api/community/watches
   * Get user's watched products
   */
  app.get("/api/community/watches", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const productIds = await communityService.getUserWatchedProducts(user.id);

      res.json({
        success: true,
        data: productIds,
        count: productIds.length,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'FetchWatches');
      res.status(errorResponse.status).json({ error: errorResponse.error });
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

      res.json({
        success: true,
        count,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'FetchWatchCount');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * GET /api/community/is-watching/:productId
   * Check if user is watching a product
   */
  app.get("/api/community/is-watching/:productId", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const isWatching = await communityService.isUserWatchingProduct(user.id, productId);

      res.json({
        success: true,
        isWatching,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'CheckWatchStatus');
      res.status(errorResponse.status).json({ error: errorResponse.error });
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

      res.json({
        success: true,
        data: products,
        count: products.length,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'FetchMostWatched');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * GET /api/community/reputation
   * Get user's reputation
   */
  app.get("/api/community/reputation", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const reputation = await communityService.getUserReputation(user.id);

      res.json({
        success: true,
        data: reputation,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'FetchReputation');
      res.status(errorResponse.status).json({ error: errorResponse.error });
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

      res.json({
        success: true,
        data: leaderboard,
        count: leaderboard.length,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'FetchLeaderboard');
      res.status(errorResponse.status).json({ error: errorResponse.error });
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

      res.json({
        success: true,
        data: deals,
        count: deals.length,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'FetchRecentDeals');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * WATCH LIST MANAGEMENT ROUTES
   */

  /**
   * POST /api/community/watch-lists
   * Create a new watch list
   */
  app.post("/api/community/watch-lists", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const { name, description, color, icon } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Watch list name is required" });
      }

      const watchList = await communityService.createWatchList(
        user.id,
        name.trim(),
        description,
        color,
        icon
      );

      res.json({
        success: true,
        data: watchList,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'CreateWatchList');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * GET /api/community/watch-lists
   * Get all watch lists for the user
   */
  app.get("/api/community/watch-lists", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const watchLists = await communityService.getUserWatchLists(user.id);

      res.json({
        success: true,
        data: watchLists,
        count: watchLists.length,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'FetchWatchLists');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * GET /api/community/watch-lists/:listId
   * Get a specific watch list with details
   */
  app.get("/api/community/watch-lists/:listId", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const listId = parseIntSafe(req.params.listId, 'listId', { min: 1 });

      const watchList = await communityService.getWatchListById(user.id, listId);

      if (!watchList) {
        return res.status(404).json({ error: "Watch list not found" });
      }

      res.json({
        success: true,
        data: watchList,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'FetchWatchList');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * PATCH /api/community/watch-lists/:listId
   * Update a watch list
   */
  app.patch("/api/community/watch-lists/:listId", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const listId = parseIntSafe(req.params.listId, 'listId', { min: 1 });

      const { name, description, color, icon, sortOrder } = req.body;
      const updates: {
        name?: string;
        description?: string | null;
        color?: string | null;
        icon?: string | null;
        sortOrder?: number;
      } = {};

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;
      if (icon !== undefined) updates.icon = icon;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;

      const updated = await communityService.updateWatchList(user.id, listId, updates);

      if (!updated) {
        return res.status(404).json({ error: "Watch list not found" });
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'UpdateWatchList');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * DELETE /api/community/watch-lists/:listId
   * Delete a watch list
   */
  app.delete("/api/community/watch-lists/:listId", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const listId = parseIntSafe(req.params.listId, 'listId', { min: 1 });

      const deleted = await communityService.deleteWatchList(user.id, listId);

      if (!deleted) {
        return res.status(404).json({ error: "Watch list not found or cannot be deleted" });
      }

      res.json({ success: true });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'DeleteWatchList');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * GET /api/community/watch-lists/:listId/products
   * Get all products in a watch list
   */
  app.get("/api/community/watch-lists/:listId/products", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const listId = parseIntSafe(req.params.listId, 'listId', { min: 1 });

      const products = await communityService.getWatchListProducts(user.id, listId);

      res.json({
        success: true,
        data: products,
        count: products.length,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'FetchWatchListProducts');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * PATCH /api/community/product-watches/:watchId
   * Update a product watch (category, notes, priority, target price, list)
   */
  app.patch("/api/community/product-watches/:watchId", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const watchId = parseIntSafe(req.params.watchId, 'watchId', { min: 1 });

      const { category, notes, priority, targetPrice, watchListId } = req.body;
      const updates: {
        category?: string | null;
        notes?: string | null;
        priority?: number;
        targetPrice?: string | null;
        watchListId?: number | null;
      } = {};

      if (category !== undefined) updates.category = category;
      if (notes !== undefined) updates.notes = notes;
      if (priority !== undefined) {
        const priorityNum = parseIntSafe(priority, 'priority', { min: 1, max: 5 });
        updates.priority = priorityNum;
      }
      if (targetPrice !== undefined) updates.targetPrice = targetPrice;
      if (watchListId !== undefined) updates.watchListId = watchListId;

      const updated = await communityService.updateProductWatch(user.id, watchId, updates);

      if (!updated) {
        return res.status(404).json({ error: "Product watch not found" });
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'UpdateProductWatch');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * POST /api/community/product-watches/bulk-move
   * Move multiple products to a different watch list
   */
  app.post("/api/community/product-watches/bulk-move", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const { productWatchIds, targetListId } = req.body;

      if (!Array.isArray(productWatchIds) || productWatchIds.length === 0) {
        return res.status(400).json({ error: "Product watch IDs array is required" });
      }

      const movedCount = await communityService.moveProductsToWatchList(
        user.id,
        productWatchIds,
        targetListId
      );

      res.json({
        success: true,
        movedCount,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'BulkMoveProducts');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * POST /api/community/product-watches/bulk-delete
   * Remove multiple products from watch lists
   */
  app.post("/api/community/product-watches/bulk-delete", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const { productWatchIds } = req.body;

      if (!Array.isArray(productWatchIds) || productWatchIds.length === 0) {
        return res.status(400).json({ error: "Product watch IDs array is required" });
      }

      const deletedCount = await communityService.bulkRemoveProductWatches(
        user.id,
        productWatchIds
      );

      res.json({
        success: true,
        deletedCount,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'BulkDeleteProducts');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * GET /api/community/watch-lists/export
   * Export all watch lists as JSON
   */
  app.get("/api/community/watch-lists/export", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const exportData = await communityService.exportWatchLists(user.id);

      res.json({
        success: true,
        data: exportData,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'ExportWatchLists');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * POST /api/community/watch-lists/import
   * Import watch lists from JSON
   */
  app.post("/api/community/watch-lists/import", withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const importData = req.body;

      if (!importData || !importData.watchLists) {
        return res.status(400).json({ error: "Invalid import data format" });
      }

      const result = await communityService.importWatchLists(user.id, importData);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(error, 'ImportWatchLists');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));
}
