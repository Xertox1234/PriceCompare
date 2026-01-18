/**
 * API v1 Routes - Agent-Native Endpoints
 *
 * These routes use HTTP Basic Authentication for AI agents and automation.
 * NO session cookies or CSRF tokens required.
 *
 * Authentication: Authorization: Basic base64(username:password)
 * Example: curl -u "admin:password" https://api.pricecompare.com/api/v1/scraping/discover-trends
 *
 * All routes mirror the browser-based routes but with Basic Auth instead of sessions.
 */

import type { Express, Request, Response } from 'express';
import { flexibleAuth } from '../middleware/flexible-auth';
import { withAuth, withAdmin, shouldSkipCache } from './helpers';
import { sendSuccess, sendError, sendErrorFromException, sendPaginated } from '../utils/api-response';
import { agentService } from '../services/agent-service';
import { googleSearchService } from '../services/google-search';
import { storage } from '../storage';
import { storageCache } from '../services/storage-cache';
import { logger } from '../utils/logger';
import { validateRequest } from '../validation';
import {
  scrapingInitializeSchema,
  productSearchQuerySchema,
  googleSearchQuerySchema,
} from '../validation/admin-schemas';
import { parseIntSafe, parseIntOptional, parseFloatSafe } from '../utils/validation-helpers';
import type { SearchFilters } from '@shared/schema';
import type { AuthenticatedRequest } from '@shared/types';

