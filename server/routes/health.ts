/**
 * Health Check Routes
 *
 * Provides endpoints for load balancers, Kubernetes probes, and monitoring systems.
 * These endpoints verify service health and dependency availability.
 *
 * Endpoints:
 * - GET /health - Basic liveness check (fast, no dependencies)
 * - GET /health/ready - Readiness check (verifies all dependencies)
 * - GET /health/detailed - Deep diagnostics (dev/auth only)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { storage } from '../storage';
import { getRedisClient } from '../config/redis';

export const healthRouter = Router();

interface HealthCheck {
  status: 'pass' | 'fail';
  latencyMs?: number;
  message?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

/**
 * Basic liveness check - fast, no dependencies
 * Used by load balancers for quick health verification
 *
 * GET /health
 *
 * Returns 200 if the process is running.
 * This endpoint is designed to be extremely fast and reliable.
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Readiness check - verifies all dependencies
 * Used by Kubernetes for readiness probes
 * Returns 503 if any critical dependency is down
 *
 * GET /health/ready
 *
 * Checks:
 * - PostgreSQL database connectivity
 * - Redis connectivity (degraded if unavailable)
 *
 * Status codes:
 * - 200: All dependencies healthy or degraded
 * - 503: Critical dependency (database) is down
 */
healthRouter.get('/health/ready', async (_req: Request, res: Response): Promise<void> => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    uptime: process.uptime(),
    checks: {
      database: { status: 'fail' },
      redis: { status: 'fail' },
    },
    memory: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };

  // Check PostgreSQL connectivity via storage layer (TODO 270: Use storage, not direct db)
  try {
    const dbStart = Date.now();
    const healthy = await storage.checkDatabaseHealth();
    health.checks.database = {
      status: healthy ? 'pass' : 'fail',
      latencyMs: Date.now() - dbStart,
    };
    if (!healthy) {
      health.status = 'unhealthy';
    }
  } catch (error) {
    health.checks.database = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'unhealthy';
  }

  // Check Redis connectivity
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const redisStart = Date.now();
      await redisClient.ping();
      health.checks.redis = {
        status: 'pass',
        latencyMs: Date.now() - redisStart,
      };
    } catch (error) {
      health.checks.redis = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      // Redis down = degraded (can still serve cached data)
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }
  } else {
    // Redis not configured (development mode)
    health.checks.redis = {
      status: 'fail',
      message: 'Redis not configured',
    };
    // In development, missing Redis = degraded, not unhealthy
    if (health.status === 'healthy' && process.env.NODE_ENV !== 'production') {
      health.status = 'degraded';
    }
  }

  // Return appropriate status code
  // 200: healthy or degraded (service can still operate)
  // 503: unhealthy (critical dependency down)
  const statusCode = health.status === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json(health);
});

/**
 * Deep health check - detailed diagnostics
 * Only accessible in non-production or with auth
 *
 * GET /health/detailed
 *
 * Requires:
 * - Development environment OR
 * - X-Health-Key header matching HEALTH_CHECK_KEY env var
 *
 * Returns detailed system diagnostics including:
 * - Environment info
 * - Node.js version
 * - Process info (PID, uptime)
 * - Memory usage (detailed)
 * - CPU usage
 */
healthRouter.get('/health/detailed', (req: Request, res: Response): void => {
  // Only allow detailed checks in development or with special header
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-health-key'] !== process.env.HEALTH_CHECK_KEY
  ) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const detailed = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    uptime: process.uptime(),
    pid: process.pid,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  };

  res.json(detailed);
});
