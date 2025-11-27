import type { Express, Request, Response } from "express";
import { logger } from "../utils/logger";
import { z } from "zod";
import * as smartAlertsService from "../services/smart-alerts-service";
import { parseIntSafe, parseFloatSafe } from "../utils/validation-helpers";
import { sendSuccess, sendError, sendErrorFromException } from "../utils/api-response";
import { withAuth } from "./helpers";
import { csrfProtection } from "../middleware/security";

/**
 * Smart Alerts Routes
 *
 * API endpoints for smart threshold suggestions, predictive alerts,
 * and alert analytics.
 */

export function registerSmartAlertsRoutes(app: Express) {

  /**
   * GET /api/smart-alerts/suggestions/:productId
   * Get smart threshold suggestions for a product
   */
  app.get("/api/smart-alerts/suggestions/:productId", async (req: Request, res: Response): Promise<void> => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });
      const currentPrice = req.query.currentPrice
        ? parseFloatSafe(req.query.currentPrice as string, 'currentPrice', { min: 0 })
        : undefined;

      if (!currentPrice) {
        sendError(res, "Current price is required", 400);
        return;
      }

      const suggestions = await smartAlertsService.generateSmartThresholdSuggestions(
        productId,
        currentPrice
      );

      sendSuccess(res, {
        data: suggestions,
        count: suggestions.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GenerateSmartSuggestions');
    }
  });

  /**
   * GET /api/smart-alerts/predictive
   * Get predictive alerts for the authenticated user
   */
  app.get("/api/smart-alerts/predictive", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const alerts = await smartAlertsService.generatePredictiveAlerts(user.id);

      sendSuccess(res, {
        data: alerts,
        count: alerts.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GeneratePredictiveAlerts');
    }
  }));

  /**
   * GET /api/smart-alerts/effectiveness
   * Get alert effectiveness metrics for the authenticated user
   */
  app.get("/api/smart-alerts/effectiveness", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const effectiveness = await smartAlertsService.getAlertEffectiveness(user.id);

      sendSuccess(res, {
        data: effectiveness,
        count: effectiveness.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetAlertEffectiveness');
    }
  }));

  /**
   * GET /api/smart-alerts/analytics
   * Get comprehensive alert analytics for the authenticated user
   */
  app.get("/api/smart-alerts/analytics", withAuth(async (req, res) => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware
      const analytics = await smartAlertsService.getAlertAnalytics(user.id);

      sendSuccess(res, analytics);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetAlertAnalytics');
    }
  }));

  /**
   * POST /api/smart-alerts/create-suggested
   * Create a suggested alert based on smart recommendations
   */
  app.post("/api/smart-alerts/create-suggested", csrfProtection, withAuth(async (req, res): Promise<void> => {
    try {
      const user = req.user!; // Auth verified by withAuth middleware

      const schema = z.object({
        productId: z.number(),
        targetPrice: z.number(),
        reason: z.string(),
        confidence: z.number(),
        savingsPercent: z.number(),
        savingsAmount: z.number(),
        basedOn: z.enum(['historical_low', 'seasonal_pattern', 'trending_down', 'below_average']),
      });

      const data = schema.parse(req.body);

      const suggestion = {
        targetPrice: data.targetPrice,
        reason: data.reason,
        confidence: data.confidence,
        savingsPercent: data.savingsPercent,
        savingsAmount: data.savingsAmount,
        basedOn: data.basedOn,
      };

      const alert = await smartAlertsService.createSuggestedAlert(
        user.id,
        data.productId,
        suggestion
      );

      sendSuccess(res, alert);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CreateSuggestedAlert');
    }
  }));
}
