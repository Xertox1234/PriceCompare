import { BaseAgent, AgentConfig } from './base-agent';
import { storage } from '../storage';
import type { InsertSearchQuery } from '../../shared/schema';
import type { SearchTaskData, SearchResult } from './types';
import OpenAI from 'openai';
import { googleSearchService } from '../services/google-search';
import type { GoogleSearchResult } from '../services/google-search';
import { logger } from '../utils/logger';
import { safeSearchQueries, type AISearchQueries } from './ai-validation-schemas';
import { queryCache } from '../services/advanced-cache';
import { agentQueryLimiter } from '../services/agent-query-limiter';

// Local retailer config interface that matches the Map usage
interface RetailerConfig {
  name: string;
  searchUrl: string;
  selectors: {
    productLinks: string;
    prices: string;
    titles: string;
  };
}

export class SearchOrchestrationAgent extends BaseAgent {
  private openai: OpenAI | null = null;
  private isAIEnabled = false;
  private retailers: Map<string, RetailerConfig>;
  private queryGenerationCache: Map<string, string[]>;

  constructor() {
    const config: AgentConfig = {
      name: 'Search Orchestration Agent',
      type: 'search',
      maxConcurrentTasks: 5,
      retryAttempts: 2,
      retryDelay: 1500,
    };

    super(config);

    // Only initialize OpenAI if API key is available (graceful degradation)
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.isAIEnabled = true;
    } else {
      logger.warn('OpenAI API key not configured - AI search query generation disabled');
    }

    this.queryGenerationCache = new Map();

