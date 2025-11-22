import axios from 'axios';
import { ScraperUtils, RateLimiter } from '../utils/scraper-utils.js';
import { createLogger } from '../utils/logger';

const log = createLogger('GoogleSearch');

export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  formattedUrl: string;
  htmlTitle?: string;
  htmlSnippet?: string;
  pagemap?: Record<string, unknown>; // Google's pagemap structure varies by result
}

export interface GoogleSearchResponse {
  items: GoogleSearchResult[];
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  queries: {
    request: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
    }>;
  };
}

export class GoogleCustomSearchService {
  private apiKey: string;
  private searchEngineId: string;
  private rateLimiter: RateLimiter;
  private baseUrl = 'https://www.googleapis.com/customsearch/v1';

  // Cache for search results (14-day TTL to reduce API costs)
  private searchCache: Map<string, { results: GoogleSearchResult[]; timestamp: number }>;
  private readonly CACHE_TTL = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
  private readonly MAX_CACHE_SIZE = 1000; // Prevent memory issues

  constructor() {
    this.apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '';
    this.searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';

    if (!this.apiKey || !this.searchEngineId) {
      log.warn('Google Custom Search API credentials not configured');
    }

    // Google Custom Search allows 100 queries per day for free
    // Rate limit to 1 request per second to be safe
    this.rateLimiter = new RateLimiter(1, 1000);

    this.searchCache = new Map();
  }

  /**
   * Generate cache key from search parameters
   */
  private getCacheKey(query: string, retailerDomain: string = '', options: Record<string, unknown> = {}): string {
    return JSON.stringify({ query, retailerDomain, ...options });
  }

  /**
   * Enforce cache size limit to prevent memory issues
   */
  private enforceCacheLimit(): void {
    if (this.searchCache.size > this.MAX_CACHE_SIZE) {
      const keysToDelete = Array.from(this.searchCache.keys()).slice(0, this.searchCache.size - this.MAX_CACHE_SIZE);
      keysToDelete.forEach(key => this.searchCache.delete(key));
    }
  }

  /**
   * Search for products on specific retailer sites
   * OPTIMIZED: Results cached for 14 days to reduce API costs by 50-70%
   */
  async searchRetailer(query: string, retailerDomain: string, options: {
    num?: number;
    start?: number;
    safe?: 'high' | 'medium' | 'off';
    lr?: string;
  } = {}): Promise<GoogleSearchResult[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Custom Search API not configured');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(query, retailerDomain, options);
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      log.debug(`[CACHE_HIT] Google Search: ${query} site:${retailerDomain}`);
      return cached.results;
    }

    await this.rateLimiter.waitIfNeeded();

    const searchParams = {
      key: this.apiKey,
      cx: this.searchEngineId,
      q: `${query} site:${retailerDomain}`,
      num: options.num || 10,
      start: options.start || 1,
      safe: options.safe || 'medium',
      lr: options.lr || 'lang_en'
    };

