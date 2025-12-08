import { BaseAgent, AgentConfig } from './base-agent';
import { affiliateLinkService } from '../services/affiliate-link-service';
import { db } from '../db';
import { productOffers, retailers } from '../../shared/schema';
import { eq, and, isNull, lt } from 'drizzle-orm';
import type { ProductOffer, Retailer as _Retailer } from '../../shared/schema';
import type { AffiliateLinkTask, LinkHealthCheckTask, AffiliateStats } from './types';
import { logger } from '../utils/logger';
import { cleanupManager } from '../utils/cleanup-manager';

/** Result of affiliate link generation batch */
interface GenerateLinksResult {
  processed: number;
  successful: number;
  failed: number;
  results: Array<{
    offerId: number;
    success: boolean;
    affiliateUrl?: string;
    error?: string;
  }>;
}

/** Result of processing a single offer */
interface ProcessOfferResult {
  affiliateUrl: string;
  isHealthy: boolean;
  originalUrl: string;
}

/** Result of link health check */
interface HealthCheckResult {
  total: number;
  healthy: number;
  broken: number;
}

/** Result of single offer health check */
interface SingleHealthCheckResult {
  isHealthy: boolean;
  affiliateUrl: string;
}

/** Result of updating a single offer */
interface UpdateOfferResult {
  skipped?: boolean;
  reason?: string;
  affiliateUrl?: string;
  isHealthy?: boolean;
  originalUrl?: string;
}

