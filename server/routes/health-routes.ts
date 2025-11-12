import { Express } from "express";
import { db } from "../db";
import { sql } from 'drizzle-orm';

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

  // Detailed health check with database connectivity
  app.get("/api/health", async (req, res) => {
    try {
      // Check database connection
      await db.execute(sql`SELECT 1`);

      res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: "ok"
        }
      });
    } catch (error) {
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        checks: {
          database: "error"
        }
      });
    }
  });
}
