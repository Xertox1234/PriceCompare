import { Express } from 'express';
import express from 'express';
import { storage } from '../storage';
import { getRedisClient, getRedisSessionClient } from '../config/redis';
import { createLogger } from '../utils/logger';
import { sendSuccess } from '../utils/api-response';

const cspLog = createLogger('CSP');

/**
 * CSP Violation Report structure
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#violation_report_syntax
 */
interface CspReport {
  'document-uri'?: string;
  'violated-directive'?: string;
  'blocked-uri'?: string;
  'source-file'?: string;
  'line-number'?: number;
  'column-number'?: number;
  'status-code'?: number;
  'original-policy'?: string;
  'effective-directive'?: string;
}

interface CspReportRequest {
  'csp-report'?: CspReport;
}

/**
 * Health Check Routes
 *
 * Provides health and readiness endpoints for monitoring.
 */
export function registerHealthRoutes(app: Express): void {
  // Basic health check (infrastructure endpoint)
  // NOTE: This endpoint uses raw JSON format (not standardized envelope)
  // for compatibility with orchestration systems (Kubernetes, Docker, load balancers)
  // that expect simple { status: "ok" } responses
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Detailed health check with database and Redis connectivity
  app.get('/api/health', async (req, res) => {
    const checks: Record<string, string> = {};
    let overallStatus = 'ok';

    // Check database connection
    try {
      const healthy = await storage.checkDatabaseHealth();
      checks.database = healthy ? 'ok' : 'error';
      if (!healthy) overallStatus = 'degraded';
    } catch (error: unknown) {
      checks.database = 'error';
      overallStatus = 'degraded';
    }

    // Check Redis cache client (ioredis)
    try {
      const redisClient = getRedisClient();
      if (redisClient) {
        await redisClient.ping();
        checks.redis_cache = 'ok';
      } else {
        checks.redis_cache = 'unavailable';
        // Redis is optional, so this is a warning not an error
        if (overallStatus === 'ok') overallStatus = 'degraded';
      }
    } catch (error: unknown) {
      checks.redis_cache = 'error';
      if (overallStatus === 'ok') overallStatus = 'degraded';
    }

    // Check Redis session client (redis package)
    try {
      const redisSessionClient = getRedisSessionClient();
      if (redisSessionClient) {
        await redisSessionClient.ping();
        checks.redis_sessions = 'ok';
      } else {
        checks.redis_sessions = 'unavailable';
        // Redis sessions are critical for production
        if (process.env.NODE_ENV === 'production') {
          overallStatus = 'error';
        } else if (overallStatus === 'ok') {
          overallStatus = 'degraded';
        }
      }
    } catch (error: unknown) {
      checks.redis_sessions = 'error';
      if (process.env.NODE_ENV === 'production') {
        overallStatus = 'error';
      } else if (overallStatus === 'ok') {
        overallStatus = 'degraded';
      }
    }

    const statusCode = overallStatus === 'error' ? 503 : 200;

    sendSuccess(
      res,
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        checks,
      },
      statusCode
    );
  });

  // CSP Violation Report Endpoint
  // SECURITY: Receives browser reports of CSP violations for monitoring
  // Browsers send violation reports to this endpoint when CSP blocks a resource
  app.post( // CSRF exempt: endpoint is called cross-origin by browsers; no user state mutation.
    '/api/csp-violation-report',
    express.json({ type: ['application/json', 'application/csp-report'] }),
    (req, res) => {
      // Browser sends violations in 'csp-report' wrapper
      // Type assertion safe since content-type is validated by express.json middleware
      const body = req.body as CspReportRequest | CspReport;
      // Extract report from wrapper if present, otherwise use body directly
      const report: CspReport =
        'csp-report' in body && body['csp-report'] !== undefined
          ? body['csp-report']
          : (body as CspReport);

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
        timestamp: new Date().toISOString(),
      });

      // Return 204 No Content - browser doesn't need response
      res.status(204).end();
    }
  );
}
