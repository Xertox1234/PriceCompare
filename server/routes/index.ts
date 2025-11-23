import { Express } from "express";
import { createServer, type Server } from "http";
import { forumStorage } from "../forum-storage";

// Core routes
import { registerHealthRoutes } from "./health-routes";
import { registerAuthRoutes } from "./auth-routes";
import { registerForumRoutes } from "./forum-routes";
import { registerAlertRoutes } from "./alert-routes";
import { registerRetailerRoutes } from "./retailer-routes";
import { registerProductRoutes } from "./product-routes";
import { registerAdminRoutes } from "./admin-routes";
import { registerWatchListRoutes } from "./watchlist-routes";
import aggregationMetricsRoutes from "./aggregation-metrics-routes";
import adminAggregationRoutes from "./admin-aggregation-routes";

// Feature routes (previously registered in server/index.ts)
import { registerScrapingRoutes } from "./scraping-routes";
import { registerMonitoringRoutes } from "./monitoring-routes";
import { registerAffiliateRoutes } from "./affiliate-routes";
import { registerDiscourseRoutes } from "./discourse-routes";
import { registerEnhancedForumRoutes } from "./enhanced-forum-routes";
import { registerAdvancedSearchRoutes } from "./advanced-search-routes";
import { registerPriceHistoryRoutes } from "./price-history-routes";
import { registerPriceAnalyticsRoutes } from "./price-analytics-routes";
import { registerNotificationRoutes } from "./notification-routes";
import { registerSmartAlertsRoutes } from "./smart-alerts-routes";
import { registerCommunityRoutes } from "./community-routes";
import wishlistRoutes from "./wishlist-routes";
import specificationRoutes from "./specification-routes";
import agentLimitsRoutes from "./agent-limits-routes";

/**
 * Register all application routes
 *
 * This is the single entry point for all route registration. It aggregates all
 * route modules and registers them with the Express app.
 *
 * Route organization:
 * - health-routes: Health check endpoints
 * - auth-routes: Authentication (register, login, logout, password reset)
 * - forum-routes: Forum functionality (categories, topics, posts)
 * - alert-routes: Price alerts management
 * - watchlist-routes: Watch list and product watch management
 * - retailer-routes: Retailer data
 * - product-routes: Product search, details, price history, analytics
 * - admin-routes: Admin panel (analytics, product/retailer management, performance)
 * - scraping-routes: AI-powered web scraping
 * - monitoring-routes: System monitoring dashboard
 * - affiliate-routes: Affiliate link generation
 * - discourse-routes: Discourse SSO integration
 * - enhanced-forum-routes: Enhanced forum capabilities
 * - advanced-search-routes: Advanced product search
 * - price-history-routes: Historical price data
 * - price-analytics-routes: Price trends and aggregations
 * - notification-routes: User notifications
 * - smart-alerts-routes: Advanced price alerting
 * - community-routes: Community features
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize forum categories (ensure defaults exist)
  await forumStorage.initializeDefaultCategories();

  // Register core route modules
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerForumRoutes(app);
  registerAlertRoutes(app);
  registerWatchListRoutes(app);
  registerRetailerRoutes(app);
  registerProductRoutes(app);
  registerAdminRoutes(app);
  app.use('/api/aggregation-metrics', aggregationMetricsRoutes);
  app.use('/api/admin/aggregation', adminAggregationRoutes);

  // Register feature route modules
  registerScrapingRoutes(app);
  registerMonitoringRoutes(app);
  registerAffiliateRoutes(app);
  registerDiscourseRoutes(app);
  registerEnhancedForumRoutes(app);
  registerAdvancedSearchRoutes(app);
  registerPriceHistoryRoutes(app);
  registerPriceAnalyticsRoutes(app);
  registerNotificationRoutes(app);
  registerSmartAlertsRoutes(app);
  registerCommunityRoutes(app);

  // Wishlist routes (simple "I want this" lists)
  app.use('/api/wishlists', wishlistRoutes);

  // Product specification routes
  app.use('/api', specificationRoutes);

  // Agent query limits routes
  app.use('/api/agent-limits', agentLimitsRoutes);

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}

// Export helper functions for use in other route modules
export { withAuth, withAdmin, isAuthenticated } from "./helpers";
