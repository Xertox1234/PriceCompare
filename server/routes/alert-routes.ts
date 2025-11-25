import { Express } from "express";
import { alertStorage } from "../storage";
import { withAuth } from "./helpers";
import { logger } from "../utils/logger";
import { parseIntSafe } from "../utils/validation-helpers";
import { csrfProtection } from "../middleware/security";

/**
 * Price Alert Routes
 *
 * Handles price alert creation, retrieval, updates, and deletion.
 */
export function registerAlertRoutes(app: Express): void {
  // Create a new price alert
  app.post("/api/price-alerts", csrfProtection, withAuth(async (req, res) => {
    try {
      const { productId, targetPrice, notifyForum } = req.body;
      const user = req.user;

      const alert = await alertStorage.createPriceAlert({
        userId: user.id,
        productId,
        targetPrice,
        notifyForum: notifyForum || false,
      });

      res.json({ success: true, alert });
    } catch (error) {
      logger.error('Create price alert error', { error: error instanceof Error ? error.message : String(error), userId: req.user.id });
      res.status(500).json({ error: "Failed to create price alert" });
    }
  }));

  // Get all price alerts for the current user
  app.get("/api/price-alerts", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alerts = await alertStorage.getUserPriceAlerts(user.id);
      res.json(alerts);
    } catch (error) {
      logger.error('Get price alerts error', { error: error instanceof Error ? error.message : String(error), userId: req.user.id });
      res.status(500).json({ error: "Failed to fetch price alerts" });
    }
  }));

  // Update a price alert (activate/deactivate)
  app.patch("/api/price-alerts/:id", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });
      const updates = req.body;

      const updatedAlert = await alertStorage.updatePriceAlert(alertId, user.id, updates);
      if (!updatedAlert) {
        return res.status(404).json({ error: "Alert not found or unauthorized" });
      }

      res.json(updatedAlert);
    } catch (error) {
      if (error instanceof Error && error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update price alert" });
    }
  }));

  // Delete a price alert
  app.delete("/api/price-alerts/:id", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });

      const deleted = await alertStorage.deletePriceAlert(alertId, user.id);
      if (!deleted) {
        return res.status(404).json({ error: "Alert not found or unauthorized" });
      }

      res.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete price alert" });
    }
  }));
}
