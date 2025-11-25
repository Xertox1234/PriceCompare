import { db } from "../db";
import { priceAlerts, products, productOffers, retailers } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { BaseStorage } from "./base-storage";
import type {
  PriceAlert,
  InsertPriceAlert,
  ProductOfferForAlert,
  TriggeredPriceAlert,
} from "./types";

/**
 * Alert Storage Constants
 *
 * Centralized constants for magic numbers used in alert storage operations.
 */
const ALERT_CONSTANTS = {
  VALIDATION: {
    MIN_ID: 1,
    MIN_PRICE: 0,
  },
} as const;

/**
 * Alert Storage Interface
 *
 * Defines all price alert-related database operations.
 */
export interface IAlertStorage {
  // Basic CRUD Operations
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  getUserPriceAlerts(userId: number): Promise<PriceAlert[]>;
  updatePriceAlert(alertId: number, userId: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | null>;
  deletePriceAlert(alertId: number, userId: number): Promise<boolean>;

  // Alert Trigger Operations
  getProductOfferDetailsForAlert(productOfferId: number): Promise<ProductOfferForAlert | null>;
  getTriggeredPriceAlerts(productId: number, newPrice: number): Promise<TriggeredPriceAlert[]>;
  getUsersWithActiveAlertsForProduct(productId: number): Promise<number[]>;
}

/**
 * Alert Storage Repository
 *
 * Handles all database operations related to price alerts including:
 * - Alert CRUD operations (create, read, update, delete)
 * - Alert triggering logic for price drop detection
 * - User notification queries for alert system
 *
 * **Quality Patterns Applied:**
 * - Extends BaseStorage for consistent error handling
 * - Explicit field selection for security
 * - Input validation on all methods
 * - Type safety (no 'any' types)
 * - Constants for magic numbers
 * - Comprehensive JSDoc documentation
 *
 * **Related Services:**
 * - price-drop-detection.ts: Uses trigger methods
 * - smart-alerts-service.ts: Uses CRUD operations
 * - notification-service.ts: Receives alert events
 *
 * @extends BaseStorage
 * @implements IAlertStorage
 */
export class AlertStorage extends BaseStorage implements IAlertStorage {
  /**
   * Create a new price alert
   *
   * Creates a price alert for a user on a specific product with a target price.
   * When the product price drops to or below the target price, the alert will trigger.
   *
   * @param alert - Price alert data (userId, productId, targetPrice, etc.)
   * @returns The created price alert with generated ID
   *
   * @throws Error if alert data is invalid or creation fails
   *
   * @example
   * const alert = await alertStorage.createPriceAlert({
   *   userId: 123,
   *   productId: 456,
   *   targetPrice: "99.99",
   *   notifyForum: false
   * });
   */
  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    return this.handleError('createPriceAlert', async () => {
      // Validation
      if (!alert.userId || alert.userId <= 0) {
        throw new Error('User ID must be a positive number');
      }
      if (!alert.productId || alert.productId <= 0) {
        throw new Error('Product ID must be a positive number');
      }
      if (!alert.targetPrice) {
        throw new Error('Target price is required');
      }

      const targetPriceNum = parseFloat(alert.targetPrice as string);
      if (isNaN(targetPriceNum) || targetPriceNum < ALERT_CONSTANTS.VALIDATION.MIN_PRICE) {
        throw new Error('Target price must be a non-negative number');
      }

      // Insert with explicit return
      const [created] = await db
        .insert(priceAlerts)
        .values(alert)
        .returning();

      if (!created) {
        throw new Error('Failed to create price alert');
      }

      return created;
    });
  }

  /**
   * Get all active price alerts for a user
   *
   * Retrieves all currently active (non-deleted) price alerts for a specific user.
   * Only returns alerts where isActive = true.
   *
   * @param userId - User ID to get alerts for (must be positive)
   * @returns Array of active price alerts (empty array if none found)
   *
   * @throws Error if userId is invalid
   *
   * @example
   * const alerts = await alertStorage.getUserPriceAlerts(123);
   * // Returns: [{ id: 1, productId: 456, targetPrice: "99.99", ... }]
   */
  async getUserPriceAlerts(userId: number): Promise<PriceAlert[]> {
    return this.handleError('getUserPriceAlerts', async () => {
      // Validation
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

      return await db
        .select()
        .from(priceAlerts)
        .where(and(
          eq(priceAlerts.userId, userId),
          eq(priceAlerts.isActive, true)
        ));
    });
  }

