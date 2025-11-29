/**
 * Advanced Search Service
 *
 * Storage Layer Migration - Phase 6
 * Migrated: 2025-11-24
 *
 * MIGRATION SUMMARY:
 * - Replaced all direct db imports with storage layer abstraction
 * - 7 queries migrated to use storage methods
 * - Preserved all OpenAI API integration and caching logic
 * - No breaking changes to function signatures
 */

import { OpenAI } from 'openai';
import { storage } from '../storage';
import { logger } from '../utils/logger';
import type { ProductWithOffers, SearchFilters } from '@shared/schema';

interface SearchConfig {
  fuzzyThreshold: number;
  semanticThreshold: number;
  maxResults: number;
  enableSemanticSearch: boolean;
  enableFuzzySearch: boolean;
}

interface SearchResult {
  product: ProductWithOffers;
  relevanceScore: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'synonym';
}

interface SearchSuggestion {
  query: string;
  type: 'completion' | 'correction' | 'synonym';
  confidence: number;
}

export class AdvancedSearchService {
  private openai: OpenAI | null;
  private config: SearchConfig;
  private synonyms: Map<string, string[]>;
  private queryCache: Map<string, SearchResult[]>;
  private embeddingCache: Map<string, number[]>;
  private suggestionCache: Map<string, { suggestions: SearchSuggestion[]; timestamp: number }>;

  // Cache size limits to prevent memory leaks
  private readonly MAX_QUERY_CACHE_SIZE = 1000;
  private readonly MAX_EMBEDDING_CACHE_SIZE = 5000;
  private readonly MAX_SUGGESTION_CACHE_SIZE = 500;

