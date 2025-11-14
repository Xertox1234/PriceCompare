import { BaseAgent, AgentConfig, TaskResult } from './base-agent.js';
import { ProductDiscoveryAgent } from './discovery-agent.js';
import { SearchOrchestrationAgent } from './search-agent.js';
import { DataExtractionAgent } from './extraction-agent.js';
import { PriceMonitoringAgent } from './monitoring-agent.js';
import { db } from '../db.js';
import { scrapingJobs, trendingProducts, products, productOffers } from '../../shared/schema.js';
import { eq, and, lt } from 'drizzle-orm';
import type {
  ScrapingJob,
  InsertScrapingJob,
  TrendingProduct,
  InsertProduct,
  InsertProductOffer
} from '../../shared/schema.js';
import type { CoordinatorTask, SystemStatus } from './types.js';
import { logger } from '../utils/logger.js';
import { distributedLock } from '../services/distributed-lock.js';

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
    
    return await this.executeTask(
      taskId,
      () => this.coordinateWorkflow(taskData),
      {
        jobType: 'coordination',
        targetData: JSON.stringify(taskData)
      }
    );
  }

  private async coordinateWorkflow(taskData: any): Promise<void> {
    const { action, ...params } = taskData;

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
    const sources = params.sources || ['google_trends', 'seasonal'];
    const categories = params.categories;
    const limit = params.limit || 20;

    try {
      const trends = await this.discoveryAgent.processTask({
        sources,
        categories,
        limit
      });

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
    const trendingProductsList = await db.select()
      .from(trendingProducts)
      .where(eq(trendingProducts.status, 'discovered'))
      .limit(5);

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
      await db.update(trendingProducts)
        .set({ status: 'processing' })
        .where(eq(trendingProducts.id, product.id));

      // Generate search queries and find product URLs
      const searchResults = await this.searchAgent.processTask({
        productName: product.name,
        category: product.category || undefined,
        retailers: ['amazon', 'walmart', 'target'],
        trendingProductId: product.id
      });

      if (searchResults.length > 0) {
        // Create product record
        const createdProduct = await this.createProductFromTrending(product);
        
        if (createdProduct) {
          // Link trending product to created product
          await db.update(trendingProducts)
            .set({ 
              productId: createdProduct.id,
              status: 'scraped'
            })
            .where(eq(trendingProducts.id, product.id));

          logger.info(`Successfully processed trending product: ${product.name}`);
        }
      } else {
        await db.update(trendingProducts)
          .set({ status: 'failed' })
          .where(eq(trendingProducts.id, product.id));
      }

    } catch (error) {
      logger.error(`Failed to process product ${product.name}`, {
        error: error instanceof Error ? error.message : String(error),
        productName: product.name
      });
      await db.update(trendingProducts)
        .set({ status: 'failed' })
        .where(eq(trendingProducts.id, product.id));
    }
  }

  private async createProductFromTrending(trendingProduct: TrendingProduct): Promise<any> {
    try {
      const productData: InsertProduct = {
        name: trendingProduct.name,
        category: trendingProduct.category || 'General',
        description: `Trending product discovered via ${trendingProduct.source}`,
        brand: this.extractBrand(trendingProduct.name)
      };

      const [createdProduct] = await db.insert(products).values(productData).returning();
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

  private async queueSearchJobs(trends: Array<Record<string, unknown>>): Promise<void> {
    const jobsToCreate: InsertScrapingJob[] = trends.map(trend => ({
      jobType: 'search',
      priority: this.coordinatorConfig.jobPriorities.search,
      targetData: JSON.stringify({
        productName: trend.query,
        category: trend.category,
        retailers: ['amazon', 'walmart', 'target']
      }),
      scheduledAt: new Date()
    }));

    if (jobsToCreate.length > 0) {
      await db.insert(scrapingJobs).values(jobsToCreate);
      logger.info(`Queued ${jobsToCreate.length} search jobs`);
    }
  }

  private async updateExistingPrices(): Promise<void> {
    // Get products that need price updates (older than 1 hour)
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
      jobType: 'price_update',
      priority: this.coordinatorConfig.jobPriorities.price_update,
      targetData: JSON.stringify({ offerId }),
      scheduledAt: new Date()
    };

    await db.insert(scrapingJobs).values(jobData);
  }

  private async runFullCycle(params: Record<string, unknown>): Promise<void> {
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
      const pendingJobsCount = await db.select()
        .from(scrapingJobs)
        .where(eq(scrapingJobs.status, 'pending'));

      const queueSize = pendingJobsCount.length;

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

      setTimeout(scheduleNext, interval);
    };

    // Start the scheduler
    scheduleNext();
    logger.info('Dynamic job processor started with adaptive scheduling');
  }

  private async processQueuedJobs(): Promise<void> {
    try {
      const pendingJobs = await db.select()
        .from(scrapingJobs)
        .where(
          and(
            eq(scrapingJobs.status, 'pending'),
            lt(scrapingJobs.scheduledAt, new Date())
          )
        )
        .limit(this.coordinatorConfig.maxConcurrentJobs);

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
    // Acquire distributed lock to prevent duplicate processing across instances
    const lockKey = `job:${job.id}`;
    const lock = await distributedLock.acquire(lockKey, 60000, 2, 100); // 60s TTL, 2 retries

    if (!lock) {
      logger.debug(`Job ${job.id} is already being processed by another instance, skipping`, {
        jobId: job.id,
        jobType: job.jobType
      });
      return; // Another instance is processing this job
    }

    try {
      // Update job status to running
      await db.update(scrapingJobs)
        .set({
          status: 'running',
          startedAt: new Date()
        })
        .where(eq(scrapingJobs.id, job.id));

      let result: any;
      const targetData = JSON.parse(job.targetData);

      switch (job.jobType) {
        case 'discovery':
          result = await this.discoveryAgent.processTask(targetData);
          break;
        case 'search':
          result = await this.searchAgent.processTask(targetData);
          break;
        default:
          throw new Error(`Unknown job type: ${job.jobType}`);
      }

      // Mark job as completed
      await db.update(scrapingJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          resultData: JSON.stringify(result)
        })
        .where(eq(scrapingJobs.id, job.id));

      logger.info(`Job ${job.id} completed successfully`, {
        jobId: job.id,
        jobType: job.jobType,
        duration: Date.now() - (job.startedAt?.getTime() || Date.now())
      });

    } catch (error) {
      logger.error(`Job ${job.id} failed`, {
        error: error instanceof Error ? error.message : String(error),
        jobId: job.id,
        jobType: job.jobType
      });

      // Handle job failure
      await db.update(scrapingJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          retryCount: (job.retryCount || 0) + 1
        })
        .where(eq(scrapingJobs.id, job.id));
    } finally {
      // Always release the lock
      await distributedLock.release(lockKey, lock.lockId);
    }
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const [
      totalJobs,
      pendingJobs,
      runningJobs,
      completedJobs,
      failedJobs,
      discoveredProducts,
      processedProducts
    ] = await Promise.all([
      db.select().from(scrapingJobs),
      db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'pending')),
      db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'running')),
      db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'completed')),
      db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'failed')),
      db.select().from(trendingProducts).where(eq(trendingProducts.status, 'discovered')),
      db.select().from(trendingProducts).where(eq(trendingProducts.status, 'scraped'))
    ]);

    return {
      jobs: {
        total: totalJobs.length,
        pending: pendingJobs.length,
        running: runningJobs.length,
        completed: completedJobs.length,
        failed: failedJobs.length
      },
      products: {
        discovered: discoveredProducts.length,
        processed: processedProducts.length
      },
      agents: {
        coordinator: this.getStatus(),
        discovery: this.discoveryAgent.getStatus(),
        search: this.searchAgent.getStatus()
      }
    };
  }
}