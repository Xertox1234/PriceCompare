import { Express } from "express";
import { storage } from "../storage";
import { forumStorage } from "../forum-storage";
import type { SearchFilters } from "@shared/schema";
import { parseIntSafe, parseIntOptional, parseFloatSafe } from "../utils/validation-helpers";
import {
  productCacheMiddleware,
  searchCacheMiddleware,
  redisCacheMiddleware,
} from "../middleware/redis-cache";
import { CACHE_DURATION } from "../utils/constants";
import { logger } from "../utils/logger";
import { csrfProtection } from "../middleware/security";
import { sendSuccess, sendError, sendPaginated, sendErrorFromException } from "../utils/api-response";

// Price history cache middleware - using redis cache with 1 hour TTL
const priceHistoryCacheMiddleware = redisCacheMiddleware({
  ttl: CACHE_DURATION.VERY_LONG, // 1 hour
  keyGenerator: (req) => `cache:price-history:${req.params.id}:${req.query.days || '30'}:${req.query.retailerId || 'all'}`,
});

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

        // Search for product by URL using storage layer
        const result = await storage.getProductByUrl(productUrl);

        if (!result) {
          sendSuccess(res, { product: null });
          return;
        }

        const { product } = result;

        // Get all offers for this product
        const offers = await storage.getProductOffers(product.id);
        const prices = offers.map(o => parseFloat(o.price));
        const bestPrice = Math.min(...prices);

        sendSuccess(res, {
          product: {
            ...product,
            offers,
            bestPrice
          }
        });
        return;
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

      // Return standardized paginated response
      sendPaginated(res, productsWithDiscussions, {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'SearchProducts');
    }
  });

  // Get product by ID (with Redis caching)
  app.get("/api/products/:id", productCacheMiddleware, async (req, res) => {
    try {
      // SECURITY: Safe integer parsing with validation
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });

      const product = await storage.getProductById(id);
      if (!product) {
        sendError(res, "Product not found", 404);
        return;
      }

      const discussionCount = await forumStorage.getProductDiscussionCount(id);
      const productWithDiscussions = {
        ...product,
        discussionCount,
        hasActiveDiscussion: discussionCount > 0,
      };

      sendSuccess(res, productWithDiscussions);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchProduct');
    }
  });

  // Get all products (for initial load)
  app.get("/api/products", async (req, res) => {
    try {
      const filters: SearchFilters = {
        sortBy: "popularity",
      };
      const { products, pagination } = await storage.searchProducts(filters);
      sendPaginated(res, products, pagination);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'FetchProducts');
    }
  });

  // Price History Endpoints
  // Get price history for a product (with caching)
  app.get("/api/products/:id/price-history", priceHistoryCacheMiddleware, async (req, res) => {
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

      sendSuccess(res, { history: formattedHistory });
    } catch (error: unknown) {
      logger.error('Error fetching price history', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      sendErrorFromException(res, error, 'FetchPriceHistory');
    }
  });

  // Get price trend analysis for a product
  app.get("/api/products/:id/price-trend", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const trendData = await storage.getPriceTrend(id);

      // Format for extension compatibility
      sendSuccess(res, {
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
    } catch (error: unknown) {
      logger.error('Error fetching price trend', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      sendErrorFromException(res, error, 'FetchPriceTrend');
    }
  });

  // Get best time to buy analysis for a product
  app.get("/api/products/:id/best-time-to-buy", async (req, res) => {
    try {
      const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
      const analysis = await storage.getBestTimeToBuy(id);
      sendSuccess(res, analysis);
    } catch (error: unknown) {
      logger.error('Error fetching best time to buy', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      sendErrorFromException(res, error, 'FetchBestTimeToBuy');
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
        sendSuccess(res, null);
        return;
      }

      // Calculate volatility using the calculator
      const { calculateVolatility } = await import('../utils/volatility-calculator');
      const volatility = calculateVolatility(history);

      sendSuccess(res, volatility);
    } catch (error: unknown) {
      logger.error('Error calculating volatility', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      sendErrorFromException(res, error, 'CalculateVolatility');
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
        sendSuccess(res, null);
        return;
      }

      // Detect seasonal patterns
      const { detectSeasonalPatterns } = await import('../utils/seasonal-pattern-detector');
      const patterns = detectSeasonalPatterns(history);

      sendSuccess(res, patterns);
    } catch (error: unknown) {
      logger.error('Error detecting seasonal patterns', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      sendErrorFromException(res, error, 'DetectSeasonalPatterns');
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
        sendSuccess(res, null);
        return;
      }

      // Group data by retailer
      interface RetailerAnalysisData {
        retailerId: number;
        retailerName: string;
        priceHistory: Array<{ price: string; recordedAt: Date; availability: string }>;
      }
      const retailerDataMap = new Map<number, RetailerAnalysisData>();
      history.forEach(entry => {
        if (!retailerDataMap.has(entry.retailerId)) {
          retailerDataMap.set(entry.retailerId, {
            retailerId: entry.retailerId,
            retailerName: entry.retailerName || 'Unknown',
            priceHistory: [],
          });
        }
        retailerDataMap.get(entry.retailerId)!.priceHistory.push({
          price: entry.price,
          recordedAt: entry.recordedAt,
          availability: entry.availability || 'unknown',
        });
      });

      const allRetailersData = Array.from(retailerDataMap.values());

      // Calculate reliability scores
      const { calculateAllRetailerReliability } = await import('../utils/retailer-reliability-calculator');
      const scores = calculateAllRetailerReliability(allRetailersData);

      sendSuccess(res, scores);
    } catch (error: unknown) {
      logger.error('Error calculating retailer reliability', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      sendErrorFromException(res, error, 'CalculateRetailerReliability');
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

      sendSuccess(res, { offers: formattedOffers });
    } catch (error: unknown) {
      logger.error('Error fetching product offers', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      sendErrorFromException(res, error, 'FetchProductOffers');
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
        const lastPrice = history.length > 0 ? parseFloat(history[history.length - 1].price) : 0;
        sendSuccess(res, {
          predictions: [],
          confidence: 'low',
          basePrice: lastPrice,
          message: 'Not enough historical data for predictions'
        });
        return;
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

      sendSuccess(res, {
        predictions,
        confidence: recentPrices.length >= 30 ? 'medium' : 'low',
        basePrice: lastPrice,
        averageDailyChange: avgChange
      });
    } catch (error: unknown) {
      logger.error('Error fetching price predictions', { error: error instanceof Error ? error.message : String(error), productId: req.params.id });
      sendErrorFromException(res, error, 'FetchPricePredictions');
    }
  });

  // Track product view (analytics for browser extension)
  app.post("/api/analytics/product-view", csrfProtection, async (req, res) => {
    try {
      const { productId, source, retailer } = req.body;

      if (!productId) {
        sendError(res, "productId is required", 400);
        return;
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
      sendSuccess(res, { success: true });
    } catch (error: unknown) {
      logger.error('Error tracking product view', { error: error instanceof Error ? error.message : String(error), productId: req.body.productId });
      sendErrorFromException(res, error, 'TrackProductView');
    }
  });
}
