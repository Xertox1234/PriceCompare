import { Express, Request, Response } from 'express';
import { logger } from "../utils/logger";
import { z } from 'zod';
import { parseIntSafe, parseIntOptional } from '../utils/validation-helpers';
import {
  recordPriceChange,
  getPriceHistory,
  getPriceStats,
  generateDailySnapshots,
  getPriceSnapshots,
  detectSignificantPriceDrops,
  cleanupOldPriceHistory
} from '../services/price-history-service';
import type { AuthenticatedRequest } from '@shared/types';
import { handleRouteError, notFound } from "./helpers";

// Validation schemas
const recordPriceSchema = z.object({
  productOfferId: z.number().int().positive(),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  source: z.enum(['manual', 'scraper', 'api', 'admin']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

const priceHistoryQuerySchema = z.object({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  source: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : undefined)
});

const priceStatsSchema = z.object({
  days: z.string().optional().transform(val => val ? parseInt(val) : 90)
});

const priceSnapshotsQuerySchema = z.object({
  retailerId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

const generateSnapshotsSchema = z.object({
  date: z.string().optional().transform(val => val ? new Date(val) : new Date())
});

const priceDropsQuerySchema = z.object({
  thresholdPercent: z.string().optional().transform(val => val ? parseFloat(val) : 10),
  hours: z.string().optional().transform(val => val ? parseInt(val) : 24)
});

// Type predicate to check if request is authenticated
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return !!req.user;
}

// Wrapper to enforce authentication
function withAuth(handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    await handler(req, res);
  };
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

export function registerPriceHistoryRoutes(app: Express): void {
  /**
   * GET /api/products/:productId/offers/:offerId/price-history
   * Get price history for a specific product offer
   */
  app.get('/api/products/:productId/offers/:offerId/price-history', async (req: Request, res: Response) => {
    try {
      const productOfferId = parseIntSafe(req.params.offerId, 'offerId', { min: 1 });

      const queryParams = priceHistoryQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const history = await getPriceHistory({
        productOfferId,
        ...queryParams.data
      });

      res.json({
        success: true,
        data: history,
        count: history.length
      });
    } catch (error) {
      handleRouteError(res, error, 'GetPriceHistory');
    }
  });

  /**
   * GET /api/products/:productId/offers/:offerId/price-stats
   * Get price statistics for a specific product offer
   */
  app.get('/api/products/:productId/offers/:offerId/price-stats', async (req: Request, res: Response) => {
    try {
      const productOfferId = parseIntSafe(req.params.offerId, 'offerId', { min: 1 });

      const queryParams = priceStatsSchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const stats = await getPriceStats(productOfferId, queryParams.data.days);

      if (!stats) {
        notFound(res, 'Product offer');
        return;
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      handleRouteError(res, error, 'GetPriceStats');
    }
  });

  /**
   * GET /api/products/:productId/price-snapshots
   * Get daily price snapshots for a product
   */
  app.get('/api/products/:productId/price-snapshots', async (req: Request, res: Response) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const queryParams = priceSnapshotsQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const snapshots = await getPriceSnapshots(
        productId,
        queryParams.data.retailerId,
        queryParams.data.startDate,
        queryParams.data.endDate
      );

      res.json({
        success: true,
        data: snapshots,
        count: snapshots.length
      });
    } catch (error) {
      handleRouteError(res, error, 'GetPriceSnapshots');
    }
  });

  /**
   * POST /api/admin/price-history/record
   * Manually record a price change (admin only)
   */
  app.post('/api/admin/price-history/record', withAdmin(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validationResult = recordPriceSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({ error: 'Invalid request data', details: validationResult.error });
        return;
      }

      const { productOfferId, price, originalPrice, source, confidence, metadata } = validationResult.data;

      const result = await recordPriceChange(
        productOfferId,
        price,
        originalPrice,
        source || 'admin',
        confidence,
        metadata
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      handleRouteError(res, error, 'RecordPriceChange');
    }
  }));

  /**
   * POST /api/admin/price-history/generate-snapshots
   * Generate daily price snapshots (admin only)
   */
  app.post('/api/admin/price-history/generate-snapshots', withAdmin(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validationResult = generateSnapshotsSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({ error: 'Invalid request data', details: validationResult.error });
        return;
      }

      const { date } = validationResult.data;
      const count = await generateDailySnapshots(date);

      res.json({
        success: true,
        message: `Generated ${count} price snapshots`,
        count
      });
    } catch (error) {
      handleRouteError(res, error, 'GenerateSnapshots');
    }
  }));

  /**
   * GET /api/admin/price-history/price-drops
   * Detect significant price drops (admin only)
   */
  app.get('/api/admin/price-history/price-drops', withAdmin(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const queryParams = priceDropsQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const drops = await detectSignificantPriceDrops(
        queryParams.data.thresholdPercent,
        queryParams.data.hours
      );

      res.json({
        success: true,
        data: drops,
        count: drops.length
      });
    } catch (error) {
      handleRouteError(res, error, 'DetectPriceDrops');
    }
  }));

  /**
   * DELETE /api/admin/price-history/cleanup
   * Clean up old price history records (admin only)
   */
  app.delete('/api/admin/price-history/cleanup', withAdmin(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const daysToKeep = req.query.days
        ? parseIntSafe(req.query.days as string, 'days', { min: 1 })
        : 90;

      const deletedCount = await cleanupOldPriceHistory(daysToKeep);

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} old price history records`,
        deletedCount
      });
    } catch (error) {
      handleRouteError(res, error, 'CleanupPriceHistory');
    }
  }));

  /**
   * GET /api/price-history/recent-drops
   * Get recent significant price drops (public endpoint)
   */
  app.get('/api/price-history/recent-drops', async (req: Request, res: Response) => {
    try {
      const queryParams = priceDropsQuerySchema.safeParse(req.query);

      if (!queryParams.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryParams.error });
        return;
      }

      const drops = await detectSignificantPriceDrops(
        queryParams.data.thresholdPercent,
        queryParams.data.hours
      );

      // Limit to top 20 for public endpoint
      const limitedDrops = drops.slice(0, 20);

      res.json({
        success: true,
        data: limitedDrops,
        count: limitedDrops.length
      });
    } catch (error) {
      handleRouteError(res, error, 'GetRecentPriceDrops');
    }
  });
}
