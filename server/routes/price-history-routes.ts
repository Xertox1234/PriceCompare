import { Express, Request, Response } from 'express';
import { logger } from "../utils/logger";
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
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
import { withAuth, withAdmin } from './helpers';
import type { AuthenticatedRequest } from '@shared/types';

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
        sendError(res, 'Invalid query parameters', 400);
        return;
      }

      const history = await getPriceHistory({
        productOfferId,
        ...queryParams.data
      });

      sendSuccess(res, {
        data: history,
        count: history.length
      });
    } catch (error) {
      sendErrorFromException(res, error, 'GetPriceHistory');
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
        sendError(res, 'Invalid query parameters', 400);
        return;
      }

      const stats = await getPriceStats(productOfferId, queryParams.data.days);

      if (!stats) {
        sendError(res, 'Product offer not found', 404);
        return;
      }

      sendSuccess(res, stats);
    } catch (error) {
      sendErrorFromException(res, error, 'GetPriceStats');
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
        sendError(res, 'Invalid query parameters', 400);
        return;
      }

      const snapshots = await getPriceSnapshots(
        productId,
        queryParams.data.retailerId,
        queryParams.data.startDate,
        queryParams.data.endDate
      );

      sendSuccess(res, {
        data: snapshots,
        count: snapshots.length
      });
    } catch (error) {
      sendErrorFromException(res, error, 'GetPriceSnapshots');
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
        sendError(res, 'Invalid request data', 400);
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

      sendSuccess(res, result);
    } catch (error) {
      sendErrorFromException(res, error, 'RecordPriceChange');
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
        sendError(res, 'Invalid request data', 400);
        return;
      }

      const { date } = validationResult.data;
      const count = await generateDailySnapshots(date);

      sendSuccess(res, {
        message: `Generated ${count} price snapshots`,
        count
      });
    } catch (error) {
      sendErrorFromException(res, error, 'GenerateSnapshots');
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
        sendError(res, 'Invalid query parameters', 400);
        return;
      }

      const drops = await detectSignificantPriceDrops(
        queryParams.data.thresholdPercent,
        queryParams.data.hours
      );

      sendSuccess(res, {
        data: drops,
        count: drops.length
      });
    } catch (error) {
      sendErrorFromException(res, error, 'DetectPriceDrops');
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

      sendSuccess(res, {
        message: `Cleaned up ${deletedCount} old price history records`,
        deletedCount
      });
    } catch (error) {
      sendErrorFromException(res, error, 'CleanupPriceHistory');
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
        sendError(res, 'Invalid query parameters', 400);
        return;
      }

      const drops = await detectSignificantPriceDrops(
        queryParams.data.thresholdPercent,
        queryParams.data.hours
      );

      // Limit to top 20 for public endpoint
      const limitedDrops = drops.slice(0, 20);

      sendSuccess(res, {
        data: limitedDrops,
        count: limitedDrops.length
      });
    } catch (error) {
      sendErrorFromException(res, error, 'GetRecentPriceDrops');
    }
  });
}
