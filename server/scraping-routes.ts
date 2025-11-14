import type { Express, Request, Response } from "express";
import { logger } from "./utils/logger";
import { sendErrorResponse, ErrorMessages } from './utils/error-handler';
import { requireAuth, requireAdmin } from './auth';
import { validateRequest } from './validation';
import {
  scrapingInitializeSchema,
  scrapingSearchSchema,
  paginationSchema,
  trendingProductsQuerySchema,
  productSearchQuerySchema,
  googleSearchQuerySchema,
} from './validation/admin-schemas';
import { CoordinationAgent } from './agents/coordinator-agent.js';
import { ProductDiscoveryAgent } from './agents/discovery-agent.js';
import { SearchOrchestrationAgent } from './agents/search-agent.js';
import { googleSearchService } from './services/google-search.js';
import { db } from './db.js';
import { scrapingJobs, trendingProducts, agentSessions } from '../shared/schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

// Allowed retailer domains for SSRF protection
const ALLOWED_RETAILER_DOMAINS = [
  'amazon.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'ebay.com',
  'newegg.com',
  'bhphotovideo.com',
  'apple.com',
  'homedepot.com',
  'lowes.com',
  'macys.com',
  'nordstrom.com',
  'costco.com',
  'samsclub.com',
];

/**
 * Validates URL to prevent SSRF attacks
 * @param url - URL to validate
 * @returns { valid: boolean, error?: string, parsedUrl?: URL }
 */
function validateScrapingUrl(url: string): { valid: boolean; error?: string; parsedUrl?: URL } {
  try {
    const parsedUrl = new URL(url);

    // 1. Validate protocol - only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, error: 'Invalid URL protocol. Only HTTP and HTTPS are allowed.' };
    }

    // 2. Validate domain against whitelist
    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowedDomain = ALLOWED_RETAILER_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowedDomain) {
      return {
        valid: false,
        error: `Domain not allowed. Allowed domains: ${ALLOWED_RETAILER_DOMAINS.join(', ')}`
      };
    }

    // 3. Block internal/private IP addresses
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      // Check for private IP ranges
      const parts = hostname.split('.');
      const first = parseInt(parts[0]);
      const second = parseInt(parts[1]);

      // Block localhost, private networks, and link-local
      if (
        first === 127 || // 127.0.0.0/8 (localhost)
        first === 10 ||   // 10.0.0.0/8 (private)
        (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12 (private)
        (first === 192 && second === 168) || // 192.168.0.0/16 (private)
        (first === 169 && second === 254)    // 169.254.0.0/16 (link-local)
      ) {
        return { valid: false, error: 'Private and internal IP addresses are not allowed.' };
      }
    }

    // 4. Block localhost variations
    if (['localhost', '0.0.0.0', '::1', '::'].includes(hostname)) {
      return { valid: false, error: 'Localhost addresses are not allowed.' };
    }

    return { valid: true, parsedUrl };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

// Global agent instances
let coordinationAgent: CoordinationAgent | null = null;
let discoveryAgent: ProductDiscoveryAgent | null = null;
let searchAgent: SearchOrchestrationAgent | null = null;

// Initialize agents
async function initializeAgents() {
  if (!coordinationAgent) {
    coordinationAgent = new CoordinationAgent();
    await coordinationAgent.initialize();
  }
  
  if (!discoveryAgent) {
    discoveryAgent = new ProductDiscoveryAgent();
    await discoveryAgent.initialize();
  }
  
  if (!searchAgent) {
    searchAgent = new SearchOrchestrationAgent();
    await searchAgent.initialize();
  }
}

