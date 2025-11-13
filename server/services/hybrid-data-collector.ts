import { Product, ProductOffer, Retailer } from "../../shared/schema";

export interface DataSourceStrategy {
  retailer: string;
  primarySource: 'api' | 'scraping';
  apiService?: RetailerAPIService;
  scrapingConfig?: ScrapingConfig;
  fallbackEnabled: boolean;
  rateLimits: RateLimit;
  costPerRequest: number;
  monthlyLimit?: number;
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerDay: number;
  requestsPerMonth?: number;
  currentMinute: number;
  currentDay: number;
  currentMonth: number;
  resetTimes: {
    minute: Date;
    day: Date;
    month: Date;
  };
}

export interface ScrapingConfig {
  baseUrl: string;
  searchPath: string;
  productSelectors: Record<string, string>;
  antiDetection: {
    userAgents: string[];
    delays: { min: number; max: number };
    proxyRotation: boolean;
  };
}

export interface APIHealthStatus {
  retailer: string;
  endpoint: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorRate: number;
  lastCheck: Date;
  consecutiveFailures: number;
}

export interface UnifiedProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: {
    current: number;
    original?: number;
    currency: string;
  };
  availability: 'in_stock' | 'out_of_stock' | 'limited';
  images: string[];
  description: string;
  specifications: Record<string, unknown>;
  retailer: {
    name: string;
    productUrl: string;
    affiliateUrl?: string;
  };
  metadata: {
    source: 'api' | 'scraping';
    lastUpdated: Date;
    confidence: number; // 0-1 quality score
    apiCost?: number;
  };
}

export abstract class RetailerAPIService {
  abstract searchProducts(query: string, options?: Record<string, unknown>): Promise<UnifiedProduct[]>;
  abstract getProductDetails(productId: string): Promise<UnifiedProduct>;
  abstract checkHealth(): Promise<boolean>;
  abstract getRateLimit(): RateLimit;
  abstract getCostPerRequest(): number;
}

export class AmazonAPIService extends RetailerAPIService {
  private config: {
    accessKey: string;
    secretKey: string;
    partnerTag: string;
    region: string;
    marketplace: string;
  };

  constructor(config: {
    accessKey: string;
    secretKey: string;
    partnerTag: string;
    region: string;
    marketplace: string;
  }) {
    super();
    this.config = config;
  }

  async searchProducts(query: string, options?: Record<string, unknown>): Promise<UnifiedProduct[]> {
    try {
      // Amazon PA-API 5.0 implementation
      const searchRequest = {
        Keywords: query,
        Resources: [
          'Images.Primary.Large',
          'ItemInfo.Title',
          'ItemInfo.Features',
          'Offers.Listings.Price'
        ],
        PartnerTag: this.config.partnerTag,
        PartnerType: 'Associates',
        Marketplace: this.config.marketplace
      };

      // Make API call (implementation depends on AWS SDK)
      const response = await this.makeAPICall('SearchItems', searchRequest);
      
      return response.SearchResult?.Items?.map((item: unknown) => {
        const amazonItem = item as Record<string, any>;
        return {
          id: amazonItem.ASIN,
          name: amazonItem.ItemInfo?.Title?.DisplayValue || '',
          brand: amazonItem.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || '',
          category: amazonItem.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName || '',
          price: {
            current: parseFloat(amazonItem.Offers?.Listings?.[0]?.Price?.Amount || '0'),
            currency: amazonItem.Offers?.Listings?.[0]?.Price?.Currency || 'USD'
          },
          availability: amazonItem.Offers?.Listings?.[0]?.Availability?.Type === 'Now' ? 'in_stock' : 'out_of_stock',
          images: [amazonItem.Images?.Primary?.Large?.URL].filter(Boolean),
          description: amazonItem.ItemInfo?.Features?.DisplayValues?.join('. ') || '',
          specifications: {},
          retailer: {
            name: 'Amazon',
            productUrl: amazonItem.DetailPageURL,
            affiliateUrl: amazonItem.DetailPageURL // Already includes affiliate tag
          },
          metadata: {
            source: 'api' as const,
            lastUpdated: new Date(),
            confidence: 0.95,
            apiCost: this.getCostPerRequest()
          }
        };
      }) || [];
    } catch (error) {
      console.error('Amazon API error:', error);
      throw error;
    }
  }

