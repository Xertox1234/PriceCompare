import { db } from '../db.js';
import { scrapingJobs, trendingProducts, agentSessions, productOffers } from '../../shared/schema.js';
import { eq, desc, and, gte, count, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { queryCache, generalCache } from './redis-cache.js';
import { distributedLock } from './distributed-lock.js';

/**
 * Monitoring Service
 *
 * Provides real-time system metrics and health status for the dashboard
 */

export interface DashboardMetrics {
  timestamp: string;
  agents: AgentMetrics;
  jobs: JobMetrics;
  cache: CacheMetrics;
  locks: LockMetrics;
  products: ProductMetrics;
  health: HealthStatus;
}

export interface AgentMetrics {
  total: number;
  active: number;
  inactive: number;
  sessions: AgentSession[];
}

export interface AgentSession {
  id: number;
  type: string;
  status: string;
  startTime: string;
  tasksCompleted: number;
  successRate: number;
  errorsEncountered: number;
}

export interface JobMetrics {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  successRate: number;
  avgDuration: number | null;
  recentJobs: RecentJob[];
}

export interface RecentJob {
  id: number;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
}

export interface CacheMetrics {
  queryCache: {
    hits: number;
    misses: number;
    hitRate: number;
    hitRatePercent: number;
    connected: boolean;
  };
  generalCache: {
    hits: number;
    misses: number;
    hitRate: number;
    hitRatePercent: number;
    connected: boolean;
  };
  overall: {
    totalHits: number;
    totalMisses: number;
    combinedHitRate: number;
  };
}

export interface LockMetrics {
  acquisitionAttempts: number;
  acquisitionsSucceeded: number;
  acquisitionsFailed: number;
  locksReleased: number;
  activeLocks: number;
  avgAcquisitionTime: number;
  contentionRate: number;
  successRate: number;
}

export interface ProductMetrics {
  totalProducts: number;
  totalOffers: number;
  trendingDiscovered: number;
  trendingProcessed: number;
  trendingFailed: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: boolean;
    redis: boolean;
    agents: boolean;
  };
  issues: string[];
}

export interface ErrorLog {
  timestamp: string;
  level: 'error' | 'warn';
  message: string;
  context?: Record<string, any>;
}

class MonitoringService {
  private errorLogs: ErrorLog[] = [];
  private readonly MAX_ERROR_LOGS = 100;

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const [agents, jobs, cache, locks, products, health] = await Promise.all([
        this.getAgentMetrics(),
        this.getJobMetrics(),
        this.getCacheMetrics(),
        this.getLockMetrics(),
        this.getProductMetrics(),
        this.getHealthStatus()
      ]);

