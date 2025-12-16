import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { withAuth, isAuthenticated } from './helpers';
import type { AuthenticatedRequest } from '../../shared/types';
import { storage } from '../storage';
import { parseIntSafe } from '../utils/validation-helpers';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { csrfProtection } from '../middleware/security';
import { logger } from '../utils/logger';
import { createRateLimiter } from '../middleware/redis-rate-limiter';
import { WATCHLIST_RATE_LIMITS } from '../utils/constants';

/**
 * Watchlist Routes
 *
 * Handles user watch list creation, retrieval, updates, and product management.
 * All routes require authentication and mutating operations require CSRF protection.
 */

// ============================================================================
// Middleware Helpers
// ============================================================================

/**
 * Middleware to require authentication
 * Simple wrapper that checks req.user and returns 401 if not authenticated
 */
function requireAuth(req: Request, res: Response, next: () => void) {
  if (!isAuthenticated(req)) {
    sendError(res, 'Authentication required', 401);
    return;
  }
  next();
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Schema for creating a new watch list
 * VALIDATION: Name required (1-100 chars), description optional (max 500 chars)
 * Note: .trim() transforms the string BEFORE validation, so empty/whitespace-only strings
 * become "" and fail the .min(1) check with a 400 validation error
 */
const createWatchListSchema = z.object({
  name: z
    .string()
    .trim() // Trim FIRST - converts "  " to ""
    .min(1, 'Name is required') // Then validate non-empty
    .max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
});

/**
 * Schema for updating a watch list
 * VALIDATION: At least one field must be provided, same constraints as create
 */
const updateWatchListSchema = z
  .object({
    name: z
      .string()
      .trim() // Trim FIRST before validation
      .min(1, 'Name cannot be empty')
      .max(100, 'Name must be 100 characters or less')
      .optional(),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'At least one field (name or description) must be provided',
  });

/**
 * Schema for adding a product to a watch list
 * VALIDATION: Product ID must be a positive integer
 */
const addProductSchema = z.object({
  productId: z.number().int().positive('Product ID must be a positive integer'),
});

const shareWatchListSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  permission: z.enum(['view', 'edit']),
});

// ============================================================================
// Rate Limiters
// ============================================================================

/**
 * Rate limiter for watch list creation
 * Configuration: WATCHLIST_RATE_LIMITS.CREATE from constants.ts
 */
const watchlistCreateLimiter = createRateLimiter(WATCHLIST_RATE_LIMITS.CREATE);

/**
 * Rate limiter for adding products to watch lists
 * Configuration: WATCHLIST_RATE_LIMITS.PRODUCT_ADD from constants.ts
 */
const productAddLimiter = createRateLimiter(WATCHLIST_RATE_LIMITS.PRODUCT_ADD);

// ============================================================================
// Route Handlers
// ============================================================================