  async getProductDetails(asin: string): Promise<UnifiedProduct> {
    // Similar implementation for GetItems operation
    const response = await this.makeAPICall('GetItems', {
      ItemIds: [asin],
      Resources: ['ItemInfo.Title', 'ItemInfo.Features', 'Offers.Listings.Price'],
      PartnerTag: this.config.partnerTag,
      PartnerType: 'Associates',
      Marketplace: this.config.marketplace
    });

    const item = response.ItemsResult?.Items?.[0];
    if (!item) throw new Error('Product not found');

    return {
      id: item.ASIN,
      name: item.ItemInfo?.Title?.DisplayValue || '',
      // ... rest of mapping
    } as UnifiedProduct;
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.makeAPICall('SearchItems', {
        Keywords: 'test',
        Resources: ['ItemInfo.Title'],
        PartnerTag: this.config.partnerTag,
        PartnerType: 'Associates',
        Marketplace: this.config.marketplace
      });
      return true;
    } catch {
      return false;
    }
  }

  getRateLimit(): RateLimit {
    return {
      requestsPerMinute: 1,
      requestsPerDay: 8640,
      currentMinute: 0,
      currentDay: 0,
      currentMonth: 0,
      resetTimes: {
        minute: new Date(),
        day: new Date(),
        month: new Date()
      }
    };
  }

  getCostPerRequest(): number {
    return 0.0; // Free tier, but requires sales to maintain access
  }

  private async makeAPICall(operation: string, payload: Record<string, unknown>): Promise<Record<string, any>> {
    // AWS signature v4 implementation for PA-API calls
    // This would use the actual AWS SDK or manual signing
    throw new Error('AWS PA-API implementation required');
  }
}

export class WalmartAPIService extends RetailerAPIService {
  private apiKey: string;
  private affiliateId?: string;

  constructor(config: { apiKey: string; affiliateId?: string }) {
    super();
    this.apiKey = config.apiKey;
    this.affiliateId = config.affiliateId;
  }

  async searchProducts(query: string): Promise<UnifiedProduct[]> {
    try {
      const url = `https://api.walmart.com/v1/search?apikey=${this.apiKey}&query=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const data = await response.json();

      return data.items?.map((item: unknown) => {
        const walmartItem = item as Record<string, any>;
        return {
          id: walmartItem.itemId.toString(),
          name: walmartItem.name,
          brand: walmartItem.brand || '',
          category: walmartItem.categoryPath || '',
          price: {
            current: walmartItem.salePrice || walmartItem.msrp,
            original: walmartItem.msrp,
            currency: 'USD'
          },
          availability: walmartItem.availableOnline ? 'in_stock' : 'out_of_stock',
          images: [walmartItem.largeImage].filter(Boolean),
          description: walmartItem.shortDescription || '',
          specifications: {},
          retailer: {
            name: 'Walmart',
            productUrl: walmartItem.productUrl,
            affiliateUrl: this.affiliateId ? `${walmartItem.productUrl}?affp1=${this.affiliateId}` : walmartItem.productUrl
          },
          metadata: {
            source: 'api' as const,
            lastUpdated: new Date(),
            confidence: 0.92,
            apiCost: this.getCostPerRequest()
          }
        };
      }) || [];
    } catch (error) {
      console.error('Walmart API error:', error);
      throw error;
    }
  }

  async getProductDetails(itemId: string): Promise<UnifiedProduct> {
    const url = `https://api.walmart.com/v1/items/${itemId}?apikey=${this.apiKey}`;
    const response = await fetch(url);
    const item = await response.json();

    return {
      id: item.itemId.toString(),
      name: item.name,
      // ... rest of mapping
    } as UnifiedProduct;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`https://api.walmart.com/v1/search?apikey=${this.apiKey}&query=test`);
      return response.ok;
    } catch {
      return false;
    }
  }

  getRateLimit(): RateLimit {
    return {
      requestsPerMinute: 100,
      requestsPerDay: 5000,
      currentMinute: 0,
      currentDay: 0,
      currentMonth: 0,
      resetTimes: {
        minute: new Date(),
        day: new Date(),
        month: new Date()
      }
    };
  }

  getCostPerRequest(): number {
    return 0.0; // Free tier
  }
}

