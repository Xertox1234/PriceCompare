import { Express } from "express";
import { forumStorage } from "../forum-storage";
import { withAuth } from "./helpers";
import { parseIntSafe } from "../utils/validation-helpers";

/**
 * Price Alert Routes
 *
 * Handles price alert creation, retrieval, updates, and deletion.
 */
export function registerAlertRoutes(app: Express): void {
  // Create a new price alert
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

  // Get all price alerts for the current user
  app.get("/api/price-alerts", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alerts = await forumStorage.getUserPriceAlerts(user.id);
      res.json(alerts);
    } catch (error) {
      console.error('Get price alerts error:', error);
      res.status(500).json({ error: "Failed to fetch price alerts" });
    }
  }));

  // Update a price alert (activate/deactivate)
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

  // Delete a price alert
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
}
