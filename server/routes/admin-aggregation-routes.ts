/**
 * Admin Aggregation Routes
 *
 * Admin-only endpoints for managing price aggregation operations.
 * Requires admin authentication for all endpoints.
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { priceAggregationService } from '../services/price-aggregation-service';
import { logger } from '../utils/logger';
import { withAdmin, handleRouteError, notFound } from "./helpers";
import { productIdSchema } from '../services/aggregation-validation';

/**
 * Zod schemas for request validation
 */

// Date range validation for admin endpoints
const dateRangeRequestSchema = z.object({
  startDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid date format for startDate. Use YYYY-MM-DD' }
  ).transform((val) => new Date(val)),
  endDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid date format for endDate. Use YYYY-MM-DD' }
  ).transform((val) => new Date(val)),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date' }
).refine(
  (data) => {
    const diffDays = (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 365;
  },
  { message: 'Date range cannot exceed 365 days' }
);

// Product ID validation
const productIdRequestSchema = z.object({
  productId: z.number().int().positive({
    message: 'Product ID must be a positive integer',
  }),
});

/**
 * Register admin aggregation routes
 */
export function registerAdminAggregationRoutes(app: Express): void {
  /**
   * POST /api/admin/aggregation/force-daily
   *
   * Force re-aggregation for a specific date range
   *
   * Body:
   * {
   *   "startDate": "2025-01-01",
   *   "endDate": "2025-01-31"
   * }
   *
   * @returns { daysAggregated: number, message: string }
   */
  app.post('/api/admin/aggregation/force-daily', withAdmin(async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod
      const { startDate, endDate } = dateRangeRequestSchema.parse(req.body);

      logger.info('[AdminAggregation] Force re-aggregation requested', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        adminUser: req.user?.username,
      });

      // Force re-aggregation (force=true parameter)
      const daysAggregated = await priceAggregationService.aggregateToDaily(
        startDate,
        endDate,
        true // force re-aggregation
      );

      res.json({
        daysAggregated,
        message: `Successfully re-aggregated ${daysAggregated} days`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
    } catch (error: unknown) {
      logger.error('[AdminAggregation] Force aggregation failed:', {
        error,
        body: req.body,
        adminUser: req.user?.username,
      });
      handleRouteError(res, error, 'ForceAggregation');
    }
  }));

  /**
   * POST /api/admin/aggregation/detect-gaps
   *
   * Detect missing aggregates in a date range
   *
   * Body:
   * {
   *   "startDate": "2025-01-01",
   *   "endDate": "2025-01-31"
   * }
   *
   * @returns { gaps: string[], count: number }
   */
  app.post('/api/admin/aggregation/detect-gaps', withAdmin(async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod
      const { startDate, endDate } = dateRangeRequestSchema.parse(req.body);

      logger.info('[AdminAggregation] Gap detection requested', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        adminUser: req.user?.username,
      });

      const gaps = await priceAggregationService.detectGaps(startDate, endDate);

      res.json({
        gaps,
        count: gaps.length,
        message: gaps.length === 0
          ? 'No gaps found'
          : `Found ${gaps.length} days with missing aggregates`,
      });
    } catch (error: unknown) {
      logger.error('[AdminAggregation] Gap detection failed:', {
        error,
        body: req.body,
        adminUser: req.user?.username,
      });
      handleRouteError(res, error, 'DetectGaps');
    }
  }));

  /**
   * POST /api/admin/aggregation/fill-gaps
   *
   * Detect and fill gaps in aggregated data
   *
   * Body:
   * {
   *   "startDate": "2025-01-01",
   *   "endDate": "2025-01-31"
   * }
   *
   * @returns { daysFilled: number, message: string }
   */
  app.post('/api/admin/aggregation/fill-gaps', withAdmin(async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod
      const { startDate, endDate } = dateRangeRequestSchema.parse(req.body);

      logger.info('[AdminAggregation] Fill gaps requested', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        adminUser: req.user?.username,
      });

      const daysFilled = await priceAggregationService.fillGaps(startDate, endDate);

      res.json({
        daysFilled,
        message: daysFilled === 0
          ? 'No gaps found to fill'
          : `Successfully filled ${daysFilled} gaps`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
    } catch (error: unknown) {
      logger.error('[AdminAggregation] Fill gaps failed:', {
        error,
        body: req.body,
        adminUser: req.user?.username,
      });
      handleRouteError(res, error, 'FillGaps');
    }
  }));

  /**
   * POST /api/admin/aggregation/single-product
   *
   * Re-aggregate a specific product's data
   *
   * Body:
   * {
   *   "productId": 123
   * }
   *
   * @returns { message: string }
   */
  app.post('/api/admin/aggregation/single-product', withAdmin(async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod
      const { productId } = productIdRequestSchema.parse(req.body);

      logger.info('[AdminAggregation] Single product aggregation requested', {
        productId,
        adminUser: req.user?.username,
      });

      await priceAggregationService.calculateProductAggregates(productId);

      res.json({
        message: `Successfully re-aggregated product ${productId}`,
        productId,
      });
    } catch (error: unknown) {
      logger.error('[AdminAggregation] Single product aggregation failed:', {
        error,
        productId: req.body.productId,
        adminUser: req.user?.username,
      });
      handleRouteError(res, error, 'SingleProductAggregation');
    }
  }));
}
