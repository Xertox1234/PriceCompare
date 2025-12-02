// Load environment variables from .env file
import 'dotenv/config';

// IMPORTANT: Sentry must be initialized FIRST before any other imports
import { initializeSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler } from "./config/sentry";

// Initialize Sentry error monitoring
initializeSentry();

import express from "express";
import compression from "compression";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { websocketService } from "./services/websocket-service";
import { passport } from "./auth";
import { apiCacheMiddleware } from "./middleware/cache";
import { securityHeaders, rateLimiter, sanitizeInput, corsMiddleware, attachCsrfToken } from "./middleware/security";
import { createRateLimiter as redisRateLimiter } from "./middleware/redis-rate-limiter";
import { performanceMonitoring } from "./middleware/performance";
import { validateEnvironment, getRequiredEnv } from "./config/env-validation";
import { requestSizeLimiter, DEFAULT_SIZE_LIMITS } from "./middleware/request-limits";
import { initializeRedis, getRedisSessionClient, closeRedis } from "./config/redis";
import { createSessionStore } from "./config/session-store";
import { cleanupExpiredTokens } from "./services/password-reset-service";
import { initializePriceSnapshotScheduler } from "./jobs/price-snapshot-queue";
import { startPriceHistoryJobs } from "./jobs/price-history-jobs";
import { startPriceAnalyticsJobs } from "./jobs/price-analytics-jobs";
import { startPriceAggregationJobs } from "./jobs/price-aggregation-job";
import { initializeNotificationProcessor } from "./jobs/notification-processor";
import { errorHandler, setupGlobalErrorHandlers } from "./middleware/error-handler";
import { RATE_LIMIT, SESSION } from "./utils/constants";
import { cleanupManager } from "./utils/cleanup-manager";
import { createLogger } from "./utils/logger";
import { initializeWebSocket, shutdownWebSocket } from "./websocket/index";
import { advancedCache } from "./services/advanced-cache";
import { initializeEventSubscriptions, cleanupEventSubscriptions } from "./services/event-subscriptions";
import { storageCache } from "./services/storage-cache";