  /**
   * Update a price alert
   *
   * Updates an existing price alert. Only the alert owner can update their own alerts.
   * Common updates: changing targetPrice, toggling isActive, updating notifyForum.
   *
   * @param alertId - Price alert ID to update (must be positive)
   * @param userId - User ID making the update (authorization check)
   * @param updates - Partial alert data to update
   * @returns Updated price alert or null if not found/unauthorized
   *
   * @throws Error if IDs are invalid or updates object is empty
   *
   * @example
   * const updated = await alertStorage.updatePriceAlert(1, 123, {
   *   targetPrice: "89.99",
   *   isActive: true
   * });
   */
  async updatePriceAlert(
    alertId: number,
    userId: number,
    updates: Partial<InsertPriceAlert>
  ): Promise<PriceAlert | null> {
    return this.handleError('updatePriceAlert', async () => {
      // Validation
      if (!alertId || alertId <= 0) {
        throw new Error('Alert ID must be a positive number');
      }
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }
      if (!updates || Object.keys(updates).length === 0) {
        this.logDebug('updatePriceAlert', { alertId, userId, reason: 'No updates provided' });
        return null;
      }

      // Validate targetPrice if present
      if (updates.targetPrice !== undefined) {
        const targetPriceNum = parseFloat(updates.targetPrice as string);
        if (isNaN(targetPriceNum) || targetPriceNum < ALERT_CONSTANTS.VALIDATION.MIN_PRICE) {
          throw new Error('Target price must be a non-negative number');
        }
      }

      // Update with ownership check (user can only update their own alerts)
      const [updated] = await db
        .update(priceAlerts)
        .set(updates)
        .where(and(
          eq(priceAlerts.id, alertId),
          eq(priceAlerts.userId, userId)
        ))
        .returning();

      return updated || null;
    });
  }

  /**
   * Delete a price alert
   *
   * Permanently deletes a price alert. Only the alert owner can delete their own alerts.
   * This is a hard delete (not soft delete).
   *
   * @param alertId - Price alert ID to delete (must be positive)
   * @param userId - User ID making the deletion (authorization check)
   * @returns true if deleted, false if not found/unauthorized
   *
   * @throws Error if IDs are invalid
   *
   * @example
   * const deleted = await alertStorage.deletePriceAlert(1, 123);
   * // Returns: true if deleted, false if not found or user doesn't own it
   */
  async deletePriceAlert(alertId: number, userId: number): Promise<boolean> {
    return this.handleError('deletePriceAlert', async () => {
      // Validation
      if (!alertId || alertId <= 0) {
        throw new Error('Alert ID must be a positive number');
      }
      if (!userId || userId <= 0) {
        throw new Error('User ID must be a positive number');
      }

      // Delete with ownership check
      const result = await db
        .delete(priceAlerts)
        .where(and(
          eq(priceAlerts.id, alertId),
          eq(priceAlerts.userId, userId)
        ))
        .returning();

      return result.length > 0;
    });
  }

  /**
   * Get product offer details for alert notification
   *
   * Retrieves product offer details with JOINs to products and retailers table.
   * Used by price-drop-detection service to build notification messages.
   *
   * **Performance:** Single query with LEFT JOINs (no N+1)
   *
   * @param productOfferId - Product offer ID (must be positive)
   * @returns Offer details with product name, retailer name, URL, and price (or null if not found)
   *
   * @throws Error if productOfferId is invalid
   *
   * @example
   * const details = await alertStorage.getProductOfferDetailsForAlert(789);
   * // Returns: {
   * //   productId: 456,
   * //   productName: "iPhone 15 Pro",
   * //   retailerName: "Best Buy",
   * //   productUrl: "https://...",
   * //   price: "999.99"
   * // }
   */
  async getProductOfferDetailsForAlert(productOfferId: number): Promise<ProductOfferForAlert | null> {
    return this.handleError('getProductOfferDetailsForAlert', async () => {
      // Validation
      if (!productOfferId || productOfferId <= 0) {
        throw new Error('Product offer ID must be a positive number');
      }

      const [result] = await db
        .select({
          productId: productOffers.productId,
          productName: products.name,
          retailerName: retailers.name,
          productUrl: productOffers.productUrl,
          price: productOffers.price,
        })
        .from(productOffers)
        .leftJoin(products, eq(productOffers.productId, products.id))
        .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
        .where(eq(productOffers.id, productOfferId))
        .limit(1);

      return result || null;
    });
  }

  /**
   * Get triggered price alerts for a product at a new price
   *
   * Finds all active price alerts that are triggered by a new price point.
   * An alert is triggered when: targetPrice >= newPrice AND isActive = true.
   *
   * Used by price-drop-detection service to identify which users should be notified.
   *
   * **Performance:** Single query with database-side numeric comparison
   *
   * @param productId - Product ID to check alerts for (must be positive)
   * @param newPrice - New price to compare against target prices (must be non-negative)
   * @returns Array of triggered alerts (empty if none triggered)
   *
   * @throws Error if productId or newPrice is invalid
   *
   * @example
   * const triggered = await alertStorage.getTriggeredPriceAlerts(456, 89.99);
   * // Returns: [
   * //   { id: 1, userId: 123, productId: 456, targetPrice: "99.99", ... },
   * //   { id: 2, userId: 124, productId: 456, targetPrice: "94.99", ... }
   * // ]
   */
  async getTriggeredPriceAlerts(productId: number, newPrice: number): Promise<TriggeredPriceAlert[]> {
    return this.handleError('getTriggeredPriceAlerts', async () => {
      // Validation
      if (!productId || productId <= 0) {
        throw new Error('Product ID must be a positive number');
      }
      if (newPrice < ALERT_CONSTANTS.VALIDATION.MIN_PRICE) {
        throw new Error('Price must be non-negative');
      }

      const alerts = await db
        .select({
          id: priceAlerts.id,
          userId: priceAlerts.userId,
          productId: priceAlerts.productId,
          targetPrice: priceAlerts.targetPrice,
          isActive: priceAlerts.isActive,
          createdAt: priceAlerts.createdAt,
        })
        .from(priceAlerts)
        .where(and(
          eq(priceAlerts.productId, productId),
          eq(priceAlerts.isActive, true),
          sql`${priceAlerts.targetPrice}::numeric >= ${newPrice}`
        ));

      // Type assertion: database schema guarantees non-null for required fields
      return alerts as TriggeredPriceAlert[];
    });
  }

  /**
   * Get user IDs with active alerts for a product
   *
   * Retrieves all unique user IDs who have active price alerts for a specific product.
   * Used to determine who should receive notifications when a product price changes.
   *
   * **Performance:** Simple filtered query, returns only user IDs (minimal payload)
   *
   * @param productId - Product ID to check (must be positive)
   * @returns Array of user IDs (empty if no active alerts exist)
   *
   * @throws Error if productId is invalid
   *
   * @example
   * const userIds = await alertStorage.getUsersWithActiveAlertsForProduct(456);
   * // Returns: [123, 124, 125]
   */
  async getUsersWithActiveAlertsForProduct(productId: number): Promise<number[]> {
    return this.handleError('getUsersWithActiveAlertsForProduct', async () => {
      // Validation
      if (!productId || productId <= 0) {
        throw new Error('Product ID must be a positive number');
      }

      const result = await db
        .select({ userId: priceAlerts.userId })
        .from(priceAlerts)
        .where(and(
          eq(priceAlerts.productId, productId),
          eq(priceAlerts.isActive, true)
        ));

      return result.map(row => row.userId);
    });
  }
}

/**
 * Alert Storage Instance
 *
 * Singleton instance for alert storage operations.
 * Import this in services and routes.
 */
export const alertStorage = new AlertStorage();
