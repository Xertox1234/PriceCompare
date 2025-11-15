// IMPORTANT: Sentry must be initialized FIRST before any other imports
import { initializeSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler } from "./config/sentry";

// Initialize Sentry error monitoring
initializeSentry();

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import session from "express-session";
import { registerRoutes } from "./routes";
import { registerScrapingRoutes } from "./scraping-routes";
import { registerMonitoringRoutes } from "./monitoring-routes";
import { registerAffiliateRoutes } from "./affiliate-routes";
import { registerHybridDataRoutes } from "./hybrid-data-routes";
import { registerDiscourseRoutes } from "./discourse-routes";
import { registerEnhancedForumRoutes } from "./enhanced-forum-routes";
import { registerAdvancedSearchRoutes } from "./advanced-search-routes";
import { registerPriceHistoryRoutes } from "./price-history-routes";
import { registerPriceAnalyticsRoutes } from "./price-analytics-routes";
import { registerNotificationRoutes } from "./notification-routes";
import { registerSmartAlertsRoutes } from "./smart-alerts-routes";
import { registerCommunityRoutes } from "./community-routes";
import { setupVite, serveStatic, log } from "./vite";
import { websocketService } from "./services/websocket-service";
import { passport } from "./auth";
import { apiCacheMiddleware } from "./middleware/cache";
import { securityHeaders, rateLimiter, sanitizeInput, corsMiddleware, attachCsrfToken, csrfProtection } from "./middleware/security";
import { createRateLimiter as redisRateLimiter } from "./middleware/redis-rate-limiter";
import { performanceMonitoring, getPerformanceStats, getSlowestEndpoints } from "./middleware/performance";
import { validateEnvironment, getRequiredEnv } from "./config/env-validation";
import { requestSizeLimiter, DEFAULT_SIZE_LIMITS } from "./middleware/request-limits";
import { initializeRedis } from "./config/redis";
import { createSessionStore } from "./config/session-store";
import { cleanupExpiredTokens } from "./services/password-reset-service";
import { initializePriceSnapshotScheduler, triggerManualSnapshot } from "./jobs/price-snapshot-queue";
import { startPriceHistoryJobs } from "./jobs/price-history-jobs";
import { startPriceAnalyticsJobs } from "./jobs/price-analytics-jobs";
import { errorHandler, setupGlobalErrorHandlers } from "./middleware/error-handler";
import { RATE_LIMIT, SESSION } from "./utils/constants";

// Validate environment variables on startup
validateEnvironment();

// Setup global error handlers for uncaught exceptions and unhandled rejections
setupGlobalErrorHandlers();

const app = express();

// SENTRY: Request handler must be first middleware
app.use(sentryRequestHandler);
app.use(sentryTracingHandler);

// Performance optimizations
app.use(compression()); // Enable gzip compression

// SECURITY: Per-endpoint request size limits (prevents DoS via large payloads)
app.use(requestSizeLimiter(DEFAULT_SIZE_LIMITS));

// Parse JSON and URL-encoded bodies with default limits
app.use(express.json({ limit: DEFAULT_SIZE_LIMITS.default }));
app.use(express.urlencoded({ extended: false, limit: DEFAULT_SIZE_LIMITS.default }));

// CORS configuration
app.use(corsMiddleware); // Handle cross-origin requests

// Security middleware
app.use(securityHeaders); // Comprehensive security headers

// Input sanitization
app.use(sanitizeInput);

