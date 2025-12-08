import { Express } from 'express';
import { storage } from '../storage';
import { storageCache } from '../services/storage-cache';
import type { AuthenticatedRequest } from '@shared/types';
import { retailerCacheMiddleware } from '../middleware/redis-cache';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { parseIntSafe } from '../utils/validation-helpers';
import { shouldSkipCache } from './helpers';

/**
 * Retailer Routes
 *
 * Handles retailer retrieval with multi-tier caching (L1 + L2).
 * Uses storageCache service for automatic cache management.
 * Supports cache bypass via ?skipCache=1 query parameter (admin only).
 */
export function registerRetailerRoutes(app: Express): void {
  // Get all retailers (with multi-tier caching)
  // Supports cache bypass via ?skipCache=1 query parameter (admin only)
  app.get('/api/retailers', retailerCacheMiddleware, async (req, res) => {
    try {
      // Set longer cache for retailers as they change less frequently
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=1800');

      // Cache bypass support for admin users (debugging and verification)
      // Note: shouldSkipCache() already validates authentication internally
      const skipCache = shouldSkipCache(req as AuthenticatedRequest);
      const retailers = skipCache
        ? await storage.getAllRetailers()
        : await storageCache.getAllRetailers();

      sendSuccess(res, retailers);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchRetailers');
    }
  });

  // Get retailer by ID (with multi-tier caching)
  // Supports cache bypass via ?skipCache=1 query parameter (admin only)
  app.get('/api/retailers/:id', async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'retailerId', { min: 1 });

      // Set longer cache for retailers as they change less frequently
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=1800');

      // Cache bypass support for admin users (debugging and verification)
      // Note: shouldSkipCache() already validates authentication internally
      const skipCache = shouldSkipCache(req as AuthenticatedRequest);
      const retailer = skipCache
        ? await storage.getRetailerById(id)
        : await storageCache.getRetailerById(id);

      if (!retailer) {
        sendError(res, 'Retailer not found', 404);
        return;
      }

      sendSuccess(res, retailer);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchRetailerById');
    }
  });
}
