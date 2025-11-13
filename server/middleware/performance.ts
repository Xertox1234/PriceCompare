import type { Request, Response, NextFunction } from 'express';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
}

// In-memory store for performance metrics (last 1000 requests)
const performanceLog: PerformanceMetrics[] = [];
const MAX_LOG_SIZE = 1000;

// Thresholds for performance warnings
const THRESHOLDS = {
  WARN: 1000, // 1 second
  CRITICAL: 5000, // 5 seconds
};

/**
 * Performance monitoring middleware
 * Tracks request duration and logs slow requests
 */
export function performanceMonitoring(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const originalEnd = res.end;

  // Override res.end to capture metrics
  res.end = function (chunk?: any, encoding?: any, callback?: any): any {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const method = req.method;
    const endpoint = req.path;

    // Store metrics
    const metrics: PerformanceMetrics = {
      endpoint,
      method,
      duration,
      statusCode,
      timestamp: new Date(),
    };

    // Add to log (maintain max size)
    performanceLog.push(metrics);
    if (performanceLog.length > MAX_LOG_SIZE) {
      performanceLog.shift(); // Remove oldest
    }

    // Log performance issues
    if (duration > THRESHOLDS.CRITICAL) {
      logger.error(
        `🚨 CRITICAL PERFORMANCE: ${method} ${endpoint} took ${duration}ms (${statusCode})`
      );
    } else if (duration > THRESHOLDS.WARN) {
      logger.warn(
        `⚠️  SLOW REQUEST: ${method} ${endpoint} took ${duration}ms (${statusCode})`
      );
    }

    // Call original end
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
}

/**
 * Get performance statistics
 */
export function getPerformanceStats() {
  if (performanceLog.length === 0) {
    return {
      totalRequests: 0,
      averageDuration: 0,
      slowRequests: 0,
      criticalRequests: 0,
      endpointStats: {},
    };
  }

  const durations = performanceLog.map(m => m.duration);
  const slowRequests = performanceLog.filter(m => m.duration > THRESHOLDS.WARN).length;
  const criticalRequests = performanceLog.filter(m => m.duration > THRESHOLDS.CRITICAL).length;

  // Calculate per-endpoint statistics
  const endpointStats: Record<string, {
    count: number;
    avgDuration: number;
    maxDuration: number;
    slowRequests: number;
  }> = {};

  for (const metric of performanceLog) {
    const key = `${metric.method} ${metric.endpoint}`;
    if (!endpointStats[key]) {
      endpointStats[key] = {
        count: 0,
        avgDuration: 0,
        maxDuration: 0,
        slowRequests: 0,
      };
    }

    const stats = endpointStats[key];
    stats.count++;
    stats.avgDuration = ((stats.avgDuration * (stats.count - 1)) + metric.duration) / stats.count;
    stats.maxDuration = Math.max(stats.maxDuration, metric.duration);
    if (metric.duration > THRESHOLDS.WARN) {
      stats.slowRequests++;
    }
  }

  return {
    totalRequests: performanceLog.length,
    averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
    slowRequests,
    criticalRequests,
    endpointStats,
    recentMetrics: performanceLog.slice(-10), // Last 10 requests
  };
}

/**
 * Get slowest endpoints
 */
export function getSlowestEndpoints(limit: number = 10) {
  const stats = getPerformanceStats();
  return Object.entries(stats.endpointStats)
    .map(([endpoint, data]) => ({ endpoint, ...data }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, limit);
}

/**
 * Clear performance logs (for testing)
 */
export function clearPerformanceLogs() {
  performanceLog.length = 0;
}