  /**
   * Helper function to convert storage layer result to ProductWithOffers
   * Storage layer has simplified offer structure, so we populate missing fields
   */
  private convertToProductWithOffers(result: {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    brand: string | null;
    image: string | null;
    similarity?: number;
    offers: Array<{
      id: number;
      price: string;
      availability: string | null;
      productUrl: string | null;
      retailer: {
        id: number;
        name: string;
        websiteUrl: string | null;
      } | null;
    }>;
  }): ProductWithOffers {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      category: result.category,
      brand: result.brand,
      image: result.image,
      model: null,
      embedding: null,
      embeddingUpdatedAt: null,
      searchVector: null,
      createdAt: new Date(),
      offers: result.offers
        .filter(offer => offer.retailer !== null) // Filter out offers without retailers
        .map(offer => ({
          id: offer.id,
          productId: result.id,
          retailerId: offer.retailer!.id,
          price: offer.price,
          originalPrice: null,
          availability: offer.availability,
          rating: null,
          reviewCount: null,
          shippingInfo: null,
          dealType: null,
          productUrl: offer.productUrl,
          affiliateUrl: null,
          linkHealthStatus: 'unknown' as const,
          lastLinkCheck: null,
          clickCount: 0,
          condition: null,
          inStock: null,
          stockQuantity: null,
          scrapedAt: null,
          lastChecked: new Date(),
          lastUpdated: null,
          retailer: {
            id: offer.retailer!.id,
            name: offer.retailer!.name,
            logo: null,
            website: offer.retailer!.websiteUrl,
            isActive: true,
            affiliateId: null,
            affiliateProgram: null,
            baseAffiliateUrl: null,
            commissionRate: null,
            affiliateStatus: 'inactive',
            affiliateConfig: null
          }
        }))
    };
  }

  constructor() {
    // Only initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
      } catch (error) {
        logger.error('OpenAI initialization error:', { error: error instanceof Error ? error.message : String(error) });
        this.openai = null;
      }
    } else {
      this.openai = null;
    }

    this.config = {
      fuzzyThreshold: 0.7,
      semanticThreshold: 0.8,
      maxResults: 100,
      enableSemanticSearch: !!this.openai,
      enableFuzzySearch: true
    };

    this.synonyms = this.initializeSynonyms();
    this.queryCache = new Map();
    this.embeddingCache = new Map();
    this.suggestionCache = new Map();
  }

  /**
   * Enforce cache size limits by removing oldest entries
   */
  private enforceQueryCacheLimit(): void {
    if (this.queryCache.size > this.MAX_QUERY_CACHE_SIZE) {
      const keysToDelete = Array.from(this.queryCache.keys()).slice(0, this.queryCache.size - this.MAX_QUERY_CACHE_SIZE);
      keysToDelete.forEach(key => this.queryCache.delete(key));
    }
  }

  private enforceEmbeddingCacheLimit(): void {
    if (this.embeddingCache.size > this.MAX_EMBEDDING_CACHE_SIZE) {
      const keysToDelete = Array.from(this.embeddingCache.keys()).slice(0, this.embeddingCache.size - this.MAX_EMBEDDING_CACHE_SIZE);
      keysToDelete.forEach(key => this.embeddingCache.delete(key));
    }
  }

  private enforceSuggestionCacheLimit(): void {
    if (this.suggestionCache.size > this.MAX_SUGGESTION_CACHE_SIZE) {
      const keysToDelete = Array.from(this.suggestionCache.keys()).slice(0, this.suggestionCache.size - this.MAX_SUGGESTION_CACHE_SIZE);
      keysToDelete.forEach(key => this.suggestionCache.delete(key));
    }
  }

  /**
   * Initialize common product synonyms
   */
  private initializeSynonyms(): Map<string, string[]> {
    const synonymMap = new Map<string, string[]>();
    
    // Electronics synonyms
    synonymMap.set('tv', ['television', 'smart tv', 'display', 'monitor']);
    synonymMap.set('phone', ['smartphone', 'mobile', 'cell phone', 'iphone', 'android']);
    synonymMap.set('laptop', ['notebook', 'computer', 'macbook', 'chromebook']);
    synonymMap.set('headphones', ['earbuds', 'earphones', 'airpods', 'audio']);
    synonymMap.set('tablet', ['ipad', 'surface', 'android tablet']);
    synonymMap.set('watch', ['smartwatch', 'apple watch', 'fitness tracker']);
    
    // Common misspellings and variations
    synonymMap.set('iphone', ['iphon', 'i-phone', 'iph']);
    synonymMap.set('samsung', ['samung', 'samsng']);
    synonymMap.set('bluetooth', ['bluethooth', 'blue tooth']);
    
    return synonymMap;
  }

  /**
   * Advanced product search with multiple ranking strategies
   */
  async searchProducts(filters: SearchFilters, userId?: number): Promise<SearchResult[]> {
    const cacheKey = JSON.stringify({ filters, userId });
    
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)!;
    }

    const results: SearchResult[] = [];
    
    if (filters.query) {
      // 1. Exact matches (highest priority)
      const exactResults = await this.performExactSearch(filters);
      results.push(...exactResults);

      // 2. Fuzzy matches for typos and variations
      if (this.config.enableFuzzySearch) {
        const fuzzyResults = await this.performFuzzySearch(filters);
        results.push(...fuzzyResults);
      }

      // 3. Synonym matches
      const synonymResults = await this.performSynonymSearch(filters);
      results.push(...synonymResults);

      // 4. Semantic search using AI embeddings
      if (this.config.enableSemanticSearch) {
        const semanticResults = await this.performSemanticSearch(filters);
        results.push(...semanticResults);
      }
    } else {
      // No query - perform filtered search
      const filteredResults = await this.performFilteredSearch(filters);
      results.push(...filteredResults);
    }

    // Remove duplicates and rank by relevance
    const uniqueResults = this.removeDuplicatesAndRank(results);
    
    // Apply additional filters
    const finalResults = this.applyFilters(uniqueResults, filters);

    // Cache results
    this.queryCache.set(cacheKey, finalResults);
    this.enforceQueryCacheLimit();

    return finalResults.slice(0, this.config.maxResults);
  }

  /**
   * Perform exact text matching
   */
  private async performExactSearch(filters: SearchFilters): Promise<SearchResult[]> {
    const query = filters.query!.toLowerCase();
    const searchPattern = `%${query}%`;

    const results = await storage.searchProductsExact(searchPattern, filters.limit || this.config.maxResults);

    return results.map(result => {
      const productWithOffers = this.convertToProductWithOffers(result);
      return {
        product: productWithOffers,
        relevanceScore: this.calculateExactMatchScore(query, productWithOffers),
        matchType: 'exact' as const
      };
    });
  }

  /**
   * Perform fuzzy search for typos and variations
   */
  private async performFuzzySearch(filters: SearchFilters): Promise<SearchResult[]> {
    const query = filters.query!.toLowerCase();

    // Use ILIKE with wildcards for fuzzy matching (fallback without pg_trgm)
    const fuzzyPattern = `%${query.split('').join('%')}%`;
    const threshold = this.config.fuzzyThreshold; // Use config threshold

    const results = await storage.searchProductsFuzzy(fuzzyPattern, threshold, filters.limit || this.config.maxResults);

    return results.map(result => {
      const productWithOffers = this.convertToProductWithOffers(result);
      return {
        product: productWithOffers,
        relevanceScore: this.calculateFuzzyScore(query, productWithOffers),
        matchType: 'fuzzy' as const
      };
    });
  }

  /**
   * Calculate fuzzy match score
   */
  private calculateFuzzyScore(query: string, product: ProductWithOffers): number {
    const queryLower = query.toLowerCase();
    const name = product.name?.toLowerCase() || '';
    const brand = product.brand?.toLowerCase() || '';
    const description = product.description?.toLowerCase() || '';

    // Simple fuzzy scoring based on character overlap
    let score = 0;
    
    // Name fuzzy match
    score += this.fuzzyStringMatch(queryLower, name) * 0.8;
    
    // Brand fuzzy match
    score += this.fuzzyStringMatch(queryLower, brand) * 0.6;
    
    // Description fuzzy match
    score += this.fuzzyStringMatch(queryLower, description) * 0.3;
    
    return Math.min(score, 0.8); // Cap at 0.8 for fuzzy matches
  }

  /**
   * Simple fuzzy string matching
   */
  private fuzzyStringMatch(query: string, target: string): number {
    if (target.includes(query)) return 1.0;
    
    let matches = 0;
    let queryIndex = 0;
    
    for (let i = 0; i < target.length && queryIndex < query.length; i++) {
      if (target[i] === query[queryIndex]) {
        matches++;
        queryIndex++;
      }
    }
    
    return matches / query.length;
  }

  /**
   * Search using synonyms
   */
  private async performSynonymSearch(filters: SearchFilters): Promise<SearchResult[]> {
    const query = filters.query!.toLowerCase();
    const queryWords = query.split(' ');
    const expandedQueries = new Set<string>();

    // Find synonyms for each word
    for (const word of queryWords) {
      if (this.synonyms.has(word)) {
        const synonyms = this.synonyms.get(word)!;
        synonyms.forEach((synonym: string) => expandedQueries.add(synonym));
      }

      // Also check if the word is a synonym of something else
      for (const [key, synonyms] of Array.from(this.synonyms.entries())) {
        if (synonyms.includes(word)) {
          expandedQueries.add(key);
          synonyms.forEach((synonym: string) => expandedQueries.add(synonym));
        }
      }
    }

    if (expandedQueries.size === 0) {
      return [];
    }

    const allTerms = Array.from(expandedQueries);
    const results = await storage.searchProductsBySynonyms(allTerms, filters.limit || this.config.maxResults);

    return results.map(result => {
      const productWithOffers = this.convertToProductWithOffers(result);
      return {
        product: productWithOffers,
        relevanceScore: 0.6, // Lower score for synonym matches
        matchType: 'synonym' as const
      };
    });
  }

  /**
   * Semantic search using OpenAI embeddings and pgvector
   *
   * OPTIMIZED: Uses vector database for 99% cost reduction
   * - Before: N+1 API calls (1 for query + 1 per product)
   * - After: 1 API call (only for query embedding)
   * - Uses pgvector's HNSW index for fast similarity search
   */
  private async performSemanticSearch(filters: SearchFilters): Promise<SearchResult[]> {
    if (!this.config.enableSemanticSearch || !this.openai) {
      return [];
    }

    try {
      const query = filters.query!;
      let queryEmbedding = this.embeddingCache.get(query);

      // Generate query embedding (only 1 API call per unique query)
      if (!queryEmbedding) {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query
        });
        queryEmbedding = response.data[0].embedding;
        this.embeddingCache.set(query, queryEmbedding);
        this.enforceEmbeddingCacheLimit();
      }

      // Use pgvector's cosine similarity operator (<=>) for efficient search
      // HNSW index makes this extremely fast even with millions of products
      const semanticMatches = await storage.searchProductsSemantic(
        queryEmbedding,
        filters.limit || 50 // Get top 50 most similar products
      );

      // Filter by similarity threshold and map to SearchResult format
      const semanticResults: SearchResult[] = semanticMatches
        .filter(result => (result.similarity || 0) >= this.config.semanticThreshold)
        .map(result => {
          const productWithOffers = this.convertToProductWithOffers(result);
          return {
            product: productWithOffers,
            relevanceScore: (result.similarity || 0) * 0.7, // Semantic matches get moderate score
            matchType: 'semantic' as const
          };
        });

      return semanticResults;
    } catch (error) {
      logger.error('Semantic search error:', { error: error instanceof Error ? error.message : String(error) });

      // Fallback: If vector search fails (e.g., pgvector not installed),
      // return empty array rather than falling back to N+1 pattern
      logger.error('Vector search failed. Please run: npm run migrate');
      return [];
    }
  }

  /**
   * Perform filtered search without query
   * Note: This uses exact search with wildcard pattern since we don't have
   * a specific query term. Results are then filtered by category/price/etc.
   */
  private async performFilteredSearch(filters: SearchFilters): Promise<SearchResult[]> {
    // Use exact search with broad pattern to get all products
    // The applyFilters method will narrow down by category, price, etc.
    const results = await storage.searchProductsExact('%', filters.limit || this.config.maxResults);

    return results.map(result => {
      const productWithOffers = this.convertToProductWithOffers(result);
      return {
        product: productWithOffers,
        relevanceScore: 0.5, // Default relevance for non-searched items
        matchType: 'exact' as const
      };
    });
  }

  /**
   * Calculate exact match relevance score
   */
  private calculateExactMatchScore(query: string, product: ProductWithOffers): number {
    let score = 0;
    const queryLower = query.toLowerCase();

    const name = product.name?.toLowerCase() || '';
    const brand = product.brand?.toLowerCase() || '';
    const description = product.description?.toLowerCase() || '';

    // Exact name match gets highest score
    if (name === queryLower) score += 1.0;
    else if (name.includes(queryLower)) score += 0.8;
    
    // Brand matches
    if (brand === queryLower) score += 0.7;
    else if (brand.includes(queryLower)) score += 0.5;
    
    // Description matches
    if (description.includes(queryLower)) score += 0.3;
    
    // Word order matters
    const queryWords = queryLower.split(' ');
    const nameWords = name.split(' ');
    
    let consecutiveMatches = 0;
    for (let i = 0; i < queryWords.length; i++) {
      if (nameWords.includes(queryWords[i])) {
        consecutiveMatches++;
      }
    }
    
    score += (consecutiveMatches / queryWords.length) * 0.4;
    
    return Math.min(score, 1.0);
  }

  /**
   * Remove duplicates and rank by relevance score
   */
  private removeDuplicatesAndRank(results: SearchResult[]): SearchResult[] {
    const productMap = new Map<number, SearchResult>();
    
    for (const result of results) {
      const productId = result.product.id;
      const existing = productMap.get(productId);
      
      if (!existing || result.relevanceScore > existing.relevanceScore) {
        productMap.set(productId, result);
      }
    }
    
    return Array.from(productMap.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Apply additional filters (price, category, etc.)
   */
  private applyFilters(results: SearchResult[], filters: SearchFilters): SearchResult[] {
    return results.filter(result => {
      const product = result.product;
      
      // Category filter
      if (filters.category && product.category !== filters.category) {
        return false;
      }
      
      // Price filters
      if (product.offers && product.offers.length > 0) {
        const prices = product.offers.map(offer => Number(offer.price));
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        if (filters.minPrice && maxPrice < filters.minPrice) return false;
        if (filters.maxPrice && minPrice > filters.maxPrice) return false;
      }
      
      // Retailer filter
      if (filters.retailers && filters.retailers.length > 0) {
        const productRetailers = product.offers?.map(offer => offer.retailer?.id) || [];
        if (!filters.retailers.some(id => productRetailers.includes(id))) {
          return false;
        }
      }
      
      // Rating filter
      if (filters.minRating && product.offers) {
        const maxRating = Math.max(...product.offers.map(offer => Number(offer.rating) || 0));
        if (maxRating < filters.minRating) return false;
      }
      
      // Availability filter
      if (filters.availability && filters.availability.length > 0) {
        const availabilities = product.offers?.map(offer => offer.availability) || [];
        if (!filters.availability.some(avail => availabilities.includes(avail))) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Get search suggestions and auto-completions
   */
  async getSearchSuggestions(query: string, limit = 5): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const queryLower = query.toLowerCase();

    try {
      // 1. Auto-completion from product names
      const productResults = await storage.getProductAutocompleteSuggestions(query, limit);

      productResults.forEach(product => {
        if (product.name && product.name.toLowerCase().startsWith(queryLower)) {
          suggestions.push({
            query: product.name,
            type: 'completion',
            confidence: 0.9
          });
        }
        if (product.brand && product.brand.toLowerCase().startsWith(queryLower)) {
          suggestions.push({
            query: product.brand,
            type: 'completion',
            confidence: 0.8
          });
        }
      });
    } catch (error) {
      logger.error('Database error in search suggestions:', { error: error instanceof Error ? error.message : String(error) });
    }
    
    // 2. Synonym suggestions
    for (const [key, synonyms] of Array.from(this.synonyms.entries())) {
      if (key.includes(queryLower) || synonyms.some((s: string) => s.includes(queryLower))) {
        suggestions.push({
          query: key,
          type: 'synonym',
          confidence: 0.7
        });
      }
    }
    
    // 3. AI-powered suggestions (if enabled)
    if (this.config.enableSemanticSearch && query.length > 3) {
      try {
        const aiSuggestions = await this.getAISuggestions(query);
        suggestions.push(...aiSuggestions);
      } catch (error) {
        logger.error('AI suggestions error:', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // Remove duplicates and sort by confidence
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, self) => 
        self.findIndex(s => s.query === suggestion.query) === index
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
    
    return uniqueSuggestions;
  }

  /**
   * Get AI-powered search suggestions
   */
  private async getAISuggestions(query: string): Promise<SearchSuggestion[]> {
    if (!this.openai) {
      return [];
    }

    // Check cache first (1 hour TTL)
    const cached = this.suggestionCache.get(query.toLowerCase());
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour = 3600000ms
      return cached.suggestions;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert product search assistant for a price comparison platform. Your role is to help users discover relevant product alternatives and related items they can compare prices for.

EXPERTISE:
- Understanding of product relationships (alternatives, complements, upgrades)
- Knowledge of major brands and product lines across categories
- Insight into what customers typically compare when shopping
- Understanding of product features and specifications that matter for comparison

SUGGESTION STRATEGY:
1. ALTERNATIVE PRODUCTS: Similar products from different brands
   Example: User searches "iPhone 15" → Suggest "Samsung Galaxy S24", "Google Pixel 8"

2. RELATED MODELS: Different versions/models in the same product line
   Example: User searches "iPad Pro" → Suggest "iPad Air", "iPad mini"

3. COMPLEMENTARY PRODUCTS: Items commonly purchased together
   Example: User searches "laptop" → Suggest "laptop bag", "wireless mouse"

4. UPGRADE/DOWNGRADE OPTIONS: Higher or lower tier products
   Example: User searches "AirPods Pro" → Suggest "AirPods Max", "AirPods 3rd Generation"

QUALITY CRITERIA:
- All suggestions must be real, purchasable products (not generic categories)
- Suggestions should be price-comparable across multiple retailers
- Maintain relevance to the original query (same category or use case)
- Prioritize popular, well-known products that users can easily find
- Ensure suggestions are diverse (don't suggest 3 variations of the same thing)

OUTPUT CONSTRAINTS:
- Return EXACTLY 3 suggestions
- One suggestion per line
- No numbering, bullets, or explanations
- Each suggestion: 2-6 words
- Use specific product names, not vague categories
- Format: [Brand] [Product Name] [Model if applicable]

EXAMPLES:

Query: "laptop"
Output:
MacBook Air M2
Dell XPS 13
HP Spectre x360

Query: "noise cancelling headphones"
Output:
Sony WH-1000XM5
Bose QuietComfort 45
Apple AirPods Max

Query: "smart watch"
Output:
Apple Watch Series 9
Samsung Galaxy Watch 6
Fitbit Sense 2`
          },
          {
            role: 'user',
            content: `TASK: Suggest 3 related product search queries for the following user search.

USER SEARCH: "${query}"

CONTEXT: User is on a price comparison platform comparing prices across Amazon, Walmart, Target, and other major retailers.

GOAL: Help the user discover related products they might want to compare prices for.

REQUIREMENTS:
- Suggest real, specific products (not generic categories)
- Ensure products are available at multiple major retailers
- Make suggestions relevant and useful for price comparison
- Consider: alternatives, related models, complementary items, or different tiers

Return only 3 product names, one per line, no formatting or explanations.`
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      });

      const suggestions = response.choices[0].message.content
        ?.split('\n')
        .filter(line => line.trim())
        .map(line => ({
          query: line.trim().replace(/^\d+\.?\s*/, ''), // Remove numbering
          type: 'completion' as const,
          confidence: 0.6
        })) || [];

      // Cache the result
      this.suggestionCache.set(query.toLowerCase(), {
        suggestions,
        timestamp: Date.now()
      });
      this.enforceSuggestionCacheLimit();

      return suggestions;
    } catch (error) {
      logger.error('AI suggestions error:', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Generate and store embedding for a product
   * Call this when creating/updating products to keep embeddings fresh
   */
  async generateProductEmbedding(productId: number): Promise<void> {
    if (!this.openai) {
      logger.warn('OpenAI not configured, skipping embedding generation');
      return;
    }

    try {
      // Fetch product details
      const product = await storage.getProductForEmbedding(productId);

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Create searchable text from product fields
      const searchableText = [
        product.name,
        product.description,
        product.brand
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (!searchableText) {
        logger.warn(`Product ${productId} has no searchable text, skipping embedding`);
        return;
      }

      // Generate embedding (OpenAI API call - NOT in transaction)
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: searchableText
      });

      const embedding = response.data[0].embedding;

      // Update product with embedding
      await storage.updateProductEmbedding(productId, embedding);

      logger.info(`✅ Generated embedding for product ${productId}`);

    } catch (error) {
      logger.error(`Failed to generate embedding for product ${productId}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Analyze search query intent
   */
  async analyzeQueryIntent(query: string): Promise<{
    intent: 'product_search' | 'price_comparison' | 'brand_search' | 'category_browse';
    confidence: number;
    suggestions: string[];
  }> {
    const queryLower = query.toLowerCase();
    
    // Price-related keywords
    const priceKeywords = ['cheap', 'price', 'cost', 'deal', 'sale', 'discount', 'affordable'];
    const brandKeywords = ['apple', 'samsung', 'sony', 'lg', 'microsoft', 'google'];
    const categoryKeywords = ['phone', 'laptop', 'tv', 'headphones', 'tablet', 'watch'];
    
    let intent: 'product_search' | 'price_comparison' | 'brand_search' | 'category_browse' = 'product_search';
    let confidence = 0.5;
    const suggestions: string[] = [];
    
    if (priceKeywords.some(keyword => queryLower.includes(keyword))) {
      intent = 'price_comparison';
      confidence = 0.8;
      suggestions.push('Sort by price: low to high', 'Filter by discount percentage');
    } else if (brandKeywords.some(keyword => queryLower.includes(keyword))) {
      intent = 'brand_search';
      confidence = 0.9;
      suggestions.push('View all products from this brand', 'Compare with similar brands');
    } else if (categoryKeywords.some(keyword => queryLower.includes(keyword))) {
      intent = 'category_browse';
      confidence = 0.8;
      suggestions.push('Browse category', 'Filter by sub-categories');
    }
    
    return { intent, confidence, suggestions };
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.queryCache.clear();
    this.embeddingCache.clear();
  }

  /**
   * Get search statistics
   */
  getStats(): {
    queryCacheSize: number;
    embeddingCacheSize: number;
    enabledFeatures: string[];
  } {
    return {
      queryCacheSize: this.queryCache.size,
      embeddingCacheSize: this.embeddingCache.size,
      enabledFeatures: [
        ...(this.config.enableSemanticSearch ? ['semantic_search'] : []),
        ...(this.config.enableFuzzySearch ? ['fuzzy_search'] : []),
        'synonym_search',
        'auto_completion'
      ]
    };
  }
}

export const advancedSearchService = new AdvancedSearchService();