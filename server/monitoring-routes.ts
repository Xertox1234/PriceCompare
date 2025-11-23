import type { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from './auth.js';
import { monitoringService } from './services/monitoring-service.js';
import { alertService } from './services/alert-service.js';
import { logger } from './utils/logger.js';
import { parseIntOptional } from './utils/validation-helpers.js';

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
      logger.error('Failed to get dashboard metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
      if (error instanceof Error && error.message.includes('must be')) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      logger.error('Failed to get error logs', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve error logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
      logger.error('Failed to clear error logs', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to clear error logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
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
      if (error instanceof Error && error.message.includes('must be')) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      logger.error('Failed to get alert history', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert history',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
      logger.error('Failed to send test alert', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to send test alert',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
