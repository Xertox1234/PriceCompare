import { db } from '../db.js';
import { retailers, productOffers } from '../../shared/schema.js';
import { eq, sql, count } from 'drizzle-orm';
import type { Retailer } from '../../shared/schema.js';

interface AffiliateConfig {
  [key: string]: string | number | boolean | null | undefined;
}

interface LinkGenerationResult {
  success: boolean;
  affiliateUrl?: string;
  originalUrl: string;
  error?: string;
}

interface RetailerPatterns {
  [key: string]: RegExp;
}

export class AffiliateLinkService {
  private retailerPatterns: RetailerPatterns = {
    amazon: /amazon\.com\/(?:dp\/|gp\/product\/)([A-Z0-9]{10})/,
    walmart: /walmart\.com\/ip\/.*\/(\d+)/,
    target: /target\.com\/p\/.*\/-\/A-(\d+)/,
    bestbuy: /bestbuy\.com\/site\/.*\/(\d+)\.p/,
    'b&h photo': /bhphotovideo\.com\/.*\/product\/(\d+)/,
    'apple store': /apple\.com\/.*\/([A-Z0-9]+)/
  };

  private retailerCache: Map<number, Retailer> = new Map();

  /**
   * Generate affiliate link from product URL
   */
  async generateAffiliateLink(
    retailerId: number,
    productUrl: string,
    metadata?: Record<string, unknown>
  ): Promise<LinkGenerationResult> {
    try {
      const retailer = await this.getRetailerConfig(retailerId);
      
      if (!retailer || retailer.affiliateStatus !== 'active') {
        return {
          success: false,
          originalUrl: productUrl,
          error: 'Retailer affiliate program not active'
        };
      }

      const affiliateUrl = await this.transformUrl(retailer, productUrl, metadata);
      
      if (affiliateUrl) {
        return {
          success: true,
          affiliateUrl,
          originalUrl: productUrl
        };
      }

      // Fallback to UTM tracking
      const utmUrl = this.addUTMTracking(productUrl, retailer.name);
      return {
        success: true,
        affiliateUrl: utmUrl,
        originalUrl: productUrl
      };

    } catch (error) {
      console.error('Affiliate link generation failed:', error);
      return {
        success: false,
        originalUrl: productUrl,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Transform URL based on retailer's affiliate program
   */
  private async transformUrl(
    retailer: Retailer,
    productUrl: string,
    metadata?: Record<string, unknown>
  ): Promise<string | null> {
    const config = this.parseAffiliateConfig(retailer.affiliateConfig);
    const productId = this.extractProductId(retailer.name.toLowerCase(), productUrl);

    switch (retailer.affiliateProgram) {
      case 'amazon_associates':
        return this.generateAmazonLink(productUrl, config, productId);
      
      case 'walmart_connect':
        return this.generateWalmartLink(productUrl, config, productId);
      
      case 'target_partners':
        return this.generateTargetLink(productUrl, config);
      
      case 'bestbuy_affiliate':
        return this.generateBestBuyLink(productUrl, config);
      
      case 'generic_utm':
        return this.addUTMTracking(productUrl, retailer.name, config);
      
      default:
        return null;
    }
  }

  /**
   * Generate Amazon Associates link
   */
  private generateAmazonLink(url: string, config: AffiliateConfig, asin?: string): string {
    if (!config.tag) return url;

    if (asin) {
      return `https://amazon.com/dp/${asin}?tag=${config.tag}&linkCode=as2`;
    }

    // Add tag to existing URL
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tag=${config.tag}&linkCode=as2`;
  }

  /**
   * Generate Walmart Connect link
   */
  private generateWalmartLink(url: string, config: AffiliateConfig, itemId?: string): string {
    if (!config.publisherId) return url;

    if (itemId) {
      return `https://goto.walmart.com/c/${config.publisherId}/${itemId}`;
    }

    // Fallback to URL encoding
    const encodedUrl = encodeURIComponent(url);
    return `https://goto.walmart.com/c/${config.publisherId}?u=${encodedUrl}`;
  }

  /**
   * Generate Target Partners link
   */
  private generateTargetLink(url: string, config: AffiliateConfig): string {
    if (!config.campaignId) return url;

    const encodedUrl = encodeURIComponent(url);
    return `https://goto.target.com/c/${config.campaignId}?u=${encodedUrl}`;
  }

  /**
   * Generate Best Buy affiliate link
   */
  private generateBestBuyLink(url: string, config: AffiliateConfig): string {
    if (!config.offerId) return url;

    const encodedUrl = encodeURIComponent(url);
    return `https://bestbuy.7tiv.net/c/${config.offerId}?u=${encodedUrl}`;
  }

  /**
   * Add UTM tracking parameters
   */
  private addUTMTracking(
    url: string, 
    retailerName: string, 
    config?: AffiliateConfig
  ): string {
    const separator = url.includes('?') ? '&' : '?';
    const source = config?.source || 'pricecompare';
    const campaign = config?.campaign || 'product';
    const medium = config?.medium || 'affiliate';
    
    return `${url}${separator}utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}&utm_content=${retailerName.toLowerCase()}`;
  }

  /**
   * Extract product ID from URL
   */
  private extractProductId(retailerName: string, url: string): string | undefined {
    const pattern = this.retailerPatterns[retailerName];
    if (!pattern) return undefined;

    const match = url.match(pattern);
    return match ? match[1] : undefined;
  }

  /**
   * Get retailer configuration with caching
   */
  private async getRetailerConfig(retailerId: number): Promise<Retailer | null> {
    if (this.retailerCache.has(retailerId)) {
      return this.retailerCache.get(retailerId)!;
    }

    try {
      const [retailer] = await db.select()
        .from(retailers)
        .where(eq(retailers.id, retailerId))
        .limit(1);

      if (retailer) {
        this.retailerCache.set(retailerId, retailer);
        return retailer;
      }

      return null;
    } catch (error) {
      console.error('Failed to get retailer config:', error);
      return null;
    }
  }

  /**
   * Parse affiliate configuration JSON
   */
  private parseAffiliateConfig(configString?: string | null): AffiliateConfig {
    if (!configString) return {};

    try {
      return JSON.parse(configString);
    } catch (error) {
      console.error('Failed to parse affiliate config:', error);
      return {};
    }
  }

  /**
   * Validate affiliate link functionality
   */
  async validateAffiliateLink(affiliateUrl: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(affiliateUrl, { 
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Link validation failed:', error);
      return false;
    }
  }

  /**
   * Update product offer with affiliate URL
   */
  async updateOfferWithAffiliateLink(
    offerId: number, 
    affiliateUrl: string, 
    isHealthy: boolean = true
  ): Promise<void> {
    try {
      await db.update(productOffers)
        .set({
          affiliateUrl,
          linkHealthStatus: isHealthy ? 'healthy' : 'broken',
          lastLinkCheck: new Date()
        })
        .where(eq(productOffers.id, offerId));
    } catch (error) {
      console.error('Failed to update offer with affiliate link:', error);
    }
  }

  /**
   * Track affiliate link click
   */
  async trackLinkClick(offerId: number): Promise<void> {
    try {
      const [offer] = await db.select()
        .from(productOffers)
        .where(eq(productOffers.id, offerId))
        .limit(1);

      if (offer) {
        await db.update(productOffers)
          .set({
            clickCount: (offer.clickCount || 0) + 1
          })
          .where(eq(productOffers.id, offerId));
      }
    } catch (error) {
      console.error('Failed to track link click:', error);
    }
  }

  /**
   * Health check all affiliate links for a retailer
   */
  async healthCheckRetailerLinks(retailerId: number): Promise<{
    total: number;
    healthy: number;
    broken: number;
  }> {
    try {
      const offers = await db.select()
        .from(productOffers)
        .where(eq(productOffers.retailerId, retailerId));

      let healthy = 0;
      let broken = 0;

      for (const offer of offers) {
        if (offer.affiliateUrl) {
          const isHealthy = await this.validateAffiliateLink(offer.affiliateUrl);
          
          await this.updateOfferWithAffiliateLink(offer.id, offer.affiliateUrl, isHealthy);
          
          if (isHealthy) {
            healthy++;
          } else {
            broken++;
          }
        }
      }

      return {
        total: offers.length,
        healthy,
        broken
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return { total: 0, healthy: 0, broken: 0 };
    }
  }

  /**
   * Clear retailer cache
   */
  clearCache(): void {
    this.retailerCache.clear();
  }

  /**
   * Get affiliate link statistics
   */
  async getAffiliateLinkStats(retailerId?: number): Promise<{
    total_offers: number;
    affiliate_offers: number;
    total_clicks: number;
    healthy_links: number;
    broken_links: number;
  } | null> {
    try {
      // Use Drizzle ORM for safe query building
      const baseQuery = db
        .select({
          total_offers: count(),
          affiliate_offers: sql<number>`COUNT(${productOffers.affiliateUrl})`,
          total_clicks: sql<number>`COALESCE(SUM(${productOffers.clickCount}), 0)`,
          healthy_links: sql<number>`COUNT(CASE WHEN ${productOffers.linkHealthStatus} = 'healthy' THEN 1 END)`,
          broken_links: sql<number>`COUNT(CASE WHEN ${productOffers.linkHealthStatus} = 'broken' THEN 1 END)`,
        })
        .from(productOffers);

      const result = retailerId
        ? await baseQuery.where(eq(productOffers.retailerId, retailerId))
        : await baseQuery;

      return result[0] || {
        total_offers: 0,
        affiliate_offers: 0,
        total_clicks: 0,
        healthy_links: 0,
        broken_links: 0
      };
    } catch (error) {
      console.error('Failed to get affiliate link stats:', error);
      return null;
    }
  }
}

export const affiliateLinkService = new AffiliateLinkService();