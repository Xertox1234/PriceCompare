/**
 * Retailer Storage Domain
 *
 * Handles all retailer-related database operations including:
 * - Core CRUD operations (create, read, update, delete)
 * - Admin retailer management
 * - Affiliate program configuration and statistics
 *
 * Phase 3E: Retailer Domain Extraction - Extracted from monolithic storage.ts
 */

import { db } from '../../db';
import { eq, asc, sql, inArray } from 'drizzle-orm';
import { BaseStorage } from '../base-storage';
import { retailers, productOffers, type Retailer, type InsertRetailer } from '@shared/schema';
import type { RetailerWithAffiliateStats, AffiliateConfig } from '../types';
import { storageCache } from '../../services/storage-cache';
import { safeJsonParse } from '../../utils/json-helpers';

export class RetailerStorage extends BaseStorage {
  constructor(database: typeof db) {
    super(database);
  }

  // ============================================================================
  // Validation Helpers (3 methods)
  // ============================================================================

  /**
   * Validates that retailerId is a positive integer
   */
  private validateRetailerId(retailerId: number): void {
    if (!retailerId || retailerId < 1 || !Number.isInteger(retailerId)) {
      throw new Error(`Invalid retailerId: ${retailerId}. Must be a positive integer.`);
    }
  }

  /**
   * Validates affiliate configuration object
   */
  private validateAffiliateConfig(config: AffiliateConfig): void {
    // Validate commission rate if provided
    if (config.commissionRate !== undefined && config.commissionRate !== null) {
      const rate = parseFloat(config.commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        throw new Error(
          `Invalid commission rate: ${config.commissionRate}. Must be between 0 and 100.`
        );
      }
    }

    // Validate affiliate status if provided
    if (config.affiliateStatus !== undefined && config.affiliateStatus !== null) {
      const validStatuses = ['active', 'inactive', 'pending'];
      if (!validStatuses.includes(config.affiliateStatus)) {
        throw new Error(
          `Invalid affiliate status: ${config.affiliateStatus}. Must be one of: ${validStatuses.join(', ')}`
        );
      }
    }

    // Validate base affiliate URL if provided
    if (
      config.baseAffiliateUrl !== undefined &&
      config.baseAffiliateUrl !== null &&
      config.baseAffiliateUrl.length > 0
    ) {
      try {
        new URL(config.baseAffiliateUrl);
      } catch (error) {
        throw new Error(
          `Invalid base affiliate URL: ${config.baseAffiliateUrl}. Must be a valid URL.`
        );
      }
    }
  }

