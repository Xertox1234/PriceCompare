/**
 * Agent Storage Domain
 *
 * Handles all agent-related database operations for AI agent coordination and scraping jobs.
 * Provides operations for agent sessions, scraping jobs, and trending products.
 *
 * Issue #178: Agent Storage Layer Migration - Migrate agent modules to storage layer pattern
 */

import { eq, and, gte, lte, lt, sql, desc, count, ilike } from 'drizzle-orm';
import {
  agentSessions,
  scrapingJobs,
  trendingProducts,
  products,
  productOffers,
  priceAlerts,
  searchQueries,
} from '@shared/schema';
import { BaseStorage } from '../base-storage';
import type {
  AgentSession,
  InsertAgentSession,
  ScrapingJob,
  InsertScrapingJob,
  TrendingProduct,
  InsertTrendingProduct,
  InsertSearchQuery,
  Product,
  ProductOffer,
  Retailer,
  PriceAlert,
  InsertProductOffer,
} from '@shared/schema';
import type { db } from '../../db';

// Type alias for database connection (matches BaseStorage pattern)
type Database = typeof db;

// Type definitions for query results with relations
type ProductOfferWithRelations = ProductOffer & {
  product: Product | null;
  retailer: Retailer | null;
};

type OfferWithRetailer = ProductOffer & {
  retailer: Retailer | null;
};

type ProductWithOffers = Product & {
  offers: OfferWithRetailer[];
};

type PriceAlertWithProduct = PriceAlert & {
  product: ProductWithOffers | null;
};

/**
 * AgentStorage Class
 *
 * Domain repository for AI agent operations. Extends BaseStorage
 * to provide consistent error handling, logging, and validation patterns.
 *
 * IMPLEMENTATION GUIDANCE:
 * - **Agent Sessions**: Track agent lifecycle (initialization, tasks, completion)
 * - **Scraping Jobs**: Manage distributed job queues for web scraping
 * - **Trending Products**: Coordinate product discovery and tracking
 * - **Atomicity**: Job operations use database-level concurrency controls
 */
export class AgentStorage extends BaseStorage {
  constructor(database: Database) {
    super(database);
  }

  // ============================================================================
  // Agent Session Operations
  // ============================================================================

  /**
   * Create a new agent session
   * @param sessionData - Agent session data
   * @returns The created agent session with database ID
   */
  async createAgentSession(sessionData: InsertAgentSession): Promise<AgentSession> {
    try {
      const [session] = await this.db.insert(agentSessions).values(sessionData).returning();

      this.logSuccess('createAgentSession', {
        agentType: sessionData.agentType,
        sessionId: sessionData.sessionId,
      });

      return session;
    } catch (error) {
      this.handleError(error, 'createAgentSession');
    }
  }

  /**
   * Update an existing agent session
   * @param sessionId - Database ID of the session
   * @param updates - Partial session data to update
   */
  async updateAgentSession(sessionId: number, updates: Partial<AgentSession>): Promise<void> {
    try {
      await this.db.update(agentSessions).set(updates).where(eq(agentSessions.id, sessionId));

      this.logSuccess('updateAgentSession', { sessionId, updates });
    } catch (error) {
      this.handleError(error, 'updateAgentSession');
    }
  }

  /**
   * Get agent sessions within a time period
   * @param hoursAgo - How many hours back to look
   * @returns Array of agent sessions
   */
  async getRecentAgentSessions(hoursAgo: number): Promise<AgentSession[]> {
    try {
      const timeThreshold = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

      const sessions = await this.db
        .select()
        .from(agentSessions)
        .where(gte(agentSessions.sessionStart, timeThreshold))
        .orderBy(desc(agentSessions.sessionStart));

      this.logSuccess('getRecentAgentSessions', { hoursAgo, count: sessions.length });
      return sessions;
    } catch (error) {
      this.handleError(error, 'getRecentAgentSessions');
    }
  }