export function registerWatchListRoutes(app: Express): void {
  /**
   * GET /api/watchlists/shared
   * Get watch lists shared with the authenticated user
   */
  app.get(
    '/api/watchlists/shared',
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const watchLists = await storage.getSharedWatchLists(userId);
        sendSuccess(res, { watchLists });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetSharedWatchLists');
      }
    })
  );

  /**
   * GET /api/watchlists
   * Get all watch lists for the authenticated user with product counts
   *
   * @returns Array of watch lists with product counts
   */
  app.get(
    '/api/watchlists',
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        logger.info(`Fetching watch lists for user ${userId}`);

        const watchLists = await storage.getUserWatchLists(userId);

        // Standardize response shape for clients and tests.
        // Tests expect: { data: { watchLists: [...] } }
        sendSuccess(res, { watchLists });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetWatchLists');
      }
    })
  );

  /**
   * POST /api/watchlists
   * Create a new watch list for the authenticated user
   *
   * @body {name: string, description?: string}
   * @returns The created watch list
   * @security CSRF protection required
   * @security User ID taken from authenticated session (req.user.id)
   */
  app.post('/api/watchlists', csrfProtection, requireAuth, watchlistCreateLimiter,
    async (req: Request, res: Response) => {
      try {
        // Type assertion safe after requireAuth middleware
        const userId = (req as AuthenticatedRequest).user.id;

        // Validate request body
        const data = createWatchListSchema.parse(req.body);

        logger.info(`Creating watch list "${data.name}" for user ${userId}`);

        // Create watch list (storage validates max 20 lists per user)
        const watchList = await storage.createWatchList(userId, data);

        sendSuccess(res, watchList, 201);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'CreateWatchList');
      }
    }
  );

  /**
   * GET /api/watchlists/products
   * Get all watched products across all user's watch lists
   *
   * @query sortBy - Sort order: 'priceDropPercent' | 'savings' | 'dateAdded'
   * @query cursor - Cursor for pagination (last product watch ID)
   * @query limit - Number of products per page (default: 50, max: 100)
   * @returns Paginated watched products with pricing data and mini-chart data
   * @note IMPORTANT: This route MUST be registered BEFORE /api/watchlists/:id
   *       to avoid Express matching "products" as an ID parameter
   */
  app.get(
    '/api/watchlists/products',
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const sortBy = req.query.sortBy as 'priceDropPercent' | 'savings' | 'dateAdded' | undefined;
        const cursor = req.query.cursor
          ? parseIntSafe(req.query.cursor as string, 'cursor', { min: 1 })
          : undefined;
        const limit = req.query.limit
          ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 })
          : 50;

        logger.info(
          `Fetching watched products for user ${userId} (sortBy: ${sortBy || 'priceDropPercent'}, cursor: ${cursor || 'none'}, limit: ${limit})`
        );

        const result = await storage.getWatchedProducts(userId, { sortBy, cursor, limit });

        sendSuccess(res, result); // Returns { products, hasMore, nextCursor }
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetWatchedProducts');
      }
    })
  );

  /**
   * GET /api/watchlists/stats
   * Get aggregated statistics for the user's watch lists and products
   *
   * @returns Dashboard statistics including:
   *   - Total watch lists and products
   *   - Potential savings
   *   - Active/triggered alerts
   *   - Best deals
   *   - Weekly trends
   * @note IMPORTANT: This route MUST be registered BEFORE /api/watchlists/:id
   *       to avoid Express matching "stats" as an ID parameter
   */
  app.get(
    '/api/watchlists/stats',
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        logger.info(`Fetching watch list stats for user ${userId}`);

        const stats = await storage.getWatchListStats(userId);

        sendSuccess(res, stats);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetWatchListStats');
      }
    })
  );

  /**
   * GET /api/watchlists/:id
   * Get a specific watch list with all products and pricing details
   *
   * @param id - Watch list ID
   * @returns Watch list with products array
   * @security Ownership verification in storage layer
   */
  app.get(
    '/api/watchlists/:id',
    withAuth(async (req, res) => {
      try {
        const userId = req.user.id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        logger.info(`Fetching watch list ${watchListId} for user ${userId}`);

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
   * GET /api/watchlists/:id/shares
   * List users this watchlist is shared with (owner-only)
   */
  app.get(
    '/api/watchlists/:id/shares',
    withAuth(async (req, res) => {
      try {
        const ownerUserId = req.user.id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        const shares = await storage.listWatchListShares(ownerUserId, watchListId);
        sendSuccess(res, { shares });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'ListWatchListShares');
      }
    })
  );

  /**
   * POST /api/watchlists/:id/shares
   * Invite a user by email to share this watchlist (owner-only)
   */
  app.post('/api/watchlists/:id/shares', csrfProtection, requireAuth,
    async (req: Request, res: Response) => {
      try {
        const ownerUserId = (req as AuthenticatedRequest).user.id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });
        const data = shareWatchListSchema.parse(req.body);

        const result = await storage.shareWatchListByEmail(
          ownerUserId,
          watchListId,
          data.email,
          data.permission
        );

        sendSuccess(res, result, 201);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'ShareWatchList');
      }
    }
  );

  /**
   * DELETE /api/watchlists/:id/shares/:sharedWithUserId
   * Revoke share access (owner-only)
   */
  app.delete('/api/watchlists/:id/shares/:sharedWithUserId', csrfProtection, requireAuth,
    async (req: Request, res: Response) => {
      try {
        const ownerUserId = (req as AuthenticatedRequest).user.id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });
        const sharedWithUserId = parseIntSafe(req.params.sharedWithUserId, 'sharedWithUserId', {
          min: 1,
        });

        const revoked = await storage.revokeWatchListShare(ownerUserId, watchListId, sharedWithUserId);
        sendSuccess(res, { revoked });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'RevokeWatchListShare');
      }
    }
  );

  /**
   * PATCH /api/watchlists/:id
   * Update a watch list's name or description
   *
   * @param id - Watch list ID
   * @body {name?: string, description?: string}
   * @returns The updated watch list
   * @security CSRF protection required
   * @security Ownership verification in storage layer
   */
  app.patch('/api/watchlists/:id', csrfProtection, requireAuth,
    async (req: Request, res: Response) => {
      try {
        // Type assertion safe after requireAuth middleware
        const userId = (req as AuthenticatedRequest).user.id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        // Validate request body
        const updates = updateWatchListSchema.parse(req.body);

        logger.info(`Updating watch list ${watchListId} for user ${userId}`);

        const watchList = await storage.updateWatchList(watchListId, userId, updates);

        sendSuccess(res, watchList);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'UpdateWatchList');
      }
    }
  );

  /**
   * DELETE /api/watchlists/:id
   * Delete a watch list
   *
   * @param id - Watch list ID
   * @returns {success: true, deletedId: number}
   * @security CSRF protection required
   * @security Ownership verification in storage layer
   * @note Product watches are automatically deleted via CASCADE constraint
   */
  app.delete('/api/watchlists/:id', csrfProtection, requireAuth,
    async (req: Request, res: Response) => {
      try {
        // Type assertion safe after requireAuth middleware
        const userId = (req as AuthenticatedRequest).user.id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        logger.info(`Deleting watch list ${watchListId} for user ${userId}`);

        const deletedWatchList = await storage.deleteWatchList(watchListId, userId);

        sendSuccess(res, {
          deletedId: deletedWatchList.id,
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'DeleteWatchList');
      }
    }
  );

  /**
   * POST /api/watchlists/:id/products
   * Add a product to a watch list
   *
   * @param id - Watch list ID
   * @body {productId: number}
   * @returns The created product watch entry
   * @security CSRF protection required
   * @security Ownership verification in storage layer
   * @note Storage validates: product exists, not duplicate, max 100 products/list
   */
  app.post('/api/watchlists/:id/products', csrfProtection, requireAuth, productAddLimiter,
    async (req: Request, res: Response) => {
      try {
        // Type assertion safe after requireAuth middleware
        const userId = (req as AuthenticatedRequest).user.id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });

        // Validate request body
        const { productId } = addProductSchema.parse(req.body);

        logger.info(`Adding product ${productId} to watch list ${watchListId} for user ${userId}`);

        const productWatch = await storage.addProductToWatchList(watchListId, productId, userId);

        sendSuccess(res, productWatch, 201);
      } catch (error: unknown) {
        // Handle duplicate product error with proper status code
        if (error instanceof Error && error.message.includes('already')) {
          sendError(res, error.message, 409); // 409 Conflict for duplicate resource
          return;
        }
        sendErrorFromException(res, error, 'AddProductToWatchList');
      }
    }
  );

  /**
   * DELETE /api/watchlists/:id/products/:productId
   * Remove a product from a watch list
   *
   * @param id - Watch list ID
   * @param productId - Product ID
   * @returns {success: true}
   * @security CSRF protection required
   * @security Ownership verification in storage layer
   */
  app.delete('/api/watchlists/:id/products/:productId', csrfProtection, requireAuth,
    async (req: Request, res: Response) => {
      try {
        // Type assertion safe after requireAuth middleware
        const userId = (req as AuthenticatedRequest).user.id;
        const watchListId = parseIntSafe(req.params.id, 'watchListId', { min: 1 });
        const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

        logger.info(
          `Removing product ${productId} from watch list ${watchListId} for user ${userId}`
        );

        await storage.removeProductFromWatchList(watchListId, productId, userId);

        sendSuccess(res, { success: true });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'RemoveProductFromWatchList');
      }
    }
  );
}
