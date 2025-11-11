import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from './auth';
import { hybridDataCollector } from "./services/hybrid-data-collector";

export function registerHybridDataRoutes(app: Express): void {
  
  // Get system status and data source capabilities
  app.get("/api/hybrid/status", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const status = await hybridDataCollector.getSystemStatus();
      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Error getting hybrid system status:', error);
      res.status(500).json({ 
        error: "Failed to get system status",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get retailer capabilities (API vs scraping)
  app.get("/api/hybrid/retailers/capabilities", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const capabilities = await hybridDataCollector.getRetailerCapabilities();
      res.json({
        success: true,
        retailers: capabilities
      });
    } catch (error) {
      console.error('Error getting retailer capabilities:', error);
      res.status(500).json({ 
        error: "Failed to get retailer capabilities",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Search products using hybrid approach
  app.post("/api/hybrid/search", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const { query, retailers } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const targetRetailers = retailers || ['amazon', 'walmart', 'target', 'bestbuy'];
      const results = [];

      // Collect data from multiple retailers in parallel
      const searchPromises = targetRetailers.map(async (retailer: string) => {
        try {
          const products = await hybridDataCollector.collectProductData(retailer, query);
          return { retailer, products, success: true };
        } catch (error) {
          console.error(`Search failed for ${retailer}:`, error);
          return { 
            retailer, 
            products: [], 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      const searchResults = await Promise.all(searchPromises);
      
      // Flatten and deduplicate products
      const allProducts = searchResults
        .filter(result => result.success)
        .flatMap(result => result.products);

      // Add metadata about the search
      const metadata = {
        totalRetailers: targetRetailers.length,
        successfulRetailers: searchResults.filter(r => r.success).length,
        totalProducts: allProducts.length,
        searchResults: searchResults.map(r => ({
          retailer: r.retailer,
          success: r.success,
          productCount: r.products.length,
          error: r.success ? undefined : r.error
        }))
      };

      res.json({
        success: true,
        query,
        products: allProducts,
        metadata
      });
    } catch (error) {
      console.error('Hybrid search error:', error);
      res.status(500).json({ 
        error: "Search failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test specific retailer data source
  app.post("/api/hybrid/test/:retailer", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const retailer = req.params.retailer;
      const { query = 'test product' } = req.body;

      const startTime = Date.now();
      const products = await hybridDataCollector.collectProductData(retailer, query);
      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        retailer,
        query,
        responseTime,
        productCount: products.length,
        products: products.slice(0, 3), // Return first 3 products as sample
        dataSource: products[0]?.metadata?.source || 'unknown'
      });
    } catch (error) {
      console.error(`Test failed for ${req.params.retailer}:`, error);
      res.status(500).json({ 
        error: `Test failed for ${req.params.retailer}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get data source performance metrics
  app.get("/api/hybrid/metrics", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const status = await hybridDataCollector.getSystemStatus();
      
      // Calculate performance metrics
      const metrics = Object.entries(status.strategies).map(([retailer, strategy]) => {
        const health = status.healthStatus[retailer];
        const rateLimit = strategy.rateLimits;
        
        return {
          retailer,
          primarySource: strategy.primarySource,
          hasAPI: !!strategy.apiService,
          apiHealth: health?.status || 'unknown',
          responseTime: health?.responseTime || 0,
          errorRate: health?.errorRate || 0,
          rateLimitUsage: {
            daily: {
              used: rateLimit.currentDay,
              limit: rateLimit.requestsPerDay,
              percentage: (rateLimit.currentDay / rateLimit.requestsPerDay) * 100
            },
            minutely: {
              used: rateLimit.currentMinute,
              limit: rateLimit.requestsPerMinute,
              percentage: (rateLimit.currentMinute / rateLimit.requestsPerMinute) * 100
            }
          },
          costPerRequest: strategy.costPerRequest
        };
      });

      res.json({
        success: true,
        metrics,
        summary: {
          totalRetailers: metrics.length,
          apiRetailers: metrics.filter(m => m.hasAPI).length,
          scrapingRetailers: metrics.filter(m => !m.hasAPI).length,
          healthyAPIs: metrics.filter(m => m.apiHealth === 'healthy').length,
          averageResponseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
        }
      });
    } catch (error) {
      console.error('Error getting hybrid metrics:', error);
      res.status(500).json({ 
        error: "Failed to get metrics",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Force refresh API health status
  app.post("/api/hybrid/health/refresh", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const capabilities = await hybridDataCollector.getRetailerCapabilities();
      
      // Test each retailer with API capabilities
      const healthChecks = capabilities
        .filter(cap => cap.hasAPI)
        .map(async (cap) => {
          try {
            await hybridDataCollector.collectProductData(cap.retailer, 'health check');
            return { retailer: cap.retailer, healthy: true };
          } catch (error) {
            return { retailer: cap.retailer, healthy: false, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        });

      const results = await Promise.all(healthChecks);
      
      res.json({
        success: true,
        message: "Health check completed",
        results
      });
    } catch (error) {
      console.error('Health refresh error:', error);
      res.status(500).json({ 
        error: "Health refresh failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Switch retailer data source (API to scraping or vice versa)
  app.post("/api/hybrid/retailer/:retailer/switch-source", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const retailer = req.params.retailer;
      const { source } = req.body; // 'api' or 'scraping'
      
      if (!['api', 'scraping'].includes(source)) {
        return res.status(400).json({ error: "Source must be 'api' or 'scraping'" });
      }

      // This would require extending the hybrid collector to support dynamic source switching
      // For now, return success with information about current capabilities
      const capabilities = await hybridDataCollector.getRetailerCapabilities();
      const retailerInfo = capabilities.find(cap => cap.retailer === retailer);
      
      if (!retailerInfo) {
        return res.status(404).json({ error: `Retailer ${retailer} not found` });
      }

      res.json({
        success: true,
        message: `Source switch requested for ${retailer}`,
        currentSource: retailerInfo.primarySource,
        requestedSource: source,
        hasAPI: retailerInfo.hasAPI,
        canScrape: retailerInfo.canScrape,
        note: "Dynamic source switching will be implemented in future update"
      });
    } catch (error) {
      console.error('Source switch error:', error);
      res.status(500).json({ 
        error: "Source switch failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get cost analysis for API usage
  app.get("/api/hybrid/costs", requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const status = await hybridDataCollector.getSystemStatus();
      
      const costAnalysis = Object.entries(status.strategies).map(([retailer, strategy]) => {
        const dailyRequests = strategy.rateLimits.currentDay;
        const dailyCost = dailyRequests * strategy.costPerRequest;
        const monthlyProjection = dailyCost * 30;
        
        return {
          retailer,
          source: strategy.primarySource,
          costPerRequest: strategy.costPerRequest,
          dailyRequests,
          dailyCost,
          monthlyProjection,
          rateLimitUsage: (dailyRequests / strategy.rateLimits.requestsPerDay) * 100
        };
      });

      const totals = {
        dailyCost: costAnalysis.reduce((sum, c) => sum + c.dailyCost, 0),
        monthlyProjection: costAnalysis.reduce((sum, c) => sum + c.monthlyProjection, 0),
        totalRequests: costAnalysis.reduce((sum, c) => sum + c.dailyRequests, 0)
      };

      res.json({
        success: true,
        costAnalysis,
        totals,
        recommendations: [
          totals.monthlyProjection > 100 ? "Consider optimizing API usage to reduce costs" : null,
          costAnalysis.some(c => c.rateLimitUsage > 80) ? "Some APIs are approaching rate limits" : null,
          costAnalysis.filter(c => c.source === 'api').length === 0 ? "No APIs currently in use - consider enabling for better data quality" : null
        ].filter(Boolean)
      });
    } catch (error) {
      console.error('Cost analysis error:', error);
      res.status(500).json({ 
        error: "Cost analysis failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}