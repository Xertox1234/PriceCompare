/**
 * Agent Storage Domain
 *
 * Handles all agent-related database operations for AI agent coordination and scraping jobs.
 * Provides operations for agent sessions, scraping jobs, and trending products.
 *
 * Issue #178: Agent Storage Layer Migration - Migrate agent modules to storage layer pattern
 */

import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';
import { agentSessions, scrapingJobs, trendingProducts } from '@shared/schema';
import { BaseStorage } from '../base-storage';
import type {
  AgentSession,
  InsertAgentSession,
  ScrapingJob,
  InsertScrapingJob,
  InsertTrendingProduct,
} from '@shared/schema';
import type { TrendingProduct } from '../types';
import type { db } from '../../db';

// Type alias for database connection (matches BaseStorage pattern)
type Database = typeof db;

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

      const count = parseInt(result[0]?.count as unknown as string) || 0;

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
          stats[row.status] = parseInt(row.count as unknown as string) || 0;
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
    try {
      const results = await this.db
        .select({
          id: trendingProducts.id,
          name: trendingProducts.name,
          category: trendingProducts.category,
          status: trendingProducts.status,
          discoveredAt: trendingProducts.discoveryDate,
        })
        .from(trendingProducts)
        .where(eq(trendingProducts.status, status))
        .limit(limit);

      const products = results.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        status: row.status || status,
        discoveredAt: row.discoveredAt,
      }));

      this.logSuccess('getTrendingProductsByStatus', { status, limit, count: products.length });
      return products;
    } catch (error) {
      this.handleError(error, 'getTrendingProductsByStatus');
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
}
