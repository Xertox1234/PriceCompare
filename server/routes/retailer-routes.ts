import { Express } from 'express';
import { storage } from '../storage';
import { storageCache } from '../services/storage-cache';
import type { AuthenticatedRequest } from '@shared/types';
import { retailerCacheMiddleware } from '../middleware/redis-cache';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { parseIntSafe } from '../utils/validation-helpers';
import { shouldSkipCache } from './helpers';

// Supported countries for Phase 1 (TODO 251)
const SUPPORTED_COUNTRIES = [
  { code: 'US', name: 'United States', currency: 'USD', currencySymbol: '$' },
  { code: 'CA', name: 'Canada', currency: 'CAD', currencySymbol: 'C$' },
] as const;

const VALID_COUNTRY_CODES = SUPPORTED_COUNTRIES.map((c) => c.code);

/**
 * Retailer Routes
 *
 * Handles retailer retrieval with multi-tier caching (L1 + L2).
 * Uses storageCache service for automatic cache management.
 * Supports cache bypass via ?skipCache=1 query parameter (admin only).
 * Supports country filtering via ?country=XX query parameter (TODO 251).
 */
export function registerRetailerRoutes(app: Express): void {
  // Get supported countries (TODO 251)
  // Returns list of countries with their currencies for frontend dropdown
  app.get('/api/countries', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h (rarely changes)
    sendSuccess(res, SUPPORTED_COUNTRIES);
  });

  // Get all retailers (with multi-tier caching)
  // Supports cache bypass via ?skipCache=1 query parameter (admin only)
  // Supports country filtering via ?country=XX query parameter (TODO 251)
  app.get('/api/retailers', retailerCacheMiddleware, async (req, res) => {
    try {
      // Set longer cache for retailers as they change less frequently
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=1800');

      // Cache bypass support for admin users (debugging and verification)
      // Note: shouldSkipCache() already validates authentication internally
      const skipCache = shouldSkipCache(req as AuthenticatedRequest);

      // Country filter support (TODO 251)
      const countryCode = req.query.country as string | undefined;

      if (countryCode) {
        // Validate country code
        if (!VALID_COUNTRY_CODES.includes(countryCode as 'US' | 'CA')) {
          sendError(
            res,
            `Invalid country code: ${countryCode}. Supported: ${VALID_COUNTRY_CODES.join(', ')}`,
            400
          );
          return;
        }
        // Fetch retailers filtered by country (no cache layer for this yet)
        const retailers = await storage.getRetailersByCountry(countryCode);
        sendSuccess(res, retailers);
        return;
      }

      // Use getRetailers() to return only active retailers for public API
      const retailers = skipCache
        ? await storage.getRetailers()
        : await storageCache.getRetailers();

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
