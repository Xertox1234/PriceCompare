import { Express } from "express";
import { storage } from "../storage";
import { retailerCacheMiddleware } from "../middleware/redis-cache";

/**
 * Retailer Routes
 *
 * Handles retailer retrieval with Redis caching.
 */
export function registerRetailerRoutes(app: Express): void {
  // Get all retailers (with Redis caching)
  app.get("/api/retailers", retailerCacheMiddleware, async (req, res) => {
    try {
      // Set longer cache for retailers as they change less frequently
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=1800');

      const retailers = await storage.getRetailers();
      res.json(retailers);
    } catch (error: unknown) {
      res.status(500).json({ message: "Failed to fetch retailers" });
    }
  });
}
