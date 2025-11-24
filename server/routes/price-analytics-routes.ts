import { Express, Request, Response } from 'express';
import { logger } from "../utils/logger";
import { createErrorResponse } from "../utils/error-sanitizer";
import { z } from 'zod';
import { storage } from "../storage";
import { parseIntSafe } from '../utils/validation-helpers';
import { trendAnalysisService } from '../services/trend-analysis-service';
import { priceAggregationService } from '../services/price-aggregation-service';
import type { AuthenticatedRequest } from '@shared/types';

// Validation schemas
const weeklyAggregatesQuerySchema = z.object({
  year: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  week: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 12) // Default to 12 weeks
});

const monthlyAggregatesQuerySchema = z.object({
  year: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  month: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 12) // Default to 12 months
});

const trendQuerySchema = z.object({
  analysisPeriodDays: z.string().optional().transform(val => val ? parseInt(val) : 30)
});

// Type predicate to check if request is authenticated
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return !!req.user;
}

// Wrapper to enforce admin role
function withAdmin(handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    await handler(req, res);
  };
}

export function registerPriceAnalyticsRoutes(app: Express): void {
  /**
   * GET /api/products/:productId/aggregates/weekly
   * Get weekly price aggregates for a product
   */
  app.get('/api/products/:productId/aggregates/weekly', async (req: Request, res: Response) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const queryParams = weeklyAggregatesQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const { year, week, limit } = queryParams.data;

      const aggregates = await storage.getWeeklyAggregates(productId, { year, week, limit });

      res.json(aggregates);
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetWeeklyAggregates');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * GET /api/products/:productId/aggregates/monthly
   * Get monthly price aggregates for a product
   */
  app.get('/api/products/:productId/aggregates/monthly', async (req: Request, res: Response) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const queryParams = monthlyAggregatesQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const { year, month, limit } = queryParams.data;

      const aggregates = await storage.getMonthlyAggregates(productId, { year, month, limit });

      res.json(aggregates);
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetMonthlyAggregates');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * GET /api/products/:productId/retailers/:retailerId/aggregates/weekly
   * Get weekly price aggregates for a specific product-retailer combination
   */
  app.get('/api/products/:productId/retailers/:retailerId/aggregates/weekly', async (req: Request, res: Response) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });
      const retailerId = parseIntSafe(req.params.retailerId, 'retailerId', { min: 1 });

      const queryParams = weeklyAggregatesQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const { limit } = queryParams.data;

      const aggregates = await storage.getWeeklyAggregates(productId, { retailerId, limit });

      res.json(aggregates);
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetRetailerWeeklyAggregates');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * GET /api/products/:productId/retailers/:retailerId/aggregates/monthly
   * Get monthly price aggregates for a specific product-retailer combination
   */
  app.get('/api/products/:productId/retailers/:retailerId/aggregates/monthly', async (req: Request, res: Response) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });
      const retailerId = parseIntSafe(req.params.retailerId, 'retailerId', { min: 1 });

      const queryParams = monthlyAggregatesQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const { limit } = queryParams.data;

      const aggregates = await storage.getMonthlyAggregates(productId, { retailerId, limit });

      res.json(aggregates);
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetRetailerMonthlyAggregates');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * GET /api/products/:productId/trends
   * Get price trends for all retailers selling this product
   */
  app.get('/api/products/:productId/trends', async (req: Request, res: Response) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const trends = await trendAnalysisService.getProductTrendSummary(productId);

      res.json(trends);
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetProductTrends');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * GET /api/products/:productId/retailers/:retailerId/trend
   * Get price trend for a specific product-retailer combination
   */
  app.get('/api/products/:productId/retailers/:retailerId/trend', async (req: Request, res: Response) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });
      const retailerId = parseIntSafe(req.params.retailerId, 'retailerId', { min: 1 });

      const trend = await trendAnalysisService.getProductTrend(productId, retailerId);

      if (!trend) {
        res.status(404).json({ error: 'Trend data not found' });
        return;
      }

      res.json(trend);
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetProductRetailerTrend');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * POST /api/admin/analytics/calculate-weekly
   * Manually trigger weekly aggregation calculation (admin only)
   */
  app.post('/api/admin/analytics/calculate-weekly', withAdmin(async (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info(`Admin ${req.user.username} triggered weekly aggregation calculation`);
      const count = await priceAggregationService.calculateWeeklyAggregates();
      res.json({ success: true, aggregatesCalculated: count });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'CalculateWeeklyAggregates');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * POST /api/admin/analytics/calculate-monthly
   * Manually trigger monthly aggregation calculation (admin only)
   */
  app.post('/api/admin/analytics/calculate-monthly', withAdmin(async (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info(`Admin ${req.user.username} triggered monthly aggregation calculation`);
      const count = await priceAggregationService.calculateMonthlyAggregates();
      res.json({ success: true, aggregatesCalculated: count });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'CalculateMonthlyAggregates');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * POST /api/admin/analytics/analyze-trends
   * Manually trigger trend analysis (admin only)
   */
  app.post('/api/admin/analytics/analyze-trends', withAdmin(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const queryParams = trendQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const { analysisPeriodDays } = queryParams.data;

      logger.info(`Admin ${req.user.username} triggered trend analysis (${analysisPeriodDays} days)`);
      const count = await trendAnalysisService.analyzeTrendsForAllProducts(analysisPeriodDays);
      res.json({ success: true, trendsAnalyzed: count });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'AnalyzeTrends');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  /**
   * GET /api/analytics/overview
   * Get analytics overview with aggregate statistics
   *
   * OPTIMIZED: Uses SQL COUNT(*) and GROUP BY instead of fetching all records
   * Reduces memory usage and improves query performance significantly
   */
  app.get('/api/analytics/overview', async (req: Request, res: Response) => {
    try {
      const overview = await storage.getAnalyticsOverview();
      res.json(overview);
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetAnalyticsOverview');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  });

  /**
   * GET /api/health/job-locks
   * Health check endpoint for monitoring distributed job locks
   *
   * Returns information about active and expired locks across all servers
   */
  app.get('/api/health/job-locks', async (req: Request, res: Response) => {
    try {
      const now = new Date();

      // Fetch all locks via storage layer
      const allLocks = await storage.getJobLocks();

      // Categorize locks
      const activeLocks = allLocks.filter(lock => new Date(lock.expiresAt) > now);
      const expiredLocks = allLocks.filter(lock => new Date(lock.expiresAt) <= now);

      // Group by job name for analysis
      const locksByJob: Record<string, { active: number; expired: number }> = {};
      allLocks.forEach(lock => {
        if (!locksByJob[lock.jobName]) {
          locksByJob[lock.jobName] = { active: 0, expired: 0 };
        }
        if (new Date(lock.expiresAt) > now) {
          locksByJob[lock.jobName].active++;
        } else {
          locksByJob[lock.jobName].expired++;
        }
      });

      res.json({
        status: 'ok',
        timestamp: now.toISOString(),
        summary: {
          totalLocks: allLocks.length,
          activeLocks: activeLocks.length,
          expiredLocks: expiredLocks.length,
        },
        byJob: locksByJob,
        activeLockDetails: activeLocks.map(lock => ({
          jobName: lock.jobName,
          lockedBy: lock.lockedBy,
          lockedAt: lock.lockedAt,
          expiresAt: lock.expiresAt,
          expiresIn: Math.floor((new Date(lock.expiresAt).getTime() - now.getTime()) / 1000),
        })),
        expiredLockDetails: expiredLocks.map(lock => ({
          jobName: lock.jobName,
          lockedBy: lock.lockedBy,
          lockedAt: lock.lockedAt,
          expiresAt: lock.expiresAt,
          expiredFor: Math.floor((now.getTime() - new Date(lock.expiresAt).getTime()) / 1000),
        })),
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetJobLockHealth');
      res.status(errorResponse.status).json({
        status: 'error',
        error: errorResponse.error
      });
    }
  });

  logger.info('Price analytics routes registered');
}
