import { Express, Request, Response } from 'express';
import { logger } from "./utils/logger";
import { requireAuth, requireAdmin } from './auth';
import { advancedSearchService } from './services/advanced-search';
import type { SearchFilters } from '@shared/schema';
import { parseIntSafe, parseFloatSafe } from './utils/validation-helpers';

export function registerAdvancedSearchRoutes(app: Express): void {
  
  /**
   * Advanced product search with AI-powered features
   */
  app.get("/api/search/advanced", async (req: Request, res: Response) => {
    try {
      // SECURITY: Safe number parsing with validation and constraints
      const filters: SearchFilters = {
        query: req.query.query as string,
        category: req.query.category as string,
        minPrice: req.query.minPrice ? parseFloatSafe(req.query.minPrice as string, 'minPrice', { min: 0 }) : undefined,
        maxPrice: req.query.maxPrice ? parseFloatSafe(req.query.maxPrice as string, 'maxPrice', { min: 0 }) : undefined,
        retailers: req.query.retailers ?
          (Array.isArray(req.query.retailers) ?
            req.query.retailers.map(id => parseIntSafe(id as string, 'retailerId', { min: 1 })) :
            [parseIntSafe(req.query.retailers as string, 'retailerId', { min: 1 })]) : undefined,
        minRating: req.query.minRating ? parseFloatSafe(req.query.minRating as string, 'minRating', { min: 0, max: 5 }) : undefined,
        availability: req.query.availability ?
          (Array.isArray(req.query.availability) ?
            req.query.availability as string[] :
            [req.query.availability as string]) : undefined,
        sortBy: req.query.sortBy as "price_low" | "price_high" | "rating" | "popularity",
      };

      // SECURITY: Use properly typed session data instead of 'as any'
      const userId = req.session.userId;
      const results = await advancedSearchService.searchProducts(filters, userId);
      
      // Transform results for API response
      const response = {
        results: results.map(result => ({
          product: result.product,
          relevanceScore: result.relevanceScore,
          matchType: result.matchType
        })),
        metadata: {
          totalResults: results.length,
          searchTime: Date.now(),
          features: ['fuzzy_search', 'semantic_search', 'synonym_matching', 'relevance_scoring']
        }
      };

      // Cache for 2 minutes for search results
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
      res.json(response);
      
    } catch (error) {
      logger.error('Advanced search error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Advanced search failed" });
    }
  });

  /**
   * Get search suggestions and auto-completions
   */
  app.get("/api/search/suggestions", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      // SECURITY: Safe integer parsing with validation and cap
      const limit = req.query.limit ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 50 }) : 5;
      
      logger.info('Search suggestions request', { query, limit });
      
      if (!query || query.length < 2) {
        return res.json({ suggestions: [] });
      }

      const suggestions = await advancedSearchService.getSearchSuggestions(query, limit);
      
      logger.info('Search suggestions response:', suggestions);
      
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=150');
      res.json({ suggestions });
      
    } catch (error) {
      logger.error('Search suggestions error:', { error: error instanceof Error ? error.message : String(error) });
      logger.error('Search error with stack', { stack: (error as Error).stack });
      res.status(500).json({ message: "Failed to get search suggestions", error: (error as Error).message });
    }
  });

  /**
   * Analyze search query intent
   */
  app.post("/api/search/analyze", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      const analysis = await advancedSearchService.analyzeQueryIntent(query);
      
      res.json(analysis);
      
    } catch (error) {
      logger.error('Query analysis error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to analyze query" });
    }
  });

  /**
   * Search with specific intent optimization
   */
  app.get("/api/search/intent/:intent", async (req: Request, res: Response) => {
    try {
      const intent = req.params.intent;
      const query = req.query.query as string;
      
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      let optimizedFilters: SearchFilters = { query };
      
      // Optimize filters based on intent
      switch (intent) {
        case 'price_comparison':
          optimizedFilters.sortBy = 'price_low';
          break;
        case 'brand_search':
          // Focus on exact brand matches
          break;
        case 'category_browse':
          if (req.query.category) {
            optimizedFilters.category = req.query.category as string;
          }
          break;
      }

      // Apply additional filters from query params with safe parsing
      // SECURITY: Safe number parsing with validation and constraints
      Object.assign(optimizedFilters, {
        minPrice: req.query.minPrice ? parseFloatSafe(req.query.minPrice as string, 'minPrice', { min: 0 }) : undefined,
        maxPrice: req.query.maxPrice ? parseFloatSafe(req.query.maxPrice as string, 'maxPrice', { min: 0 }) : undefined,
        retailers: req.query.retailers ?
          (Array.isArray(req.query.retailers) ?
            req.query.retailers.map(id => parseIntSafe(id as string, 'retailerId', { min: 1 })) :
            [parseIntSafe(req.query.retailers as string, 'retailerId', { min: 1 })]) : undefined,
        minRating: req.query.minRating ? parseFloatSafe(req.query.minRating as string, 'minRating', { min: 0, max: 5 }) : undefined,
      });

      // SECURITY: Use properly typed session data instead of 'as any'
      const userId = req.session.userId;
      const results = await advancedSearchService.searchProducts(optimizedFilters, userId);
      
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
      res.json({
        results: results.map(result => ({
          product: result.product,
          relevanceScore: result.relevanceScore,
          matchType: result.matchType
        })),
        intent,
        optimizations: `Optimized for ${intent}`
      });
      
    } catch (error) {
      logger.error('Intent-based search error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Intent-based search failed" });
    }
  });

  /**
   * Smart search that automatically selects best strategy
   */
  app.get("/api/search/smart", async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      // First analyze the intent
      const analysis = await advancedSearchService.analyzeQueryIntent(query);
      
      // Build optimized filters based on intent
      let filters: SearchFilters = { query };
      
      switch (analysis.intent) {
        case 'price_comparison':
          filters.sortBy = 'price_low';
          break;
        case 'category_browse':
          // Auto-detect category if not specified
          if (req.query.category) {
            filters.category = req.query.category as string;
          }
          break;
      }

      // Apply manual filters with safe parsing
      // SECURITY: Safe number parsing with validation and constraints
      Object.assign(filters, {
        category: req.query.category as string,
        minPrice: req.query.minPrice ? parseFloatSafe(req.query.minPrice as string, 'minPrice', { min: 0 }) : undefined,
        maxPrice: req.query.maxPrice ? parseFloatSafe(req.query.maxPrice as string, 'maxPrice', { min: 0 }) : undefined,
        retailers: req.query.retailers ?
          (Array.isArray(req.query.retailers) ?
            req.query.retailers.map(id => parseIntSafe(id as string, 'retailerId', { min: 1 })) :
            [parseIntSafe(req.query.retailers as string, 'retailerId', { min: 1 })]) : undefined,
        minRating: req.query.minRating ? parseFloatSafe(req.query.minRating as string, 'minRating', { min: 0, max: 5 }) : undefined,
        availability: req.query.availability ?
          (Array.isArray(req.query.availability) ?
            req.query.availability as string[] :
            [req.query.availability as string]) : undefined,
        sortBy: req.query.sortBy as "price_low" | "price_high" | "rating" | "popularity" || filters.sortBy,
      });

      // SECURITY: Use properly typed session data instead of 'as any'
      const userId = req.session.userId;
      const results = await advancedSearchService.searchProducts(filters, userId);
      
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
      res.json({
        results: results.map(result => ({
          product: result.product,
          relevanceScore: result.relevanceScore,
          matchType: result.matchType
        })),
        analysis,
        suggestions: analysis.suggestions,
        metadata: {
          totalResults: results.length,
          searchStrategy: 'smart_adaptive',
          detectedIntent: analysis.intent,
          confidence: analysis.confidence
        }
      });
      
    } catch (error) {
      logger.error('Smart search error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Smart search failed" });
    }
  });

  /**
   * Get faceted search filters (for building dynamic filter UI)
   */
  app.get("/api/search/facets", async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      
      // This would typically aggregate from search results
      // For now, return common facets
      const facets = {
        categories: [
          { value: 'Smartphones', count: 45 },
          { value: 'Laptops', count: 32 },
          { value: 'Audio', count: 28 },
          { value: 'Tablets', count: 18 }
        ],
        brands: [
          { value: 'Apple', count: 38 },
          { value: 'Samsung', count: 25 },
          { value: 'Sony', count: 15 },
          { value: 'LG', count: 12 }
        ],
        priceRanges: [
          { label: 'Under $100', min: 0, max: 100, count: 22 },
          { label: '$100 - $500', min: 100, max: 500, count: 34 },
          { label: '$500 - $1000', min: 500, max: 1000, count: 28 },
          { label: 'Over $1000', min: 1000, max: null, count: 16 }
        ],
        ratings: [
          { value: 4, label: '4+ stars', count: 67 },
          { value: 3, label: '3+ stars', count: 89 },
          { value: 2, label: '2+ stars', count: 95 }
        ],
        availability: [
          { value: 'in_stock', label: 'In Stock', count: 78 },
          { value: 'limited_stock', label: 'Limited Stock', count: 15 },
          { value: 'out_of_stock', label: 'Out of Stock', count: 7 }
        ]
      };
      
      res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=900');
      res.json({ facets });
      
    } catch (error) {
      logger.error('Facets error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to get search facets" });
    }
  });

  /**
   * Search statistics and performance metrics (admin only)
   */
  app.get("/api/search/stats", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // SECURITY: Using requireAdmin middleware for consistent authorization

      const stats = advancedSearchService.getStats();
      
      res.json({
        ...stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Search stats error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to get search statistics" });
    }
  });

  /**
   * Clear search caches (admin only)
   */
  app.post("/api/search/clear-cache", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // SECURITY: Using requireAdmin middleware for consistent authorization

      advancedSearchService.clearCaches();
      
      res.json({ message: "Search caches cleared successfully" });
      
    } catch (error) {
      logger.error('Clear cache error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to clear search caches" });
    }
  });

}