(async () => {
  // Initialize Redis for distributed features (sessions, rate limiting, lockouts)
  log('Initializing Redis connection...');
  const redisClient = await initializeRedis();

  // CRITICAL: Redis is mandatory in production for distributed rate limiting and sessions
  if (!redisClient && process.env.NODE_ENV === 'production') {
    log('❌ FATAL: Redis is required in production but connection failed');
    log('   Please ensure Redis is running and accessible at: ' + (process.env.REDIS_URL || 'redis://localhost:6379'));
    log('   Production requires Redis for:');
    log('   - Distributed rate limiting across multiple instances');
    log('   - Session storage and management');
    log('   - Account lockout tracking');
    log('   - Caching and performance optimization');
    process.exit(1);
  }

  // SECURITY: Setup rate limiting (Redis-based if available, otherwise in-memory)
  const rateLimiterMiddleware = redisClient ? redisRateLimiter : rateLimiter;
  const limiterSource = redisClient ? 'Redis (distributed)' : 'in-memory (single server)';
  log(`Rate limiting using: ${limiterSource}`);

  // Global rate limiting - 100 requests per 15 minutes per IP
  app.use('/api', rateLimiterMiddleware({
    windowMs: RATE_LIMIT.WINDOW_MS,
    maxRequests: RATE_LIMIT.MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later'
  }));

  // Stricter rate limiting for authentication endpoints
  app.use('/api/auth', rateLimiterMiddleware({
    windowMs: RATE_LIMIT.WINDOW_MS,
    maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
    message: 'Too many authentication attempts, please try again later'
  }));

  // Create session store (Redis or in-memory fallback)
  const sessionStore = await createSessionStore(redisClient);

  // Session configuration
  app.use(session({
    store: sessionStore,
    secret: getRequiredEnv('SESSION_SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION.MAX_AGE,
    },
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // SECURITY: Attach CSRF token to all responses
  // This middleware adds X-CSRF-Token header for clients to use
  app.use(attachCsrfToken);

  // Apply caching middleware
  app.use(apiCacheMiddleware);

  // Apply performance monitoring middleware
  app.use(performanceMonitoring);

  // SECURITY: CSRF protection for state-changing operations
  // Must be after session initialization
  app.use(csrfProtection);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });
  const server = await registerRoutes(app);
  
  // Register AI scraping routes
  registerScrapingRoutes(app);

  // Register monitoring and dashboard routes
  registerMonitoringRoutes(app);

  // Register affiliate routes
  registerAffiliateRoutes(app);
  
  // Register hybrid data collection routes
  registerHybridDataRoutes(app);
  
  // Register Discourse SSO routes
  registerDiscourseRoutes(app);
  
  // Register enhanced forum routes
  registerEnhancedForumRoutes(app);
  
  // Register advanced search routes
  registerAdvancedSearchRoutes(app);

  // Register price history routes
  registerPriceHistoryRoutes(app);

  // Register price analytics routes (trends and aggregates)
  registerPriceAnalyticsRoutes(app);

  // Register notification routes
  registerNotificationRoutes(app);

  // Register smart alerts routes
  registerSmartAlertsRoutes(app);

  // Register community routes
  registerCommunityRoutes(app);

  // Initialize advanced caching system
  const { initializeAdvancedCache, performInitialCacheWarming } = await import("./cache-initialization");
  await initializeAdvancedCache(app);
  log("Advanced caching system initialized");

  // Initialize WebSocket service for real-time dashboard updates
  websocketService.initialize(server);
  log("WebSocket service initialized for real-time monitoring");

  // SENTRY: Error handler must be BEFORE custom error handler
  app.use(sentryErrorHandler);

  // Centralized error handling (must be after all routes)
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Start price history scheduled jobs
  startPriceHistoryJobs();

  // Start price analytics scheduled jobs (aggregation and trend analysis)
  startPriceAnalyticsJobs();

  // Password reset token cleanup - run every hour
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  setInterval(async () => {
    try {
      const deletedCount = await cleanupExpiredTokens();
      if (deletedCount > 0) {
        log(`Cleaned up ${deletedCount} expired password reset token(s)`);
      }
    } catch (error) {
      log(`Error cleaning up expired tokens: ${error}`, 'error');
    }
  }, CLEANUP_INTERVAL);

  // Run cleanup immediately on startup
  try {
    const deletedCount = await cleanupExpiredTokens();
    if (deletedCount > 0) {
      log(`Initial cleanup: removed ${deletedCount} expired password reset token(s)`);
    }
  } catch (error) {
    log(`Error during initial token cleanup: ${error}`, 'error');
  }

  // Initialize price snapshot scheduler
  try {
    log('Initializing price snapshot scheduler...');
    initializePriceSnapshotScheduler();
    log('Price snapshot scheduler initialized successfully');

    // Optionally trigger an initial snapshot on startup (only if database has data)
    // Uncomment the following lines to enable initial snapshot:
    // log('Triggering initial price snapshot...');
    // await triggerManualSnapshot();
  } catch (error) {
    log(`Error initializing price snapshot scheduler: ${error}`, 'error');
  }

  // Perform initial cache warming (non-blocking)
  performInitialCacheWarming().catch(error => {
    log(`Error during initial cache warming: ${error}`, 'error');
  });
})();