    this.retailers = new Map([
      [
        'amazon',
        {
          name: 'Amazon',
          searchUrl: 'https://www.amazon.com/s?k=',
          selectors: {
            productLinks: '[data-component-type="s-search-result"] h2 a',
            prices: '.a-price-whole',
            titles: '[data-component-type="s-search-result"] h2 span',
          },
        },
      ],
      [
        'walmart',
        {
          name: 'Walmart',
          searchUrl: 'https://www.walmart.com/search?q=',
          selectors: {
            productLinks: '[data-testid="product-title"] a',
            prices: '[data-automation-id="product-price"]',
            titles: '[data-testid="product-title"]',
          },
        },
      ],
      [
        'target',
        {
          name: 'Target',
          searchUrl: 'https://www.target.com/s?searchTerm=',
          selectors: {
            productLinks: '[data-test="product-title"] a',
            prices: '[data-test="product-price"]',
            titles: '[data-test="product-title"]',
          },
        },
      ],
    ]);
  }

  async processTask(taskData: SearchTaskData): Promise<SearchResult[]> {
    const taskId = `search_${Date.now()}`;

    const result = await this.executeTask(taskId, () => this.orchestrateSearch(taskData), {
      jobType: 'search',
      targetData: JSON.stringify(taskData),
    });

    if (result.success) {
      return result.data as SearchResult[];
    } else {
      throw new Error(result.error || 'Search orchestration failed');
    }
  }

  private async orchestrateSearch(taskData: SearchTaskData): Promise<SearchResult[]> {
    // Generate optimized search queries using AI
    const searchQueries = await this.generateSearchQueries(taskData.productName, taskData.category);

    // Execute searches across all specified retailers
    const searchResults: SearchResult[] = [];

    for (const retailer of taskData.retailers) {
      const retailerConfig = this.retailers.get(retailer);
      if (!retailerConfig) {
        logger.warn(`Unknown retailer: ${retailer}`);
        continue;
      }

      for (const query of searchQueries) {
        try {
          const results = await this.searchRetailer(query, retailer, retailerConfig);
          searchResults.push(...results);

          // Store successful query for future optimization
          await this.storeSearchQuery({
            trendingProductId: taskData.trendingProductId,
            queryText: query,
            retailer,
            queryType: 'product_search',
            avgResults: results.length,
          });
        } catch (error) {
          logger.error(`Search failed for ${retailer} with query "${query}"`, {
            error: error instanceof Error ? error.message : String(error),
            retailer,
            query,
          });
        }
      }
    }

    // Rank and deduplicate results
    return this.rankSearchResults(searchResults);
  }

  /**
   * Generate basic search queries without AI (fallback when OpenAI unavailable)
   */
  private generateBasicQueries(productName: string, category?: string): string[] {
    const queries = [
      productName,
      `${productName} price`,
      `buy ${productName}`,
    ];

    // Add category-specific query if available
    if (category) {
      queries.push(`${productName} ${category}`);
    }

    // Add common variations
    const words = productName.split(' ');
    if (words.length > 1) {
      // Add first word (likely brand) + "products"
      queries.push(`${words[0]} products`);
    }

    return queries.slice(0, 5); // Limit to 5 queries
  }

  private async generateSearchQueries(productName: string, category?: string): Promise<string[]> {
    // Check Redis cache first (7 day TTL)
    const cacheKey = `${productName}:${category || 'none'}`;
    const cached = await queryCache.get<string[]>(cacheKey);

    if (cached) {
      logger.debug('Query cache hit', { productName, category });
      return cached;
    }

    // If AI is not enabled, use basic query generation
    if (!this.isAIEnabled || !this.openai) {
      logger.debug('AI disabled, using basic query generation', { productName, category });
      return this.generateBasicQueries(productName, category);
    }

    logger.debug('Query cache miss, generating with AI', { productName, category });

    try {
      const prompt = `
        Generate 3-5 optimized search queries for finding "${productName}" on e-commerce websites.
        ${category ? `Product Category: ${category}` : ''}

        TARGET RETAILERS: Amazon, Walmart, Target

        OBJECTIVE: Create search queries that maximize product discovery while maintaining high precision.

        QUERY VARIATIONS TO INCLUDE:
        1. Exact brand + model (if applicable): "Apple iPhone 15 Pro"
        2. Generic category search: "smartphone flagship unlocked"
        3. Feature-based search: "phone 5G camera 256GB"
        4. Price-conscious search: "best value [product] 2024"

        OPTIMIZATION RULES:
        - Include brand name variations (e.g., "Instant Pot" vs "instant pressure cooker")
        - Add common specifications (size, capacity, model numbers)
        - Use terms that appear in product titles (not marketing speak)
        - Include both formal and colloquial terms
        - Consider seasonal variants if relevant
        - Avoid overly specific queries that yield zero results
        - Prioritize queries that return 10-100 results (not too broad, not too narrow)

        OUTPUT FORMAT:
        Return ONLY the search queries, one per line.
        No numbering, no bullet points, no explanations.
        Each query should be 2-8 words.

        EXAMPLE INPUT: "Sony WH-1000XM5 Headphones"
        EXAMPLE OUTPUT:
        Sony WH-1000XM5
        Sony wireless noise cancelling headphones
        WH1000XM5 bluetooth headphones
        Sony premium over ear headphones
        noise cancelling headphones wireless
      `;

      // Check daily query limit before making OpenAI call
      const limitResult = await agentQueryLimiter.checkAndIncrement('openai_completion');
      if (!limitResult.allowed) {
        throw new Error(`Daily agent query limit exceeded. ${limitResult.reason}`);
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert e-commerce search optimization specialist with deep knowledge of product discovery patterns across major retailers (Amazon, Walmart, Target).

EXPERTISE:
- Understanding of retailer-specific search algorithms and ranking factors
- Knowledge of how customers search for products (both expert and novice behaviors)
- Expertise in query expansion, semantic matching, and search intent analysis
- Understanding of product taxonomy and category-specific terminology

METHODOLOGY:
1. Analyze the product name for brand, model, category, and features
2. Generate queries that balance specificity (precision) with discoverability (recall)
3. Consider multiple search intents: brand-focused, feature-focused, price-focused
4. Use terminology that matches actual product listings (scrape-friendly terms)
5. Avoid ambiguous terms that could match unrelated products

QUALITY CRITERIA:
- Each query should be actionable and likely to return relevant results
- Queries should be diverse (don't repeat the same pattern 5 times)
- Prioritize queries that work across multiple retailers
- Use common misspellings only if they're widespread

OUTPUT CONSTRAINTS:
- Return EXACTLY 3-5 queries (prefer 5 when possible)
- One query per line, no formatting
- Each query: 2-8 words
- Use natural search syntax (how humans actually search)
- No quotes, no special operators, no Boolean logic`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const rawResponse = response.choices[0].message.content || '';
      const queries = rawResponse
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

      // Validate queries with Zod schema
      let validatedQueries: AISearchQueries;
      try {
        const validationResult = safeSearchQueries(queries);

        if (!validationResult.success) {
          logger.error('Search query validation failed', {
            errors: validationResult.error.issues,
            rawQueries: queries,
            productName,
          });
          throw new Error('Invalid search query format');
        }

        validatedQueries = validationResult.data;
        logger.debug('Search queries validated successfully', {
          queryCount: validatedQueries.length,
          productName,
        });
      } catch (validationError) {
        logger.error('Failed to validate search queries', {
          error:
            validationError instanceof Error ? validationError.message : String(validationError),
          rawResponse: rawResponse.substring(0, 200),
          productName,
        });
        // Fallback to product name
        validatedQueries = [productName];
      }

      // Cache the validated result in Redis (7 day TTL)
      await queryCache.set(cacheKey, validatedQueries, 604800000);

      logger.debug('Query cached in Redis', {
        productName,
        category,
        queryCount: validatedQueries.length,
      });

      return validatedQueries;
    } catch (error) {
      logger.error('AI query generation failed', {
        error: error instanceof Error ? error.message : String(error),
        productName,
      });
      return [productName];
    }
  }

  private async searchRetailer(
    query: string,
    retailerName: string,
    _config: RetailerConfig
  ): Promise<SearchResult[]> {
    try {
      if (!googleSearchService.isConfigured()) {
        throw new Error('Google Custom Search API not configured');
      }

      const retailerDomain = this.getRetailerDomain(retailerName);
      const results = await googleSearchService.searchRetailer(query, retailerDomain, { num: 10 });

      // Convert Google search results to our SearchResult format
      const searchResults = results.map((item: GoogleSearchResult) => ({
        query,
        retailer: retailerName,
        urls: [item.link],
        relevanceScore: this.calculateRelevanceScore(item.title, item.snippet, query),
      }));

      // Filter to only include product URLs
      const productUrls = googleSearchService.extractProductUrls(results);
      return searchResults.filter((result) => productUrls.some((url) => result.urls.includes(url)));
    } catch (error) {
      logger.error(`Google Custom Search failed for ${retailerName}`, {
        error: error instanceof Error ? error.message : String(error),
        retailerName,
        query,
      });
      throw error; // Don't fall back to simulated data
    }
  }

  private simulateSearchResults(query: string, retailerName: string): SearchResult[] {
    // Simulated results for development/testing
    const baseUrls = {
      amazon: 'https://www.amazon.com/dp/',
      walmart: 'https://www.walmart.com/ip/',
      target: 'https://www.target.com/p/',
    };

    const baseUrl = baseUrls[retailerName as keyof typeof baseUrls] || 'https://example.com/';

    return [
      {
        query,
        retailer: retailerName,
        urls: [
          `${baseUrl}${Math.random().toString(36).substr(2, 9)}`,
          `${baseUrl}${Math.random().toString(36).substr(2, 9)}`,
        ],
        relevanceScore: 0.8 + Math.random() * 0.2,
      },
    ];
  }

  private getRetailerDomain(retailerName: string): string {
    const domains = {
      amazon: 'amazon.com',
      walmart: 'walmart.com',
      target: 'target.com',
    };

    return domains[retailerName as keyof typeof domains] || 'example.com';
  }

  private calculateRelevanceScore(title: string, snippet: string, query: string): number {
    const text = `${title} ${snippet}`.toLowerCase();
    const queryWords = query.toLowerCase().split(' ');

    let score = 0;
    const totalWords = queryWords.length;

    for (const word of queryWords) {
      if (text.includes(word)) {
        score += 1;
      }
    }

    return totalWords > 0 ? score / totalWords : 0;
  }

  private rankSearchResults(results: SearchResult[]): SearchResult[] {
    // Remove duplicates and rank by relevance
    const uniqueResults = new Map<string, SearchResult>();

    for (const result of results) {
      for (const url of result.urls) {
        const key = `${result.retailer}_${url}`;
        const existing = uniqueResults.get(key);
        if (!existing || existing.relevanceScore < result.relevanceScore) {
          uniqueResults.set(key, { ...result, urls: [url] });
        }
      }
    }

    return Array.from(uniqueResults.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20); // Limit to top 20 results
  }

  private async storeSearchQuery(queryData: Partial<InsertSearchQuery>): Promise<void> {
    try {
      await storage.createSearchQuery(queryData);
    } catch (error) {
      logger.error('Failed to store search query', {
        error: error instanceof Error ? error.message : String(error),
        queryData,
      });
    }
  }

  async optimizeQueriesForProduct(productName: string): Promise<string[]> {
    try {
      // Get historical queries that performed well for similar products
      const historicalQueries = await storage.getHistoricalSearchQueries(productName, 10);

      // If we have historical data, use it
      if (historicalQueries.length > 0) {
        logger.debug('Using historical queries for optimization', {
          productName,
          count: historicalQueries.length,
        });
        return historicalQueries;
      }

      // Fall back to AI-generated queries if no historical data
      logger.debug('No historical queries found, generating new queries', { productName });
      return this.generateSearchQueries(productName);
    } catch (error) {
      logger.error('Query optimization failed', {
        error: error instanceof Error ? error.message : String(error),
        productName,
      });
      // Fall back to AI-generated queries on error
      return this.generateSearchQueries(productName);
    }
  }
}
