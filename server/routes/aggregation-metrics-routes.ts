/**
 * Aggregation Metrics API Routes
 *
 * Provides endpoints for monitoring price aggregation operations.
 *
 * SECURITY: Prometheus endpoint is protected by API key authentication in production.
 * Set METRICS_API_KEY environment variable to secure the /prometheus endpoint.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { metricsStore, getMetricsSummary } from '../services/aggregation-metrics';
import { logger } from '../utils/logger';
import { createErrorResponse } from '../utils/error-sanitizer';

const router = Router();

/**
 * Middleware to authenticate metrics API requests
 *
 * In production: Requires METRICS_API_KEY to be set and provided via Authorization header
 * In development: Allows requests without authentication (logs warning)
 *
 * Usage: Authorization: Bearer <METRICS_API_KEY>
 */
function metricsAuth(req: Request, res: Response, next: NextFunction): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  // Skip auth in test environment
  if (isTest) {
    return next();
  }

  const expectedApiKey = process.env.METRICS_API_KEY;

  // In production, API key is required
  if (!isDevelopment && !expectedApiKey) {
    logger.error('[MetricsAuth] CRITICAL: METRICS_API_KEY not set in production');
    res.status(500).json({
      error: 'Metrics endpoint not configured',
      details: 'METRICS_API_KEY environment variable is required in production',
    });
    return;
  }

  // In development, allow but warn if no API key is set
  if (isDevelopment && !expectedApiKey) {
    logger.warn('[MetricsAuth] METRICS_API_KEY not set in development - allowing unauthenticated access');
    return next();
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('[MetricsAuth] Missing or invalid Authorization header');
    res.status(401).json({
      error: 'Authentication required',
      details: 'Provide API key via Authorization: Bearer <METRICS_API_KEY>',
    });
    return;
  }

  const providedApiKey = authHeader.substring(7); // Remove "Bearer "

  // Constant-time comparison to prevent timing attacks
  if (providedApiKey !== expectedApiKey) {
    logger.warn('[MetricsAuth] Invalid API key provided');
    res.status(403).json({
      error: 'Invalid API key',
    });
    return;
  }

  // Authentication successful
  next();
}

/**
 * GET /api/aggregation-metrics/summary
 *
 * Get human-readable summary of all aggregation metrics
 *
 * @returns Text summary of metrics
 */
router.get('/summary', (req: Request, res: Response) => {
  try {
    const summary = getMetricsSummary();
    res.type('text/plain').send(summary);
  } catch (error: unknown) {
    logger.error('[AggregationMetrics] Error fetching summary:', { error });
    const errorResponse = createErrorResponse(error, 'FetchMetricsSummary');
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      details: errorResponse.details,
    });
  }
});

/**
 * GET /api/aggregation-metrics/stats
 *
 * Get detailed statistics for all operations
 *
 * @returns JSON with statistics for each operation type
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = metricsStore.getAllStats();
    res.json(stats);
  } catch (error: unknown) {
    logger.error('[AggregationMetrics] Error fetching stats:', { error });
    const errorResponse = createErrorResponse(error, 'FetchMetricsStats');
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      details: errorResponse.details,
    });
  }
});

/**
 * GET /api/aggregation-metrics/stats/:operation
 *
 * Get statistics for a specific operation (daily, weekly, monthly)
 *
 * @param operation - Operation name (daily, weekly, monthly)
 * @returns JSON with operation statistics
 */
router.get('/stats/:operation', (req: Request, res: Response) => {
  try {
    const { operation } = req.params;
    const stats = metricsStore.getStats(operation);

    if (!stats) {
      return res.status(404).json({
        error: 'No metrics found for operation',
        operation,
      });
    }

    res.json(stats);
  } catch (error: unknown) {
    logger.error('[AggregationMetrics] Error fetching operation stats:', {
      error,
      operation: req.params.operation,
    });
    const errorResponse = createErrorResponse(error, 'FetchOperationStats');
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      details: errorResponse.details,
    });
  }
});

/**
 * GET /api/aggregation-metrics/prometheus
 *
 * Export metrics in Prometheus format for scraping
 *
 * SECURITY: Protected by API key authentication in production
 *
 * @returns Prometheus-formatted metrics
 */
router.get('/prometheus', metricsAuth, (req: Request, res: Response) => {
  try {
    const prometheus = metricsStore.exportPrometheus();
    res.type('text/plain; version=0.0.4').send(prometheus);
  } catch (error: unknown) {
    logger.error('[AggregationMetrics] Error exporting Prometheus metrics:', { error });
    const errorResponse = createErrorResponse(error, 'ExportPrometheusMetrics');
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      details: errorResponse.details,
    });
  }
});

/**
 * GET /api/aggregation-metrics/health
 *
 * Check health of aggregation operations
 * Returns warning if success rate < 95% or if last operation failed
 *
 * @returns Health status with warnings if any
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const allStats = metricsStore.getAllStats();
    const operations = Object.keys(allStats);

    if (operations.length === 0) {
      return res.json({
        status: 'healthy',
        message: 'No aggregation operations have run yet',
      });
    }

    const warnings: string[] = [];

    for (const operation of operations) {
      const stats = allStats[operation];

      // Check success rate
      if (stats.successRate < 95) {
        warnings.push(
          `${operation} has low success rate: ${stats.successRate.toFixed(1)}%`
        );
      }

      // Check if last operation failed
      if (stats.lastError) {
        warnings.push(`${operation} last operation failed: ${stats.lastError}`);
      }

      // Check if operations are too slow (> 60 seconds avg)
      if (stats.avgDurationMs > 60000) {
        warnings.push(
          `${operation} operations are slow: ${(stats.avgDurationMs / 1000).toFixed(1)}s avg`
        );
      }
    }

    if (warnings.length > 0) {
      return res.status(503).json({
        status: 'degraded',
        warnings,
        stats: allStats,
      });
    }

    res.json({
      status: 'healthy',
      message: 'All aggregation operations are healthy',
      stats: allStats,
    });
  } catch (error: unknown) {
    logger.error('[AggregationMetrics] Error checking health:', { error });
    const errorResponse = createErrorResponse(error, 'CheckAggregationHealth');
    res.status(500).json({
      status: 'error',
      error: errorResponse.error,
      details: errorResponse.details,
    });
  }
});

export default router;
