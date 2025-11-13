import { Express, Request, Response } from 'express';
import { logger } from "./utils/logger";
import { db } from './db.js';
import { retailers, productOffers } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from './auth';
import { validateRequest } from './validation';
import {
  affiliateConfigUpdateSchema,
  idParamSchema,
} from './validation/admin-schemas';
import { z } from 'zod';
import { affiliateLinkService } from './services/affiliate-link-service.js';
import { AffiliateLinkAgent } from './agents/affiliate-agent.js';
import { parseIntSafe, parseIntOptional } from './utils/validation-helpers';

let affiliateAgent: AffiliateLinkAgent | null = null;

// Validation schema for testing affiliate links
const testAffiliateLinkSchema = z.object({
  testUrl: z.string().url('Test URL must be a valid URL'),
});

export function registerAffiliateRoutes(app: Express): void {
  // Initialize affiliate agent
  const initializeAffiliateAgent = async () => {
    if (!affiliateAgent) {
      affiliateAgent = new AffiliateLinkAgent();
      await affiliateAgent.initialize();
      await affiliateAgent.start();
    }
    return affiliateAgent;
  };

  // Get all retailers with affiliate status
  app.get("/api/admin/retailers/affiliate", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const allRetailers = await db.select().from(retailers);
      
      // Get affiliate stats for each retailer
      const retailersWithStats = await Promise.all(
        allRetailers.map(async (retailer) => {
          const stats = await affiliateLinkService.getAffiliateLinkStats(retailer.id);
          return {
            ...retailer,
            affiliateConfig: retailer.affiliateConfig ? JSON.parse(retailer.affiliateConfig) : null,
            stats
          };
        })
      );

      res.json(retailersWithStats);
    } catch (error) {
      logger.error('Failed to get retailers:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Failed to retrieve retailers' });
    }
  });

  // Update retailer affiliate configuration
  app.put("/api/admin/retailers/:id/affiliate", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });
      const {
        affiliateId,
        affiliateProgram,
        baseAffiliateUrl,
        commissionRate,
        affiliateStatus,
        affiliateConfig
      } = req.body;

      const [updatedRetailer] = await db.update(retailers)
        .set({
          affiliateId,
          affiliateProgram,
          baseAffiliateUrl,
          commissionRate: commissionRate ? commissionRate.toString() : null,
          affiliateStatus,
          affiliateConfig: affiliateConfig ? JSON.stringify(affiliateConfig) : null
        })
        .where(eq(retailers.id, retailerId))
        .returning();

      if (!updatedRetailer) {
        return res.status(404).json({ error: 'Retailer not found' });
      }

      // Clear cache after update
      affiliateLinkService.clearCache();

      res.json(updatedRetailer);
    } catch (error) {
      logger.error('Failed to update retailer affiliate config:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Failed to update retailer affiliate configuration' });
    }
  });

  // Test affiliate link generation for retailer
  app.post(
    "/api/admin/retailers/:id/test-affiliate-link",
    requireAuth,
    requireAdmin,
    validateRequest(idParamSchema, 'params'),
    validateRequest(testAffiliateLinkSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params as { id: number };
        const { testUrl } = req.body as { testUrl: string };

        const result = await affiliateLinkService.generateAffiliateLink(id, testUrl);

        if (result.success && result.affiliateUrl) {
          const isHealthy = await affiliateLinkService.validateAffiliateLink(result.affiliateUrl);

          res.json({
            success: true,
            originalUrl: testUrl,
            affiliateUrl: result.affiliateUrl,
            isHealthy,
          generationTime: new Date().toISOString()
        });
      } else {
        res.json({
          success: false,
          originalUrl: testUrl,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Link test failed:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Link test failed' });
    }
  });

  // Generate affiliate links for retailer
  app.post("/api/admin/retailers/:id/generate-affiliate-links", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });
      // SECURITY: Validate and cap limit to prevent excessive database queries
      const limit = req.body.limit ? parseIntSafe(req.body.limit, 'limit', { min: 1, max: 1000 }) : 50;

      const agent = await initializeAffiliateAgent();
      
      const result = await agent.processTask({
        action: 'batch_process_retailer',
        retailerId,
        limit
      });

      res.json(result);
    } catch (error) {
      logger.error('Link generation failed:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Link generation failed' });
    }
  });

  // Get affiliate link statistics
  app.get("/api/admin/affiliate-stats", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { retailerId } = req.query;

      // SECURITY: Safe optional integer parsing
      const stats = await affiliateLinkService.getAffiliateLinkStats(
        parseIntOptional(retailerId as string, 'retailerId', { min: 1 })
      );

      res.json(stats);
    } catch (error) {
      logger.error('Failed to get affiliate stats:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Failed to retrieve affiliate statistics' });
    }
  });

  // Track affiliate link click (public endpoint)
  app.post("/api/affiliate/track-click/:offerId", async (req: Request, res: Response) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const offerId = parseIntSafe(req.params.offerId, 'offerId', { min: 1 });

      await affiliateLinkService.trackLinkClick(offerId);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to track click:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Failed to track click' });
    }
  });

  // Start affiliate agent
  app.post("/api/admin/affiliate-agent/start", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const agent = await initializeAffiliateAgent();
      const stats = await agent.getStats();
      
      res.json({
        success: true,
        message: 'Affiliate agent started',
        stats
      });
    } catch (error) {
      logger.error('Failed to start affiliate agent:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Failed to start affiliate agent' });
    }
  });
}