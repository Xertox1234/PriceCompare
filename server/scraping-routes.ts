import type { Express, Request, Response } from "express";
import { CoordinationAgent } from './agents/coordinator-agent.js';
import { ProductDiscoveryAgent } from './agents/discovery-agent.js';
import { SearchOrchestrationAgent } from './agents/search-agent.js';
import { googleSearchService } from './services/google-search.js';
import { db } from './db.js';
import { scrapingJobs, trendingProducts, agentSessions } from '../shared/schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

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
  app.post("/api/scraping/initialize", async (req: Request, res: Response) => {
    try {
      await initializeAgents();
      res.json({ 
        success: true, 
        message: "AI scraping system initialized successfully" 
      });
    } catch (error) {
      console.error('Failed to initialize scraping system:', error);
      res.status(500).json({ 
        error: "Failed to initialize scraping system",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start AI agent coordination
  app.post("/api/scraping/start-agents", async (req: Request, res: Response) => {
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
      console.error('Failed to start agents:', error);
      res.status(500).json({ 
        error: "Failed to start AI agents",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Trigger trend discovery
  app.post("/api/scraping/discover-trends", async (req: Request, res: Response) => {
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
  app.get("/api/scraping/trending-products", async (req: Request, res: Response) => {
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
  app.get("/api/scraping/status", async (req: Request, res: Response) => {
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
  app.post("/api/scraping/search-product", async (req: Request, res: Response) => {
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
  app.post("/api/scraping/full-cycle", async (req: Request, res: Response) => {
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
  app.get("/api/scraping/google-search/test", async (req: Request, res: Response) => {
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
  app.post("/api/scraping/google-search", async (req: Request, res: Response) => {
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
  app.get("/api/scraping/google-search/status", async (req: Request, res: Response) => {
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
}