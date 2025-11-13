import { BaseAgent, AgentConfig, TaskResult } from './base-agent.js';
import { affiliateLinkService } from '../services/affiliate-link-service.js';
import { db } from '../db.js';
import { productOffers, retailers } from '../../shared/schema.js';
import { eq, and, isNull, lt } from 'drizzle-orm';
import type { ProductOffer, Retailer } from '../../shared/schema.js';

interface AffiliateLinkTask {
  offerId: number;
  retailerId: number;
  productUrl: string;
  forceRegenerate?: boolean;
}

interface LinkHealthCheckTask {
  retailerId?: number;
  offerId?: number;
}

export class AffiliateLinkAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Affiliate Link Agent',
      type: 'affiliate',
      maxConcurrentTasks: 5,
      retryAttempts: 2,
      retryDelay: 1000
    };

    super(config);
  }

  async processTask(taskData: any): Promise<any> {
    const { action, ...params } = taskData;

    switch (action) {
      case 'generate_affiliate_links':
        return await this.generateAffiliateLinks(params);
      case 'health_check_links':
        return await this.healthCheckLinks(params);
      case 'update_single_offer':
        return await this.updateSingleOffer(params);
      case 'batch_process_retailer':
        return await this.batchProcessRetailer(params);
      default:
        throw new Error(`Unknown affiliate task action: ${action}`);
    }
  }

  /**
   * Generate affiliate links for offers without them
   */
  private async generateAffiliateLinks(params: any): Promise<any> {
    const limit = params.limit || 50;
    const retailerId = params.retailerId;

    try {
      // Get offers without affiliate links
      const whereConditions = [isNull(productOffers.affiliateUrl)];
      
      if (retailerId) {
        whereConditions.push(eq(productOffers.retailerId, retailerId));
      }

      const query = db.select()
        .from(productOffers)
        .where(and(...whereConditions))
        .limit(limit);

      const offers = await query;
      const results = [];

      for (const offer of offers) {
        const taskId = `affiliate_${offer.id}`;
        
        const result = await this.executeTask(
          taskId,
          () => this.processOfferAffiliateLink(offer),
          {
            jobType: 'affiliate_generation',
            targetData: JSON.stringify({ offerId: offer.id, retailerId: offer.retailerId })
          }
        );

        results.push({
          offerId: offer.id,
          success: result.success,
          affiliateUrl: result.data?.affiliateUrl,
          error: result.error
        });
      }

      return {
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };

    } catch (error) {
      console.error('Affiliate link generation failed:', error);
      throw error;
    }
  }

  /**
   * Process affiliate link for a single offer
   */
  private async processOfferAffiliateLink(offer: ProductOffer): Promise<any> {
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
        originalUrl: offer.productUrl
      };
    }

    throw new Error(linkResult.error || 'Failed to generate affiliate link');
  }

  /**
   * Health check existing affiliate links
   */
  private async healthCheckLinks(params: LinkHealthCheckTask): Promise<any> {
    try {
      if (params.offerId) {
        return await this.healthCheckSingleOffer(params.offerId);
      }

      if (params.retailerId) {
        return await affiliateLinkService.healthCheckRetailerLinks(params.retailerId);
      }

      // Health check all links older than 24 hours
      const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const staleOffers = await db.select()
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
          
          const result = await this.executeTask(
            taskId,
            () => this.checkOfferLinkHealth(offer),
            {
              jobType: 'link_health_check',
              targetData: JSON.stringify({ offerId: offer.id })
            }
          );

          if (result.success && result.data?.isHealthy) {
            healthy++;
          } else {
            broken++;
          }
        }
      }

      return {
        total: staleOffers.length,
        healthy,
        broken
      };

    } catch (error) {
      console.error('Link health check failed:', error);
      throw error;
    }
  }

  /**
   * Health check a single offer's affiliate link
   */
  private async healthCheckSingleOffer(offerId: number): Promise<any> {
    const [offer] = await db.select()
      .from(productOffers)
      .where(eq(productOffers.id, offerId))
      .limit(1);

    if (!offer || !offer.affiliateUrl) {
      throw new Error(`No affiliate link found for offer ${offerId}`);
    }

    const isHealthy = await affiliateLinkService.validateAffiliateLink(offer.affiliateUrl);
    
    await affiliateLinkService.updateOfferWithAffiliateLink(
      offerId,
      offer.affiliateUrl,
      isHealthy
    );

    return { isHealthy, affiliateUrl: offer.affiliateUrl };
  }

  /**
   * Check health of a single offer's link
   */
  private async checkOfferLinkHealth(offer: ProductOffer): Promise<any> {
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
  private async updateSingleOffer(params: AffiliateLinkTask): Promise<any> {
    const { offerId, retailerId, productUrl, forceRegenerate } = params;

    const [offer] = await db.select()
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
        affiliateUrl: offer.affiliateUrl 
      };
    }

    return await this.processOfferAffiliateLink(offer);
  }

  /**
   * Batch process all offers for a retailer
   */
  private async batchProcessRetailer(params: { retailerId: number }): Promise<any> {
    const { retailerId } = params;

    // Verify retailer has affiliate configuration
    const [retailer] = await db.select()
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
    return await this.generateAffiliateLinks({ retailerId, limit: 1000 });
  }

  /**
   * Schedule periodic affiliate link maintenance
   */
  async scheduleMaintenance(): Promise<void> {
    // Health check links every 6 hours
    setInterval(async () => {
      try {
        await this.processTask({ action: 'health_check_links' });
      } catch (error) {
        console.error('Scheduled health check failed:', error);
      }
    }, 6 * 60 * 60 * 1000);

    // Generate missing affiliate links every hour
    setInterval(async () => {
      try {
        await this.processTask({ action: 'generate_affiliate_links', limit: 25 });
      } catch (error) {
        console.error('Scheduled affiliate generation failed:', error);
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Get affiliate link agent statistics
   */
  async getStats(): Promise<any> {
    try {
      const stats = await affiliateLinkService.getAffiliateLinkStats();
      const agentStats = this.getStatus();

      return {
        agent: agentStats,
        links: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get affiliate agent stats:', error);
      return null;
    }
  }
}