export class AffiliateLinkAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Affiliate Link Agent',
      type: 'affiliate',
      maxConcurrentTasks: 5,
      retryAttempts: 2,
      retryDelay: 1000,
    };

    super(config);
  }

  async processTask(taskData: unknown): Promise<unknown> {
    const task = taskData as { action: string; [key: string]: unknown };
    const { action, ...params } = task;

    switch (action) {
      case 'generate_affiliate_links':
        return this.generateAffiliateLinks(params);
      case 'health_check_links':
        return this.healthCheckLinks(params as LinkHealthCheckTask);
      case 'update_single_offer':
        return this.updateSingleOffer(params as AffiliateLinkTask);
      case 'batch_process_retailer':
        return this.batchProcessRetailer(params as { retailerId: number });
      default:
        throw new Error(`Unknown affiliate task action: ${action}`);
    }
  }

  /**
   * Generate affiliate links for offers without them
   */
  private async generateAffiliateLinks(
    params: Record<string, unknown>
  ): Promise<GenerateLinksResult> {
    const limit = typeof params.limit === 'number' ? params.limit : 50;
    const retailerId = typeof params.retailerId === 'number' ? params.retailerId : undefined;

    try {
      // Get offers without affiliate links
      const whereConditions = [isNull(productOffers.affiliateUrl)];

      if (retailerId !== undefined) {
        whereConditions.push(eq(productOffers.retailerId, retailerId));
      }

      const query = db
        .select()
        .from(productOffers)
        .where(and(...whereConditions))
        .limit(limit);

      const offers = await query;
      const results = [];

      for (const offer of offers) {
        const taskId = `affiliate_${offer.id}`;

        const result = await this.executeTask(taskId, () => this.processOfferAffiliateLink(offer), {
          jobType: 'affiliate_generation',
          targetData: JSON.stringify({ offerId: offer.id, retailerId: offer.retailerId }),
        });

        const resultData = result.data as ProcessOfferResult | undefined;
        results.push({
          offerId: offer.id,
          success: result.success,
          affiliateUrl: resultData?.affiliateUrl,
          error: result.error,
        });
      }

      return {
        processed: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    } catch (error) {
      logger.error('Affiliate link generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process affiliate link for a single offer
   */
  private async processOfferAffiliateLink(offer: ProductOffer): Promise<ProcessOfferResult> {
    if (!offer.productUrl) {
      throw new Error(`No product URL for offer ${offer.id}`);
    }

    const linkResult = await affiliateLinkService.generateAffiliateLink(
      offer.retailerId,
      offer.productUrl
    );

    if (linkResult.success && linkResult.affiliateUrl) {
      // Validate the generated link
      const isHealthy = await affiliateLinkService.validateAffiliateLink(linkResult.affiliateUrl);

      // Update the offer
      await affiliateLinkService.updateOfferWithAffiliateLink(
        offer.id,
        linkResult.affiliateUrl,
        isHealthy
      );

      return {
        affiliateUrl: linkResult.affiliateUrl,
        isHealthy,
        originalUrl: offer.productUrl,
      };
    }

    throw new Error(linkResult.error || 'Failed to generate affiliate link');
  }

  /**
   * Health check existing affiliate links
   */
  private async healthCheckLinks(
    params: LinkHealthCheckTask
  ): Promise<HealthCheckResult | SingleHealthCheckResult> {
    try {
      if (params.offerId) {
        return await this.healthCheckSingleOffer(params.offerId);
      }

      if (params.retailerId) {
        return await affiliateLinkService.healthCheckRetailerLinks(params.retailerId);
      }

      // Health check all links older than 24 hours
      const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const staleOffers = await db
        .select()
        .from(productOffers)
        .where(
          and(
            eq(productOffers.affiliateUrl, productOffers.affiliateUrl), // Not null
            lt(productOffers.lastLinkCheck, staleCutoff)
          )
        )
        .limit(100);

      let healthy = 0;
      let broken = 0;

      for (const offer of staleOffers) {
        if (offer.affiliateUrl) {
          const taskId = `health_${offer.id}`;

          const result = await this.executeTask(taskId, () => this.checkOfferLinkHealth(offer), {
            jobType: 'link_health_check',
            targetData: JSON.stringify({ offerId: offer.id }),
          });

          const healthData = result.data as { isHealthy: boolean } | undefined;
          if (result.success && healthData?.isHealthy) {
            healthy++;
          } else {
            broken++;
          }
        }
      }

      return {
        total: staleOffers.length,
        healthy,
        broken,
      };
    } catch (error) {
      logger.error('Link health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Health check a single offer's affiliate link
   */
  private async healthCheckSingleOffer(offerId: number): Promise<SingleHealthCheckResult> {
    const [offer] = await db
      .select()
      .from(productOffers)
      .where(eq(productOffers.id, offerId))
      .limit(1);

    if (!offer || !offer.affiliateUrl) {
      throw new Error(`No affiliate link found for offer ${offerId}`);
    }

    const isHealthy = await affiliateLinkService.validateAffiliateLink(offer.affiliateUrl);

    await affiliateLinkService.updateOfferWithAffiliateLink(offerId, offer.affiliateUrl, isHealthy);

    return { isHealthy, affiliateUrl: offer.affiliateUrl };
  }

  /**
   * Check health of a single offer's link
   */
  private async checkOfferLinkHealth(offer: ProductOffer): Promise<{ isHealthy: boolean }> {
    if (!offer.affiliateUrl) {
      throw new Error('No affiliate URL to check');
    }

    const isHealthy = await affiliateLinkService.validateAffiliateLink(offer.affiliateUrl);

    await affiliateLinkService.updateOfferWithAffiliateLink(
      offer.id,
      offer.affiliateUrl,
      isHealthy
    );

    return { isHealthy };
  }

  /**
   * Update affiliate link for a single offer
   */
  private async updateSingleOffer(
    params: AffiliateLinkTask
  ): Promise<UpdateOfferResult | ProcessOfferResult> {
    const { offerId, retailerId: _retailerId, productUrl: _productUrl, forceRegenerate } = params;

    const [offer] = await db
      .select()
      .from(productOffers)
      .where(eq(productOffers.id, offerId))
      .limit(1);

    if (!offer) {
      throw new Error(`Offer ${offerId} not found`);
    }

    // Skip if affiliate link exists and not forcing regeneration
    if (offer.affiliateUrl && !forceRegenerate) {
      return {
        skipped: true,
        reason: 'Affiliate link already exists',
        affiliateUrl: offer.affiliateUrl,
      };
    }

    return this.processOfferAffiliateLink(offer);
  }

  /**
   * Batch process all offers for a retailer
   */
  private async batchProcessRetailer(params: { retailerId: number }): Promise<GenerateLinksResult> {
    const { retailerId } = params;

    // Verify retailer has affiliate configuration
    const [retailer] = await db
      .select()
      .from(retailers)
      .where(eq(retailers.id, retailerId))
      .limit(1);

    if (!retailer) {
      throw new Error(`Retailer ${retailerId} not found`);
    }

    if (retailer.affiliateStatus !== 'active') {
      throw new Error(`Retailer ${retailer.name} affiliate program is not active`);
    }

    // Process all offers for this retailer
    return this.generateAffiliateLinks({ retailerId, limit: 1000 });
  }

  /**
   * Schedule periodic affiliate link maintenance
   */
  scheduleMaintenance(): void {
    // Health check links every 6 hours
    const healthCheckInterval = setInterval(
      () => {
        void (async () => {
          try {
            await this.processTask({ action: 'health_check_links' });
          } catch (error) {
            logger.error('Scheduled health check failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      },
      6 * 60 * 60 * 1000
    );
    cleanupManager.addInterval('affiliate-health-check', healthCheckInterval);

    // Generate missing affiliate links every hour
    const affiliateGenInterval = setInterval(
      () => {
        void (async () => {
          try {
            await this.processTask({ action: 'generate_affiliate_links', limit: 25 });
          } catch (error) {
            logger.error('Scheduled affiliate generation failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      },
      60 * 60 * 1000
    );
    cleanupManager.addInterval('affiliate-generation', affiliateGenInterval);
  }

  /**
   * Get affiliate link agent statistics
   */
  async getStats(): Promise<AffiliateStats | null> {
    try {
      const dbStats = await affiliateLinkService.getAffiliateLinkStats();
      const baseStatus = this.getStatus();

      // Transform AffiliateLinkStats from storage to AffiliateStats.links format
      const links = dbStats
        ? {
            total: dbStats.total_offers,
            active: dbStats.affiliate_offers,
            broken: dbStats.broken_links,
            byRetailer: {} as Record<string, number>, // TODO: Add retailer breakdown
          }
        : { total: 0, active: 0, broken: 0, byRetailer: {} as Record<string, number> };

      return {
        agent: {
          isRunning: baseStatus.isRunning,
          taskCount: baseStatus.activeTasks,
          successCount: 0, // Not tracked in base status
          errorCount: 0, // Not tracked in base status
        },
        links,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get affiliate agent stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