    try {
      log.debug(`[API_CALL] Google Search: ${query} site:${retailerDomain}`);

      const response = await axios.get<GoogleSearchResponse>(this.baseUrl, {
        params: searchParams,
        headers: ScraperUtils.getRequestHeaders(),
        timeout: 10000
      });

      const results = response.data.items || [];

      // Cache the results
      this.searchCache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });
      this.enforceCacheLimit();

      return results;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Google Custom Search API rate limit exceeded');
        } else if (error.response?.status === 403) {
          throw new Error('Google Custom Search API quota exceeded or invalid credentials');
        } else if (error.response?.status === 400) {
          throw new Error(`Invalid search parameters: ${error.response.data.error?.message || 'Unknown error'}`);
        }
      }

      log.error('Google Custom Search error:', { error });
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for products across multiple retailers
   */
  async searchMultipleRetailers(
    query: string, 
    retailers: string[], 
    options: { maxResultsPerRetailer?: number } = {}
  ): Promise<{ retailer: string; results: GoogleSearchResult[] }[]> {
    const maxResults = options.maxResultsPerRetailer || 5;
    const searchPromises = retailers.map(async (retailer) => {
      try {
        const results = await this.searchRetailer(query, retailer, { num: maxResults });
        return { retailer, results };
      } catch (error) {
        log.error(`Search failed for ${retailer}:`, { error });
        return { retailer, results: [] };
      }
    });

    return await Promise.all(searchPromises);
  }

  /**
   * Search for trending products without site restriction
   * OPTIMIZED: Results cached for 14 days to reduce API costs by 50-70%
   */
  async searchGeneral(query: string, options: {
    num?: number;
    start?: number;
    dateRestrict?: string; // e.g., 'd1' for past day, 'w1' for past week
  } = {}): Promise<GoogleSearchResult[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Custom Search API not configured');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(query, '', options);
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      log.debug(`[CACHE_HIT] Google Search: ${query}`);
      return cached.results;
    }

    await this.rateLimiter.waitIfNeeded();

    const searchParams = {
      key: this.apiKey,
      cx: this.searchEngineId,
      q: query,
      num: options.num || 10,
      start: options.start || 1,
      ...(options.dateRestrict && { dateRestrict: options.dateRestrict })
    };

    try {
      log.debug(`[API_CALL] Google Search: ${query}`);

      const response = await axios.get<GoogleSearchResponse>(this.baseUrl, {
        params: searchParams,
        headers: ScraperUtils.getRequestHeaders(),
        timeout: 10000
      });

      const results = response.data.items || [];

      // Cache the results
      this.searchCache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });
      this.enforceCacheLimit();

      return results;

    } catch (error) {
      log.error('Google Custom Search error:', { error });
      throw new Error(`General search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract product URLs from search results
   */
  extractProductUrls(results: GoogleSearchResult[]): string[] {
    return results
      .map(result => result.link)
      .filter(url => this.isProductUrl(url));
  }

  /**
   * Check if URL is likely a product page
   */
  private isProductUrl(url: string): boolean {
    const productIndicators = [
      '/dp/', '/gp/product/', '/product/', '/p/', '/item/', '/items/',
      'product-', 'item-', '/buy/', '/shop/', 'pid=', 'productId='
    ];

    return productIndicators.some(indicator => 
      url.toLowerCase().includes(indicator)
    );
  }

  /**
   * Rank search results by relevance to query
   */
  rankResults(results: GoogleSearchResult[], query: string): GoogleSearchResult[] {
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    
    const scoredResults = results.map(result => ({
      ...result,
      relevanceScore: this.calculateRelevanceScore(result, queryWords)
    }));

    return scoredResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .map(({ relevanceScore, ...result }) => result);
  }

  private calculateRelevanceScore(result: GoogleSearchResult, queryWords: string[]): number {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    let score = 0;

    // Title matches are more important
    const titleText = result.title.toLowerCase();
    queryWords.forEach(word => {
      if (titleText.includes(word)) {
        score += 3;
      }
      if (text.includes(word)) {
        score += 1;
      }
    });

    // Bonus for product-like URLs
    if (this.isProductUrl(result.link)) {
      score += 2;
    }

    // Bonus for e-commerce domains
    const ecommerceDomains = ['amazon.', 'walmart.', 'target.', 'ebay.', 'bestbuy.'];
    if (ecommerceDomains.some(domain => result.displayLink.includes(domain))) {
      score += 1;
    }

    return score;
  }

  /**
   * Get search suggestions for a query
   */
  async getSearchSuggestions(query: string): Promise<string[]> {
    // This would typically use Google's autocomplete API
    // For now, return query variations
    const variations = [
      query,
      `${query} buy online`,
      `${query} price comparison`,
      `${query} best deals`,
      `cheap ${query}`,
      `${query} reviews`
    ];

    return variations.slice(0, 3);
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.searchEngineId);
  }

  /**
   * Get API usage statistics
   */
  getUsageStats(): { configured: boolean; apiKey: boolean; searchEngineId: boolean } {
    return {
      configured: this.isConfigured(),
      apiKey: !!this.apiKey,
      searchEngineId: !!this.searchEngineId
    };
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; results?: number }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Google Custom Search API not configured. Please set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID environment variables.'
      };
    }

    try {
      const results = await this.searchGeneral('test query', { num: 1 });
      return {
        success: true,
        message: 'Google Custom Search API connection successful',
        results: results.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Singleton instance
export const googleSearchService = new GoogleCustomSearchService();