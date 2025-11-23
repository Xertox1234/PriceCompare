import { Express } from "express";
import express from 'express';
import { storage } from "../storage";
import { getRedisClient, getRedisSessionClient } from '../config/redis';
import { createLogger } from '../utils/logger';

const cspLog = createLogger('CSP');

/**
 * Health Check Routes
 *
 * Provides health and readiness endpoints for monitoring.
 */
export function registerHealthRoutes(app: Express): void {
  // Basic health check
  app.get("/health", async (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Detailed health check with database and Redis connectivity
  app.get("/api/health", async (req, res) => {
    const checks: Record<string, string> = {};
    let overallStatus = "ok";

    // Check database connection
    try {
      const healthy = await storage.checkDatabaseHealth();
      checks.database = healthy ? "ok" : "error";
      if (!healthy) overallStatus = "degraded";
    } catch (error: unknown) {
      checks.database = "error";
      overallStatus = "degraded";
    }

    // Check Redis cache client (ioredis)
    try {
      const redisClient = getRedisClient();
      if (redisClient) {
        await redisClient.ping();
        checks.redis_cache = "ok";
      } else {
        checks.redis_cache = "unavailable";
        // Redis is optional, so this is a warning not an error
        if (overallStatus === "ok") overallStatus = "degraded";
      }
    } catch (error: unknown) {
      checks.redis_cache = "error";
      if (overallStatus === "ok") overallStatus = "degraded";
    }

    // Check Redis session client (redis package)
    try {
      const redisSessionClient = getRedisSessionClient();
      if (redisSessionClient) {
        await redisSessionClient.ping();
        checks.redis_sessions = "ok";
      } else {
        checks.redis_sessions = "unavailable";
        // Redis sessions are critical for production
        if (process.env.NODE_ENV === 'production') {
          overallStatus = "error";
        } else if (overallStatus === "ok") {
          overallStatus = "degraded";
        }
      }
    } catch (error: unknown) {
      checks.redis_sessions = "error";
      if (process.env.NODE_ENV === 'production') {
        overallStatus = "error";
      } else if (overallStatus === "ok") {
        overallStatus = "degraded";
      }
    }

    const statusCode = overallStatus === "error" ? 503 : 200;

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks
    });
  });

  // CSP Violation Report Endpoint
  // SECURITY: Receives browser reports of CSP violations for monitoring
  // Browsers send violation reports to this endpoint when CSP blocks a resource
  app.post("/api/csp-violation-report",
    express.json({ type: ['application/json', 'application/csp-report'] }),
    (req, res) => {
      // Browser sends violations in 'csp-report' wrapper
      const report = req.body['csp-report'] || req.body;

      // Log violation with structured data for analysis
      cspLog.warn('CSP Violation Detected', {
        documentUri: report['document-uri'],
        violatedDirective: report['violated-directive'],
        blockedUri: report['blocked-uri'],
        sourceFile: report['source-file'],
        lineNumber: report['line-number'],
        columnNumber: report['column-number'],
        statusCode: report['status-code'],
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });

      // Return 204 No Content - browser doesn't need response
      res.status(204).end();
    }
  );
}
