import { Express } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { forumStorage } from "../forum-storage";
import type { SearchFilters } from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, like } from 'drizzle-orm';
import { parseIntSafe, parseIntOptional, parseFloatSafe } from "../utils/validation-helpers";
import { cacheChartData } from "../middleware/chart-cache";
import {
  productCacheMiddleware,
  searchCacheMiddleware,
} from "../middleware/redis-cache";
import { logger } from "../utils/logger";

/**
 * Product Routes
 *
 * Handles product search, retrieval, price history, analytics, and predictions.
 */
export function registerProductRoutes(app: Express): void {
  // Search products with filters (supports URL-based search for browser extension)
  // Redis caching applied for better performance
  app.get("/api/products/search", searchCacheMiddleware, async (req, res) => {
    try {
      // If URL parameter is provided, search by product URL (for browser extension)
      if (req.query.url) {
        const productUrl = decodeURIComponent(req.query.url as string);

        // Search for product by URL in product offers
        const allProductOffers = await db
          .select({
            offer: schema.productOffers,
            product: schema.products,
            retailer: schema.retailers
          })
          .from(schema.productOffers)
          .innerJoin(schema.products, eq(schema.productOffers.productId, schema.products.id))
          .innerJoin(schema.retailers, eq(schema.productOffers.retailerId, schema.retailers.id))
          .where(like(schema.productOffers.productUrl, `%${productUrl}%`));

        if (allProductOffers.length === 0) {
          return res.json({ product: null });
        }

        // Get the first matching product
        const { product, offer, retailer } = allProductOffers[0];

        // Get all offers for this product
        const offers = await storage.getProductOffers(product.id);
        const prices = offers.map(o => parseFloat(o.price));
        const bestPrice = Math.min(...prices);

        return res.json({
          product: {
            ...product,
            offers,
            bestPrice
          }
        });
      }

      // Otherwise, use normal search filters
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
        page: req.query.page ? parseIntSafe(req.query.page as string, 'page', { min: 1 }) : 1,
        limit: req.query.limit ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 }) : 20,
      };

      const { products, pagination } = await storage.searchProducts(filters);

      // Add discussion counts to products (batch query to avoid N+1 problem)
      const productIds = products.map(p => p.id);
      const discussionCounts = await forumStorage.getProductDiscussionCounts(productIds);

      const productsWithDiscussions = products.map(product => ({
        ...product,
        discussionCount: discussionCounts.get(product.id) || 0,
        hasActiveDiscussion: (discussionCounts.get(product.id) || 0) > 0,
      }));

      // Return response in the format expected by the frontend
      res.json({
        results: productsWithDiscussions,
        metadata: pagination,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Get product by ID (with Redis caching)
  app.get("/api/products/:id", productCacheMiddleware, async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });

      const product = await storage.getProductById(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const discussionCount = await forumStorage.getProductDiscussionCount(id);
      const productWithDiscussions = {
        ...product,
        discussionCount,
        hasActiveDiscussion: discussionCount > 0,
      };

      res.json(productWithDiscussions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Get all products (for initial load)
  app.get("/api/products", async (req, res) => {
    try {
      const filters: SearchFilters = {
        sortBy: "popularity",
      };
      const products = await storage.searchProducts(filters);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Price History Endpoints
  // Get price history for a product (with caching)
  app.get("/api/products/:id/price-history", cacheChartData(3600), async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string);
      const retailerId = parseIntOptional(req.query.retailerId as string);

      let history;
      if (retailerId) {
        // Get history for specific retailer
        history = await storage.getRetailerPriceHistory(id, retailerId, days);
      } else {
        // Get history for all retailers
        history = await storage.getPriceHistory(id, days);
      }

      // Format for extension compatibility
      const formattedHistory = history.map(h => ({
        date: h.recordedAt instanceof Date ? h.recordedAt.toISOString() : h.recordedAt,
        price: parseFloat(h.price),
        retailerId: h.retailerId,
        retailerName: 'retailerName' in h ? h.retailerName : undefined,
        availability: h.availability
      }));

      res.json({ history: formattedHistory });
    } catch (error) {
      logger.error('Error fetching price history', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  // Get price trend analysis for a product
  app.get("/api/products/:id/price-trend", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const trendData = await storage.getPriceTrend(id);

      // Format for extension compatibility
      res.json({
        trend: {
          direction: trendData.trend,
          change: trendData.changePercentage,
          changePercent: trendData.changePercentage,
          currentPrice: trendData.currentPrice,
          averagePrice: trendData.averagePrice,
          lowestPrice: trendData.lowestPrice,
          highestPrice: trendData.highestPrice
        },
        prediction: trendData.trend === 'falling' ? 'might_drop' :
                   trendData.trend === 'rising' ? 'wait' : 'good_time'
      });
    } catch (error) {
      logger.error('Error fetching price trend', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      res.status(500).json({ message: "Failed to fetch price trend" });
    }
  });

  // Get best time to buy analysis for a product
  app.get("/api/products/:id/best-time-to-buy", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const analysis = await storage.getBestTimeToBuy(id);
      res.json(analysis);
    } catch (error) {
      logger.error('Error fetching best time to buy', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      res.status(500).json({ message: "Failed to fetch best time to buy analysis" });
    }
  });

  // Get price volatility score for a product
  app.get("/api/products/:id/volatility", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string);

      // Get price history
      const history = await storage.getPriceHistory(id, days);

      if (!history || history.length < 2) {
        return res.json(null);
      }

      // Calculate volatility using the calculator
      const { calculateVolatility } = await import('../utils/volatility-calculator');
      const volatility = calculateVolatility(history);

      res.json(volatility);
    } catch (error) {
      logger.error('Error calculating volatility', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      res.status(500).json({ message: "Failed to calculate price volatility" });
    }
  });

  // Get seasonal patterns for a product
  app.get("/api/products/:id/seasonal-patterns", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string);

      // Get price history (need at least several months for seasonal analysis)
      const history = await storage.getPriceHistory(id, days || 365); // Default to 1 year

      if (!history || history.length < 10) {
        return res.json(null);
      }

      // Detect seasonal patterns
      const { detectSeasonalPatterns } = await import('../utils/seasonal-pattern-detector');
      const patterns = detectSeasonalPatterns(history);

      res.json(patterns);
    } catch (error) {
      logger.error('Error detecting seasonal patterns', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      res.status(500).json({ message: "Failed to detect seasonal patterns" });
    }
  });

  // Get retailer reliability scores for a product
  app.get("/api/products/:id/retailer-reliability", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string);

      // Get price history for all retailers
      const history = await storage.getPriceHistory(id, days);

      if (!history || history.length < 5) {
        return res.json(null);
      }

      // Group data by retailer
      const retailerDataMap = new Map<number, any>();
      history.forEach(entry => {
        if (!retailerDataMap.has(entry.retailerId)) {
          retailerDataMap.set(entry.retailerId, {
            retailerId: entry.retailerId,
            retailerName: entry.retailerName,
            priceHistory: [],
          });
        }
        retailerDataMap.get(entry.retailerId)!.priceHistory.push({
          price: entry.price,
          recordedAt: entry.recordedAt,
          availability: entry.availability,
        });
      });

      const allRetailersData = Array.from(retailerDataMap.values());

      // Calculate reliability scores
      const { calculateAllRetailerReliability } = await import('../utils/retailer-reliability-calculator');
      const scores = calculateAllRetailerReliability(allRetailersData);

      res.json(scores);
    } catch (error) {
      logger.error('Error calculating retailer reliability', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      res.status(500).json({ message: "Failed to calculate retailer reliability" });
    }
  });

  // Get product offers (for browser extension)
  app.get("/api/products/:id/offers", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const offers = await storage.getProductOffers(id);

      // Format for extension
      const formattedOffers = offers.map(offer => ({
        id: offer.id,
        retailerId: offer.retailerId,
        retailerName: offer.retailer.name,
        retailerLogo: offer.retailer.logo,
        price: parseFloat(offer.price),
        originalPrice: offer.originalPrice ? parseFloat(offer.originalPrice) : null,
        rating: offer.rating ? parseFloat(offer.rating) : null,
        reviewCount: offer.reviewCount,
        availability: offer.availability,
        shippingInfo: offer.shippingInfo,
        dealType: offer.dealType,
        url: offer.productUrl,
        affiliateUrl: offer.affiliateUrl
      }));

      res.json({ offers: formattedOffers });
    } catch (error) {
      logger.error('Error fetching product offers', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      res.status(500).json({ message: "Failed to fetch product offers" });
    }
  });

  // Get price predictions for a product (for browser extension)
  app.get("/api/products/:id/price-predictions", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const days = parseIntOptional(req.query.days as string) || 7;

      // Get historical price data
      const history = await storage.getPriceHistory(id, 90); // Get 90 days of history

      if (history.length < 7) {
        // Not enough data for predictions
        return res.json({
          predictions: [],
          confidence: 'low',
          message: 'Not enough historical data for predictions'
        });
      }

      // Simple linear regression prediction
      const predictions = [];
      const prices = history.map(h => parseFloat(h.price));
      const recentPrices = prices.slice(-30); // Last 30 days

      // Calculate average change per day
      const avgChange = recentPrices.length >= 2
        ? (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices.length
        : 0;

      const lastPrice = prices[prices.length - 1];
      const today = new Date();

      for (let i = 1; i <= days; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + i);

        // Simple linear prediction with some randomness dampening
        const predictedPrice = lastPrice + (avgChange * i * 0.8); // 0.8 dampening factor

        predictions.push({
          date: futureDate.toISOString().split('T')[0],
          predictedPrice: Math.max(0, predictedPrice), // Ensure non-negative
          confidence: Math.max(0.3, 1 - (i / days) * 0.5) // Decreasing confidence
        });
      }

      res.json({
        predictions,
        confidence: recentPrices.length >= 30 ? 'medium' : 'low',
        basePrice: lastPrice,
        averageDailyChange: avgChange
      });
    } catch (error) {
      logger.error('Error fetching price predictions', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      res.status(500).json({ message: "Failed to fetch price predictions" });
    }
  });

  // Track product view (analytics for browser extension)
  app.post("/api/analytics/product-view", async (req, res) => {
    try {
      const { productId, source, retailer } = req.body;

      if (!productId) {
        return res.status(400).json({ error: "productId is required" });
      }

      // Log the view (in a production app, this would go to an analytics service)
      logger.info('Product view tracked', {
        productId,
        source: source || 'unknown',
        retailer: retailer || 'unknown',
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      // In the future, you could store this in a database table for analytics
      // For now, just acknowledge receipt
      res.json({ success: true });
    } catch (error) {
      logger.error('Error tracking product view', { error: error instanceof Error ? error.message : String(error), productId: req.body.productId });
      res.status(500).json({ error: "Failed to track product view" });
    }
  });
}
