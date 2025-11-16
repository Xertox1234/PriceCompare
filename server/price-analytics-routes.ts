import { Express, Request, Response } from 'express';
import { logger } from "./utils/logger";
import { z } from 'zod';
import { db } from "./db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { priceAggregatesWeekly, priceAggregatesMonthly, priceTrends } from "../shared/schema";
import { trendAnalysisService } from './services/trend-analysis-service';
import { priceAggregationService } from './services/price-aggregation-service';
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
      const productId = parseInt(req.params.productId);

      if (isNaN(productId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }

      const queryParams = weeklyAggregatesQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const { year, week, limit } = queryParams.data;

      // Build query conditions
      const conditions = [eq(priceAggregatesWeekly.productId, productId)];

      if (year) {
        conditions.push(eq(priceAggregatesWeekly.year, year));
      }

      if (week) {
        conditions.push(eq(priceAggregatesWeekly.week, week));
      }

      const aggregates = await db
        .select()
        .from(priceAggregatesWeekly)
        .where(and(...conditions))
        .orderBy(desc(priceAggregatesWeekly.year), desc(priceAggregatesWeekly.week))
        .limit(limit || 12);

      res.json(aggregates);
    } catch (error) {
      logger.error('Error fetching weekly aggregates:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to fetch weekly aggregates' });
    }
  });

  /**
   * GET /api/products/:productId/aggregates/monthly
   * Get monthly price aggregates for a product
   */
  app.get('/api/products/:productId/aggregates/monthly', async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.productId);

      if (isNaN(productId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }

      const queryParams = monthlyAggregatesQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const { year, month, limit } = queryParams.data;

      // Build query conditions
      const conditions = [eq(priceAggregatesMonthly.productId, productId)];

      if (year) {
        conditions.push(eq(priceAggregatesMonthly.year, year));
      }

      if (month) {
        conditions.push(eq(priceAggregatesMonthly.month, month));
      }

      const aggregates = await db
        .select()
        .from(priceAggregatesMonthly)
        .where(and(...conditions))
        .orderBy(desc(priceAggregatesMonthly.year), desc(priceAggregatesMonthly.month))
        .limit(limit || 12);

      res.json(aggregates);
    } catch (error) {
      logger.error('Error fetching monthly aggregates:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to fetch monthly aggregates' });
    }
  });

  /**
   * GET /api/products/:productId/retailers/:retailerId/aggregates/weekly
   * Get weekly price aggregates for a specific product-retailer combination
   */
  app.get('/api/products/:productId/retailers/:retailerId/aggregates/weekly', async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.productId);
      const retailerId = parseInt(req.params.retailerId);

      if (isNaN(productId) || isNaN(retailerId)) {
        res.status(400).json({ error: 'Invalid product or retailer ID' });
        return;
      }

      const queryParams = weeklyAggregatesQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const { limit } = queryParams.data;

      const aggregates = await db
        .select()
        .from(priceAggregatesWeekly)
        .where(
          and(
            eq(priceAggregatesWeekly.productId, productId),
            eq(priceAggregatesWeekly.retailerId, retailerId)
          )
        )
        .orderBy(desc(priceAggregatesWeekly.year), desc(priceAggregatesWeekly.week))
        .limit(limit || 12);

      res.json(aggregates);
    } catch (error) {
      logger.error('Error fetching weekly aggregates:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to fetch weekly aggregates' });
    }
  });

  /**
   * GET /api/products/:productId/retailers/:retailerId/aggregates/monthly
   * Get monthly price aggregates for a specific product-retailer combination
   */
  app.get('/api/products/:productId/retailers/:retailerId/aggregates/monthly', async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.productId);
      const retailerId = parseInt(req.params.retailerId);

      if (isNaN(productId) || isNaN(retailerId)) {
        res.status(400).json({ error: 'Invalid product or retailer ID' });
        return;
      }

      const queryParams = monthlyAggregatesQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const { limit } = queryParams.data;

      const aggregates = await db
        .select()
        .from(priceAggregatesMonthly)
        .where(
          and(
            eq(priceAggregatesMonthly.productId, productId),
            eq(priceAggregatesMonthly.retailerId, retailerId)
          )
        )
        .orderBy(desc(priceAggregatesMonthly.year), desc(priceAggregatesMonthly.month))
        .limit(limit || 12);

      res.json(aggregates);
    } catch (error) {
      logger.error('Error fetching monthly aggregates:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to fetch monthly aggregates' });
    }
  });

  /**
   * GET /api/products/:productId/trends
   * Get price trends for all retailers selling this product
   */
  app.get('/api/products/:productId/trends', async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.productId);

      if (isNaN(productId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }

      const trends = await trendAnalysisService.getProductTrendSummary(productId);

      res.json(trends);
    } catch (error) {
      logger.error('Error fetching trends:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to fetch trends' });
    }
  });

  /**
   * GET /api/products/:productId/retailers/:retailerId/trend
   * Get price trend for a specific product-retailer combination
   */
  app.get('/api/products/:productId/retailers/:retailerId/trend', async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.productId);
      const retailerId = parseInt(req.params.retailerId);

      if (isNaN(productId) || isNaN(retailerId)) {
        res.status(400).json({ error: 'Invalid product or retailer ID' });
        return;
      }

      const trend = await trendAnalysisService.getProductTrend(productId, retailerId);

      if (!trend) {
        res.status(404).json({ error: 'Trend data not found' });
        return;
      }

      res.json(trend);
    } catch (error) {
      logger.error('Error fetching trend:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to fetch trend' });
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
      logger.error('Error calculating weekly aggregates:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to calculate weekly aggregates' });
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
      logger.error('Error calculating monthly aggregates:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to calculate monthly aggregates' });
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
      logger.error('Error analyzing trends:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to analyze trends' });
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
      // OPTIMIZATION 1: Use SQL COUNT(*) instead of fetching all IDs
      const weeklyCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(priceAggregatesWeekly);

      const monthlyCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(priceAggregatesMonthly);

      // OPTIMIZATION 2: Use GROUP BY to count trends by direction in a single query
      const trendStatsResult = await db
        .select({
          direction: priceTrends.trendDirection,
          count: sql<number>`count(*)::int`
        })
        .from(priceTrends)
        .groupBy(priceTrends.trendDirection);

      // Convert grouped results to breakdown object
      const trendCounts = {
        uptrend: 0,
        downtrend: 0,
        stable: 0
      };

      let totalTrends = 0;
      for (const stat of trendStatsResult) {
        totalTrends += stat.count;
        if (stat.direction === 'uptrend') trendCounts.uptrend = stat.count;
        else if (stat.direction === 'downtrend') trendCounts.downtrend = stat.count;
        else if (stat.direction === 'stable') trendCounts.stable = stat.count;
      }

      res.json({
        weeklyAggregates: weeklyCountResult[0]?.count || 0,
        monthlyAggregates: monthlyCountResult[0]?.count || 0,
        totalTrends,
        trendBreakdown: trendCounts
      });
    } catch (error) {
      logger.error('Error fetching analytics overview:', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to fetch analytics overview' });
    }
  });

  logger.info('Price analytics routes registered');
}
