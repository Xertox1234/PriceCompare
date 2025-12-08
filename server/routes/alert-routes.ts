import { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { withAuth } from './helpers';
import { parseIntSafe } from '../utils/validation-helpers';
import { csrfProtection } from '../middleware/security';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { logger } from '../utils/logger';

/**
 * Schema for creating a new price alert
 * VALIDATION: productId required (positive), targetPrice required (positive, decimal)
 */
const createPriceAlertSchema = z.object({
  productId: z.number().int('Product ID must be an integer').min(1, 'Product ID must be positive'),
  targetPrice: z
    .number()
    .positive('Target price must be positive')
    .multipleOf(0.01, 'Price must have maximum 2 decimal places'),
  notifyForum: z.boolean().optional().default(false),
});

/**
 * Schema for updating a price alert
 * VALIDATION: All fields optional (partial update)
 */
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

/**
 * Price Alert Routes
 *
 * Handles price alert creation, retrieval, updates, and deletion.
 */
export function registerAlertRoutes(app: Express): void {
  // Create a new price alert
  app.post(
    '/api/price-alerts',
    csrfProtection,
    withAuth(async (req, res) => {
      try {
        // PHASE 0 PATTERN: Validation at route layer with Zod
        const validatedData = createPriceAlertSchema.parse(req.body);
        const user = req.user;

        // Verify product exists (prevents FK constraint failure)
        const product = await storage.getProductById(validatedData.productId);
        if (!product) {
          sendError(res, 'Product not found', 404);
          return;
        }

        const alert = await storage.createPriceAlert({
          userId: user.id,
          productId: validatedData.productId,
          targetPrice: validatedData.targetPrice.toFixed(2), // Convert to string for decimal field
          notifyForum: validatedData.notifyForum,
        });

        sendSuccess(res, alert, 201);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'CreatePriceAlert');
      }
    })
  );

  // Get all price alerts for the current user
  app.get(
    '/api/price-alerts',
    withAuth(async (req, res) => {
      try {
        const user = req.user;
        const alerts = await storage.getUserPriceAlerts(user.id);
        sendSuccess(res, alerts);
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'GetPriceAlerts');
      }
    })
  );

  // Update a price alert (activate/deactivate)
  app.patch(
    '/api/price-alerts/:id',
    csrfProtection,
    withAuth(async (req, res) => {
      try {
        const user = req.user;
        const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });

        // PHASE 0 PATTERN: Validation at route layer with Zod
        const validatedData = updatePriceAlertSchema.parse(req.body);

        // Convert targetPrice to string if present (for decimal field)
        const updates = {
          ...validatedData,
          targetPrice: validatedData.targetPrice?.toFixed(2),
        };

        const updatedAlert = await storage.updatePriceAlert(alertId, user.id, updates);
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

  // Delete a price alert
  app.delete(
    '/api/price-alerts/:id',
    csrfProtection,
    withAuth(async (req, res) => {
      try {
        const user = req.user;
        const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });

        const deleted = await storage.deletePriceAlert(alertId, user.id);
        if (!deleted) {
          sendError(res, 'Alert not found or unauthorized', 404);
          return;
        }

        // Audit log for compliance and debugging
        logger.info('Price alert deleted', {
          alertId,
          userId: user.id,
          action: 'price-alert-deleted',
          timestamp: new Date().toISOString(),
        });

        // Return meaningful success response instead of empty object
        sendSuccess(res, { deleted: true });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'DeletePriceAlert');
      }
    })
  );
}
