/**
 * API v1 Routes - Agent-Native Endpoints
 *
 * These routes use HTTP Basic Authentication for AI agents and automation.
 * NO session cookies or CSRF tokens required.
 *
 * Authentication: Authorization: Basic base64(username:password)
 * Example: curl -u "admin:password" https://api.pricecompare.com/api/v1/scraping/discover-trends
 *
 * All routes mirror the browser-based scraping routes but with Basic Auth instead of sessions.
 */

import type { Express, Request, Response } from 'express';
import { basicAuth } from '../middleware/basic-auth';
import { withAuth, withAdmin } from './helpers';
import { sendSuccess, sendErrorFromException } from '../utils/api-response';
import { agentService } from '../services/agent-service';
import { googleSearchService } from '../services/google-search';
import { logger } from '../utils/logger';
import { validateRequest } from '../validation';
import {
  scrapingInitializeSchema,
  productSearchQuerySchema,
  googleSearchQuerySchema,
} from '../validation/admin-schemas';

export function registerApiV1Routes(app: Express): void {
  /**
   * POST /api/v1/scraping/discover-trends
   * Discover trending products from external sources
   */
  app.post(
    '/api/v1/scraping/discover-trends',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    basicAuth,
    withAdmin(async (req: Request, res: Response) => {
      try {
        logger.info('API v1: Discover trends request', {
          userId: req.user!.id,
          // SECURITY: Don't log request body for authenticated endpoints
        });

        const coordinationAgent = await agentService.getCoordinationAgent();

        // Use Zod schema for validation
        const { sources, categories, limit } = scrapingInitializeSchema.parse(req.body);

        const result = await coordinationAgent.processTask({
          action: 'discover_trends',
          sources,
          categories,
          limit,
        });

        sendSuccess(res, {
          message: 'Trend discovery completed',
          result,
        });
      } catch (error) {
        sendErrorFromException(res, error, 'DiscoverTrends');
      }
    })
  );

  /**
   * POST /api/v1/scraping/initialize
   * Initialize scraping system with retailers and agents
   */
  app.post(
    '/api/v1/scraping/initialize',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    basicAuth,
    withAdmin(async (_req: Request, res: Response) => {
      try {
        logger.info('API v1: Initialize scraping system');

        await agentService.initialize();

        sendSuccess(res, {
          message: 'AI scraping system initialized successfully',
        });
      } catch (error) {
        sendErrorFromException(res, error, 'InitializeScraping');
      }
    })
  );

  /**
   * POST /api/v1/scraping/start-agents
   * Start scraping agents for specific retailers
   */
  app.post(
    '/api/v1/scraping/start-agents',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    basicAuth,
    withAdmin(async (_req: Request, res: Response) => {
      try {
        logger.info('API v1: Start agents request');

        const coordinationAgent = await agentService.getCoordinationAgent();

        if (!coordinationAgent.getStatus().isRunning) {
          await coordinationAgent.start();
        }

        sendSuccess(res, {
          message: 'AI agents started successfully',
          status: coordinationAgent.getStatus(),
        });
      } catch (error) {
        sendErrorFromException(res, error, 'StartAgents');
      }
    })
  );

  /**
   * POST /api/v1/scraping/search-product
   * Search for a specific product across retailers
   */
  app.post(
    '/api/v1/scraping/search-product',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    basicAuth,
    validateRequest(productSearchQuerySchema, 'body'),
    withAdmin(async (req: Request, res: Response) => {
      try {
        // SAFETY: Body validated by productSearchQuerySchema middleware above
        const { productName } = req.body as { productName: string };

        logger.info('API v1: Search product request', {
          userId: req.user!.id,
          productName: String(productName),
        });

        const coordinationAgent = await agentService.getCoordinationAgent();
        const result = await coordinationAgent.processTask({
          action: 'search_product',
          query: productName,
        });

        sendSuccess(res, {
          message: 'Product search completed',
          result,
        });
      } catch (error) {
        sendErrorFromException(res, error, 'SearchProduct');
      }
    })
  );

  /**
   * POST /api/v1/scraping/google-search
   * Perform Google search for products
   */
  app.post(
    '/api/v1/scraping/google-search',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    basicAuth,
    validateRequest(googleSearchQuerySchema, 'body'),
    withAdmin(async (req: Request, res: Response) => {
      try {
        // SAFETY: Body validated by googleSearchQuerySchema middleware above
        const { query, retailers, maxResults } = req.body as {
          query: string;
          retailers: string[];
          maxResults: number;
        };

        logger.info('API v1: Google search request', {
          userId: req.user!.id,
          query: String(query),
          retailers,
        });

        const results = await googleSearchService.searchMultipleRetailers(
          String(query),
          retailers || ['amazon.com', 'walmart.com', 'target.com'],
          {
            maxResultsPerRetailer: Number(maxResults),
          }
        );

        sendSuccess(res, {
          message: 'Google search completed',
          results,
          usage: googleSearchService.getUsageStats(),
        });
      } catch (error) {
        sendErrorFromException(res, error, 'GoogleSearch');
      }
    })
  );

  /**
   * GET /api/v1/scraping/status
   * Get current scraping system status
   */
  app.get(
    '/api/v1/scraping/status',
    basicAuth,
    withAuth(async (_req: Request, res: Response) => {
      try {
        logger.info('API v1: Get scraping status');

        const coordinationAgent = await agentService.getCoordinationAgent();
        const status = coordinationAgent.getStatus();

        sendSuccess(res, { status });
      } catch (error) {
        sendErrorFromException(res, error, 'GetScrapingStatus');
      }
    })
  );

  logger.info('API v1 routes registered (HTTP Basic Auth)');
}
