import { Express } from "express";
import { forumStorage } from "../forum-storage";
import { withAuth, handleRouteError, notFound } from "./helpers";
import { parseIntSafe } from "../utils/validation-helpers";
import { csrfProtection } from "../middleware/security";
import { sendSuccess, sendError, sendErrorFromException } from "../utils/api-response";

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

      const alert = await forumStorage.createPriceAlert({
        userId: user.id,
        productId,
        targetPrice,
        notifyForum: notifyForum || false,
      });

      sendSuccess(res, alert, 201);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CreatePriceAlert');
    }
  }));

  // Get all price alerts for the current user
  app.get("/api/price-alerts", withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alerts = await forumStorage.getUserPriceAlerts(user.id);
      sendSuccess(res, alerts);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetPriceAlerts');
    }
  }));

  // Update a price alert (activate/deactivate)
  app.patch("/api/price-alerts/:id", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });
      const updates = req.body;

      const updatedAlert = await forumStorage.updatePriceAlert(alertId, user.id, updates);
      if (!updatedAlert) {
        sendError(res, 'Alert not found or unauthorized', 404);
        return;
      }

      sendSuccess(res, updatedAlert);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'UpdatePriceAlert');
    }
  }));

  // Delete a price alert
  app.delete("/api/price-alerts/:id", csrfProtection, withAuth(async (req, res) => {
    try {
      const user = req.user;
      const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });

      const deleted = await forumStorage.deletePriceAlert(alertId, user.id);
      if (!deleted) {
        sendError(res, 'Alert not found or unauthorized', 404);
        return;
      }

      sendSuccess(res, {});
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'DeletePriceAlert');
    }
  }));
}