  /**
   * Get count of active agent sessions
   * @param hoursAgo - How many hours back to consider "active"
   * @returns Number of active sessions
   */
  async getActiveAgentSessionCount(hoursAgo: number): Promise<number> {
    try {
      const timeThreshold = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(agentSessions)
        .where(
          and(eq(agentSessions.status, 'active'), gte(agentSessions.sessionStart, timeThreshold))
        );

      // Type assertion: Drizzle count() returns unknown, safely convert to integer
      const count = Number(result[0]?.count ?? 0);

      this.logSuccess('getActiveAgentSessionCount', { hoursAgo, count });
      return count;
    } catch (error) {
      this.handleError(error, 'getActiveAgentSessionCount');
    }
  }

  // ============================================================================
  // Scraping Job Operations
  // ============================================================================

  /**
   * Create a new scraping job
   * @param jobData - Scraping job data
   * @returns The created scraping job with database ID
   */
  async createScrapingJob(jobData: InsertScrapingJob): Promise<ScrapingJob> {
    try {
      const [job] = await this.db.insert(scrapingJobs).values(jobData).returning();

      this.logSuccess('createScrapingJob', {
        jobId: job.id,
        jobType: jobData.jobType,
      });

      return job;
    } catch (error) {
      this.handleError(error, 'createScrapingJob');
    }
  }

  /**
   * Update an existing scraping job
   * @param jobId - Database ID of the job
   * @param updates - Partial job data to update
   */
  async updateScrapingJob(jobId: number, updates: Partial<ScrapingJob>): Promise<void> {
    try {
      await this.db.update(scrapingJobs).set(updates).where(eq(scrapingJobs.id, jobId));

      this.logSuccess('updateScrapingJob', { jobId, updates });
    } catch (error) {
      this.handleError(error, 'updateScrapingJob');
    }
  }

  /**
   * Get pending scraping jobs
   * @param limit - Maximum number of jobs to return
   * @returns Array of pending jobs ordered by priority and scheduled time
   */
  async getPendingScrapingJobs(limit: number): Promise<ScrapingJob[]> {
    // Input validation
    if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
      throw new Error(`Invalid limit: ${limit}. Must be a positive integer between 1 and 1000.`);
    }