export function registerApiV1Routes(app: Express): void {
  /**
   * POST /api/v1/scraping/discover-trends
   * Discover trending products from external sources
   */
  app.post(
    '/api/v1/scraping/discover-trends',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAdmin(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAdmin guarantees req.user exists
        const userId = (req.user as Express.User).id;
        logger.info('API v1: Discover trends request', {
          userId,
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
    flexibleAuth,
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
    flexibleAuth,
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
    flexibleAuth,
    validateRequest(productSearchQuerySchema, 'body'),
    withAdmin(async (req: Request, res: Response) => {
      try {
        // SAFETY: Body validated by productSearchQuerySchema middleware above
        const { productName } = req.body as { productName: string };
        // Type assertion: withAdmin guarantees req.user exists
        const userId = (req.user as Express.User).id;

        logger.info('API v1: Search product request', {
          userId,
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
    flexibleAuth,
    validateRequest(googleSearchQuerySchema, 'body'),
    withAdmin(async (req: Request, res: Response) => {
      try {
        // SAFETY: Body validated by googleSearchQuerySchema middleware above
        const { query, retailers, maxResults } = req.body as {
          query: string;
          retailers: string[];
          maxResults: number;
        };

        // Type assertion: withAdmin guarantees req.user exists
        const userId = (req.user as Express.User).id;

        logger.info('API v1: Google search request', {
          userId,
          query: String(query),
          retailers,
        });

        const results = await googleSearchService.searchMultipleRetailers(
          String(query),
          retailers || ['amazon.com', 'walmart.com', 'target.com'],
          {
            maxResultsPerRetailer: maxResults,
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
    flexibleAuth,
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

  // =============================================================================
  // PHASE 1: Core Read-Only Features
  // =============================================================================

  /**
   * GET /api/v1/watchlists
   * Get all watch lists for the authenticated user
   * Agent-native equivalent of GET /api/watchlists
   */
  app.get(
    '/api/v1/watchlists',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        logger.info(`API v1: Fetching watch lists for user ${userId}`);

        const watchLists = await storage.getUserWatchLists(userId);

        sendSuccess(res, { watchLists });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetWatchLists');
      }
    })
  );

  /**
   * GET /api/v1/watchlists/:id
   * Get a specific watch list with all products and pricing details
   * Agent-native equivalent of GET /api/watchlists/:id
   */
  app.get(
    '/api/v1/watchlists/:id',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        logger.info(`API v1: Fetching watch list ${watchListId} for user ${userId}`);

        const watchList = await storage.getWatchListById(watchListId, userId);

        if (!watchList) {
          sendError(res, 'Watch list not found or unauthorized', 404);
          return;
        }

        sendSuccess(res, watchList);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetWatchList');
      }
    })
  );

  /**
   * GET /api/v1/watchlists/:id/products
   * Get products in a specific watch list
   * Agent-native endpoint (extracts products from watchlist details)
   */
  app.get(
    '/api/v1/watchlists/:id/products',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        logger.info(`API v1: Fetching products for watch list ${watchListId}, user ${userId}`);

        const watchList = await storage.getWatchListById(watchListId, userId);

        if (!watchList) {
          sendError(res, 'Watch list not found or unauthorized', 404);
          return;
        }

        sendSuccess(res, { products: watchList.products || [] });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetWatchListProducts');
      }
    })
  );

  /**
   * GET /api/v1/price-alerts
   * Get all price alerts for the authenticated user
   * Agent-native equivalent of GET /api/price-alerts
   */
  app.get(
    '/api/v1/price-alerts',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        logger.info(`API v1: Fetching price alerts for user ${userId}`);

        const alerts = await storage.getUserPriceAlerts(userId);

        sendSuccess(res, alerts);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetPriceAlerts');
      }
    })
  );

  /**
   * GET /api/v1/price-alerts/:id
   * Get a specific price alert by ID
   * Agent-native endpoint (extracts single alert from user's alerts)
   */
  app.get(
    '/api/v1/price-alerts/:id',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });

        logger.info(`API v1: Fetching price alert ${alertId} for user ${userId}`);

        const alerts = await storage.getUserPriceAlerts(userId);
        const alert = alerts.find((a) => a.id === alertId);

        if (!alert) {
          sendError(res, 'Price alert not found or unauthorized', 404);
          return;
        }

        sendSuccess(res, alert);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetPriceAlert');
      }
    })
  );

  /**
   * GET /api/v1/products/search
   * Search products with filters
   * Agent-native equivalent of GET /api/products/search
   */
  app.get(
    '/api/v1/products/search',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: AuthenticatedRequest, res: Response) => {
      try {
        logger.info('API v1: Product search request');

        // Handle URL-based search (browser extension compatibility)
        if (req.query.url) {
          const productUrl = decodeURIComponent(req.query.url as string);

          const result = await storage.getProductByUrl(productUrl);

          if (!result) {
            sendSuccess(res, { product: null });
            return;
          }

          const { product } = result;
          const offers = await storage.getProductOffers(product.id);
          const prices = offers.length > 0 ? offers.map((o) => parseFloat(o.price)) : [];
          const bestPrice = prices.length > 0 ? Math.min(...prices) : null;

          sendSuccess(res, {
            product: {
              ...product,
              offers,
              bestPrice,
            },
          });
          return;
        }

        // Normal search filters
        const filters: SearchFilters = {
          query: req.query.query as string,
          category: req.query.category as string,
          minPrice: req.query.minPrice
            ? parseFloatSafe(req.query.minPrice as string, 'minPrice', { min: 0 })
            : undefined,
          maxPrice: req.query.maxPrice
            ? parseFloatSafe(req.query.maxPrice as string, 'maxPrice', { min: 0 })
            : undefined,
          retailers: req.query.retailers
            ? Array.isArray(req.query.retailers)
              ? req.query.retailers.map((id) => parseIntSafe(id as string, 'retailerId', { min: 1 }))
              : [parseIntSafe(req.query.retailers as string, 'retailerId', { min: 1 })]
            : undefined,
          minRating: req.query.minRating
            ? parseFloatSafe(req.query.minRating as string, 'minRating', { min: 0, max: 5 })
            : undefined,
          availability: req.query.availability
            ? Array.isArray(req.query.availability)
              ? (req.query.availability as string[])
              : [req.query.availability as string]
            : undefined,
          sortBy: req.query.sortBy as 'price_low' | 'price_high' | 'rating' | 'popularity',
          page: req.query.page ? parseIntSafe(req.query.page as string, 'page', { min: 1 }) : 1,
          limit: req.query.limit
            ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 })
            : 20,
        };

        // withAuth wrapper guarantees req.user exists for shouldSkipCache
        const skipCache = shouldSkipCache(req);
        const { products, pagination } = skipCache
          ? await storage.searchProducts(filters)
          : await storageCache.searchProducts(filters);

        sendPaginated(res, products, {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          totalPages: pagination.totalPages,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'SearchProducts');
      }
    })
  );

  /**
   * GET /api/v1/products/:id
   * Get product details by ID
   * Agent-native equivalent of GET /api/products/:id
   */
  app.get(
    '/api/v1/products/:id',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseIntSafe(req.params.id, 'productId', { min: 1 });

        logger.info(`API v1: Fetching product ${id}`);

        // withAuth wrapper guarantees req.user exists for shouldSkipCache
        const skipCache = shouldSkipCache(req);
        const product = skipCache
          ? await storage.getProductById(id)
          : await storageCache.getProductById(id);

        if (!product) {
          sendError(res, 'Product not found', 404);
          return;
        }

        sendSuccess(res, product);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchProduct');
      }
    })
  );

  /**
   * GET /api/v1/products/:id/price-history
   * Get price history for a product
   * Agent-native equivalent of GET /api/products/:id/price-history
   */
  app.get(
    '/api/v1/products/:id/price-history',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: AuthenticatedRequest, res: Response) => {
      // Parse id outside try block so it's available in catch
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });

      try {
        const days = parseIntOptional(req.query.days as string);
        const retailerId = parseIntOptional(req.query.retailerId as string);

        logger.info(`API v1: Fetching price history for product ${id}`);

        let history;
        if (retailerId) {
          history = await storage.getRetailerPriceHistory(id, retailerId, days);
        } else {
          history = await storage.getPriceHistory(id, days);
        }

        const formattedHistory = history.map((h) => ({
          date: h.recordedAt instanceof Date ? h.recordedAt.toISOString() : h.recordedAt,
          price: parseFloat(h.price),
          retailerId: h.retailerId,
          retailerName: 'retailerName' in h ? h.retailerName : undefined,
          availability: h.availability,
        }));

        sendSuccess(res, { history: formattedHistory });
      } catch (error: unknown) {
        logger.error('Error fetching price history', {
          error: error instanceof Error ? error.message : String(error),
          productId: id,
        });
        sendErrorFromException(res, error, 'FetchPriceHistory');
      }
    })
  );

  /**
   * GET /api/v1/notifications
   * Get user's notifications with optional filters
   * Agent-native equivalent of GET /api/notifications
   */
  app.get(
    '/api/v1/notifications',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        logger.info(`API v1: Fetching notifications for user ${userId}`);

        // Import notification service dynamically to avoid circular dependencies
        const { getUserNotifications } = await import('../services/notification-service');

        // Parse filters from query params
        const filters: {
          isRead?: boolean;
          type?: string;
          limit: number;
          offset: number;
        } = {
          limit: req.query.limit ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 }) : 50,
          offset: req.query.offset ? parseIntSafe(req.query.offset as string, 'offset', { min: 0 }) : 0,
        };

        if (req.query.isRead !== undefined) {
          filters.isRead = req.query.isRead === 'true';
        }

        if (req.query.type) {
          filters.type = req.query.type as string;
        }

        const notifications = await getUserNotifications(userId, filters);

        sendSuccess(res, {
          notifications,
          count: notifications.length,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetNotifications');
      }
    })
  );

  // =============================================================================
  // PHASE 2: Write Operations
  // =============================================================================

  /**
   * POST /api/v1/watchlists
   * Create a new watch list
   * Agent-native equivalent of POST /api/watchlists
   */
  app.post(
    '/api/v1/watchlists',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;

        // Import schema from watchlist-routes
        const { z } = await import('zod');
        const createWatchListSchema = z.object({
          name: z
            .string()
            .trim()
            .min(1, 'Name is required')
            .max(100, 'Name must be 100 characters or less'),
          description: z.string().max(500, 'Description must be 500 characters or less').optional(),
        });

        const data = createWatchListSchema.parse(req.body);

        logger.info(`API v1: Creating watch list "${data.name}" for user ${userId}`);

        const watchList = await storage.createWatchList(userId, data);

        sendSuccess(res, watchList, 201);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'CreateWatchList');
      }
    })
  );

  /**
   * PATCH /api/v1/watchlists/:id
   * Update a watch list's name or description
   * Agent-native equivalent of PATCH /api/watchlists/:id
   */
  app.patch(
    '/api/v1/watchlists/:id',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        // Import schema from watchlist-routes
        const { z } = await import('zod');
        const updateWatchListSchema = z
          .object({
            name: z
              .string()
              .trim()
              .min(1, 'Name cannot be empty')
              .max(100, 'Name must be 100 characters or less')
              .optional(),
            description: z.string().max(500, 'Description must be 500 characters or less').optional(),
          })
          .refine((data) => data.name !== undefined || data.description !== undefined, {
            message: 'At least one field (name or description) must be provided',
          });

        const updates = updateWatchListSchema.parse(req.body);

        logger.info(`API v1: Updating watch list ${watchListId} for user ${userId}`);

        const watchList = await storage.updateWatchList(watchListId, userId, updates);

        sendSuccess(res, watchList);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'UpdateWatchList');
      }
    })
  );

  /**
   * DELETE /api/v1/watchlists/:id
   * Delete a watch list
   * Agent-native equivalent of DELETE /api/watchlists/:id
   */
  app.delete(
    '/api/v1/watchlists/:id',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        logger.info(`API v1: Deleting watch list ${watchListId} for user ${userId}`);

        const deletedWatchList = await storage.deleteWatchList(watchListId, userId);

        sendSuccess(res, {
          deletedId: deletedWatchList.id,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'DeleteWatchList');
      }
    })
  );

  /**
   * POST /api/v1/watchlists/:id/products
   * Add a product to a watch list
   * Agent-native equivalent of POST /api/watchlists/:id/products
   */
  app.post(
    '/api/v1/watchlists/:id/products',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        // Import schema from watchlist-routes
        const { z } = await import('zod');
        const addProductSchema = z.object({
          productId: z.number().int().positive('Product ID must be a positive integer'),
        });

        const { productId } = addProductSchema.parse(req.body);

        logger.info(`API v1: Adding product ${productId} to watch list ${watchListId} for user ${userId}`);

        const productWatch = await storage.addProductToWatchList(watchListId, productId, userId);

        sendSuccess(res, productWatch, 201);
      } catch (error: unknown) {
        // Handle duplicate product error with proper status code
        if (error instanceof Error && error.message.includes('already')) {
          sendError(res, error.message, 409);
          return;
        }
        sendErrorFromException(res, error, 'AddProductToWatchList');
      }
    })
  );

  /**
   * DELETE /api/v1/watchlists/:id/products/:productId
   * Remove a product from a watch list
   * Agent-native equivalent of DELETE /api/watchlists/:id/products/:productId
   */
  app.delete(
    '/api/v1/watchlists/:id/products/:productId',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });
        const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

        logger.info(
          `API v1: Removing product ${productId} from watch list ${watchListId} for user ${userId}`
        );

        await storage.removeProductFromWatchList(watchListId, productId, userId);

        sendSuccess(res, {});
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'RemoveProductFromWatchList');
      }
    })
  );

  /**
   * POST /api/v1/price-alerts
   * Create a new price alert
   * Agent-native equivalent of POST /api/price-alerts
   */
  app.post(
    '/api/v1/price-alerts',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;

        // Import schema and constants
        const { z } = await import('zod');
        const { PRICE_ALERT } = await import('../utils/constants');

        const createPriceAlertSchema = z.object({
          productId: z.number().int('Product ID must be an integer').min(1, 'Product ID must be positive'),
          targetPrice: z
            .number()
            .positive('Target price must be positive')
            .multipleOf(0.01, 'Price must have maximum 2 decimal places'),
          notifyForum: z.boolean().optional().default(false),
        });

        const validatedData = createPriceAlertSchema.parse(req.body);

        // Verify product exists (prevents FK constraint failure)
        const product = await storage.getProductById(validatedData.productId);
        if (!product) {
          sendError(res, 'Product not found', 404);
          return;
        }

        // Check user alert limit (prevents spam/abuse)
        const userAlertCount = await storage.countUserAlerts(userId);
        if (userAlertCount >= PRICE_ALERT.MAX_ALERTS_PER_USER) {
          sendError(
            res,
            `Alert limit reached. You can only have ${PRICE_ALERT.MAX_ALERTS_PER_USER} active alerts.`,
            400,
            {
              code: 'ALERT_LIMIT_REACHED',
              limit: PRICE_ALERT.MAX_ALERTS_PER_USER,
              current: userAlertCount,
            }
          );
          return;
        }

        logger.info(`API v1: Creating price alert for user ${userId}, product ${validatedData.productId}`);

        const alert = await storage.createPriceAlert({
          userId,
          productId: validatedData.productId,
          targetPrice: validatedData.targetPrice.toFixed(2),
          notifyForum: validatedData.notifyForum,
        });

        sendSuccess(res, alert, 201);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'CreatePriceAlert');
      }
    })
  );

  /**
   * PATCH /api/v1/price-alerts/:id
   * Update a price alert
   * Agent-native equivalent of PATCH /api/price-alerts/:id
   */
  app.patch(
    '/api/v1/price-alerts/:id',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });

        // Import schema
        const { z } = await import('zod');
        const updatePriceAlertSchema = z
          .object({
            targetPrice: z
              .number()
              .positive('Target price must be positive')
              .multipleOf(0.01, 'Price must have maximum 2 decimal places')
              .optional(),
            isActive: z.boolean().optional(),
            notifyForum: z.boolean().optional(),
          })
          .refine((data) => Object.keys(data).length > 0, {
            message: 'At least one field must be provided for update',
          });

        const validatedData = updatePriceAlertSchema.parse(req.body);

        // Convert targetPrice to string if present (for decimal field)
        const updates = {
          ...validatedData,
          targetPrice: validatedData.targetPrice?.toFixed(2),
        };

        logger.info(`API v1: Updating price alert ${alertId} for user ${userId}`);

        const updatedAlert = await storage.updatePriceAlert(alertId, userId, updates);
        if (!updatedAlert) {
          sendError(res, 'Alert not found or unauthorized', 404);
          return;
        }

        sendSuccess(res, updatedAlert);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'UpdatePriceAlert');
      }
    })
  );

  /**
   * DELETE /api/v1/price-alerts/:id
   * Delete a price alert
   * Agent-native equivalent of DELETE /api/price-alerts/:id
   */
  app.delete(
    '/api/v1/price-alerts/:id',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });

        logger.info(`API v1: Deleting price alert ${alertId} for user ${userId}`);

        const deleted = await storage.deletePriceAlert(alertId, userId);
        if (!deleted) {
          sendError(res, 'Alert not found or unauthorized', 404);
          return;
        }

        sendSuccess(res, { deleted: true });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'DeletePriceAlert');
      }
    })
  );

  /**
   * POST /api/v1/notifications/:id/read
   * Mark a notification as read
   * Agent-native equivalent of POST /api/notifications/:id/read
   */
  app.post(
    '/api/v1/notifications/:id/read',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;
        const notificationId = parseIntSafe(req.params.id, 'notificationId', { min: 1 });

        logger.info(`API v1: Marking notification ${notificationId} as read for user ${userId}`);

        // Import notification service dynamically
        const { markAsRead } = await import('../services/notification-service');

        const count = await markAsRead(userId, notificationId);

        if (count === 0) {
          sendError(res, 'Notification not found', 404);
          return;
        }

        sendSuccess(res, { success: true });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'MarkNotificationRead');
      }
    })
  );

  /**
   * POST /api/v1/notifications/read-all
   * Mark all notifications as read
   * Agent-native equivalent of POST /api/notifications/read-all
   */
  app.post(
    '/api/v1/notifications/read-all',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        // Type assertion: withAuth guarantees req.user exists
        const userId = (req.user as Express.User).id;

        logger.info(`API v1: Marking all notifications as read for user ${userId}`);

        // Import notification service dynamically
        const { markAllAsRead } = await import('../services/notification-service');

        const count = await markAllAsRead(userId);

        sendSuccess(res, { count });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'MarkAllNotificationsRead');
      }
    })
  );

  // =============================================================================
  // PHASE 3: Advanced Features & Admin Endpoints
  // =============================================================================

  /**
   * GET /api/v1
   * API discovery endpoint - lists all available API v1 capabilities
   * Agent-native API catalog for self-discovery
   */
  app.get('/api/v1', flexibleAuth, withAuth((_req: Request, res: Response) => {
    try {
      logger.info('API v1: Discovery endpoint accessed');

      const capabilities = {
        version: '1.0.0',
        authentication: 'HTTP Basic Auth',
        documentation: '/api/v1/openapi.json',
        endpoints: {
          scraping: {
            description: 'AI-powered web scraping operations (admin only)',
            endpoints: [
              'POST /api/v1/scraping/discover-trends',
              'POST /api/v1/scraping/initialize',
              'POST /api/v1/scraping/start-agents',
              'POST /api/v1/scraping/search-product',
              'POST /api/v1/scraping/google-search',
              'GET /api/v1/scraping/status',
            ],
          },
          watchlists: {
            description: 'User watchlist management',
            endpoints: [
              'GET /api/v1/watchlists',
              'GET /api/v1/watchlists/:id',
              'GET /api/v1/watchlists/:id/products',
              'POST /api/v1/watchlists',
              'PATCH /api/v1/watchlists/:id',
              'DELETE /api/v1/watchlists/:id',
              'POST /api/v1/watchlists/:id/products',
              'DELETE /api/v1/watchlists/:id/products/:productId',
            ],
          },
          priceAlerts: {
            description: 'Price alert management',
            endpoints: [
              'GET /api/v1/price-alerts',
              'GET /api/v1/price-alerts/:id',
              'POST /api/v1/price-alerts',
              'PATCH /api/v1/price-alerts/:id',
              'DELETE /api/v1/price-alerts/:id',
            ],
          },
          products: {
            description: 'Product search and details',
            endpoints: [
              'GET /api/v1/products/search',
              'GET /api/v1/products/:id',
              'GET /api/v1/products/:id/price-history',
            ],
          },
          notifications: {
            description: 'User notification management',
            endpoints: [
              'GET /api/v1/notifications',
              'POST /api/v1/notifications/:id/read',
              'POST /api/v1/notifications/read-all',
            ],
          },
          search: {
            description: 'Advanced search capabilities',
            endpoints: [
              'GET /api/v1/search/advanced',
              'GET /api/v1/search/suggestions',
            ],
          },
          analytics: {
            description: 'User analytics and statistics',
            endpoints: ['GET /api/v1/analytics/user'],
          },
          admin: {
            description: 'Admin monitoring endpoints (admin only)',
            endpoints: [
              'GET /api/v1/admin/system-health',
              'GET /api/v1/admin/stats',
            ],
          },
        },
        rateLimit: {
          note: 'Rate limits are enforced per-user. See response headers for current limits.',
          headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
        },
      };

      sendSuccess(res, capabilities);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'APIDiscovery');
    }
  }));

  /**
   * GET /api/v1/openapi.json
   * OpenAPI 3.0 specification for API v1 endpoints
   * Enables automatic client SDK generation and documentation
   */
  app.get('/api/v1/openapi.json', flexibleAuth, withAuth((_req: Request, res: Response) => {
    try {
      logger.info('API v1: OpenAPI spec requested');

      const openApiSpec = {
        openapi: '3.0.3',
        info: {
          title: 'PriceCompare API',
          description: 'Agent-native API for price comparison and tracking',
          version: '1.0.0',
          contact: {
            name: 'PriceCompare Support',
          },
        },
        servers: [
          {
            url: '/api/v1',
            description: 'API v1 (HTTP Basic Auth)',
          },
        ],
        security: [
          {
            basicAuth: [],
          },
        ],
        components: {
          securitySchemes: {
            basicAuth: {
              type: 'http',
              scheme: 'basic',
              description: 'HTTP Basic Authentication using username:password',
            },
          },
          schemas: {
            Error: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { type: 'string' },
              },
            },
            Success: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: { type: 'object' },
              },
            },
            Watchlist: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                userId: { type: 'integer' },
                name: { type: 'string' },
                description: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
            PriceAlert: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                userId: { type: 'integer' },
                productId: { type: 'integer' },
                targetPrice: { type: 'string' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
            Product: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' },
                image: { type: 'string' },
              },
            },
          },
        },
        paths: {
          '/watchlists': {
            get: {
              summary: 'List user watchlists',
              tags: ['Watchlists'],
              responses: {
                200: { description: 'List of watchlists' },
                401: { description: 'Authentication required' },
              },
            },
            post: {
              summary: 'Create a watchlist',
              tags: ['Watchlists'],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                201: { description: 'Watchlist created' },
                400: { description: 'Invalid input' },
                401: { description: 'Authentication required' },
              },
            },
          },
          '/price-alerts': {
            get: {
              summary: 'List user price alerts',
              tags: ['Price Alerts'],
              responses: {
                200: { description: 'List of price alerts' },
                401: { description: 'Authentication required' },
              },
            },
            post: {
              summary: 'Create a price alert',
              tags: ['Price Alerts'],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['productId', 'targetPrice'],
                      properties: {
                        productId: { type: 'integer' },
                        targetPrice: { type: 'number' },
                        notifyForum: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
              responses: {
                201: { description: 'Alert created' },
                400: { description: 'Invalid input' },
                401: { description: 'Authentication required' },
              },
            },
          },
          '/products/search': {
            get: {
              summary: 'Search products',
              tags: ['Products'],
              parameters: [
                { name: 'query', in: 'query', schema: { type: 'string' } },
                { name: 'category', in: 'query', schema: { type: 'string' } },
                { name: 'minPrice', in: 'query', schema: { type: 'number' } },
                { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
              ],
              responses: {
                200: { description: 'Search results' },
                401: { description: 'Authentication required' },
              },
            },
          },
          '/analytics/user': {
            get: {
              summary: 'Get user analytics',
              tags: ['Analytics'],
              responses: {
                200: { description: 'User statistics' },
                401: { description: 'Authentication required' },
              },
            },
          },
          '/admin/system-health': {
            get: {
              summary: 'Get system health status',
              tags: ['Admin'],
              responses: {
                200: { description: 'System health data' },
                401: { description: 'Authentication required' },
                403: { description: 'Admin role required' },
              },
            },
          },
        },
      };

      // Return OpenAPI spec directly (not wrapped in { success, data })
      // OpenAPI specs have their own standard format and should not be wrapped
      res.json(openApiSpec);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'OpenAPISpec');
    }
  }));

  /**
   * GET /api/v1/search/advanced
   * Advanced product search with AI-powered features
   * Agent-native equivalent of GET /api/search/advanced
   */
  app.get(
    '/api/v1/search/advanced',
    flexibleAuth,
    withAuth(async (req: AuthenticatedRequest, res: Response) => {
      try {
        logger.info('API v1: Advanced search request');

        // Import advanced search service dynamically
        const { advancedSearchService } = await import('../services/advanced-search');

        const filters: SearchFilters = {
          query: req.query.query as string,
          category: req.query.category as string,
          minPrice: req.query.minPrice
            ? parseFloatSafe(req.query.minPrice as string, 'minPrice', { min: 0 })
            : undefined,
          maxPrice: req.query.maxPrice
            ? parseFloatSafe(req.query.maxPrice as string, 'maxPrice', { min: 0 })
            : undefined,
          retailers: req.query.retailers
            ? Array.isArray(req.query.retailers)
              ? req.query.retailers.map((id) => parseIntSafe(id as string, 'retailerId', { min: 1 }))
              : [parseIntSafe(req.query.retailers as string, 'retailerId', { min: 1 })]
            : undefined,
          minRating: req.query.minRating
            ? parseFloatSafe(req.query.minRating as string, 'minRating', { min: 0, max: 5 })
            : undefined,
          availability: req.query.availability
            ? Array.isArray(req.query.availability)
              ? (req.query.availability as string[])
              : [req.query.availability as string]
            : undefined,
          sortBy: req.query.sortBy as 'price_low' | 'price_high' | 'rating' | 'popularity',
        };

        const userId = req.user?.id;
        const results = await advancedSearchService.searchProducts(filters, userId);

        sendSuccess(res, {
          results: results.map((result) => ({
            product: result.product,
            relevanceScore: result.relevanceScore,
            matchType: result.matchType,
          })),
          metadata: {
            totalResults: results.length,
            searchTime: Date.now(),
            features: ['fuzzy_search', 'semantic_search', 'synonym_matching', 'relevance_scoring'],
          },
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'AdvancedSearch');
      }
    })
  );

  /**
   * GET /api/v1/search/suggestions
   * Get search suggestions and auto-completions
   * Agent-native equivalent of GET /api/search/suggestions
   */
  app.get(
    '/api/v1/search/suggestions',
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        const query = req.query.q as string;
        const limit = req.query.limit
          ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 50 })
          : 5;

        logger.info('API v1: Search suggestions request', { query, limit });

        if (!query || query.length < 2) {
          sendSuccess(res, { suggestions: [] });
          return;
        }

        // Import advanced search service dynamically
        const { advancedSearchService } = await import('../services/advanced-search');
        const suggestions = await advancedSearchService.getSearchSuggestions(query, limit);

        sendSuccess(res, { suggestions });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetSearchSuggestions');
      }
    })
  );

  /**
   * GET /api/v1/analytics/user
   * Get user's price tracking analytics and statistics
   * Agent-native endpoint for watchlist stats and tracking summary
   */
  app.get(
    '/api/v1/analytics/user',
    flexibleAuth,
    withAuth(async (req: Request, res: Response) => {
      try {
        const userId = (req.user as Express.User).id;
        logger.info(`API v1: Fetching analytics for user ${userId}`);

        // Get watchlist stats (primary user analytics)
        const watchlistStats = await storage.getWatchListStats(userId);

        // Get alert count
        const alertCount = await storage.countUserAlerts(userId);

        // Get notification count
        const { getUserNotifications } = await import('../services/notification-service');
        const notifications = await getUserNotifications(userId, { limit: 1 });

        sendSuccess(res, {
          watchlists: watchlistStats,
          alerts: {
            total: alertCount,
          },
          notifications: {
            unreadEstimate: notifications.length,
          },
          generatedAt: new Date().toISOString(),
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetUserAnalytics');
      }
    })
  );

  /**
   * GET /api/v1/admin/system-health
   * Get system health and status information
   * Agent-native equivalent of admin monitoring endpoints (read-only)
   */
  app.get(
    '/api/v1/admin/system-health',
    flexibleAuth,
    withAdmin(async (_req: Request, res: Response) => {
      try {
        logger.info('API v1: System health check');

        // Get performance stats
        const { getPerformanceStats } = await import('../middleware/performance');
        const performanceStats = getPerformanceStats();

        // Check database connectivity
        let dbStatus = 'healthy';
        try {
          await storage.getAllRetailers();
        } catch (error) {
          dbStatus = 'unhealthy';
          logger.error('Database health check failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Check Redis connectivity (if available)
        let redisStatus = 'not_configured';
        try {
          const { getRedisClient } = await import('../config/redis');
          const redis = getRedisClient();
          if (redis) {
            await redis.ping();
            redisStatus = 'healthy';
          }
        } catch (error) {
          redisStatus = 'unhealthy';
          logger.error('Redis health check failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }

        sendSuccess(res, {
          status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          components: {
            database: { status: dbStatus },
            redis: { status: redisStatus },
            api: { status: 'healthy' },
          },
          performance: performanceStats,
          uptime: process.uptime(),
          memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'SystemHealth');
      }
    })
  );

  /**
   * GET /api/v1/admin/stats
   * Get platform-wide statistics and analytics
   * Agent-native equivalent of GET /api/admin/analytics/overview
   */
  app.get(
    '/api/v1/admin/stats',
    flexibleAuth,
    withAdmin(async (_req: Request, res: Response) => {
      try {
        logger.info('API v1: Platform stats request');

        // Get admin analytics overview
        const overview = await storage.getAdminAnalyticsOverview();

        // Get user growth data
        const userGrowth = await storage.getUserGrowthData();

        // Get product activity
        const productActivity = await storage.getProductActivityData();

        // Get top categories
        const topCategories = await storage.getTopProductCategories(10);

        sendSuccess(res, {
          overview,
          userGrowth,
          productActivity,
          topCategories,
          generatedAt: new Date().toISOString(),
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetPlatformStats');
      }
    })
  );

  logger.info('API v1 routes registered (HTTP Basic Auth) - Phase 1 + Phase 2 + Phase 3: 31 endpoints');
}
