import type { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from '../auth';
import { monitoringService } from '../services/monitoring-service';
import { alertService } from '../services/alert-service';
import { logger } from '../utils/logger';
import { parseIntOptional } from '../utils/validation-helpers';
import { sendSuccess, sendError, sendErrorFromException } from "../utils/api-response";
import { csrfProtection } from "../middleware/security";

/**
 * Monitoring and Dashboard Routes
 *
 * Provides real-time metrics and system health information
 */
export function registerMonitoringRoutes(app: Express): void {

  /**
   * GET /api/monitoring/dashboard
   * Get comprehensive dashboard metrics
   */
  app.get("/api/monitoring/dashboard", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const metrics = await monitoringService.getDashboardMetrics();

      sendSuccess(res, metrics);
    } catch (error) {
      sendErrorFromException(res, error, 'GetDashboardMetrics');
    }
  });

  /**
   * GET /api/monitoring/errors
   * Get recent error logs
   */
  app.get("/api/monitoring/errors", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseIntOptional(req.query.limit as string, 'limit', { min: 1, max: 100 }) ?? 20;
      const errors = monitoringService.getRecentErrors(limit);

      sendSuccess(res, {
        errors,
        count: errors.length
      });
    } catch (error) {
      sendErrorFromException(res, error, 'GetRecentErrors');
    }
  });

  /**
   * POST /api/monitoring/errors/clear
   * Clear error logs
   */
  app.post("/api/monitoring/errors/clear", csrfProtection, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      monitoringService.clearErrors();

      sendSuccess(res, {
        message: 'Error logs cleared successfully'
      });
    } catch (error) {
      sendErrorFromException(res, error, 'ClearErrors');
    }
  });

  /**
   * GET /api/monitoring/health
   * Simple health check endpoint (no auth required)
   */
  app.get("/api/monitoring/health", async (req: Request, res: Response) => {
    try {
      const metrics = await monitoringService.getDashboardMetrics();

      sendSuccess(res, {
        status: metrics.health.overall,
        timestamp: metrics.timestamp,
        services: metrics.health.services
      });
    } catch (error) {
      sendError(res, 'Health check failed', 503);
    }
  });

  /**
   * GET /api/monitoring/alerts
   * Get alert history
   */
  app.get("/api/monitoring/alerts", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseIntOptional(req.query.limit as string, 'limit', { min: 1, max: 100 }) ?? 20;
      const alerts = alertService.getAlertHistory(limit);

      sendSuccess(res, {
        alerts,
        count: alerts.length
      });
    } catch (error) {
      sendErrorFromException(res, error, 'GetAlertHistory');
    }
  });

  /**
   * POST /api/monitoring/alerts/test
   * Send a test alert (for testing Slack integration)
   */
  app.post("/api/monitoring/alerts/test", csrfProtection, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await alertService.sendCustomAlert(
        'info',
        'Test Alert',
        '✅ This is a test alert from PriceCompare AI Agent Monitoring System',
        { test: true, triggeredBy: 'manual' }
      );

      sendSuccess(res, {
        message: 'Test alert sent successfully'
      });
    } catch (error) {
      sendErrorFromException(res, error, 'SendTestAlert');
    }
  });
}
