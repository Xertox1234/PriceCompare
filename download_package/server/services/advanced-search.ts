import { OpenAI } from 'openai';
import { db } from '../db';
import { products, productOffers, retailers } from '@shared/schema';
import { eq, sql, desc, asc, and, or, gte, lte, inArray, ilike } from 'drizzle-orm';
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

  constructor() {
    // Only initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
      } catch (error) {
        console.error('OpenAI initialization error:', error);
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
    
    return finalResults.slice(0, this.config.maxResults);
  }

  /**
   * Perform exact text matching
   */
  private async performExactSearch(filters: SearchFilters): Promise<SearchResult[]> {
    const query = filters.query!.toLowerCase();
    
    const results = await db
      .select({
        product: products,
        offers: sql`json_agg(
          json_build_object(
            'id', ${productOffers.id},
            'price', ${productOffers.price},
            'originalPrice', ${productOffers.originalPrice},
            'availability', ${productOffers.availability},
            'rating', ${productOffers.rating},
            'reviewCount', ${productOffers.reviewCount},
            'retailer', json_build_object(
              'id', ${retailers.id},
              'name', ${retailers.name},
              'logo', ${retailers.logo}
            )
          )
        )`.as('offers')
      })
      .from(products)
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(
        or(
          ilike(products.name, `%${query}%`),
          ilike(products.description, `%${query}%`),
          ilike(products.brand, `%${query}%`)
        )
      )
      .groupBy(products.id);

    return results.map(result => ({
      product: {
        ...result.product,
        offers: result.offers || []
      },
      relevanceScore: this.calculateExactMatchScore(query, result.product),
      matchType: 'exact' as const
    }));
  }

  /**
   * Perform fuzzy search for typos and variations
   */
  private async performFuzzySearch(filters: SearchFilters): Promise<SearchResult[]> {
    const query = filters.query!.toLowerCase();
    
    // Use ILIKE with wildcards for fuzzy matching (fallback without pg_trgm)
    const fuzzyPattern = query.split('').join('%');
    
    const results = await db
      .select({
        product: products,
        offers: sql`json_agg(
          json_build_object(
            'id', ${productOffers.id},
            'price', ${productOffers.price},
            'originalPrice', ${productOffers.originalPrice},
            'availability', ${productOffers.availability},
            'rating', ${productOffers.rating},
            'reviewCount', ${productOffers.reviewCount},
            'retailer', json_build_object(
              'id', ${retailers.id},
              'name', ${retailers.name},
              'logo', ${retailers.logo}
            )
          )
        )`.as('offers')
      })
      .from(products)
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(
        or(
          ilike(products.name, `%${fuzzyPattern}%`),
          ilike(products.brand, `%${fuzzyPattern}%`),
          ilike(products.description, `%${fuzzyPattern}%`)
        )
      )
      .groupBy(products.id);

    return results.map(result => ({
      product: {
        ...result.product,
        offers: result.offers || []
      },
      relevanceScore: this.calculateFuzzyScore(query, result.product),
      matchType: 'fuzzy' as const
    }));
  }

  /**
   * Calculate fuzzy match score
   */
  private calculateFuzzyScore(query: string, product: any): number {
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
        synonyms.forEach(synonym => expandedQueries.add(synonym));
      }
      
      // Also check if the word is a synonym of something else
      for (const [key, synonyms] of this.synonyms.entries()) {
        if (synonyms.includes(word)) {
          expandedQueries.add(key);
          synonyms.forEach(synonym => expandedQueries.add(synonym));
        }
      }
    }

    if (expandedQueries.size === 0) {
      return [];
    }

    const synonymQueries = Array.from(expandedQueries);
    const conditions = synonymQueries.map(synonym => 
      or(
        ilike(products.name, `%${synonym}%`),
        ilike(products.description, `%${synonym}%`),
        ilike(products.brand, `%${synonym}%`)
      )
    );

    const results = await db
      .select({
        product: products,
        offers: sql`json_agg(
          json_build_object(
            'id', ${productOffers.id},
            'price', ${productOffers.price},
            'originalPrice', ${productOffers.originalPrice},
            'availability', ${productOffers.availability},
            'rating', ${productOffers.rating},
            'reviewCount', ${productOffers.reviewCount},
            'retailer', json_build_object(
              'id', ${retailers.id},
              'name', ${retailers.name},
              'logo', ${retailers.logo}
            )
          )
        )`.as('offers')
      })
      .from(products)
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(or(...conditions))
      .groupBy(products.id);

    return results.map(result => ({
      product: {
        ...result.product,
        offers: result.offers || []
      },
      relevanceScore: 0.6, // Lower score for synonym matches
      matchType: 'synonym' as const
    }));
  }

  /**
   * Semantic search using OpenAI embeddings
   */
  private async performSemanticSearch(filters: SearchFilters): Promise<SearchResult[]> {
    if (!this.config.enableSemanticSearch || !this.openai) {
      return [];
    }

    try {
      const query = filters.query!;
      let queryEmbedding = this.embeddingCache.get(query);

      if (!queryEmbedding) {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query
        });
        queryEmbedding = response.data[0].embedding;
        this.embeddingCache.set(query, queryEmbedding);
      }

      // Note: This is a simplified implementation
      // In production, you'd store embeddings in a vector database
      const allProducts = await db
        .select({
          product: products,
          offers: sql`json_agg(
            json_build_object(
              'id', ${productOffers.id},
              'price', ${productOffers.price},
              'originalPrice', ${productOffers.originalPrice},
              'availability', ${productOffers.availability},
              'rating', ${productOffers.rating},
              'reviewCount', ${productOffers.reviewCount},
              'retailer', json_build_object(
                'id', ${retailers.id},
                'name', ${retailers.name},
                'logo', ${retailers.logo}
              )
            )
          )`.as('offers')
        })
        .from(products)
        .leftJoin(productOffers, eq(products.id, productOffers.productId))
        .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
        .groupBy(products.id);

      const semanticResults: SearchResult[] = [];

      for (const result of allProducts) {
        const productText = `${result.product.name} ${result.product.description} ${result.product.brand}`;
        const similarity = await this.calculateSemanticSimilarity(query, productText);
        
        if (similarity > this.config.semanticThreshold) {
          semanticResults.push({
            product: {
              ...result.product,
              offers: result.offers || []
            },
            relevanceScore: similarity * 0.7, // Semantic matches get moderate score
            matchType: 'semantic' as const
          });
        }
      }

      return semanticResults;
    } catch (error) {
      console.error('Semantic search error:', error);
      return [];
    }
  }

  /**
   * Perform filtered search without query
   */
  private async performFilteredSearch(filters: SearchFilters): Promise<SearchResult[]> {
    let query = db
      .select({
        product: products,
        offers: sql`json_agg(
          json_build_object(
            'id', ${productOffers.id},
            'price', ${productOffers.price},
            'originalPrice', ${productOffers.originalPrice},
            'availability', ${productOffers.availability},
            'rating', ${productOffers.rating},
            'reviewCount', ${productOffers.reviewCount},
            'retailer', json_build_object(
              'id', ${retailers.id},
              'name', ${retailers.name},
              'logo', ${retailers.logo}
            )
          )
        )`.as('offers')
      })
      .from(products)
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .groupBy(products.id);

    const results = await query;

    return results.map(result => ({
      product: {
        ...result.product,
        offers: result.offers || []
      },
      relevanceScore: 0.5, // Default relevance for non-searched items
      matchType: 'exact' as const
    }));
  }

  /**
   * Calculate exact match relevance score
   */
  private calculateExactMatchScore(query: string, product: any): number {
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
   * Calculate semantic similarity using cosine similarity
   */
  private async calculateSemanticSimilarity(query: string, text: string): Promise<number> {
    if (!this.openai) {
      return 0;
    }
    
    try {
      let textEmbedding = this.embeddingCache.get(text);
      
      if (!textEmbedding) {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text
        });
        textEmbedding = response.data[0].embedding;
        this.embeddingCache.set(text, textEmbedding);
      }

      const queryEmbedding = this.embeddingCache.get(query);
      if (!queryEmbedding) return 0;

      return this.cosineSimilarity(queryEmbedding, textEmbedding);
    } catch (error) {
      console.error('Error calculating semantic similarity:', error);
      return 0;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
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
  async getSearchSuggestions(query: string, limit: number = 5): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const queryLower = query.toLowerCase();
    
    try {
      // 1. Auto-completion from product names
      const productResults = await db
        .select({ name: products.name, brand: products.brand })
        .from(products)
        .where(
          or(
            ilike(products.name, `${queryLower}%`),
            ilike(products.brand, `${queryLower}%`)
          )
        )
        .limit(limit);
      
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
      console.error('Database error in search suggestions:', error);
    }
    
    // 2. Synonym suggestions
    for (const [key, synonyms] of this.synonyms.entries()) {
      if (key.includes(queryLower) || synonyms.some(s => s.includes(queryLower))) {
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
        console.error('AI suggestions error:', error);
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
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that suggests product search queries. Return only product names or brands, one per line, no explanations.'
          },
          {
            role: 'user',
            content: `Suggest 3 related product search queries for: "${query}"`
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

      return suggestions;
    } catch (error) {
      console.error('AI suggestions error:', error);
      return [];
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