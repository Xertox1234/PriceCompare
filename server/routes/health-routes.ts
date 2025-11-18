import { Express } from "express";
import { db } from "../db";
import { sql } from 'drizzle-orm';
import { getRedisClient, getRedisSessionClient } from '../config/redis';

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
      await db.execute(sql`SELECT 1`);
      checks.database = "ok";
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
}
