import { BaseAgent, AgentConfig } from './base-agent';
import { ProductDiscoveryAgent } from './discovery-agent';
import { SearchOrchestrationAgent } from './search-agent';
import { storage, type TrendingProduct } from '../storage';
import { db } from '../db';
import { productOffers } from '../../shared/schema';
import { lt } from 'drizzle-orm';
import type {
  ScrapingJob,
  InsertProduct,
  Product,
  InsertScrapingJob
} from '../../shared/schema';
import type { SystemStatus, TrendData } from './types';
import { logger } from '../utils/logger';
import { jobLockService } from '../services/job-lock-service';

interface CoordinatorConfig {
  maxConcurrentJobs: number;
  jobPriorities: Record<string, number>;
  retryDelays: Record<string, number>;
}

interface ScrapingWorkflow {
  trendingProduct: TrendingProduct;
  jobs: ScrapingJob[];
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class CoordinationAgent extends BaseAgent {
  private discoveryAgent: ProductDiscoveryAgent;
  private searchAgent: SearchOrchestrationAgent;
  private activeWorkflows: Map<number, ScrapingWorkflow> = new Map();
  private coordinatorConfig: CoordinatorConfig;

  constructor() {
    const config: AgentConfig = {
      name: 'Coordination Agent',
      type: 'coordinator',
      maxConcurrentTasks: 10,
      retryAttempts: 3,
      retryDelay: 2000
    };

    super(config);

    this.discoveryAgent = new ProductDiscoveryAgent();
    this.searchAgent = new SearchOrchestrationAgent();

    this.coordinatorConfig = {
      maxConcurrentJobs: 5,
      jobPriorities: {
        discovery: 10,
        search: 8,
        scrape: 6,
        validate: 4,
        price_update: 2
      },
      retryDelays: {
        discovery: 5000,
        search: 3000,
        scrape: 2000,
        validate: 1000,
        price_update: 1000
      }
    };
  }

  async initialize(): Promise<void> {
    await super.initialize();
    await this.discoveryAgent.initialize();
    await this.searchAgent.initialize();
  }

  async start(): Promise<void> {
    await super.start();
    await this.discoveryAgent.start();
    await this.searchAgent.start();
    
    // Start periodic job processing
    this.startJobProcessor();
    
    logger.info('Coordination Agent fully started with all sub-agents');
  }

  async stop(): Promise<void> {
    await this.discoveryAgent.stop();
    await this.searchAgent.stop();
    await super.stop();
  }

  async processTask(taskData: unknown): Promise<unknown> {
    const taskId = `coordinator_${Date.now()}`;

    return this.executeTask(
      taskId,
      () => this.coordinateWorkflow(taskData),
      {
        jobType: 'coordination' as const,
        targetData: JSON.stringify(taskData)
      }
    );
  }

  private async coordinateWorkflow(taskData: unknown): Promise<void> {
    if (typeof taskData !== 'object' || taskData === null) {
      throw new Error('Invalid task data');
    }

    const { action, ...params } = taskData as Record<string, unknown>;

    switch (action) {
      case 'discover_trends':
        await this.discoverTrends(params);
        break;
      case 'process_trending_products':
        await this.processTrendingProducts();
        break;
      case 'update_prices':
        await this.updateExistingPrices();
        break;
      case 'full_cycle':
        await this.runFullCycle(params);
        break;
      default:
        throw new Error(`Unknown coordination action: ${action}`);
    }
  }

  private async discoverTrends(params: Record<string, unknown>): Promise<void> {
    const sources = (params.sources as string[]) || ['google_trends', 'seasonal'];
    const categories = params.categories as string[] | undefined;
    const limit = (params.limit as number) || 20;

    try {
      const result = await this.discoveryAgent.processTask({
        action: 'discover_products',
        sources,
        categories,
        limit
      });

      // The result should be an array of TrendData
      const trends = (result) || [];

      logger.info(`Discovered ${trends.length} trending products`);

      // Queue search jobs for discovered trends
      await this.queueSearchJobs(trends.slice(0, 10)); // Process top 10

    } catch (error) {
      logger.error('Trend discovery failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async processTrendingProducts(): Promise<void> {
    // Get unprocessed trending products
    const trendingProductsList = await storage.getTrendingProducts('discovered', 5);

    // Process products in parallel with Promise.allSettled
    // This provides 5x performance improvement over sequential processing
    const results = await Promise.allSettled(
      trendingProductsList.map(product =>
        this.processIndividualProduct(product)
      )
    );

    // Log summary of parallel processing results
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('Parallel product processing completed', {
      total: results.length,
      succeeded,
      failed,
      successRate: results.length > 0 ? (succeeded / results.length) : 0
    });
  }

  private async processIndividualProduct(product: TrendingProduct): Promise<void> {
    try {
      // Update status to processing
      await storage.updateTrendingProduct(product.id, { status: 'processing' });

      // Generate search queries and find product URLs
      const result = await this.searchAgent.processTask({
        action: 'search_products',
        productName: product.name,
        category: product.category || undefined,
        retailers: ['amazon', 'walmart', 'target'],
        trendingProductId: product.id
      });

      // The result should be an array of search results
      const searchResults = (result as unknown[]) || [];

      if (searchResults.length > 0) {
        // Create product record
        const createdProduct = await this.createProductFromTrending(product);

        if (createdProduct) {
          // Link trending product to created product
          await storage.updateTrendingProduct(product.id, {
            productId: createdProduct.id,
            status: 'scraped' as const
          });

          logger.info(`Successfully processed trending product: ${product.name}`);
        }
      } else {
        await storage.updateTrendingProduct(product.id, { status: 'failed' as const });
      }

    } catch (error) {
      logger.error(`Failed to process product ${product.name}`, {
        error: error instanceof Error ? error.message : String(error),
        productName: product.name
      });
      await storage.updateTrendingProduct(product.id, { status: 'failed' as const });
    }
  }

  private async createProductFromTrending(trendingProduct: TrendingProduct): Promise<Product | null> {
    try {
      const productData: InsertProduct = {
        name: trendingProduct.name,
        category: trendingProduct.category || 'General',
        description: `Trending product discovered via ${trendingProduct.source}`,
        brand: this.extractBrand(trendingProduct.name)
      };

      const createdProduct = await storage.createProduct(productData);
      return createdProduct;

    } catch (error) {
      logger.error('Failed to create product from trending', {
        error: error instanceof Error ? error.message : String(error),
        productName: trendingProduct.name
      });
      return null;
    }
  }

  private extractBrand(productName: string): string | undefined {
    // Simple brand extraction logic
    const commonBrands = [
      'Apple', 'Samsung', 'Nike', 'Adidas', 'Sony', 'LG', 'Dell', 'HP',
      'Canon', 'Nikon', 'Nintendo', 'PlayStation', 'Xbox', 'Google',
      'Amazon', 'Microsoft', 'Intel', 'AMD', 'Nvidia'
    ];

    for (const brand of commonBrands) {
      if (productName.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }

    return undefined;
  }

  private async queueSearchJobs(trends: TrendData[]): Promise<void> {
    const jobsToCreate: InsertScrapingJob[] = trends.map(trend => ({
      jobType: 'search' as const,
      priority: this.coordinatorConfig.jobPriorities.search,
      targetData: JSON.stringify({
        action: 'search_products',
        productName: trend.query,
        category: trend.category,
        retailers: ['amazon', 'walmart', 'target']
      }),
      scheduledAt: new Date()
    }));

    if (jobsToCreate.length > 0) {
      // Create jobs individually using storage layer
      for (const jobData of jobsToCreate) {
        await storage.createScrapingJob(jobData);
      }
      logger.info(`Queued ${jobsToCreate.length} search jobs`);
    }
  }

  private async updateExistingPrices(): Promise<void> {
    // Get products that need price updates (older than 1 hour)
    // NOTE: Direct db query - no storage method exists for stale offers filtered by lastUpdated
    const staleProducts = await db.select()
      .from(productOffers)
      .where(lt(productOffers.lastUpdated, new Date(Date.now() - 60 * 60 * 1000)))
      .limit(10);

    for (const offer of staleProducts) {
      await this.queuePriceUpdateJob(offer.id);
    }
  }

  private async queuePriceUpdateJob(offerId: number): Promise<void> {
    const jobData: InsertScrapingJob = {
      jobType: 'price_update' as const,
      priority: this.coordinatorConfig.jobPriorities.price_update,
      targetData: JSON.stringify({
        action: 'refresh_offers',
        productOfferId: offerId
      }),
      scheduledAt: new Date()
    };

    await storage.createScrapingJob(jobData);
  }

  private async runFullCycle(_params: Record<string, unknown>): Promise<void> {
    logger.info('Starting full scraping cycle...');

    // Step 1: Discover trends
    await this.discoverTrends({
      sources: ['google_trends', 'seasonal'],
      limit: 15
    });

    // Step 2: Process trending products
    await this.processTrendingProducts();

    // Step 3: Update existing prices
    await this.updateExistingPrices();

    logger.info('Full scraping cycle completed');
  }

  /**
   * Calculate adaptive scheduling interval based on queue size
   * - High load (>100 jobs): 5s interval (aggressive processing)
   * - Medium load (20-100 jobs): 15s interval (moderate processing)
   * - Low load (5-20 jobs): 30s interval (conservative processing)
   * - Very low load (<5 jobs): 60s interval (minimal processing)
   */
  private async calculateSchedulingInterval(): Promise<number> {
    try {
      const statusCounts = await storage.getScrapingJobStatusCounts();
      const pendingCount = statusCounts.find(s => s.status === 'pending');
      const queueSize = pendingCount ? Number(pendingCount.count) : 0;

      // Aggressive: 5s when queue > 100
      if (queueSize > 100) {
        logger.debug('High queue load detected, using 5s interval', { queueSize });
        return 5000;
      }

      // Moderate: 15s when queue 20-100
      if (queueSize > 20) {
        logger.debug('Medium queue load detected, using 15s interval', { queueSize });
        return 15000;
      }

      // Conservative: 30s when queue 5-20
      if (queueSize > 5) {
        return 30000;
      }

      // Minimal: 60s when queue < 5
      logger.debug('Low queue load detected, using 60s interval', { queueSize });
      return 60000;

    } catch (error) {
      logger.error('Failed to calculate scheduling interval', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 30000; // Default fallback
    }
  }

  private startJobProcessor(): void {
    // Dynamic scheduling with adaptive intervals
    const scheduleNext = async () => {
      await this.processQueuedJobs();

      // Calculate next interval based on current queue size
      const interval = await this.calculateSchedulingInterval();

      setTimeout(() => void scheduleNext(), interval);
    };

    // Start the scheduler
    void scheduleNext();
    logger.info('Dynamic job processor started with adaptive scheduling');
  }

  private async processQueuedJobs(): Promise<void> {
    try {
      const pendingJobs = await storage.getPendingScrapingJobs(this.coordinatorConfig.maxConcurrentJobs);

      if (pendingJobs.length > 0) {
        logger.debug('Processing queued jobs', {
          jobCount: pendingJobs.length,
          maxConcurrent: this.coordinatorConfig.maxConcurrentJobs
        });
      }

      for (const job of pendingJobs) {
        await this.processJob(job);
      }

    } catch (error) {
      logger.error('Job processing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async processJob(job: ScrapingJob): Promise<void> {
    // Use jobLockService to prevent duplicate processing across instances
    const lockKey = `scraping-job:${job.id}`;

    try {
      const result = await jobLockService.withLock(
        lockKey,
        async () => {
          // Update job status to running
          await storage.updateScrapingJob(job.id, {
            status: 'running' as const,
            startedAt: new Date()
          });

          let taskResult: unknown;
          const targetData = JSON.parse(job.targetData) as Record<string, unknown>;

          switch (job.jobType) {
            case 'discovery':
              taskResult = await this.discoveryAgent.processTask(targetData as { action: 'discover_products'; sources: string[]; categories?: string[]; limit?: number });
              break;
            case 'search':
              taskResult = await this.searchAgent.processTask(targetData as { action: 'search_products'; productName: string; category?: string; retailers: string[]; trendingProductId?: number });
              break;
            default:
              throw new Error(`Unknown job type: ${job.jobType}`);
          }

          // Mark job as completed
          await storage.updateScrapingJob(job.id, {
            status: 'completed' as const,
            completedAt: new Date(),
            resultData: JSON.stringify(taskResult)
          });

          logger.info(`Job ${job.id} completed successfully`, {
            jobId: job.id,
            jobType: job.jobType,
            duration: Date.now() - (job.startedAt?.getTime() || Date.now())
          });

          return taskResult;
        },
        60 // 60 second TTL
      );

      if (result === null) {
        logger.debug(`Job ${job.id} is already being processed by another instance, skipping`, {
          jobId: job.id,
          jobType: job.jobType
        });
      }
    } catch (error: unknown) {
      logger.error(`Job ${job.id} failed`, {
        error: error instanceof Error ? error.message : String(error),
        jobId: job.id,
        jobType: job.jobType
      });

      // Handle job failure - record in database
      await storage.updateScrapingJob(job.id, {
        status: 'failed' as const,
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryCount: (job.retryCount || 0) + 1
      });
    }
  }

  async getSystemStatus(): Promise<SystemStatus> {
    // Get job and trending product statistics
    const [jobStatusCounts, trendingStatusCounts] = await Promise.all([
      storage.getScrapingJobStatusCounts(),
      storage.getTrendingProductsStatusCounts()
    ]);

    // Convert status counts to lookup maps
    const jobCounts = jobStatusCounts.reduce((acc, item) => {
      acc[item.status] = Number(item.count);
      return acc;
    }, {} as Record<string, number>);

    const trendingCounts = trendingStatusCounts.reduce((acc, item) => {
      acc[item.status] = Number(item.count);
      return acc;
    }, {} as Record<string, number>);

    // Calculate totals
    const totalJobs = Object.values(jobCounts).reduce((sum, count) => sum + count, 0);
    const totalTrending = Object.values(trendingCounts).reduce((sum, count) => sum + count, 0);

    // Count active and idle agents
    const activeAgents = [this.isRunning, this.discoveryAgent.getStatus().isRunning, this.searchAgent.getStatus().isRunning].filter(Boolean).length;
    const idleAgents = 3 - activeAgents;

    return {
      jobs: {
        total: totalJobs,
        pending: jobCounts['pending'] || 0,
        running: jobCounts['running'] || 0,
        completed: jobCounts['completed'] || 0,
        failed: jobCounts['failed'] || 0
      },
      products: {
        discovered: trendingCounts['discovered'] || 0,
        processed: trendingCounts['scraped'] || 0,
        total: totalTrending
      },
      agents: {
        active: activeAgents,
        idle: idleAgents
      },
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date().toISOString()
    };
  }
}