      return {
        timestamp: new Date().toISOString(),
        agents,
        jobs,
        cache,
        locks,
        products,
        health
      };
    } catch (error) {
      logger.error('Failed to get dashboard metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get agent metrics
   */
  private async getAgentMetrics(): Promise<AgentMetrics> {
    try {
      // Get recent agent sessions (last 24 hours)
      const recentSessions = await db
        .select()
        .from(agentSessions)
        .where(gte(agentSessions.sessionStart, new Date(Date.now() - 24 * 60 * 60 * 1000)))
        .orderBy(desc(agentSessions.sessionStart))
        .limit(20);

      const activeSessions = recentSessions.filter(s => s.status === 'active');

      const sessions: AgentSession[] = recentSessions.map(session => ({
        id: session.id,
        type: session.agentType,
        status: session.status,
        startTime: session.sessionStart.toISOString(),
        tasksCompleted: session.tasksCompleted || 0,
        successRate: parseFloat(session.successRate || '0'),
        errorsEncountered: session.errorsEncountered || 0
      }));

      return {
        total: recentSessions.length,
        active: activeSessions.length,
        inactive: recentSessions.length - activeSessions.length,
        sessions
      };
    } catch (error) {
      logger.error('Failed to get agent metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        total: 0,
        active: 0,
        inactive: 0,
        sessions: []
      };
    }
  }

  /**
   * Get job queue metrics
   */
  private async getJobMetrics(): Promise<JobMetrics> {
    try {
      const [allJobs, jobCounts] = await Promise.all([
        // Get recent jobs
        db.select()
          .from(scrapingJobs)
          .orderBy(desc(scrapingJobs.createdAt))
          .limit(50),

        // Get counts by status
        db.select({
          status: scrapingJobs.status,
          count: count()
        })
          .from(scrapingJobs)
          .groupBy(scrapingJobs.status)
      ]);

      const statusCounts = jobCounts.reduce((acc, row) => {
        acc[row.status] = Number(row.count);
        return acc;
      }, {} as Record<string, number>);

      const total = allJobs.length;
      const pending = statusCounts.pending || 0;
      const running = statusCounts.running || 0;
      const completed = statusCounts.completed || 0;
      const failed = statusCounts.failed || 0;

      const successRate = total > 0 ? completed / (completed + failed) : 0;

      // Calculate average duration for completed jobs
      const completedJobs = allJobs.filter(j => j.status === 'completed' && j.startedAt && j.completedAt);
      const avgDuration = completedJobs.length > 0
        ? completedJobs.reduce((sum, job) => {
            const duration = job.completedAt!.getTime() - job.startedAt!.getTime();
            return sum + duration;
          }, 0) / completedJobs.length
        : null;

      // Format recent jobs
      const recentJobs: RecentJob[] = allJobs.slice(0, 10).map(job => ({
        id: job.id,
        type: job.jobType,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        duration: job.startedAt && job.completedAt
          ? job.completedAt.getTime() - job.startedAt.getTime()
          : undefined,
        error: job.errorMessage || undefined
      }));

      return {
        total,
        pending,
        running,
        completed,
        failed,
        successRate,
        avgDuration,
        recentJobs
      };
    } catch (error) {
      logger.error('Failed to get job metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        successRate: 0,
        avgDuration: null,
        recentJobs: []
      };
    }
  }

  /**
   * Get cache metrics
   */
  private async getCacheMetrics(): Promise<CacheMetrics> {
    try {
      const queryCacheStats = queryCache.getStats();
      const generalCacheStats = generalCache.getStats();

      const queryPing = await queryCache.ping();
      const generalPing = await generalCache.ping();

      return {
        queryCache: {
          hits: queryCacheStats.hits,
          misses: queryCacheStats.misses,
          hitRate: queryCacheStats.hitRate,
          hitRatePercent: Math.round(queryCacheStats.hitRate * 100),
          connected: queryPing
        },
        generalCache: {
          hits: generalCacheStats.hits,
          misses: generalCacheStats.misses,
          hitRate: generalCacheStats.hitRate,
          hitRatePercent: Math.round(generalCacheStats.hitRate * 100),
          connected: generalPing
        },
        overall: {
          totalHits: queryCacheStats.hits + generalCacheStats.hits,
          totalMisses: queryCacheStats.misses + generalCacheStats.misses,
          combinedHitRate:
            (queryCacheStats.hits + generalCacheStats.hits) /
            (queryCacheStats.hits + generalCacheStats.hits + queryCacheStats.misses + generalCacheStats.misses) || 0
        }
      };
    } catch (error) {
      logger.error('Failed to get cache metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        queryCache: { hits: 0, misses: 0, hitRate: 0, hitRatePercent: 0, connected: false },
        generalCache: { hits: 0, misses: 0, hitRate: 0, hitRatePercent: 0, connected: false },
        overall: { totalHits: 0, totalMisses: 0, combinedHitRate: 0 }
      };
    }
  }

  /**
   * Get distributed lock metrics
   */
  private async getLockMetrics(): Promise<LockMetrics> {
    try {
      const metrics = distributedLock.getMetrics();

      const successRate = metrics.acquisitionAttempts > 0
        ? (metrics.acquisitionsSucceeded / metrics.acquisitionAttempts) * 100
        : 100;

      return {
        acquisitionAttempts: metrics.acquisitionAttempts,
        acquisitionsSucceeded: metrics.acquisitionsSucceeded,
        acquisitionsFailed: metrics.acquisitionsFailed,
        locksReleased: metrics.locksReleased,
        activeLocks: metrics.activeLocks,
        avgAcquisitionTime: metrics.avgAcquisitionTime,
        contentionRate: metrics.contentionRate,
        successRate: Math.round(successRate)
      };
    } catch (error) {
      logger.error('Failed to get lock metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        acquisitionAttempts: 0,
        acquisitionsSucceeded: 0,
        acquisitionsFailed: 0,
        locksReleased: 0,
        activeLocks: 0,
        avgAcquisitionTime: 0,
        contentionRate: 0,
        successRate: 100
      };
    }
  }

  /**
   * Get product metrics
   */
  private async getProductMetrics(): Promise<ProductMetrics> {
    try {
      const [productCount, offerCount, trendingCounts] = await Promise.all([
        db.select({ count: count() }).from(agentSessions), // Using agentSessions as proxy
        db.select({ count: count() }).from(productOffers),
        db.select({
          status: trendingProducts.status,
          count: count()
        })
          .from(trendingProducts)
          .groupBy(trendingProducts.status)
      ]);

      const trendingStatusCounts = trendingCounts.reduce((acc, row) => {
        acc[row.status] = Number(row.count);
        return acc;
      }, {} as Record<string, number>);

      return {
        totalProducts: 0, // Would need products table count
        totalOffers: Number(offerCount[0]?.count || 0),
        trendingDiscovered: trendingStatusCounts.discovered || 0,
        trendingProcessed: trendingStatusCounts.scraped || 0,
        trendingFailed: trendingStatusCounts.failed || 0
      };
    } catch (error) {
      logger.error('Failed to get product metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        totalProducts: 0,
        totalOffers: 0,
        trendingDiscovered: 0,
        trendingProcessed: 0,
        trendingFailed: 0
      };
    }
  }

  /**
   * Get system health status
   */
  private async getHealthStatus(): Promise<HealthStatus> {
    const issues: string[] = [];
    let healthyServices = 0;
    const totalServices = 3;

    // Check database
    let databaseHealthy = false;
    try {
      await db.select().from(agentSessions).limit(1);
      databaseHealthy = true;
      healthyServices++;
    } catch (error) {
      issues.push('Database connection failed');
    }

    // Check Redis
    const redisHealthy = await queryCache.ping();
    if (redisHealthy) {
      healthyServices++;
    } else {
      issues.push('Redis connection failed');
    }

    // Check agents
    let agentsHealthy = false;
    try {
      const activeSessions = await db
        .select()
        .from(agentSessions)
        .where(and(
          eq(agentSessions.status, 'active'),
          gte(agentSessions.sessionStart, new Date(Date.now() - 10 * 60 * 1000)) // Last 10 minutes
        ));
      agentsHealthy = activeSessions.length > 0;
      if (agentsHealthy) {
        healthyServices++;
      } else {
        issues.push('No active agents in the last 10 minutes');
      }
    } catch (error) {
      issues.push('Unable to check agent status');
    }

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      overall = 'healthy';
    } else if (healthyServices >= totalServices / 2) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      services: {
        database: databaseHealthy,
        redis: redisHealthy,
        agents: agentsHealthy
      },
      issues
    };
  }

  /**
   * Log an error for the dashboard
   */
  logError(level: 'error' | 'warn', message: string, context?: Record<string, any>): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    this.errorLogs.unshift(errorLog);

    // Keep only the most recent errors
    if (this.errorLogs.length > this.MAX_ERROR_LOGS) {
      this.errorLogs = this.errorLogs.slice(0, this.MAX_ERROR_LOGS);
    }
  }

  /**
   * Get recent error logs
   */
  getRecentErrors(limit: number = 20): ErrorLog[] {
    return this.errorLogs.slice(0, limit);
  }

  /**
   * Clear error logs
   */
  clearErrors(): void {
    this.errorLogs = [];
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();