export class HybridDataCollector {
  private strategies: Map<string, DataSourceStrategy> = new Map();
  private healthStatus: Map<string, APIHealthStatus> = new Map();
  private rateLimitTracker: Map<string, RateLimit> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies() {
    // Amazon - API First
    this.strategies.set('amazon', {
      retailer: 'amazon',
      primarySource: 'api',
      apiService: new AmazonAPIService({
        accessKey: process.env.AMAZON_ACCESS_KEY || '',
        secretKey: process.env.AMAZON_SECRET_KEY || '',
        partnerTag: process.env.AMAZON_PARTNER_TAG || '',
        region: 'us-east-1',
        marketplace: 'www.amazon.com'
      }),
      fallbackEnabled: true,
      rateLimits: {
        requestsPerMinute: 1,
        requestsPerDay: 8640,
        currentMinute: 0,
        currentDay: 0,
        currentMonth: 0,
        resetTimes: { minute: new Date(), day: new Date(), month: new Date() }
      },
      costPerRequest: 0.0
    });

    // Walmart - API First
    this.strategies.set('walmart', {
      retailer: 'walmart',
      primarySource: 'api',
      apiService: new WalmartAPIService({
        apiKey: process.env.WALMART_API_KEY || '',
        affiliateId: process.env.WALMART_AFFILIATE_ID
      }),
      fallbackEnabled: true,
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerDay: 5000,
        currentMinute: 0,
        currentDay: 0,
        currentMonth: 0,
        resetTimes: { minute: new Date(), day: new Date(), month: new Date() }
      },
      costPerRequest: 0.0
    });

