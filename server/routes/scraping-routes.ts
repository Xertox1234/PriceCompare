/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- Express req.body is typed as any, requires runtime validation */
import type { Express, Request, Response } from "express";
import { logger } from "../utils/logger";
import { sendSuccess, sendError, sendErrorFromException } from "../utils/api-response";
import { csrfProtection } from '../middleware/security';
import { requireAuth, requireAdmin } from '../auth';
import { validateRequest } from '../validation';
import {
  scrapingInitializeSchema,
  trendingProductsQuerySchema,
  productSearchQuerySchema,
  googleSearchQuerySchema,
} from '../validation/admin-schemas';
import { agentService } from '../services/agent-service';
import { googleSearchService } from '../services/google-search';
import { storage } from '../storage';

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
  } catch (error: unknown) {
    return { valid: false, error: 'Invalid URL format.' };
  }
}


export function registerScrapingRoutes(app: Express): void {
  // Initialize AI scraping system
  app.post("/api/scraping/initialize", csrfProtection, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await agentService.initialize();
      sendSuccess(res, {
        success: true,
        message: "AI scraping system initialized successfully"
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'ScrapingInitialization');
    }
  });

  // Start AI agent coordination
  app.post("/api/scraping/start-agents", csrfProtection, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const coordinationAgent = await agentService.getCoordinationAgent();

      if (!coordinationAgent.getStatus().isRunning) {
        await coordinationAgent.start();
      }

      sendSuccess(res, {
        success: true,
        message: "AI agents started successfully",
        status: coordinationAgent.getStatus()
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'StartAIAgents');
    }
  });

  // Trigger trend discovery
  app.post(
    "/api/scraping/discover-trends",
    csrfProtection,
    requireAuth,
    requireAdmin,
    validateRequest(scrapingInitializeSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const coordinationAgent = await agentService.getCoordinationAgent();

        const { sources, categories, limit } = req.body;

        const result = await coordinationAgent.processTask({
          action: 'discover_trends',
          sources,
          categories,
          limit
        });

        sendSuccess(res, {
          success: true,
          message: "Trend discovery completed",
          result
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'TrendDiscovery');
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

        const products = await storage.getTrendingProducts(status, limit);

        sendSuccess(res, {
          success: true,
          products,
          count: products.length
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'FetchTrendingProducts');
      }
    });

  // Get system status and metrics
  app.get("/api/scraping/status", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const coordinationAgent = await agentService.getCoordinationAgent();

      const systemStatus = await coordinationAgent.getSystemStatus();

      sendSuccess(res, {
        success: true,
        systemStatus,
        agentServiceStatus: agentService.getStatus(),
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchSystemStatus');
    }
  });

  // Manual product search
  app.post("/api/scraping/search-product",
    csrfProtection,
    requireAuth,
    requireAdmin,
    validateRequest(productSearchQuerySchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const searchAgent = await agentService.getSearchAgent();

        // SECURITY: Using validated request body
        const { productName, category, retailers = ['amazon', 'walmart', 'target'] } = req.body;

        const searchResults = await searchAgent.processTask({
          action: 'search_products',
          productName,
          category,
          retailers
        });

        sendSuccess(res, {
          success: true,
          searchResults,
          count: searchResults.length
        });
      } catch (error: unknown) {
        sendErrorFromException(res, error, 'ProductSearch');
      }
    });

  // Run full scraping cycle
  app.post("/api/scraping/full-cycle", csrfProtection, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const coordinationAgent = await agentService.getCoordinationAgent();

      // Run full cycle in background
      coordinationAgent.processTask({
        action: 'full_cycle',
        ...req.body
      }).catch(error => {
        logger.error('Full cycle failed:', { error: error instanceof Error ? error.message : String(error) });
      });

      sendSuccess(res, {
        success: true,
        message: "Full scraping cycle initiated in background"
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'StartFullCycle');
    }
  });

  // Test Google Custom Search API connection
  app.get("/api/scraping/google-search/test", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const testResult = await googleSearchService.testConnection();
      sendSuccess(res, {
        success: testResult.success,
        message: testResult.message,
        results: testResult.results,
        usage: googleSearchService.getUsageStats()
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'TestGoogleSearch');
    }
  });

  // Search products using Google Custom Search
  app.post("/api/scraping/google-search",
    csrfProtection,
    requireAuth,
    requireAdmin,
    validateRequest(googleSearchQuerySchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        // SECURITY: Using validated request body
        const { query, retailers = ['amazon.com', 'walmart.com', 'target.com'], maxResults = 5 } = req.body;

      if (!googleSearchService.isConfigured()) {
        sendError(res, "Google Custom Search API not configured. Please set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID environment variables", 500);
        return;
      }

      const results = await googleSearchService.searchMultipleRetailers(query, retailers, {
        maxResultsPerRetailer: maxResults
      });

      const totalResults = results.reduce((sum, retailer) => sum + retailer.results.length, 0);
      const productUrls = results.flatMap(retailer =>
        googleSearchService.extractProductUrls(retailer.results)
      );

      sendSuccess(res, {
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

    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GoogleCustomSearch');
    }
  });

  // Get Google Custom Search API usage statistics
  app.get("/api/scraping/google-search/status", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const usage = googleSearchService.getUsageStats();
      sendSuccess(res, {
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
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetGoogleSearchStatus');
    }
  });

  // Extract product data from specific URLs
  app.post("/api/scraping/extract-product", csrfProtection, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { url, retailer, searchQuery } = req.body;

      if (!url) {
        sendError(res, "Product URL is required", 400);
        return;
      }

      // SECURITY: Validate URL to prevent SSRF attacks
      const urlValidation = validateScrapingUrl(url);
      if (!urlValidation.valid) {
        sendError(res, urlValidation.error || "Invalid URL", 400);
        return;
      }

      // Import the extraction agent dynamically to avoid initialization issues
      const { dataExtractionAgent } = await import('../agents/extraction-agent');

      const result = await dataExtractionAgent.processTask({
        action: 'extract_product_data',
        url,
        retailer: retailer || 'unknown',
        searchQuery
      });

      sendSuccess(res, {
        success: result.success,
        data: result.success ? result.data : undefined,
        message: result.success ? 'Product data extracted successfully' : 'Extraction failed'
      });

    } catch (error: unknown) {
      sendErrorFromException(res, error, 'ProductExtraction');
    }
  });

  // Start price monitoring for existing products
  app.post("/api/scraping/start-monitoring", csrfProtection, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { maxAge = 24 } = req.body;

      // Import the monitoring agent dynamically
      const { priceMonitoringAgent } = await import('../agents/monitoring-agent');

      // Start monitoring tasks in background
      priceMonitoringAgent.scheduleMonitoringTasks().catch(error => {
        logger.error('Monitoring tasks failed:', { error: error instanceof Error ? error.message : String(error) });
      });

      sendSuccess(res, {
        success: true,
        message: "Price monitoring initiated",
        monitoring: {
          maxAge: maxAge + " hours",
          status: "active"
        }
      });

    } catch (error: unknown) {
      sendErrorFromException(res, error, 'StartMonitoring');
    }
  });

  // Get monitoring statistics
  app.get("/api/scraping/monitoring-stats", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // Import the monitoring agent dynamically
      const { priceMonitoringAgent } = await import('../agents/monitoring-agent');

      const stats = await priceMonitoringAgent.getMonitoringStats();

      sendSuccess(res, {
        success: true,
        stats
      });

    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetMonitoringStats');
    }
  });

  // Run complete product discovery and extraction workflow
  app.post("/api/scraping/complete-workflow", csrfProtection, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { searchQuery, maxResults = 5 } = req.body;

      if (!searchQuery) {
        sendError(res, "Search query is required", 400);
        return;
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
        sendSuccess(res, {
          success: false,
          message: "No product URLs found",
          searchResults: searchResults.length
        });
        return;
      }

      // Step 2: Extract product data from found URLs (process first few to avoid timeout)
      const { dataExtractionAgent } = await import('../agents/extraction-agent');
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
        } catch (error: unknown) {
          logger.error(`Failed to extract from ${url}:`, { error: error instanceof Error ? error.message : String(error) });
        }
      }

      sendSuccess(res, {
        success: true,
        searchQuery,
        urlsFound: productUrls.length,
        productsExtracted: extractionResults.length,
        products: extractionResults,
        message: `Found ${productUrls.length} URLs, extracted ${extractionResults.length} products`
      });

    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CompleteWorkflow');
    }
  });

  // Get Redis cache statistics
  app.get("/api/scraping/cache-stats", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { queryCache, generalCache } = await import('../services/redis-cache');

      const queryCacheStats = queryCache.getStats();
      const generalCacheStats = generalCache.getStats();

      // Test connectivity
      const queryPing = await queryCache.ping();
      const generalPing = await generalCache.ping();

      sendSuccess(res, {
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

    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetCacheStats');
    }
  });

  // Clear Redis cache (admin only)
  app.post("/api/scraping/cache-clear", csrfProtection, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { queryCache, generalCache } = await import('../services/redis-cache');
      const { cacheType } = req.body; // 'query', 'general', or 'all'

      let clearedQuery = false;
      let clearedGeneral = false;

      if (cacheType === 'query' || cacheType === 'all') {
        clearedQuery = await queryCache.clear();
      }

      if (cacheType === 'general' || cacheType === 'all') {
        clearedGeneral = await generalCache.clear();
      }

      sendSuccess(res, {
        success: true,
        message: `Cache cleared successfully`,
        cleared: {
          query: clearedQuery,
          general: clearedGeneral
        }
      });

    } catch (error: unknown) {
      sendErrorFromException(res, error, 'ClearCache');
    }
  });
}