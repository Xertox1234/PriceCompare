import type { Express } from "express";
import * as communityService from "./services/community-service";

/**
 * Community Routes
 *
 * API endpoints for product watches, reputation, leaderboard,
 * and community features.
 */

export function registerCommunityRoutes(app: Express) {
  // Middleware to ensure user is authenticated
  const withAuth = (handler: any) => {
    return async (req: any, res: any) => {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      return handler(req, res);
    };
  };

  /**
   * POST /api/community/watch/:productId
   * Add product to watch list
   */
  app.post("/api/community/watch/:productId", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const productId = parseInt(req.params.productId);

      if (isNaN(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }

      const watch = await communityService.addProductWatch(user.id, productId);

      res.json({
        success: true,
        data: watch,
      });
    } catch (error: any) {
      console.error('Error adding product watch:', error);
      res.status(500).json({ error: error.message || "Failed to add watch" });
    }
  }));

  /**
   * DELETE /api/community/watch/:productId
   * Remove product from watch list
   */
  app.delete("/api/community/watch/:productId", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const productId = parseInt(req.params.productId);

      if (isNaN(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }

      const removed = await communityService.removeProductWatch(user.id, productId);

      if (!removed) {
        return res.status(404).json({ error: "Watch not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing product watch:', error);
      res.status(500).json({ error: error.message || "Failed to remove watch" });
    }
  }));

  /**
   * GET /api/community/watches
   * Get user's watched products
   */
  app.get("/api/community/watches", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const productIds = await communityService.getUserWatchedProducts(user.id);

      res.json({
        success: true,
        data: productIds,
        count: productIds.length,
      });
    } catch (error: any) {
      console.error('Error fetching watches:', error);
      res.status(500).json({ error: error.message || "Failed to fetch watches" });
    }
  }));

  /**
   * GET /api/community/watch-count/:productId
   * Get watch count for a product
   */
  app.get("/api/community/watch-count/:productId", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);

      if (isNaN(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }

      const count = await communityService.getProductWatchCount(productId);

      res.json({
        success: true,
        count,
      });
    } catch (error: any) {
      console.error('Error fetching watch count:', error);
      res.status(500).json({ error: error.message || "Failed to fetch watch count" });
    }
  });

  /**
   * GET /api/community/is-watching/:productId
   * Check if user is watching a product
   */
  app.get("/api/community/is-watching/:productId", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const productId = parseInt(req.params.productId);

      if (isNaN(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }

      const isWatching = await communityService.isUserWatchingProduct(user.id, productId);

      res.json({
        success: true,
        isWatching,
      });
    } catch (error: any) {
      console.error('Error checking watch status:', error);
      res.status(500).json({ error: error.message || "Failed to check watch status" });
    }
  }));

  /**
   * GET /api/community/most-watched
   * Get most watched products
   */
  app.get("/api/community/most-watched", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const products = await communityService.getMostWatchedProducts(limit);

      res.json({
        success: true,
        data: products,
        count: products.length,
      });
    } catch (error: any) {
      console.error('Error fetching most watched:', error);
      res.status(500).json({ error: error.message || "Failed to fetch most watched products" });
    }
  });

  /**
   * GET /api/community/reputation
   * Get user's reputation
   */
  app.get("/api/community/reputation", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const reputation = await communityService.getUserReputation(user.id);

      res.json({
        success: true,
        data: reputation,
      });
    } catch (error: any) {
      console.error('Error fetching reputation:', error);
      res.status(500).json({ error: error.message || "Failed to fetch reputation" });
    }
  }));

  /**
   * GET /api/community/leaderboard
   * Get reputation leaderboard
   */
  app.get("/api/community/leaderboard", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const leaderboard = await communityService.getLeaderboard(limit);

      res.json({
        success: true,
        data: leaderboard,
        count: leaderboard.length,
      });
    } catch (error: any) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ error: error.message || "Failed to fetch leaderboard" });
    }
  });

  /**
   * GET /api/community/recent-deals
   * Get recent deal spottings
   */
  app.get("/api/community/recent-deals", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const deals = await communityService.getRecentDealSpottings(limit);

      res.json({
        success: true,
        data: deals,
        count: deals.length,
      });
    } catch (error: any) {
      console.error('Error fetching recent deals:', error);
      res.status(500).json({ error: error.message || "Failed to fetch recent deals" });
    }
  });
}