export function registerScrapingRoutes(app: Express): void {
  // Initialize AI scraping system
  app.post("/api/scraping/initialize", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await initializeAgents();
      res.json({ 
        success: true, 
        message: "AI scraping system initialized successfully" 
      });
    } catch (error) {
      sendErrorResponse(res, 500, error, 'Scraping Initialization');
    }
  });

  // Start AI agent coordination
  app.post("/api/scraping/start-agents", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await initializeAgents();
      
      if (coordinationAgent && !coordinationAgent.getStatus().isRunning) {
        await coordinationAgent.start();
      }
      
      res.json({ 
        success: true, 
        message: "AI agents started successfully",
        status: coordinationAgent?.getStatus()
      });
    } catch (error) {
      sendErrorResponse(res, 500, error, 'Start AI Agents');
    }
  });

  // Trigger trend discovery
  app.post(
    "/api/scraping/discover-trends",
    requireAuth,
    requireAdmin,
    validateRequest(scrapingInitializeSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        await initializeAgents();

        const { sources, categories, limit } = req.body;

        if (!coordinationAgent) {
          return res.status(500).json({ error: "Coordination agent not initialized" });
        }

        const result = await coordinationAgent.processTask({
          action: 'discover_trends',
          sources,
          categories,
          limit
        });

        res.json({
          success: true,
          message: "Trend discovery completed",
          result
        });
      } catch (error) {
        logger.error('Trend discovery failed:', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({
          error: "Trend discovery failed",
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Get trending products
  app.get(
    "/api/scraping/trending-products",
    requireAuth,
    requireAdmin,
    validateRequest(trendingProductsQuerySchema, 'query'),
    async (req: Request, res: Response) => {
      try {
        // SECURITY: Using validated query parameters (validated by middleware)
        const limit = Number(req.query.limit) || 20;
        const status = (req.query.status as string) || 'discovered';

        const products = await db.select()
          .from(trendingProducts)
          .where(eq(trendingProducts.status, status))
          .orderBy(desc(trendingProducts.trendScore))
          .limit(limit);

      res.json({ 
        success: true, 
        products,
        count: products.length
      });
    } catch (error) {
      logger.error('Failed to get trending products:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        error: "Failed to retrieve trending products",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get system status and metrics
  app.get("/api/scraping/status", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await initializeAgents();
      
      if (!coordinationAgent) {
        return res.status(500).json({ error: "Coordination agent not initialized" });
      }

      const systemStatus = await coordinationAgent.getSystemStatus();
      
      res.json({ 
        success: true, 
        systemStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get system status:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        error: "Failed to retrieve system status",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Manual product search
  app.post("/api/scraping/search-product",
    requireAuth,
    requireAdmin,
    validateRequest(productSearchQuerySchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        await initializeAgents();

        // SECURITY: Using validated request body
        const { productName, category, retailers = ['amazon', 'walmart', 'target'] } = req.body;

      if (!searchAgent) {
        return res.status(500).json({ error: "Search agent not initialized" });
      }

      const searchResults = await searchAgent.processTask({
        productName,
        category,
        retailers
      });

      res.json({ 
        success: true, 
        searchResults,
        count: searchResults.length
      });
    } catch (error) {
      logger.error('Product search failed:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        error: "Product search failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Run full scraping cycle
  app.post("/api/scraping/full-cycle", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await initializeAgents();
      
      if (!coordinationAgent) {
        return res.status(500).json({ error: "Coordination agent not initialized" });
      }

      // Run full cycle in background
      coordinationAgent.processTask({
        action: 'full_cycle',
        ...req.body
      }).catch(error => {
        logger.error('Full cycle failed:', { error: error instanceof Error ? error.message : String(error) });
      });

      res.json({ 
        success: true, 
        message: "Full scraping cycle initiated in background"
      });
    } catch (error) {
      logger.error('Failed to start full cycle:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        error: "Failed to start full cycle",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test Google Custom Search API connection
  app.get("/api/scraping/google-search/test", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const testResult = await googleSearchService.testConnection();
      res.json({
        success: testResult.success,
        message: testResult.message,
        results: testResult.results,
        usage: googleSearchService.getUsageStats()
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to test Google Custom Search API",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Search products using Google Custom Search
  app.post("/api/scraping/google-search",
    requireAuth,
    requireAdmin,
    validateRequest(googleSearchQuerySchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        // SECURITY: Using validated request body
        const { query, retailers = ['amazon.com', 'walmart.com', 'target.com'], maxResults = 5 } = req.body;

      if (!googleSearchService.isConfigured()) {
        return res.status(500).json({ 
          error: "Google Custom Search API not configured",
          message: "Please set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID environment variables"
        });
      }

      const results = await googleSearchService.searchMultipleRetailers(query, retailers, { 
        maxResultsPerRetailer: maxResults 
      });

      const totalResults = results.reduce((sum, retailer) => sum + retailer.results.length, 0);
      const productUrls = results.flatMap(retailer => 
        googleSearchService.extractProductUrls(retailer.results)
      );

      res.json({
        success: true,
        query,
        totalResults,
        productUrls: productUrls.length,
        results: results.map(retailer => ({
          retailer: retailer.retailer,
          resultCount: retailer.results.length,
          productUrls: googleSearchService.extractProductUrls(retailer.results),
          topResults: retailer.results.slice(0, 3).map(result => ({
            title: result.title,
            link: result.link,
            snippet: result.snippet
          }))
        }))
      });

    } catch (error) {
      logger.error('Google Custom Search failed:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: "Google Custom Search failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get Google Custom Search API usage statistics
  app.get("/api/scraping/google-search/status", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const usage = googleSearchService.getUsageStats();
      res.json({
        success: true,
        configured: usage.configured,
        status: {
          apiKey: usage.apiKey ? 'configured' : 'missing',
          searchEngineId: usage.searchEngineId ? 'configured' : 'missing'
        },
        message: usage.configured 
          ? 'Google Custom Search API is properly configured'
          : 'Google Custom Search API requires configuration'
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to get Google Custom Search status",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Extract product data from specific URLs
  app.post("/api/scraping/extract-product", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { url, retailer, searchQuery } = req.body;

      if (!url) {
        return res.status(400).json({ error: "Product URL is required" });
      }

      // SECURITY: Validate URL to prevent SSRF attacks
      const urlValidation = validateScrapingUrl(url);
      if (!urlValidation.valid) {
        return res.status(400).json({ error: urlValidation.error });
      }

      // Import the extraction agent dynamically to avoid initialization issues
      const { dataExtractionAgent } = await import('./agents/extraction-agent');
      
      const result = await dataExtractionAgent.processTask({
        action: 'extract_product_data',
        url,
        retailer: retailer || 'unknown',
        searchQuery
      });

      res.json({
        success: result.success,
        data: result.data,
        message: result.success ? 'Product data extracted successfully' : 'Extraction failed'
      });

    } catch (error) {
      logger.error('Product extraction failed:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: "Product extraction failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start price monitoring for existing products
  app.post("/api/scraping/start-monitoring", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { maxAge = 24 } = req.body;
      
      // Import the monitoring agent dynamically
      const { priceMonitoringAgent } = await import('./agents/monitoring-agent');
      
      // Start monitoring tasks in background
      priceMonitoringAgent.scheduleMonitoringTasks().catch(error => {
        logger.error('Monitoring tasks failed:', { error: error instanceof Error ? error.message : String(error) });
      });

      res.json({
        success: true,
        message: "Price monitoring initiated",
        monitoring: {
          maxAge: maxAge + " hours",
          status: "active"
        }
      });

    } catch (error) {
      logger.error('Failed to start monitoring:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: "Failed to start monitoring",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get monitoring statistics
  app.get("/api/scraping/monitoring-stats", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // Import the monitoring agent dynamically
      const { priceMonitoringAgent } = await import('./agents/monitoring-agent');
      
      const stats = await priceMonitoringAgent.getMonitoringStats();
      
      res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Failed to get monitoring stats:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: "Failed to get monitoring statistics",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Run complete product discovery and extraction workflow
  app.post("/api/scraping/complete-workflow", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { searchQuery, maxResults = 5 } = req.body;
      
      if (!searchQuery) {
        return res.status(400).json({ error: "Search query is required" });
      }

      // Step 1: Search for products using Google Custom Search
      const searchResults = await googleSearchService.searchMultipleRetailers(
        searchQuery, 
        ['amazon.com', 'walmart.com', 'target.com'], 
        { maxResultsPerRetailer: maxResults }
      );

      const productUrls = searchResults.flatMap(retailer => 
        googleSearchService.extractProductUrls(retailer.results)
      );

      if (productUrls.length === 0) {
        return res.json({
          success: false,
          message: "No product URLs found",
          searchResults: searchResults.length
        });
      }

      // Step 2: Extract product data from found URLs (process first few to avoid timeout)
      const { dataExtractionAgent } = await import('./agents/extraction-agent');
      const extractionResults = [];
      
      for (const url of productUrls.slice(0, 3)) { // Limit to 3 for demo
        try {
          const retailerDomain = new URL(url).hostname;
          const result = await dataExtractionAgent.processTask({
            action: 'extract_product_data',
            url,
            retailer: retailerDomain,
            searchQuery
          });
          
          if (result.success) {
            extractionResults.push({
              url,
              retailer: retailerDomain,
              product: result.data
            });
          }
        } catch (error) {
          logger.error(`Failed to extract from ${url}:`, { error: error instanceof Error ? error.message : String(error) });
        }
      }

      res.json({
        success: true,
        searchQuery,
        urlsFound: productUrls.length,
        productsExtracted: extractionResults.length,
        products: extractionResults,
        message: `Found ${productUrls.length} URLs, extracted ${extractionResults.length} products`
      });

    } catch (error) {
      logger.error('Complete workflow failed:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: "Complete workflow failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get Redis cache statistics
  app.get("/api/scraping/cache-stats", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { queryCache, generalCache } = await import('./services/redis-cache.js');

      const queryCacheStats = queryCache.getStats();
      const generalCacheStats = generalCache.getStats();

      // Test connectivity
      const queryPing = await queryCache.ping();
      const generalPing = await generalCache.ping();

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        queryCache: {
          ...queryCacheStats,
          healthy: queryPing,
          hitRatePercent: Math.round(queryCacheStats.hitRate * 100)
        },
        generalCache: {
          ...generalCacheStats,
          healthy: generalPing,
          hitRatePercent: Math.round(generalCacheStats.hitRate * 100)
        },
        overall: {
          totalHits: queryCacheStats.hits + generalCacheStats.hits,
          totalMisses: queryCacheStats.misses + generalCacheStats.misses,
          totalSets: queryCacheStats.sets + generalCacheStats.sets,
          totalErrors: queryCacheStats.errors + generalCacheStats.errors,
          combinedHitRate: (queryCacheStats.hits + generalCacheStats.hits) /
            (queryCacheStats.hits + generalCacheStats.hits + queryCacheStats.misses + generalCacheStats.misses) || 0
        }
      });

    } catch (error) {
      logger.error('Failed to get cache stats:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: "Failed to retrieve cache statistics",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clear Redis cache (admin only)
  app.post("/api/scraping/cache-clear", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { queryCache, generalCache } = await import('./services/redis-cache.js');
      const { cacheType } = req.body; // 'query', 'general', or 'all'

      let clearedQuery = false;
      let clearedGeneral = false;

      if (cacheType === 'query' || cacheType === 'all') {
        clearedQuery = await queryCache.clear();
      }

      if (cacheType === 'general' || cacheType === 'all') {
        clearedGeneral = await generalCache.clear();
      }

      res.json({
        success: true,
        message: `Cache cleared successfully`,
        cleared: {
          query: clearedQuery,
          general: clearedGeneral
        }
      });

    } catch (error) {
      logger.error('Failed to clear cache:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: "Failed to clear cache",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}