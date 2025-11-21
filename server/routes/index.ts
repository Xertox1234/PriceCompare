import { Express } from "express";
import { createServer, type Server } from "http";
import { forumStorage } from "../forum-storage";
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

/**
 * Register all application routes
 *
 * This is the main entry point for route registration. It aggregates all domain-specific
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
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize forum categories (ensure defaults exist)
  await forumStorage.initializeDefaultCategories();

  // Register all route modules
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

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}

// Export helper functions for use in other route modules
export { withAuth, withAdmin, isAuthenticated } from "./helpers";
