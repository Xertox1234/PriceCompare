/**
 * Wishlist Routes
 *
 * Simple "I want this" product lists - separate from price tracking watchlists.
 * Wishlists are personal shopping lists without price monitoring features.
 */
import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { withAuth } from './helpers';
import { createErrorResponse } from '../utils/error-sanitizer';
import { parseIntSafe } from '../utils/validation-helpers';
import { logger } from '../utils/logger';

// Validation schemas
const createWishlistSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

const updateWishlistSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

const addToWishlistSchema = z.object({
  productId: z.number().int().positive(),
  notes: z.string().max(500).optional(),
  priority: z.number().int().min(1).max(5).optional(),
});

/**
 * Register wishlist routes
 */
export function registerWishlistRoutes(app: Express): void {
  // GET /api/wishlists - Get all user wishlists
  app.get('/api/wishlists', withAuth(async (req, res) => {
    try {
      const userId = req.user!.id;
      const wishlists = await storage.getUserWishlists(userId);
      res.json({ success: true, data: wishlists, count: wishlists.length });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetUserWishlists');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  // GET /api/wishlists/items - Get all wishlist items for user (flat list)
  app.get('/api/wishlists/items', withAuth(async (req, res) => {
    try {
      const userId = req.user!.id;
      const items = await storage.getUserWishlistItems(userId);
      res.json({ success: true, data: items, count: items.length });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetUserWishlistItems');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  // GET /api/wishlists/check/:productId - Check if product is in any wishlist
  app.get('/api/wishlists/check/:productId', withAuth(async (req, res) => {
    try {
      const userId = req.user!.id;
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });
      const isInWishlist = await storage.isInWishlist(userId, productId);
      res.json({ success: true, isInWishlist });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'CheckWishlist');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  // POST /api/wishlists - Create a new wishlist
  app.post('/api/wishlists', withAuth(async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = createWishlistSchema.parse(req.body);

      // Check user doesn't have too many wishlists (limit to 10)
      const existing = await storage.getUserWishlists(userId);
      if (existing.length >= 10) {
        res.status(400).json({ error: 'Maximum of 10 wishlists allowed' });
        return;
      }

      const wishlist = await storage.createWishlist(userId, data);
      logger.info('Wishlist created', { userId, wishlistId: wishlist.id });
      res.status(201).json({ success: true, data: wishlist });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'CreateWishlist');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  // GET /api/wishlists/:id - Get specific wishlist with items
  app.get('/api/wishlists/:id', withAuth(async (req, res) => {
    try {
      const userId = req.user!.id;
      const wishlistId = parseIntSafe(req.params.id, 'wishlistId', { min: 1 });

      const wishlist = await storage.getWishlistById(wishlistId, userId);
      if (!wishlist) {
        res.status(404).json({ error: 'Wishlist not found' });
        return;
      }

      res.json({ success: true, data: wishlist });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'GetWishlist');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  // PATCH /api/wishlists/:id - Update wishlist
  app.patch('/api/wishlists/:id', withAuth(async (req, res) => {
    try {
      const userId = req.user!.id;
      const wishlistId = parseIntSafe(req.params.id, 'wishlistId', { min: 1 });
      const updates = updateWishlistSchema.parse(req.body);

      const wishlist = await storage.updateWishlist(wishlistId, userId, updates);
      if (!wishlist) {
        res.status(404).json({ error: 'Wishlist not found' });
        return;
      }

      res.json({ success: true, data: wishlist });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'UpdateWishlist');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  // DELETE /api/wishlists/:id - Delete wishlist
  app.delete('/api/wishlists/:id', withAuth(async (req, res) => {
    try {
      const userId = req.user!.id;
      const wishlistId = parseIntSafe(req.params.id, 'wishlistId', { min: 1 });

      const deleted = await storage.deleteWishlist(wishlistId, userId);
      if (!deleted) {
        res.status(404).json({ error: 'Wishlist not found' });
        return;
      }

      logger.info('Wishlist deleted', { userId, wishlistId });
      res.json({ success: true });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'DeleteWishlist');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  // POST /api/wishlists/:id/items - Add product to wishlist
  app.post('/api/wishlists/:id/items', withAuth(async (req, res) => {
    try {
      const userId = req.user!.id;
      const wishlistId = parseIntSafe(req.params.id, 'wishlistId', { min: 1 });
      const data = addToWishlistSchema.parse(req.body);

      // Check wishlist item limit (100 per wishlist)
      const wishlist = await storage.getWishlistById(wishlistId, userId);
      if (!wishlist) {
        res.status(404).json({ error: 'Wishlist not found' });
        return;
      }
      if (wishlist.itemCount >= 100) {
        res.status(400).json({ error: 'Maximum of 100 items per wishlist' });
        return;
      }

      const item = await storage.addToWishlist(wishlistId, userId, data.productId, {
        notes: data.notes,
        priority: data.priority,
      });

      logger.info('Product added to wishlist', { userId, wishlistId, productId: data.productId });
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      // Handle duplicate entry
      if (error instanceof Error && error.message.includes('unique')) {
        res.status(400).json({ error: 'Product already in wishlist' });
        return;
      }
      const errorResponse = createErrorResponse(error, 'AddToWishlist');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));

  // DELETE /api/wishlists/:id/items/:productId - Remove product from wishlist
  app.delete('/api/wishlists/:id/items/:productId', withAuth(async (req, res) => {
    try {
      const userId = req.user!.id;
      const wishlistId = parseIntSafe(req.params.id, 'wishlistId', { min: 1 });
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const removed = await storage.removeFromWishlist(wishlistId, userId, productId);
      if (!removed) {
        res.status(404).json({ error: 'Item not found in wishlist' });
        return;
      }

      logger.info('Product removed from wishlist', { userId, wishlistId, productId });
      res.json({ success: true });
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'RemoveFromWishlist');
      res.status(errorResponse.status).json({ error: errorResponse.error });
    }
  }));
}
