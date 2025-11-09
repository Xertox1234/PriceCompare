import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import session from "express-session";
import { registerRoutes } from "./routes";
import { registerScrapingRoutes } from "./scraping-routes";
import { registerAffiliateRoutes } from "./affiliate-routes";
import { registerHybridDataRoutes } from "./hybrid-data-routes";
import { registerDiscourseRoutes } from "./discourse-routes";
import { registerEnhancedForumRoutes } from "./enhanced-forum-routes";
import { registerAdvancedSearchRoutes } from "./advanced-search-routes";
import { setupVite, serveStatic, log } from "./vite";
import { passport } from "./auth";
import { apiCacheMiddleware } from "./middleware/cache";
import { securityHeaders, rateLimiter, sanitizeInput, corsMiddleware } from "./middleware/security";
import crypto from "crypto";

// Validate and get session secret
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET environment variable must be set in production. ' +
      'Generate a secure secret with: openssl rand -base64 32'
    );
  }
  
  // In development, generate a random secret and warn
  const generatedSecret = crypto.randomBytes(32).toString('base64');
  console.warn(
    '⚠️  WARNING: SESSION_SECRET not set. Using randomly generated secret.\n' +
    '   This is OK for development, but sessions will reset on server restart.\n' +
    '   For production, set SESSION_SECRET environment variable.'
  );
  return generatedSecret;
}

const app = express();

// Performance optimizations
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CORS configuration
app.use(corsMiddleware); // Handle cross-origin requests

// Security middleware
app.use(securityHeaders); // Comprehensive security headers

// Global rate limiting - 100 requests per 15 minutes per IP
app.use('/api', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later'
}));

// Stricter rate limiting for authentication endpoints
app.use('/api/auth', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // Only 10 login attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later'
}));

// Input sanitization
app.use(sanitizeInput);

// Session configuration
app.use(session({
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Apply caching middleware
app.use(apiCacheMiddleware);

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

(async () => {
  const server = await registerRoutes(app);
  
  // Register AI scraping routes
  registerScrapingRoutes(app);
  
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
})();
