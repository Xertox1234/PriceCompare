/**
 * Product Discovery Routes
 *
 * User-facing routes for discovering new products via direct retailer search.
 * When a product isn't found in the database, users can trigger a search
 * across Canadian retailers to add it to the system.
 *
 * @see server/services/direct-retailer-search.ts - Direct search service
 * @see CLAUDE.md - Playwright EXCLUSIVELY for browser automation
 */

import { Express, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { csrfProtection } from '../middleware/security';
import { requireAuth } from '../auth';
import { parseIntSafe } from '../utils/validation-helpers';
import { directRetailerSearchService } from '../services/direct-retailer-search';
import { dataExtractionAgent } from '../agents/extraction-agent';
import { storage } from '../storage';

/**
 * Rate limiting for discovery requests
 * Prevents abuse while allowing legitimate product discovery
 */
const discoveryRateLimits = new Map<number, { count: number; resetAt: number }>();
const MAX_DISCOVERIES_PER_HOUR = 10;

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  const userLimit = discoveryRateLimits.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    discoveryRateLimits.set(userId, { count: 1, resetAt: now + hourMs });
    return true;
  }

  if (userLimit.count >= MAX_DISCOVERIES_PER_HOUR) {
    return false;
  }

  userLimit.count++;
  return true;
}

export function registerProductDiscoveryRoutes(app: Express): void {
  /**
   * Discover products by searching Canadian retailers directly
   *
   * This endpoint allows authenticated users to trigger a search across
   * Canadian retailers when a product isn't found in the database.
   *
   * POST /api/discover/search
   * Body: { query: string, maxResultsPerRetailer?: number }
   */
  app.post(
    '/api/discover/search',
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.session.userId;
        if (!userId) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        // Rate limiting
        if (!checkRateLimit(userId)) {
          sendError(
            res,
            'Rate limit exceeded. Please wait before discovering more products.',
            429,
            { retryAfter: 3600 }
          );
          return;
        }

        // Validate input
        const body = req.body as { query?: string; maxResultsPerRetailer?: number };
        const query = body.query?.trim();

        if (!query || query.length < 2) {
          sendError(res, 'Search query must be at least 2 characters', 400);
          return;
        }

        if (query.length > 200) {
          sendError(res, 'Search query too long (max 200 characters)', 400);
          return;
        }

        const maxResultsPerRetailer = body.maxResultsPerRetailer
          ? parseIntSafe(String(body.maxResultsPerRetailer), 'maxResultsPerRetailer', {
              min: 1,
              max: 10,
            })
          : 5;

        logger.info('User initiated product discovery', {
          userId,
          query,
          maxResultsPerRetailer,
        });

        // First check if we already have products matching this query
        const existingProducts = await storage.searchProducts({
          query,
          limit: 10,
        });

        if (existingProducts.products.length > 0) {
          sendSuccess(res, {
            source: 'database',
            message: 'Found existing products matching your search',
            products: existingProducts.products,
            count: existingProducts.products.length,
          });
          return;
        }

        // No existing products - search Canadian retailers
        const searchResults = await directRetailerSearchService.searchAllRetailers(
          query,
          maxResultsPerRetailer
        );

        // Collect all found product URLs for extraction
        const allProducts = searchResults.flatMap((r) =>
          r.products.map((p) => ({
            ...p,
            retailer: r.retailer,
            domain: r.domain,
          }))
        );

        const successfulRetailers = searchResults.filter((r) => r.success);
        const totalFound = allProducts.length;

        logger.info('Product discovery search completed', {
          userId,
          query,
          successfulRetailers: successfulRetailers.length,
          totalFound,
        });

        sendSuccess(res, {
          source: 'retailers',
          message:
            totalFound > 0
              ? `Found ${totalFound} products across ${successfulRetailers.length} retailers`
              : 'No products found matching your search',
          results: searchResults.map((r) => ({
            retailer: r.retailer,
            domain: r.domain,
            success: r.success,
            productCount: r.products.length,
            products: r.products,
            error: r.error,
          })),
          totalProducts: totalFound,
          successfulRetailers: successfulRetailers.length,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'ProductDiscoverySearch');
      }
    }
  );

  /**
   * Extract and save a product from a discovered URL
   *
   * After discovery search finds products, users can choose to add
   * a specific product to the database for tracking.
   *
   * POST /api/discover/extract
   * Body: { url: string, retailerDomain: string, searchQuery?: string }
   */
  app.post(
    '/api/discover/extract',
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.session.userId;
        if (!userId) {
          sendError(res, 'Authentication required', 401);
          return;
        }

        // Validate input
        const body = req.body as {
          url?: string;
          retailerDomain?: string;
          searchQuery?: string;
        };
        const { url, retailerDomain, searchQuery } = body;

        if (!url) {
          sendError(res, 'Product URL is required', 400);
          return;
        }

        if (!retailerDomain) {
          sendError(res, 'Retailer domain is required', 400);
          return;
        }

        // Validate the retailer domain is in our allowed list
        const allowedDomains = directRetailerSearchService.getCanadianDomains();
        if (!allowedDomains.includes(retailerDomain)) {
          sendError(res, 'Retailer not supported', 400);
          return;
        }

        logger.info('User initiated product extraction', {
          userId,
          url,
          retailerDomain,
        });

        // Extract product data using Playwright
        const result = await dataExtractionAgent.processTask({
          action: 'extract_product_data',
          url,
          retailer: retailerDomain,
          searchQuery,
        });

        if (result.success) {
          logger.info('Product extraction successful', {
            userId,
            url,
            productTitle: result.data.title,
          });

          sendSuccess(res, {
            success: true,
            message: 'Product extracted and added successfully',
            product: {
              title: result.data.title,
              price: result.data.price,
              currency: result.data.currency,
              availability: result.data.availability,
              imageUrl: result.data.imageUrl,
              brand: result.data.brand,
            },
          });
        } else {
          sendSuccess(res, {
            success: false,
            message: 'Failed to extract product data',
            reason: result.reason,
          });
        }
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'ProductDiscoveryExtract');
      }
    }
  );

  /**
   * Get list of supported Canadian retailers
   *
   * GET /api/discover/retailers
   */
  app.get('/api/discover/retailers', (_req: Request, res: Response) => {
    try {
      const retailers = directRetailerSearchService.getRetailers();

      sendSuccess(res, {
        retailers: retailers.map((r) => ({
          name: r.name,
          domain: r.domain,
          currency: r.currency,
        })),
        count: retailers.length,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetSupportedRetailers');
    }
  });

  /**
   * Get user's discovery rate limit status
   *
   * GET /api/discover/rate-limit
   */
  app.get('/api/discover/rate-limit', requireAuth, (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        sendError(res, 'Authentication required', 401);
        return;
      }

      const now = Date.now();
      const userLimit = discoveryRateLimits.get(userId);

      if (!userLimit || now > userLimit.resetAt) {
        sendSuccess(res, {
          remaining: MAX_DISCOVERIES_PER_HOUR,
          limit: MAX_DISCOVERIES_PER_HOUR,
          resetsIn: 0,
        });
        return;
      }

      const remaining = Math.max(0, MAX_DISCOVERIES_PER_HOUR - userLimit.count);
      const resetsIn = Math.max(0, Math.ceil((userLimit.resetAt - now) / 1000));

      sendSuccess(res, {
        remaining,
        limit: MAX_DISCOVERIES_PER_HOUR,
        resetsIn,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetDiscoveryRateLimit');
    }
  });
}
