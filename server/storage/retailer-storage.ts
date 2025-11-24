/**
 * Retailer Storage Repository
 *
 * Handles all retailer-related database operations including:
 * - Retailer CRUD operations
 * - Active/inactive retailer filtering
 * - Affiliate program management
 * - Retailer affiliate statistics
 */

import { eq, asc, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { retailers, productOffers } from '@shared/schema';
import type {
  Retailer,
  InsertRetailer,
} from '@shared/schema';
import type {
  AffiliateConfig,
  RetailerWithAffiliateStats
} from './types';
import { BaseStorage } from './base-storage';
import { logger } from '../utils/logger';

/**
 * Constants for retailer storage operations
 */
const RETAILER_CONSTANTS = {
  VALIDATION: {
    MIN_ID: 1,
    MIN_NAME_LENGTH: 1,
    MAX_NAME_LENGTH: 255,
  },
  DEFAULTS: {
    IS_ACTIVE: true,
  },
} as const;

/**
 * Interface defining all retailer storage operations
 */
export interface IRetailerStorage {
  // Basic CRUD
  getAllRetailers(): Promise<Retailer[]>;
  getRetailers(): Promise<Retailer[]>;
  getRetailerById(id: number): Promise<Retailer | null>;
  createRetailer(retailer: InsertRetailer): Promise<Retailer>;
  updateRetailer(id: number, updates: Partial<InsertRetailer>): Promise<Retailer | null>;
  deleteRetailer(id: number): Promise<Retailer | null>;

  // Admin operations
  getAdminRetailers(): Promise<Retailer[]>;
  createAdminRetailer(data: InsertRetailer): Promise<Retailer>;
  updateAdminRetailer(id: number, data: Partial<InsertRetailer>): Promise<Retailer | null>;
  deleteAdminRetailer(id: number): Promise<Retailer | null>;

  // Affiliate management
  getRetailersWithAffiliateStats(): Promise<RetailerWithAffiliateStats[]>;
  updateRetailerAffiliateConfig(id: number, config: AffiliateConfig): Promise<Retailer | null>;
}

/**
 * RetailerStorage - Handles all retailer-related database operations
 *
 * Responsibilities:
 * - Retailer CRUD operations with validation
 * - Active retailer filtering
 * - Affiliate program configuration
 * - Affiliate statistics aggregation
 *
 * Quality: Follows Phase 2-4 patterns for 9+ quality standard
 */
export class RetailerStorage extends BaseStorage implements IRetailerStorage {
  constructor(db: NodePgDatabase) {
    super(db);
  }

  /**
   * Get all retailers (including inactive)
   *
   * @returns All retailers in the database
   */
  async getAllRetailers(): Promise<Retailer[]> {
    return this.handleError('getAllRetailers', async () => {
      return await this.db
        .select()
        .from(retailers);
    });
  }

  /**
   * Get only active retailers
   *
   * Used by public-facing pages to display available retailers
   *
   * @returns Array of active retailers
   */
  async getRetailers(): Promise<Retailer[]> {
    return this.handleError('getRetailers', async () => {
      return await this.db
        .select()
        .from(retailers)
        .where(eq(retailers.isActive, true));
    });
  }

  /**
   * Get retailer by ID
   *
   * @param id - Retailer ID (must be positive)
   * @returns Retailer or null if not found
   */
  async getRetailerById(id: number): Promise<Retailer | null> {
    return this.handleError('getRetailerById', async () => {
      // Validation
      if (!id || id < RETAILER_CONSTANTS.VALIDATION.MIN_ID) {
        throw new Error('Retailer ID must be a positive number');
      }

      const [retailer] = await this.db
        .select()
        .from(retailers)
        .where(eq(retailers.id, id))
        .limit(1);

      return retailer || null;
    });
  }

  /**
   * Create a new retailer
   *
   * @param retailer - Retailer data to insert
   * @returns Created retailer with generated ID
   *
   * @example
   * const newRetailer = await retailerStorage.createRetailer({
   *   name: 'Amazon',
   *   website: 'https://amazon.com',
   *   logo: 'https://amazon.com/logo.png',
   *   isActive: true
   * });
   */
  async createRetailer(retailer: InsertRetailer): Promise<Retailer> {
    return this.handleError('createRetailer', async () => {
      // Validation
      if (!retailer.name || retailer.name.trim().length < RETAILER_CONSTANTS.VALIDATION.MIN_NAME_LENGTH) {
        throw new Error(`Retailer name must be at least ${RETAILER_CONSTANTS.VALIDATION.MIN_NAME_LENGTH} characters`);
      }

      if (retailer.name.length > RETAILER_CONSTANTS.VALIDATION.MAX_NAME_LENGTH) {
        throw new Error(`Retailer name cannot exceed ${RETAILER_CONSTANTS.VALIDATION.MAX_NAME_LENGTH} characters`);
      }

      const [created] = await this.db
        .insert(retailers)
        .values({
          ...retailer,
          logo: retailer.logo || null,
          website: retailer.website || null,
          isActive: retailer.isActive ?? RETAILER_CONSTANTS.DEFAULTS.IS_ACTIVE,
        })
        .returning();

      return created;
    });
  }

  /**
   * Update retailer information
   *
   * @param id - Retailer ID to update
   * @param updates - Fields to update
   * @returns Updated retailer or null if not found
   */
  async updateRetailer(id: number, updates: Partial<InsertRetailer>): Promise<Retailer | null> {
    return this.handleError('updateRetailer', async () => {
      // Validation
      if (!id || id < RETAILER_CONSTANTS.VALIDATION.MIN_ID) {
        throw new Error('Retailer ID must be a positive number');
      }

      if (!updates || Object.keys(updates).length === 0) {
        this.logDebug('updateRetailer', { id, reason: 'No updates provided' });
        return null;
      }

      // Validate name if being updated
      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length < RETAILER_CONSTANTS.VALIDATION.MIN_NAME_LENGTH) {
          throw new Error(`Retailer name must be at least ${RETAILER_CONSTANTS.VALIDATION.MIN_NAME_LENGTH} characters`);
        }
        if (updates.name.length > RETAILER_CONSTANTS.VALIDATION.MAX_NAME_LENGTH) {
          throw new Error(`Retailer name cannot exceed ${RETAILER_CONSTANTS.VALIDATION.MAX_NAME_LENGTH} characters`);
        }
      }

      // Check existence before update
      const existing = await this.getRetailerById(id);
      if (!existing) {
        this.logDebug('updateRetailer', { id, reason: 'Retailer not found' });
        return null;
      }

      const [updated] = await this.db
        .update(retailers)
        .set(updates)
        .where(eq(retailers.id, id))
        .returning();

      return updated || null;
    });
  }

  /**
   * Delete a retailer
   *
   * WARNING: This will cascade delete all associated product offers
   * due to foreign key constraints. Use with caution.
   *
   * @param id - Retailer ID to delete
   * @returns Deleted retailer or null if not found
   */
  async deleteRetailer(id: number): Promise<Retailer | null> {
    return this.handleError('deleteRetailer', async () => {
      // Validation
      if (!id || id < RETAILER_CONSTANTS.VALIDATION.MIN_ID) {
        throw new Error('Retailer ID must be a positive number');
      }

      // Check existence before delete
      const existing = await this.getRetailerById(id);
      if (!existing) {
        this.logDebug('deleteRetailer', { id, reason: 'Retailer not found' });
        return null;
      }

      const [deleted] = await this.db
        .delete(retailers)
        .where(eq(retailers.id, id))
        .returning();

      return deleted || null;
    });
  }

  /**
   * Get all retailers for admin panel (sorted by name)
   *
   * @returns All retailers ordered alphabetically
   */
  async getAdminRetailers(): Promise<Retailer[]> {
    return this.handleError('getAdminRetailers', async () => {
      return await this.db
        .select()
        .from(retailers)
        .orderBy(asc(retailers.name));
    });
  }

  /**
   * Create retailer from admin panel
   *
   * @param data - Retailer data to insert
   * @returns Created retailer
   */
  async createAdminRetailer(data: InsertRetailer): Promise<Retailer> {
    return this.handleError('createAdminRetailer', async () => {
      // Validation
      if (!data.name || data.name.trim().length < RETAILER_CONSTANTS.VALIDATION.MIN_NAME_LENGTH) {
        throw new Error(`Retailer name must be at least ${RETAILER_CONSTANTS.VALIDATION.MIN_NAME_LENGTH} characters`);
      }

      if (data.name.length > RETAILER_CONSTANTS.VALIDATION.MAX_NAME_LENGTH) {
        throw new Error(`Retailer name cannot exceed ${RETAILER_CONSTANTS.VALIDATION.MAX_NAME_LENGTH} characters`);
      }

      const [created] = await this.db
        .insert(retailers)
        .values(data)
        .returning();

      return created;
    });
  }

  /**
   * Update retailer from admin panel
   *
   * @param id - Retailer ID
   * @param data - Fields to update
   * @returns Updated retailer or null if not found
   */
  async updateAdminRetailer(id: number, data: Partial<InsertRetailer>): Promise<Retailer | null> {
    return this.handleError('updateAdminRetailer', async () => {
      // Validation
      if (!id || id < RETAILER_CONSTANTS.VALIDATION.MIN_ID) {
        throw new Error('Retailer ID must be a positive number');
      }

      if (!data || Object.keys(data).length === 0) {
        this.logDebug('updateAdminRetailer', { id, reason: 'No updates provided' });
        return null;
      }

      // Validate name if being updated
      if (data.name !== undefined) {
        if (!data.name || data.name.trim().length < RETAILER_CONSTANTS.VALIDATION.MIN_NAME_LENGTH) {
          throw new Error(`Retailer name must be at least ${RETAILER_CONSTANTS.VALIDATION.MIN_NAME_LENGTH} characters`);
        }
        if (data.name.length > RETAILER_CONSTANTS.VALIDATION.MAX_NAME_LENGTH) {
          throw new Error(`Retailer name cannot exceed ${RETAILER_CONSTANTS.VALIDATION.MAX_NAME_LENGTH} characters`);
        }
      }

      // Check existence before update
      const existing = await this.getRetailerById(id);
      if (!existing) {
        this.logDebug('updateAdminRetailer', { id, reason: 'Retailer not found' });
        return null;
      }

      const [updated] = await this.db
        .update(retailers)
        .set(data)
        .where(eq(retailers.id, id))
        .returning();

      return updated || null;
    });
  }

  /**
   * Delete retailer from admin panel
   *
   * WARNING: This will cascade delete all associated product offers.
   *
   * @param id - Retailer ID to delete
   * @returns Deleted retailer or null if not found
   */
  async deleteAdminRetailer(id: number): Promise<Retailer | null> {
    return this.handleError('deleteAdminRetailer', async () => {
      // Validation
      if (!id || id < RETAILER_CONSTANTS.VALIDATION.MIN_ID) {
        throw new Error('Retailer ID must be a positive number');
      }

      // Check existence before delete
      const existing = await this.getRetailerById(id);
      if (!existing) {
        this.logDebug('deleteAdminRetailer', { id, reason: 'Retailer not found' });
        return null;
      }

      const [deleted] = await this.db
        .delete(retailers)
        .where(eq(retailers.id, id))
        .returning();

      return deleted || null;
    });
  }

  /**
   * Get all retailers with their affiliate statistics
   *
   * Performance: Uses Promise.allSettled for graceful error handling per retailer.
   * If stats fail for a retailer, returns retailer with empty stats rather than failing entire operation.
   *
   * Statistics include:
   * - Total number of offers
   * - Number of offers with affiliate links
   * - Total click count across all affiliate links
   *
   * @returns Retailers with parsed affiliate config and statistics
   */
  async getRetailersWithAffiliateStats(): Promise<RetailerWithAffiliateStats[]> {
    return this.handleError('getRetailersWithAffiliateStats', async () => {
      const allRetailers = await this.db
        .select()
        .from(retailers);

      // Use Promise.allSettled for graceful error handling per retailer
      const results = await Promise.allSettled(
        allRetailers.map(async (retailer) => {
          // Get affiliate stats for each retailer
          const statsResult = await this.db
            .select({
              totalOffers: sql<number>`count(*)::int`,
              offersWithAffiliateLinks: sql<number>`count(case when ${productOffers.affiliateUrl} is not null then 1 end)::int`,
              totalClicks: sql<number>`coalesce(sum(${productOffers.clickCount}), 0)::int`,
            })
            .from(productOffers)
            .where(eq(productOffers.retailerId, retailer.id));

          const stats = statsResult[0] || {
            totalOffers: 0,
            offersWithAffiliateLinks: 0,
            totalClicks: 0
          };

          return {
            ...retailer,
            affiliateConfigParsed: retailer.affiliateConfig
              ? JSON.parse(retailer.affiliateConfig)
              : null,
            stats,
          };
        })
      );

      // Handle failures gracefully - return retailer with empty stats on error
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }

        // Log error but don't fail entire operation
        logger.error('Failed to fetch affiliate stats for retailer', {
          retailerId: allRetailers[index].id,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });

        return {
          ...allRetailers[index],
          affiliateConfigParsed: allRetailers[index].affiliateConfig
            ? JSON.parse(allRetailers[index].affiliateConfig)
            : null,
          stats: {
            totalOffers: 0,
            offersWithAffiliateLinks: 0,
            totalClicks: 0
          },
        };
      });
    });
  }

  /**
   * Update retailer's affiliate program configuration
   *
   * @param id - Retailer ID
   * @param config - Affiliate configuration including program details, rates, and status
   * @returns Updated retailer or null if not found
   *
   * @example
   * const updated = await retailerStorage.updateRetailerAffiliateConfig(1, {
   *   affiliateId: 'amazon-123',
   *   affiliateProgram: 'Amazon Associates',
   *   baseAffiliateUrl: 'https://amazon.com/associate',
   *   commissionRate: 5.0,
   *   affiliateStatus: 'active',
   *   affiliateConfig: { trackingParam: 'tag', customParam: 'ref' }
   * });
   */
  async updateRetailerAffiliateConfig(id: number, config: AffiliateConfig): Promise<Retailer | null> {
    return this.handleError('updateRetailerAffiliateConfig', async () => {
      // Validation
      if (!id || id < RETAILER_CONSTANTS.VALIDATION.MIN_ID) {
        throw new Error('Retailer ID must be a positive number');
      }

      if (!config) {
        throw new Error('Affiliate config is required');
      }

      // Check existence before update
      const existing = await this.getRetailerById(id);
      if (!existing) {
        this.logDebug('updateRetailerAffiliateConfig', { id, reason: 'Retailer not found' });
        return null;
      }

      const [updated] = await this.db
        .update(retailers)
        .set({
          affiliateId: config.affiliateId,
          affiliateProgram: config.affiliateProgram,
          baseAffiliateUrl: config.baseAffiliateUrl,
          commissionRate: config.commissionRate,
          affiliateStatus: config.affiliateStatus as 'active' | 'inactive' | 'pending',
          affiliateConfig: config.affiliateConfig
            ? JSON.stringify(config.affiliateConfig)
            : null,
        })
        .where(eq(retailers.id, id))
        .returning();

      return updated || null;
    });
  }
}