const serverLog = createLogger('Server');

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

  // CRITICAL: Redis is mandatory in production for distributed operations
  const isProduction = process.env.NODE_ENV === 'production';

  if (!redisClient) {
    if (isProduction) {
      // Production: Redis initialization already threw error in initializeRedis()
      // This should never be reached, but added as safety check
      log('❌ FATAL: Redis is required in production but not available');
      log('   Please ensure Redis is running and REDIS_URL is set');
      process.exit(1);
    } else {
      // Development: Log prominent warnings about in-memory fallback
      log('⚠️  ================================ WARNING ================================');
      log('⚠️  Running in DEVELOPMENT mode WITHOUT Redis');
      log('⚠️  Using in-memory fallbacks for rate limiting and sessions');
      log('⚠️  This is NOT suitable for production deployment');
      log('⚠️  ========================================================================');
    }
  }

  // SECURITY: Setup rate limiting
  // Production: MUST use Redis (fail fast if unavailable - checked above)
  // Development: Fallback to in-memory with warnings
  const limiterSource = redisClient ? 'Redis (distributed)' : 'in-memory (single server)';
  log(`Rate limiting using: ${limiterSource}`);

  // Additional production safety check for rate limiter
  if (isProduction && !redisClient) {
    log('❌ FATAL: Cannot use in-memory rate limiting in production');
    log('   Production requires distributed rate limiting via Redis');
    process.exit(1);
  }

  // Global rate limiting with tiered limits (Redis only) or flat limits (in-memory fallback)
  if (redisClient) {
    // Redis available: Use tiered rate limiting based on user role
    // - Free/Anonymous: 50 req/15min (0.5x multiplier)
    // - User: 100 req/15min (1x baseline)
    // - Premium: 500 req/15min (5x multiplier)
    // - Moderator: 1000 req/15min (10x multiplier)
    // - Admin: 10,000 req/15min (100x multiplier)
    app.use('/api', redisRateLimiter({
      windowMs: RATE_LIMIT.WINDOW_MS,
      maxRequests: RATE_LIMIT.MAX_REQUESTS,
      message: 'Too many requests from this IP, please try again later',
      tiers: {}, // Enable tiered limits with default multipliers from RATE_LIMIT_TIERS
    }));

    // Stricter rate limiting for authentication endpoints (NO TIERS for security)
    // All users get same strict limit to prevent credential stuffing attacks
    app.use('/api/auth', redisRateLimiter({
      windowMs: RATE_LIMIT.WINDOW_MS,
      maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
      message: 'Too many authentication attempts, please try again later',
      // No tiers property = strict limit for all users
    }));
  } else {
    // Redis unavailable: Use in-memory rate limiting (development only)
    // No tiered limits - all users get same flat limit
    app.use('/api', rateLimiter({
      windowMs: RATE_LIMIT.WINDOW_MS,
      maxRequests: RATE_LIMIT.MAX_REQUESTS,
      message: 'Too many requests from this IP, please try again later',
    }));

    app.use('/api/auth', rateLimiter({
      windowMs: RATE_LIMIT.WINDOW_MS,
      maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
      message: 'Too many authentication attempts, please try again later',
    }));
  }

  // Create session store (Redis or in-memory fallback)
  // Use the Redis session client (from 'redis' package) for connect-redis v9 compatibility
  const redisSessionClient = getRedisSessionClient();
  const sessionStore = await createSessionStore(redisSessionClient);

  // Session configuration
  // Store session middleware for WebSocket authentication
  const sessionMiddleware = session({
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
  });

  app.use(sessionMiddleware);

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

  // NOTE: CSRF protection is applied per-route in individual route files,
  // not globally. This ensures GET requests aren't protected while mutations are.
  // Each POST/PUT/PATCH/DELETE endpoint includes csrfProtection middleware.
  // See server/routes/*.ts files for csrfProtection usage.

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson: unknown, ...args) {
      capturedJsonResponse = bodyJson as Record<string, unknown>;
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

  // Initialize advanced caching system
  const { initializeAdvancedCache, performInitialCacheWarming } = await import("./cache-initialization");
  await initializeAdvancedCache(app);
  log("Advanced caching system initialized");

  // Initialize WebSocket service for real-time dashboard updates
  websocketService.initialize(server);
  log("WebSocket service initialized for real-time monitoring");

  // Initialize WebSocket server for watch list real-time notifications
  // Pass session middleware for authentication
  initializeWebSocket(server, sessionMiddleware);
  log("WebSocket server initialized for watch list notifications (path: /ws)");

  // Initialize event bus subscriptions (must be after services are loaded)
  // This connects services via event bus to avoid circular dependencies
  initializeEventSubscriptions();
  log("Event subscriptions initialized");

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

  // Serve the app on configured port (defaults to 5000)
  // this serves both the API and the client.
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, async () => {
    log(`serving on port ${port}`);

    // Warm critical caches (retailers) to eliminate first-request cache misses
    await storageCache.warmCaches();
  });

  // Log cache performance metrics every minute
  const CACHE_METRICS_INTERVAL = 60 * 1000; // 1 minute
  const cacheMetricsInterval = setInterval(() => {
    storageCache.logCacheMetrics();
  }, CACHE_METRICS_INTERVAL);
  cleanupManager.addInterval('cache-metrics', cacheMetricsInterval);

  // Log initial cache metrics on startup
  storageCache.logCacheMetrics();

  // Start price history scheduled jobs
  startPriceHistoryJobs();

  // Start price analytics scheduled jobs (aggregation and trend analysis)
  startPriceAnalyticsJobs();

  // Start price aggregation scheduled jobs (daily/weekly/monthly aggregates and cleanup)
  startPriceAggregationJobs();

  // Password reset token cleanup - run every hour
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  const tokenCleanupInterval = setInterval(() => {
    void (async () => {
      try {
        const deletedCount = await cleanupExpiredTokens();
        if (deletedCount > 0) {
          log(`Cleaned up ${deletedCount} expired password reset token(s)`);
        }
      } catch (error) {
        log(`Error cleaning up expired tokens: ${error}`, 'error');
      }
    })();
  }, CLEANUP_INTERVAL);
  cleanupManager.addInterval('token-cleanup', tokenCleanupInterval);

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

  // Initialize smart notification processor
  try {
    log('Initializing smart notification processor...');
    initializeNotificationProcessor();
    log('Smart notification processor initialized successfully');
  } catch (error) {
    log(`Error initializing notification processor: ${error}`, 'error');
  }

  // Perform initial cache warming (non-blocking)
  performInitialCacheWarming().catch(error => {
    log(`Error during initial cache warming: ${error}`, 'error');
  });
})().catch(error => {
  serverLog.error('Fatal error during server startup', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  log(`${signal} received, starting graceful shutdown...`);

  try {
    // Step 1: Stop all timers and cleanup intervals
    log('Running cleanup manager...');
    await cleanupManager.cleanup();
    const stats = cleanupManager.getStats();
    log(`Cleaned up ${stats.intervals} intervals and ran ${stats.cleanupHandlers} handlers`);

    // Step 2: Close WebSocket connections
    log('Closing WebSocket connections...');
    await websocketService.shutdown();
    await shutdownWebSocket();
    log('WebSocket connections closed');

    // Step 2.5: Cleanup event bus subscriptions
    log('Cleaning up event subscriptions...');
    cleanupEventSubscriptions();
    log('Event subscriptions cleaned up');

    // Step 3: Close advanced cache (pub/sub subscriber)
    log('Closing advanced cache service...');
    await advancedCache.close();
    log('Advanced cache service closed');

    // Step 4: Close Redis connections (both ioredis and redis clients)
    log('Closing Redis connections...');
    await closeRedis();
    log('Redis connections closed');

    // Exit process
    log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    serverLog.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