  /**
   * Validates retailer data for create/update operations
   */
  private validateRetailerData(data: Partial<InsertRetailer>): void {
    // Validate name if provided
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Retailer name cannot be empty');
      }
      if (data.name.length > 255) {
        throw new Error('Retailer name must be 255 characters or less');
      }
    }

    // Validate website URL if provided
    if (data.website !== undefined && data.website !== null && data.website.length > 0) {
      try {
        new URL(data.website);
      } catch (error) {
        throw new Error(`Invalid website URL: ${data.website}. Must be a valid URL.`);
      }
    }
  }

  // ============================================================================
  // Core CRUD Operations (6 methods)
  // ============================================================================

  /**
   * Get all active retailers
   * @returns Array of retailers where isActive = true
   */
  async getRetailers(): Promise<Retailer[]> {
    try {
      const result = await this.db
        .select()
        .from(retailers)
        .where(eq(retailers.isActive, true))
        .orderBy(asc(retailers.name));

      this.logSuccess('getRetailers', { count: result.length });
      return result;
    } catch (error) {
      this.handleError(error, 'getRetailers');
    }
  }

  /**
   * Get all retailers (including inactive)
   * @returns Array of all retailers
   */
  async getAllRetailers(): Promise<Retailer[]> {
    try {
      const result = await this.db.select().from(retailers).orderBy(asc(retailers.name));

      this.logSuccess('getAllRetailers', { count: result.length });
      return result;
    } catch (error) {
      this.handleError(error, 'getAllRetailers');
    }
  }

  /**
   * Get retailer by ID
   * @param id - Retailer ID
   * @returns Retailer or null if not found
   */
  async getRetailerById(id: number): Promise<Retailer | null> {
    this.validateRetailerId(id);

    try {
      const [result] = await this.db.select().from(retailers).where(eq(retailers.id, id)).limit(1);

      this.logSuccess('getRetailerById', { retailerId: id, found: !!result });
      return result || null;
    } catch (error) {
      this.handleError(error, 'getRetailerById');
    }
  }

  /**
   * Get retailers by array of IDs (batch query to prevent N+1)
   * Used for: Price snapshot operations, bulk retailer lookups
   *
   * @param ids - Array of retailer IDs
   * @returns Array of retailers with id and name fields
   */
  async getRetailersByIds(ids: number[]): Promise<Array<{ id: number; name: string }>> {
    try {
      // Validate all IDs
      ids.forEach((id) => this.validateRetailerId(id));

      if (ids.length === 0) {
        return [];
      }

      return await this.db
        .select({ id: retailers.id, name: retailers.name })
        .from(retailers)
        .where(inArray(retailers.id, ids));
    } catch (error) {
      this.handleError(error, 'getRetailersByIds');
    }
  }

  /**
   * Create new retailer
   * @param retailer - Retailer data to insert
   * @returns Created retailer
   */
  async createRetailer(retailer: InsertRetailer): Promise<Retailer> {
    this.validateRetailerData(retailer);

    try {
      const [result] = await this.db
        .insert(retailers)
        .values({
          ...retailer,
          logo: retailer.logo || null,
          website: retailer.website || null,
          isActive: retailer.isActive ?? true,
        })
        .returning();

      this.logSuccess('createRetailer', { retailerId: result.id, name: result.name });
      return result;
    } catch (error) {
      this.handleError(error, 'createRetailer');
    }
  }

  /**
   * Update existing retailer
   * @param id - Retailer ID
   * @param updates - Fields to update
   * @returns Updated retailer or null if not found
   */
  async updateRetailer(id: number, updates: Partial<InsertRetailer>): Promise<Retailer | null> {
    this.validateRetailerId(id);
    this.validateRetailerData(updates);

    try {
      const [result] = await this.db
        .update(retailers)
        .set(updates)
        .where(eq(retailers.id, id))
        .returning();

      // Invalidate retailer caches after successful update
      if (result) {
        await storageCache.invalidateRetailerCache(id);
      }

      this.logSuccess('updateRetailer', { retailerId: id, found: !!result });
      return result || null;
    } catch (error) {
      this.handleError(error, 'updateRetailer');
    }
  }

  /**
   * Delete retailer
   * @param id - Retailer ID
   * @returns Deleted retailer or null if not found
   */
  async deleteRetailer(id: number): Promise<Retailer | null> {
    this.validateRetailerId(id);

    try {
      const [result] = await this.db.delete(retailers).where(eq(retailers.id, id)).returning();

      // Invalidate retailer caches after successful deletion
      if (result) {
        await storageCache.invalidateRetailerCache(id);
      }

      this.logSuccess('deleteRetailer', { retailerId: id, found: !!result });
      return result || null;
    } catch (error) {
      this.handleError(error, 'deleteRetailer');
    }
  }

  // ============================================================================
  // Admin Operations (4 methods)
  // ============================================================================

  /**
   * Get all retailers for admin panel (ordered by name)
   * @returns Array of all retailers
   */
  async getAdminRetailers(): Promise<Retailer[]> {
    try {
      const result = await this.db.select().from(retailers).orderBy(asc(retailers.name));

      this.logSuccess('getAdminRetailers', { count: result.length });
      return result;
    } catch (error) {
      this.handleError(error, 'getAdminRetailers');
    }
  }

  /**
   * Create retailer via admin panel
   * @param data - Retailer data to insert
   * @returns Created retailer
   */
  async createAdminRetailer(data: InsertRetailer): Promise<Retailer> {
    this.validateRetailerData(data);

    try {
      const [newRetailer] = await this.db.insert(retailers).values(data).returning();

      this.logSuccess('createAdminRetailer', {
        retailerId: newRetailer.id,
        name: newRetailer.name,
      });
      return newRetailer;
    } catch (error) {
      this.handleError(error, 'createAdminRetailer');
    }
  }

  /**
   * Update retailer via admin panel
   * @param id - Retailer ID
   * @param data - Fields to update
   * @returns Updated retailer or null if not found
   */
  async updateAdminRetailer(id: number, data: Partial<InsertRetailer>): Promise<Retailer | null> {
    this.validateRetailerId(id);
    this.validateRetailerData(data);

    try {
      const [updatedRetailer] = await this.db
        .update(retailers)
        .set(data)
        .where(eq(retailers.id, id))
        .returning();

      // Invalidate retailer caches after successful update
      if (updatedRetailer) {
        await storageCache.invalidateRetailerCache(id);
      }

      this.logSuccess('updateAdminRetailer', { retailerId: id, found: !!updatedRetailer });
      return updatedRetailer || null;
    } catch (error) {
      this.handleError(error, 'updateAdminRetailer');
    }
  }

  /**
   * Delete retailer via admin panel
   * @param id - Retailer ID
   * @returns Deleted retailer or null if not found
   */
  async deleteAdminRetailer(id: number): Promise<Retailer | null> {
    this.validateRetailerId(id);

    try {
      const [deletedRetailer] = await this.db
        .delete(retailers)
        .where(eq(retailers.id, id))
        .returning();

      // Invalidate retailer caches after successful deletion
      if (deletedRetailer) {
        await storageCache.invalidateRetailerCache(id);
      }

      this.logSuccess('deleteAdminRetailer', { retailerId: id, found: !!deletedRetailer });
      return deletedRetailer || null;
    } catch (error) {
      this.handleError(error, 'deleteAdminRetailer');
    }
  }

  // ============================================================================
  // Affiliate Operations (2 methods)
  // ============================================================================

  /**
   * Get retailers with affiliate stats (single query with GROUP BY)
   * N+1 Prevention: Uses LEFT JOIN + GROUP BY instead of per-retailer queries
   * @returns Array of retailers with affiliate statistics
   */
  async getRetailersWithAffiliateStats(): Promise<RetailerWithAffiliateStats[]> {
    try {
      // Single query with LEFT JOIN and GROUP BY - eliminates N+1 pattern
      const results = await this.db
        .select({
          id: retailers.id,
          name: retailers.name,
          logo: retailers.logo,
          website: retailers.website,
          isActive: retailers.isActive,
          affiliateId: retailers.affiliateId,
          affiliateProgram: retailers.affiliateProgram,
          baseAffiliateUrl: retailers.baseAffiliateUrl,
          commissionRate: retailers.commissionRate,
          affiliateStatus: retailers.affiliateStatus,
          affiliateConfig: retailers.affiliateConfig,
          totalOffers: sql<number>`count(${productOffers.id})::int`,
          offersWithAffiliateLinks: sql<number>`count(case when ${productOffers.affiliateUrl} is not null then 1 end)::int`,
          totalClicks: sql<number>`coalesce(sum(${productOffers.clickCount}), 0)::int`,
        })
        .from(retailers)
        .leftJoin(productOffers, eq(retailers.id, productOffers.retailerId))
        .groupBy(retailers.id)
        .orderBy(asc(retailers.name));

      const retailersWithStats: RetailerWithAffiliateStats[] = results.map((row) => {
        // Parse affiliateConfig safely - return null on parse failure
        let affiliateConfigParsed: Record<string, unknown> | null = null;
        if (row.affiliateConfig) {
          const parseResult = safeJsonParse<Record<string, unknown>>(
            row.affiliateConfig,
            'RetailerStorage.getRetailersWithAffiliateStats'
          );
          if (parseResult.success) {
            affiliateConfigParsed = parseResult.data;
          }
          // On failure, affiliateConfigParsed remains null (graceful degradation)
        }

        return {
          id: row.id,
          name: row.name,
          logo: row.logo,
          website: row.website,
          isActive: row.isActive,
          affiliateId: row.affiliateId,
          affiliateProgram: row.affiliateProgram,
          baseAffiliateUrl: row.baseAffiliateUrl,
          commissionRate: row.commissionRate,
          affiliateStatus: row.affiliateStatus,
          affiliateConfig: row.affiliateConfig,
          affiliateConfigParsed,
          stats: {
            totalOffers: row.totalOffers,
            offersWithAffiliateLinks: row.offersWithAffiliateLinks,
            totalClicks: row.totalClicks,
          },
        };
      });

      this.logSuccess('getRetailersWithAffiliateStats', { count: retailersWithStats.length });
      return retailersWithStats;
    } catch (error) {
      this.handleError(error, 'getRetailersWithAffiliateStats');
    }
  }

  /**
   * Update retailer affiliate configuration
   * @param id - Retailer ID
   * @param config - Affiliate configuration
   * @returns Updated retailer or null if not found
   */
  async updateRetailerAffiliateConfig(
    id: number,
    config: AffiliateConfig
  ): Promise<Retailer | null> {
    this.validateRetailerId(id);
    this.validateAffiliateConfig(config);

    try {
      const [updatedRetailer] = await this.db
        .update(retailers)
        .set({
          affiliateId: config.affiliateId,
          affiliateProgram: config.affiliateProgram,
          baseAffiliateUrl: config.baseAffiliateUrl,
          commissionRate: config.commissionRate,
          affiliateStatus: config.affiliateStatus as 'active' | 'inactive' | 'pending',
          affiliateConfig: config.affiliateConfig ? JSON.stringify(config.affiliateConfig) : null,
        })
        .where(eq(retailers.id, id))
        .returning();

      // Invalidate retailer caches after successful affiliate config update
      if (updatedRetailer) {
        await storageCache.invalidateRetailerCache(id);
      }

      this.logSuccess('updateRetailerAffiliateConfig', {
        retailerId: id,
        found: !!updatedRetailer,
        status: config.affiliateStatus,
      });
      return updatedRetailer || null;
    } catch (error) {
      this.handleError(error, 'updateRetailerAffiliateConfig');
    }
  }
}
