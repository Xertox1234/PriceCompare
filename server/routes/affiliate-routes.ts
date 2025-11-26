import { Express, Request, Response } from 'express';
import { logger } from "../utils/logger";
import { storage } from '../storage';
import { requireAuth, requireAdmin } from '../auth';
import { validateRequest } from '../validation';
import {
  affiliateConfigUpdateSchema,
  idParamSchema,
} from '../validation/admin-schemas';
import { z } from 'zod';
import { affiliateLinkService } from '../services/affiliate-link-service';
import { AffiliateLinkAgent } from '../agents/affiliate-agent';
import { parseIntSafe, parseIntOptional } from '../utils/validation-helpers';
import { handleRouteError, notFound } from "./helpers";
let affiliateAgent: AffiliateLinkAgent | null = null;

// Validation schema for testing affiliate links
const testAffiliateLinkSchema = z.object({
  testUrl: z.string().url('Test URL must be a valid URL'),
});

// Validation schema for updating retailer affiliate configuration
const updateAffiliateConfigSchema = z.object({
  affiliateId: z.string().max(100, 'Affiliate ID must be 100 characters or less').optional().nullable(),
  affiliateProgram: z.string().max(50, 'Affiliate program must be 50 characters or less').optional().nullable(),
  baseAffiliateUrl: z.string().url('Base affiliate URL must be a valid URL').optional().nullable().or(z.literal('')),
  commissionRate: z.union([z.number().min(0).max(100), z.string().regex(/^\d+(\.\d+)?$/)]).optional().nullable(),
  affiliateStatus: z.enum(['active', 'pending', 'inactive', 'disabled']).optional(),
  affiliateConfig: z.record(z.string(), z.unknown()).optional().nullable(),
});

// Validation schema for generating affiliate links
const generateAffiliateLinksSchema = z.object({
  limit: z.union([z.number().int().positive().max(1000), z.string().regex(/^\d+$/).transform(Number)]).optional(),
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
      const retailersWithStats = await storage.getRetailersWithAffiliateStats();
      res.json(retailersWithStats);
    } catch (error: unknown) {
      handleRouteError(res, error, 'GetRetailersWithAffiliateStats');
    }
  });

  // Update retailer affiliate configuration
  app.put("/api/admin/retailers/:id/affiliate", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });
      const validatedData = updateAffiliateConfigSchema.parse(req.body);

      const updatedRetailer = await storage.updateRetailerAffiliateConfig(retailerId, {
        affiliateId: validatedData.affiliateId,
        affiliateProgram: validatedData.affiliateProgram,
        baseAffiliateUrl: validatedData.baseAffiliateUrl || null,
        commissionRate: validatedData.commissionRate ? validatedData.commissionRate.toString() : null,
        affiliateStatus: validatedData.affiliateStatus,
        affiliateConfig: validatedData.affiliateConfig
      });

      if (!updatedRetailer) {
        notFound(res, 'Retailer');
        return;
      }

      // Clear cache after update
      affiliateLinkService.clearCache();

      res.json(updatedRetailer);
    } catch (error: unknown) {
      handleRouteError(res, error, 'UpdateRetailerAffiliateConfig');
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
        const id = parseInt(req.params.id);
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
    } catch (error: unknown) {
      handleRouteError(res, error, 'TestAffiliateLink');
    }
  });

  // Generate affiliate links for retailer
  app.post("/api/admin/retailers/:id/generate-affiliate-links", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const retailerId = parseIntSafe(req.params.id, 'retailerId', { min: 1 });
      // SECURITY: Validate and cap limit to prevent excessive database queries
      const validatedData = generateAffiliateLinksSchema.parse(req.body);
      const limit = validatedData.limit ?? 50;

      const agent = await initializeAffiliateAgent();
      
      const result = await agent.processTask({
        action: 'batch_process_retailer',
        retailerId,
        limit
      });

      res.json(result);
    } catch (error: unknown) {
      handleRouteError(res, error, 'GenerateAffiliateLinks');
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
    } catch (error: unknown) {
      handleRouteError(res, error, 'GetAffiliateStats');
    }
  });

  // Track affiliate link click (public endpoint)
  app.post("/api/affiliate/track-click/:offerId", async (req: Request, res: Response) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const offerId = parseIntSafe(req.params.offerId, 'offerId', { min: 1 });

      await affiliateLinkService.trackLinkClick(offerId);

      res.json({ success: true });
    } catch (error: unknown) {
      handleRouteError(res, error, 'TrackAffiliateClick');
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
    } catch (error: unknown) {
      handleRouteError(res, error, 'StartAffiliateAgent');
    }
  });
}