    // Target - Scraping Only (no public API)
    this.strategies.set('target', {
      retailer: 'target',
      primarySource: 'scraping',
      scrapingConfig: {
        baseUrl: 'https://www.target.com',
        searchPath: '/s',
        productSelectors: {
          name: '[data-test="product-title"]',
          price: '[data-test="product-price"]',
          image: '[data-test="product-image"] img'
        },
        antiDetection: {
          userAgents: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'],
          delays: { min: 1000, max: 3000 },
          proxyRotation: false
        }
      },
      fallbackEnabled: false,
      rateLimits: {
        requestsPerMinute: 10,
        requestsPerDay: 1000,
        currentMinute: 0,
        currentDay: 0,
        currentMonth: 0,
        resetTimes: { minute: new Date(), day: new Date(), month: new Date() }
      },
      costPerRequest: 0.0
    });
  }

  async collectProductData(retailer: string, query: string): Promise<UnifiedProduct[]> {
    const strategy = this.strategies.get(retailer.toLowerCase());
    if (!strategy) {
      throw new Error(`No data collection strategy for retailer: ${retailer}`);
    }

    // Check rate limits
    if (!await this.checkRateLimit(retailer)) {
      throw new Error(`Rate limit exceeded for ${retailer}`);
    }

    try {
      if (strategy.primarySource === 'api' && strategy.apiService) {
        // Check API health before making request
        const isHealthy = await this.checkAPIHealth(retailer);
        if (!isHealthy && !strategy.fallbackEnabled) {
          throw new Error(`API is unhealthy for ${retailer} and fallback is disabled`);
        }

        if (isHealthy) {
          const products = await strategy.apiService.searchProducts(query);
          this.updateRateLimit(retailer, products.length);
          return products;
        }
      }

      // Fallback to scraping or primary scraping
      if (strategy.fallbackEnabled || strategy.primarySource === 'scraping') {
        console.log(`Using scraping for ${retailer}${strategy.primarySource === 'api' ? ' (API fallback)' : ''}`);
        return await this.scrapeRetailer(retailer, query, strategy.scrapingConfig);
      }

      throw new Error(`No available data source for ${retailer}`);
    } catch (error) {
      console.error(`Data collection failed for ${retailer}:`, error);
      throw error;
    }
  }

  private async checkAPIHealth(retailer: string): Promise<boolean> {
    const strategy = this.strategies.get(retailer);
    if (!strategy?.apiService) return false;

    try {
      const isHealthy = await strategy.apiService.checkHealth();
      this.updateHealthStatus(retailer, isHealthy);
      return isHealthy;
    } catch (error) {
      this.updateHealthStatus(retailer, false);
      return false;
    }
  }

  private async checkRateLimit(retailer: string): Promise<boolean> {
    const strategy = this.strategies.get(retailer);
    if (!strategy) return false;

    const now = new Date();
    const limits = strategy.rateLimits;

    // Reset counters if time periods have passed
    if (now >= limits.resetTimes.minute) {
      limits.currentMinute = 0;
      limits.resetTimes.minute = new Date(now.getTime() + 60000);
    }
    if (now >= limits.resetTimes.day) {
      limits.currentDay = 0;
      limits.resetTimes.day = new Date(now.getTime() + 86400000);
    }

    // Check limits
    return limits.currentMinute < limits.requestsPerMinute && 
           limits.currentDay < limits.requestsPerDay;
  }

  private updateRateLimit(retailer: string, requestCount: number = 1) {
    const strategy = this.strategies.get(retailer);
    if (strategy) {
      strategy.rateLimits.currentMinute += requestCount;
      strategy.rateLimits.currentDay += requestCount;
    }
  }

  private updateHealthStatus(retailer: string, isHealthy: boolean) {
    const current = this.healthStatus.get(retailer) || {
      retailer,
      endpoint: '',
      status: 'healthy' as const,
      responseTime: 0,
      errorRate: 0,
      lastCheck: new Date(),
      consecutiveFailures: 0
    };

    current.lastCheck = new Date();
    if (isHealthy) {
      current.status = 'healthy';
      current.consecutiveFailures = 0;
    } else {
      current.consecutiveFailures += 1;
      current.status = current.consecutiveFailures > 3 ? 'down' : 'degraded';
    }

    this.healthStatus.set(retailer, current);
  }

  private async scrapeRetailer(retailer: string, query: string, config?: ScrapingConfig): Promise<UnifiedProduct[]> {
    // This would integrate with your existing scraping infrastructure
    // For now, return empty array as placeholder
    console.log(`Scraping ${retailer} for query: ${query}`);
    return [];
  }

  async getSystemStatus(): Promise<{
    strategies: Record<string, DataSourceStrategy>;
    healthStatus: Record<string, APIHealthStatus>;
    rateLimits: Record<string, RateLimit>;
  }> {
    return {
      strategies: Object.fromEntries(this.strategies),
      healthStatus: Object.fromEntries(this.healthStatus),
      rateLimits: Object.fromEntries(this.rateLimitTracker)
    };
  }

  async getRetailerCapabilities(): Promise<Array<{
    retailer: string;
    hasAPI: boolean;
    canScrape: boolean;
    primarySource: string;
    apiHealth: string;
    rateLimit: RateLimit;
  }>> {
    return Array.from(this.strategies.entries()).map(([retailer, strategy]) => ({
      retailer,
      hasAPI: !!strategy.apiService,
      canScrape: !!strategy.scrapingConfig,
      primarySource: strategy.primarySource,
      apiHealth: this.healthStatus.get(retailer)?.status || 'unknown',
      rateLimit: strategy.rateLimits
    }));
  }
}

export const hybridDataCollector = new HybridDataCollector();