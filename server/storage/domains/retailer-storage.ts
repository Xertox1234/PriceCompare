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

import { db } from "../../db";
import { eq, asc, sql } from "drizzle-orm";
import { BaseStorage } from "../base-storage";
import {
  retailers,
  productOffers,
  type Retailer,
  type InsertRetailer
} from "@shared/schema";
import type {
  RetailerWithAffiliateStats,
  AffiliateConfig,
} from "../types";
import { logger } from "../../utils/logger";

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
        throw new Error(`Invalid commission rate: ${config.commissionRate}. Must be between 0 and 100.`);
      }
    }

    // Validate affiliate status if provided
    if (config.affiliateStatus !== undefined && config.affiliateStatus !== null) {
      const validStatuses = ['active', 'inactive', 'pending'];
      if (!validStatuses.includes(config.affiliateStatus)) {
        throw new Error(`Invalid affiliate status: ${config.affiliateStatus}. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Validate base affiliate URL if provided
    if (config.baseAffiliateUrl !== undefined && config.baseAffiliateUrl !== null && config.baseAffiliateUrl.length > 0) {
      try {
        new URL(config.baseAffiliateUrl);
      } catch (error) {
        throw new Error(`Invalid base affiliate URL: ${config.baseAffiliateUrl}. Must be a valid URL.`);
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
      const result = await this.db
        .select()
        .from(retailers)
        .orderBy(asc(retailers.name));

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
      const [result] = await this.db
        .select()
        .from(retailers)
        .where(eq(retailers.id, id))
        .limit(1);

      this.logSuccess('getRetailerById', { retailerId: id, found: !!result });
      return result || null;
    } catch (error) {
      this.handleError(error, 'getRetailerById');
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
          isActive: retailer.isActive ?? true
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
      const [result] = await this.db
        .delete(retailers)
        .where(eq(retailers.id, id))
        .returning();

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
      const result = await this.db
        .select()
        .from(retailers)
        .orderBy(asc(retailers.name));

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
      const [newRetailer] = await this.db
        .insert(retailers)
        .values(data)
        .returning();

      this.logSuccess('createAdminRetailer', { retailerId: newRetailer.id, name: newRetailer.name });
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
   * Get retailers with affiliate stats (database aggregation + fault isolation)
   * Uses Promise.allSettled for graceful error handling per retailer
   * @returns Array of retailers with affiliate statistics
   */
  async getRetailersWithAffiliateStats(): Promise<RetailerWithAffiliateStats[]> {
    try {
      // Fetch all retailers
      const allRetailers = await this.db
        .select()
        .from(retailers)
        .orderBy(asc(retailers.name));

      // Use Promise.allSettled for graceful error handling per retailer
      const results = await Promise.allSettled(
        allRetailers.map(async (retailer) => {
          // Get affiliate stats using database-level aggregation
          const statsResult = await this.db
            .select({
              totalOffers: sql<number>`count(*)::int`,
              offersWithAffiliateLinks: sql<number>`count(case when ${productOffers.affiliateUrl} is not null then 1 end)::int`,
              totalClicks: sql<number>`coalesce(sum(${productOffers.clickCount}), 0)::int`
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
            stats
          };
        })
      );

      // Handle failures gracefully - return retailer with empty stats on error
      const retailersWithStats = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }

        // Log error but don't fail entire operation
        logger.error('[RetailerStorage] Failed to fetch affiliate stats for retailer', {
          retailerId: allRetailers[index].id,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });

        return {
          ...allRetailers[index],
          affiliateConfigParsed: allRetailers[index].affiliateConfig
            ? JSON.parse(allRetailers[index].affiliateConfig)
            : null,
          stats: { totalOffers: 0, offersWithAffiliateLinks: 0, totalClicks: 0 }
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
  async updateRetailerAffiliateConfig(id: number, config: AffiliateConfig): Promise<Retailer | null> {
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
          affiliateConfig: config.affiliateConfig ? JSON.stringify(config.affiliateConfig) : null
        })
        .where(eq(retailers.id, id))
        .returning();

      this.logSuccess('updateRetailerAffiliateConfig', {
        retailerId: id,
        found: !!updatedRetailer,
        status: config.affiliateStatus
      });
      return updatedRetailer || null;
    } catch (error) {
      this.handleError(error, 'updateRetailerAffiliateConfig');
    }
  }
}
