import type { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from '../middleware/auth';
import { monitoringService } from '../services/monitoring-service';
import { alertService } from '../services/alert-service';
import { logger } from '../utils/logger';
import { parseIntOptional } from '../utils/validation-helpers';
import { createErrorResponse } from '../utils/error-sanitizer';

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

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetDashboardMetrics');
      res.status(errorResponse.status).json({ success: false, error: errorResponse.error });
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

      res.json({
        success: true,
        data: {
          errors,
          count: errors.length
        }
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetRecentErrors');
      res.status(errorResponse.status).json({ success: false, error: errorResponse.error });
    }
  });

  /**
   * POST /api/monitoring/errors/clear
   * Clear error logs
   */
  app.post("/api/monitoring/errors/clear", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      monitoringService.clearErrors();

      res.json({
        success: true,
        message: 'Error logs cleared successfully'
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'ClearErrors');
      res.status(errorResponse.status).json({ success: false, error: errorResponse.error });
    }
  });

  /**
   * GET /api/monitoring/health
   * Simple health check endpoint (no auth required)
   */
  app.get("/api/monitoring/health", async (req: Request, res: Response) => {
    try {
      const metrics = await monitoringService.getDashboardMetrics();

      res.json({
        success: true,
        status: metrics.health.overall,
        timestamp: metrics.timestamp,
        services: metrics.health.services
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Health check failed'
      });
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

      res.json({
        success: true,
        data: {
          alerts,
          count: alerts.length
        }
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetAlertHistory');
      res.status(errorResponse.status).json({ success: false, error: errorResponse.error });
    }
  });

  /**
   * POST /api/monitoring/alerts/test
   * Send a test alert (for testing Slack integration)
   */
  app.post("/api/monitoring/alerts/test", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await alertService.sendCustomAlert(
        'info',
        'Test Alert',
        '✅ This is a test alert from PriceCompare AI Agent Monitoring System',
        { test: true, triggeredBy: 'manual' }
      );

      res.json({
        success: true,
        message: 'Test alert sent successfully'
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'SendTestAlert');
      res.status(errorResponse.status).json({ success: false, error: errorResponse.error });
    }
  });
}