    try {
      const jobs = await this.db
        .select()
        .from(scrapingJobs)
        .where(and(eq(scrapingJobs.status, 'pending'), lte(scrapingJobs.scheduledAt, new Date())))
        .orderBy(desc(scrapingJobs.priority), scrapingJobs.scheduledAt)
        .limit(limit);

      this.logSuccess('getPendingScrapingJobs', { limit, count: jobs.length });
      return jobs;
    } catch (error) {
      this.handleError(error, 'getPendingScrapingJobs');
    }
  }

  /**
   * Get count of scraping jobs by status
   * @returns Record mapping status to count
   */
  async getScrapingJobStats(): Promise<Record<string, number>> {
    try {
      const results = await this.db
        .select({
          status: scrapingJobs.status,
          count: sql<number>`count(*)`,
        })
        .from(scrapingJobs)
        .groupBy(scrapingJobs.status);

      const stats: Record<string, number> = {};
      for (const row of results) {
        if (row.status) {
          // Type assertion: Drizzle count() returns unknown, convert to safe integer
          stats[row.status] = Number(row.count);
        }
      }

      this.logSuccess('getScrapingJobStats', { stats });
      return stats;
    } catch (error) {
      this.handleError(error, 'getScrapingJobStats');
    }
  }

  /**
   * Get recent scraping jobs with details
   * @param limit - Maximum number of jobs to return
   * @returns Array of recent jobs ordered by creation time
   */
  async getRecentScrapingJobs(limit: number): Promise<ScrapingJob[]> {
    try {
      const jobs = await this.db
        .select()
        .from(scrapingJobs)
        .orderBy(desc(scrapingJobs.createdAt))
        .limit(limit);

      this.logSuccess('getRecentScrapingJobs', { limit, count: jobs.length });
      return jobs;
    } catch (error) {
      this.handleError(error, 'getRecentScrapingJobs');
    }
  }

  // ============================================================================
  // Trending Product Operations (used by coordinator agent)
  // ============================================================================

  /**
   * Get trending products by status
   * @param status - Status to filter by
   * @param limit - Maximum number of products to return
   * @returns Array of trending products
   */
  async getTrendingProductsByStatus(status: string, limit: number): Promise<TrendingProduct[]> {
    // Input validation
    if (!status || status.trim().length === 0) {
      throw new Error('Status is required and cannot be empty');
    }
    if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
      throw new Error(`Invalid limit: ${limit}. Must be a positive integer between 1 and 1000.`);
    }

    try {
      // Select all fields to match TrendingProduct schema type
      const results = await this.db
        .select()
        .from(trendingProducts)
        .where(eq(trendingProducts.status, status))
        .limit(limit);

      this.logSuccess('getTrendingProductsByStatus', { status, limit, count: results.length });
      return results;
    } catch (error) {
      this.handleError(error, 'getTrendingProductsByStatus');
    }
  }

  /**
   * Bulk insert trending products
   * @param products - Array of trending products to insert
   * @returns Array of created trending products
   */
  async bulkCreateTrendingProducts(
    products: InsertTrendingProduct[]
  ): Promise<TrendingProduct[]> {
    // Input validation
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Products array is required and cannot be empty');
    }
    if (products.length > 100) {
      throw new Error(`Batch size too large: ${products.length}. Maximum is 100.`);
    }

    try {
      const results = await this.db.insert(trendingProducts).values(products).returning();

      this.logSuccess('bulkCreateTrendingProducts', { count: results.length });
      return results;
    } catch (error) {
      this.handleError(error, 'bulkCreateTrendingProducts');
    }
  }

  // ============================================================================
  // Search Query Operations (used by search agent)
  // ============================================================================

  /**
   * Create a search query record for analytics
   * @param queryData - Search query data to store
   */
  async createSearchQuery(queryData: Partial<InsertSearchQuery>): Promise<void> {
    try {
      await this.db.insert(searchQueries).values({
        queryText: queryData.queryText || '',
        retailer: queryData.retailer,
        queryType: queryData.queryType || 'product_search',
        avgResults: queryData.avgResults || 0,
        trendingProductId: queryData.trendingProductId,
        lastUsed: new Date(),
      });

      this.logSuccess('createSearchQuery', { query: queryData.queryText });
    } catch (error) {
      this.handleError(error, 'createSearchQuery');
    }
  }

  /**
   * Get historical search queries for optimization
   * Returns queries that performed well for similar product names
   * @param productName - Product name to search for
   * @param limit - Maximum number of queries to return (1-100)
   */
  async getHistoricalSearchQueries(productName: string, limit: number): Promise<string[]> {
    // Input validation
    if (!productName || productName.trim().length === 0) {
      throw new Error('Product name is required');
    }
    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
      throw new Error(`Invalid limit: ${limit}. Must be between 1 and 100.`);
    }

    try {
      const results = await this.db
        .select({ queryText: searchQueries.queryText })
        .from(searchQueries)
        .where(ilike(searchQueries.queryText, `%${productName}%`))
        .orderBy(desc(searchQueries.avgResults), desc(searchQueries.lastUsed))
        .limit(limit);

      const queries = results.map((r) => r.queryText);

      this.logSuccess('getHistoricalSearchQueries', {
        productName,
        limit,
        found: queries.length,
      });
      return queries;
    } catch (error) {
      this.handleError(error, 'getHistoricalSearchQueries');
    }
  }

  /**
   * Update trending product status
   * @param productId - ID of the trending product
   * @param updates - Partial trending product data to update
   */
  async updateTrendingProduct(
    productId: number,
    updates: Partial<InsertTrendingProduct>
  ): Promise<void> {
    try {
      await this.db.update(trendingProducts).set(updates).where(eq(trendingProducts.id, productId));

      this.logSuccess('updateTrendingProduct', { productId, updates });
    } catch (error) {
      this.handleError(error, 'updateTrendingProduct');
    }
  }

  /**
   * Get scraping job counts by status
   * @returns Array of {status, count} objects
   */
  async getScrapingJobStatusCounts(): Promise<Array<{ status: string; count: number }>> {
    try {
      const statusCounts = await this.db
        .select({
          status: scrapingJobs.status,
          count: count(),
        })
        .from(scrapingJobs)
        .groupBy(scrapingJobs.status);

      // Map to consistent return type
      // Type assertion: GROUP BY status can be null per Drizzle typing, cast to string
      const result = statusCounts.map((row) => ({
        status: row.status as string,
        count: Number(row.count),
      }));

      this.logSuccess('getScrapingJobStatusCounts', { result });
      return result;
    } catch (error) {
      this.handleError(error, 'getScrapingJobStatusCounts');
    }
  }

  /**
   * Get trending product counts by status
   * @returns Array of {status, count} objects
   */
  async getTrendingProductsStatusCounts(): Promise<Array<{ status: string; count: number }>> {
    try {
      const statusCounts = await this.db
        .select({
          status: trendingProducts.status,
          count: count(),
        })
        .from(trendingProducts)
        .groupBy(trendingProducts.status);

      // Map to consistent return type
      // Type assertion: GROUP BY status can be null per Drizzle typing, cast to string
      const result = statusCounts.map((row) => ({
        status: row.status as string,
        count: Number(row.count),
      }));

      this.logSuccess('getTrendingProductsStatusCounts', { result });
      return result;
    } catch (error) {
      this.handleError(error, 'getTrendingProductsStatusCounts');
    }
  }

  // ============================================================================
  // Advanced Agent Operations (Added for Agent Migration)
  // ============================================================================

  /**
   * Create product from trending product with atomic transaction
   * Prevents race conditions and ensures data consistency
   *
   * @param trendingProduct - Trending product to convert to full product
   * @param offerData - Product offer data to create alongside product
   * @returns Created product with database ID
   */
  async createProductFromTrendingProduct(
    trendingProduct: TrendingProduct,
    offerData: InsertProductOffer[]
  ): Promise<Product> {
    try {
      return await this.db.transaction(async (tx) => {
        // Step 1: Create the product
        const [product] = await tx
          .insert(products)
          .values({
            name: trendingProduct.name,
            category: trendingProduct.category,
            image: null,
            brand: null,
            description: null,
            model: null,
            embedding: null,
            embeddingUpdatedAt: null,
          })
          .returning();

        // Step 2: Create product offers with the new product ID
        if (offerData.length > 0) {
          await tx.insert(productOffers).values(
            offerData.map((offer) => ({
              ...offer,
              productId: product.id,
            }))
          );
        }

        // Step 3: Update trending product status to 'processed'
        await tx
          .update(trendingProducts)
          .set({ status: 'processed', productId: product.id })
          .where(eq(trendingProducts.id, trendingProduct.id));

        this.logSuccess('createProductFromTrendingProduct', {
          productId: product.id,
          trendingProductId: trendingProduct.id,
          offersCreated: offerData.length,
        });

        return product;
      });
    } catch (error) {
      this.handleError(error, 'createProductFromTrendingProduct');
    }
  }

  /**
   * Get stale product offers with relations using efficient JOIN
   * Used by MonitoringAgent to find offers that need price checking
   *
   * WARNING: Must use db.query API to preserve JOIN efficiency
   *
   * @param cutoffTime - Offers with lastLinkCheck before this time are considered stale
   * @param limit - Maximum number of offers to return
   * @returns Array of product offers with product and retailer relations
   */
  async getPriceMonitoringOffers(
    cutoffTime: Date,
    limit: number
  ): Promise<ProductOfferWithRelations[]> {
    try {
      const offers = await this.db.query.productOffers.findMany({
        where: lt(productOffers.lastLinkCheck, cutoffTime),
        with: {
          product: true,
          retailer: true,
        },
        limit,
      });

      this.logSuccess('getPriceMonitoringOffers', {
        cutoffTime: cutoffTime.toISOString(),
        limit,
        count: offers.length,
      });

      return offers;
    } catch (error) {
      this.handleError(error, 'getPriceMonitoringOffers');
    }
  }

  /**
   * Get active price alerts with deeply nested relations
   * Used by MonitoringAgent to check which alerts need to be triggered
   *
   * Returns alerts with:
   * - Alert details
   * - Product details
   * - Product's offers with retailer information
   *
   * @returns Array of price alerts with nested product and offer relations
   */
  async getActivePriceAlertsWithRelations(): Promise<PriceAlertWithProduct[]> {
    try {
      const alerts = await this.db.query.priceAlerts.findMany({
        where: eq(priceAlerts.isActive, true),
        with: {
          product: {
            with: {
              offers: {
                with: {
                  retailer: true,
                },
              },
            },
          },
        },
      });

      this.logSuccess('getActivePriceAlertsWithRelations', { count: alerts.length });

      return alerts;
    } catch (error) {
      this.handleError(error, 'getActivePriceAlertsWithRelations');
    }
  }

  /**
   * Update a product offer (admin/system use)
   * @param offerId - Product offer ID
   * @param updates - Partial updates to apply
   */
  async updateProductOffer(offerId: number, updates: Partial<ProductOffer>): Promise<void> {
    try {
      await this.db
        .update(productOffers)
        .set(updates)
        .where(eq(productOffers.id, offerId));

      this.logSuccess('updateProductOffer', { offerId });
    } catch (error) {
      this.handleError(error, 'updateProductOffer');
    }
  }

  /**
   * Update a price alert (admin/system use, no user check)
   * @param alertId - Price alert ID
   * @param updates - Partial updates to apply
   */
  async updatePriceAlertAdmin(alertId: number, updates: Partial<PriceAlert>): Promise<void> {
    try {
      await this.db.update(priceAlerts).set(updates).where(eq(priceAlerts.id, alertId));

      this.logSuccess('updatePriceAlertAdmin', { alertId });
    } catch (error) {
      this.handleError(error, 'updatePriceAlertAdmin');
    }
  }

  /**
   * Get monitoring statistics
   * Optimized: Combines multiple queries into 2 aggregate queries using conditional counting
   */
  async getMonitoringStats(): Promise<{
    recentChecks: { last24h: number; last7d: number };
    activeAlerts: { total: number; triggered: number; byType: Record<string, unknown> };
    priceChanges: { increases: number; decreases: number; stable: number };
    availability: { available: number; outOfStock: number; unknown: number };
    timestamp: string;
  }> {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Combine all offer statistics into a single query
      const [offerStats] = await this.db
        .select({
          recentChecks24h: sql<number>`count(case when ${productOffers.lastLinkCheck} >= ${last24h} then 1 end)`,
          recentChecks7d: sql<number>`count(case when ${productOffers.lastLinkCheck} >= ${last7d} then 1 end)`,
          available: sql<number>`count(case when ${productOffers.availability} = 'in_stock' then 1 end)`,
          outOfStock: sql<number>`count(case when ${productOffers.availability} = 'out_of_stock' then 1 end)`,
          unknownAvailability: sql<number>`count(case when ${productOffers.availability} is null or ${productOffers.availability} not in ('in_stock', 'out_of_stock') then 1 end)`,
        })
        .from(productOffers);

      // Combine all alert statistics into a single query
      const [alertStats] = await this.db
        .select({
          totalAlerts: count(),
          activeAlerts: sql<number>`count(case when ${priceAlerts.isActive} = true then 1 end)`,
          triggeredAlerts: sql<number>`count(case when ${priceAlerts.isActive} = false then 1 end)`,
        })
        .from(priceAlerts);

      this.logSuccess('getMonitoringStats', {});

      return {
        recentChecks: {
          last24h: Number(offerStats?.recentChecks24h ?? 0),
          last7d: Number(offerStats?.recentChecks7d ?? 0),
        },
        activeAlerts: {
          total: Number(alertStats?.totalAlerts ?? 0),
          triggered: Number(alertStats?.triggeredAlerts ?? 0),
          byType: {},
        },
        priceChanges: {
          increases: 0,
          decreases: 0,
          stable: 0,
        },
        availability: {
          available: Number(offerStats?.available ?? 0),
          outOfStock: Number(offerStats?.outOfStock ?? 0),
          unknown: Number(offerStats?.unknownAvailability ?? 0),
        },
        timestamp: now.toISOString(),
      };
    } catch (error) {
      this.handleError(error, 'getMonitoringStats');
    }
  }
}
