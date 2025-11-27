/**
 * Product Specification Routes
 *
 * Structured key/value specifications for products (electronics, appliances, etc.)
 * Specs are organized into groups like "Display", "Processor", "Dimensions".
 */
import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { withAuth, withAdmin } from './helpers';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { parseIntSafe } from '../utils/validation-helpers';
import { logger } from '../utils/logger';

// Validation schemas
const createSpecificationSchema = z.object({
  productId: z.number().int().positive(),
  specGroup: z.string().max(100).optional(),
  specName: z.string().min(1).max(100),
  specValue: z.string().min(1),
  specUnit: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
  isHighlight: z.boolean().optional(),
  source: z.enum(['scraper', 'manual', 'api']).optional(),
});

const createSpecificationsBatchSchema = z.object({
  productId: z.number().int().positive(),
  specs: z.array(z.object({
    specGroup: z.string().max(100).optional(),
    specName: z.string().min(1).max(100),
    specValue: z.string().min(1),
    specUnit: z.string().max(50).optional(),
    sortOrder: z.number().int().optional(),
    isHighlight: z.boolean().optional(),
  })).min(1).max(100),
  source: z.enum(['scraper', 'manual', 'api']).optional(),
});

const updateSpecificationSchema = z.object({
  specGroup: z.string().max(100).optional(),
  specName: z.string().min(1).max(100).optional(),
  specValue: z.string().min(1).optional(),
  specUnit: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
  isHighlight: z.boolean().optional(),
});

/**
 * Register specification routes
 */
export function registerSpecificationRoutes(app: Express): void {
  // GET /api/products/:productId/specifications - Get product specifications
  app.get('/api/products/:productId/specifications', async (req, res) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });
      const specs = await storage.getProductSpecifications(productId);
      sendSuccess(res, { specs, count: specs.length });
    } catch (error) {
      sendErrorFromException(res, error, 'GetProductSpecifications');
    }
  });

  // GET /api/products/:productId/specifications/grouped - Get specs grouped by category
  app.get('/api/products/:productId/specifications/grouped', async (req, res) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });
      const groups = await storage.getProductSpecificationsGrouped(productId);
      sendSuccess(res, { groups, count: groups.length });
    } catch (error) {
      sendErrorFromException(res, error, 'GetProductSpecificationsGrouped');
    }
  });

  // GET /api/products/:productId/full - Get product with all details including specs
  app.get('/api/products/:productId/full', async (req, res) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });
      const product = await storage.getProductFull(productId);

      if (!product) {
        sendError(res, 'Product not found', 404);
        return;
      }

      sendSuccess(res, product);
    } catch (error) {
      sendErrorFromException(res, error, 'GetProductFull');
    }
  });

  // POST /api/admin/specifications - Create a single specification (Admin only)
  app.post('/api/admin/specifications', withAdmin(async (req, res) => {
    try {
      const data = createSpecificationSchema.parse(req.body);

      const spec = await storage.createProductSpecification({
        productId: data.productId,
        specGroup: data.specGroup ?? null,
        specName: data.specName,
        specValue: data.specValue,
        specUnit: data.specUnit ?? null,
        sortOrder: data.sortOrder ?? 0,
        isHighlight: data.isHighlight ?? false,
        source: data.source ?? 'manual',
      });

      logger.info('Product specification created', {
        specId: spec.id,
        productId: data.productId,
        specName: data.specName,
      });

      sendSuccess(res, spec, 201);
    } catch (error) {
      sendErrorFromException(res, error, 'CreateSpecification');
    }
  }));

  // POST /api/admin/specifications/batch - Create multiple specifications (Admin only)
  app.post('/api/admin/specifications/batch', withAdmin(async (req, res) => {
    try {
      const data = createSpecificationsBatchSchema.parse(req.body);

      const specs = await storage.createProductSpecificationsBatch(
        data.specs.map((spec, index) => ({
          productId: data.productId,
          specGroup: spec.specGroup ?? null,
          specName: spec.specName,
          specValue: spec.specValue,
          specUnit: spec.specUnit ?? null,
          sortOrder: spec.sortOrder ?? index,
          isHighlight: spec.isHighlight ?? false,
          source: data.source ?? 'manual',
        }))
      );

      logger.info('Product specifications batch created', {
        productId: data.productId,
        count: specs.length,
      });

      sendSuccess(res, { specs, count: specs.length }, 201);
    } catch (error) {
      sendErrorFromException(res, error, 'CreateSpecificationsBatch');
    }
  }));

  // PATCH /api/admin/specifications/:id - Update specification (Admin only)
  app.patch('/api/admin/specifications/:id', withAdmin(async (req, res) => {
    try {
      const specId = parseIntSafe(req.params.id, 'specId', { min: 1 });
      const updates = updateSpecificationSchema.parse(req.body);

      const spec = await storage.updateProductSpecification(specId, updates);
      if (!spec) {
        sendError(res, 'Specification not found', 404);
        return;
      }

      sendSuccess(res, spec);
    } catch (error) {
      sendErrorFromException(res, error, 'UpdateSpecification');
    }
  }));

  // DELETE /api/admin/specifications/:id - Delete single specification (Admin only)
  app.delete('/api/admin/specifications/:id', withAdmin(async (req, res) => {
    try {
      const specId = parseIntSafe(req.params.id, 'specId', { min: 1 });

      const deleted = await storage.deleteProductSpecification(specId);
      if (!deleted) {
        sendError(res, 'Specification not found', 404);
        return;
      }

      logger.info('Product specification deleted', { specId });
      sendSuccess(res, {});
    } catch (error) {
      sendErrorFromException(res, error, 'DeleteSpecification');
    }
  }));

  // DELETE /api/admin/products/:productId/specifications - Delete all specs for product (Admin only)
  app.delete('/api/admin/products/:productId/specifications', withAdmin(async (req, res) => {
    try {
      const productId = parseIntSafe(req.params.productId, 'productId', { min: 1 });

      const count = await storage.deleteProductSpecifications(productId);

      logger.info('Product specifications cleared', { productId, count });
      sendSuccess(res, { deletedCount: count });
    } catch (error) {
      sendErrorFromException(res, error, 'DeleteProductSpecifications');
    }
  }));
}
