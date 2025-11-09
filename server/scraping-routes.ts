import type { Express, Request, Response } from "express";
import { sendErrorResponse, ErrorMessages } from './utils/error-handler';
import { CoordinationAgent } from './agents/coordinator-agent.js';
import { ProductDiscoveryAgent } from './agents/discovery-agent.js';
import { SearchOrchestrationAgent } from './agents/search-agent.js';
import { googleSearchService } from './services/google-search.js';
import { db } from './db.js';
import { scrapingJobs, trendingProducts, agentSessions } from '../shared/schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

// Authentication middleware
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req: any, res: Response, next: Function) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

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
  app.post("/api/scraping/initialize", requireAuth, requireAdmin, async (req: any, res: Response) => {
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
  app.post("/api/scraping/start-agents", requireAuth, requireAdmin, async (req: any, res: Response) => {
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
  app.post("/api/scraping/discover-trends", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      await initializeAgents();
      
      const { sources = ['google_trends', 'seasonal'], categories, limit = 20 } = req.body;
      
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
      console.error('Trend discovery failed:', error);
      res.status(500).json({ 
        error: "Trend discovery failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get trending products
  app.get("/api/scraping/trending-products", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const { limit = 50, status = 'discovered' } = req.query;
      
      const products = await db.select()
        .from(trendingProducts)
        .where(eq(trendingProducts.status, status as string))
        .orderBy(desc(trendingProducts.trendScore))
        .limit(parseInt(limit as string));

      res.json({ 
        success: true, 
        products,
        count: products.length
      });
    } catch (error) {
      console.error('Failed to get trending products:', error);
      res.status(500).json({ 
        error: "Failed to retrieve trending products",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get system status and metrics
  app.get("/api/scraping/status", requireAuth, requireAdmin, async (req: any, res: Response) => {
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
      console.error('Failed to get system status:', error);
      res.status(500).json({ 
        error: "Failed to retrieve system status",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Manual product search
  app.post("/api/scraping/search-product", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      await initializeAgents();
      
      const { productName, category, retailers = ['amazon', 'walmart', 'target'] } = req.body;
      
      if (!productName) {
        return res.status(400).json({ error: "Product name is required" });
      }

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
      console.error('Product search failed:', error);
      res.status(500).json({ 
        error: "Product search failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Run full scraping cycle
  app.post("/api/scraping/full-cycle", requireAuth, requireAdmin, async (req: any, res: Response) => {
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
        console.error('Full cycle failed:', error);
      });

      res.json({ 
        success: true, 
        message: "Full scraping cycle initiated in background"
      });
    } catch (error) {
      console.error('Failed to start full cycle:', error);
      res.status(500).json({ 
        error: "Failed to start full cycle",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test Google Custom Search API connection
  app.get("/api/scraping/google-search/test", requireAuth, requireAdmin, async (req: any, res: Response) => {
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
  app.post("/api/scraping/google-search", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const { query, retailers = ['amazon.com', 'walmart.com', 'target.com'], maxResults = 5 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }

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
      console.error('Google Custom Search failed:', error);
      res.status(500).json({
        error: "Google Custom Search failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get Google Custom Search API usage statistics
  app.get("/api/scraping/google-search/status", requireAuth, requireAdmin, async (req: any, res: Response) => {
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
  app.post("/api/scraping/extract-product", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const { url, retailer, searchQuery } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "Product URL is required" });
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
      console.error('Product extraction failed:', error);
      res.status(500).json({
        error: "Product extraction failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start price monitoring for existing products
  app.post("/api/scraping/start-monitoring", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const { maxAge = 24 } = req.body;
      
      // Import the monitoring agent dynamically
      const { priceMonitoringAgent } = await import('./agents/monitoring-agent');
      
      // Start monitoring tasks in background
      priceMonitoringAgent.scheduleMonitoringTasks().catch(error => {
        console.error('Monitoring tasks failed:', error);
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
      console.error('Failed to start monitoring:', error);
      res.status(500).json({
        error: "Failed to start monitoring",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get monitoring statistics
  app.get("/api/scraping/monitoring-stats", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      // Import the monitoring agent dynamically
      const { priceMonitoringAgent } = await import('./agents/monitoring-agent');
      
      const stats = await priceMonitoringAgent.getMonitoringStats();
      
      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Failed to get monitoring stats:', error);
      res.status(500).json({
        error: "Failed to get monitoring statistics",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Run complete product discovery and extraction workflow
  app.post("/api/scraping/complete-workflow", requireAuth, requireAdmin, async (req: any, res: Response) => {
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
          console.error(`Failed to extract from ${url}:`, error);
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
      console.error('Complete workflow failed:', error);
      res.status(500).json({
        error: "Complete workflow failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}