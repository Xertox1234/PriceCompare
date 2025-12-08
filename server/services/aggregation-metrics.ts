/**
 * Aggregation Metrics Collection
 *
 * Provides Prometheus-style metrics collection for price aggregation operations.
 * Tracks success/failure rates, duration, record counts, and data quality metrics.
 *
 * Metrics are stored in-memory and can be exported for monitoring dashboards.
 */

import { logger } from '../utils/logger';

/**
 * Metric types
 */
export interface AggregationMetric {
  /** Operation name (e.g., 'daily', 'weekly', 'monthly') */
  operation: string;

  /** Timestamp when operation started */
  startTime: number;

  /** Duration in milliseconds */
  durationMs: number;

  /** Whether operation succeeded */
  success: boolean;

  /** Number of records aggregated */
  recordCount: number;

  /** Number of retries required */
  retryCount?: number;

  /** Error message if failed */
  error?: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Aggregated statistics
 */
export interface AggregationStats {
  operation: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  totalRecordsProcessed: number;
  avgRecordsPerExecution: number;
  lastExecutionTime: number;
  lastError?: string;
}

/**
 * In-memory metrics store
 */
class AggregationMetricsStore {
  private metrics: AggregationMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics
  private readonly metricTTLMs = 24 * 60 * 60 * 1000; // 24 hours
  private recordCount = 0;

  /**
   * Record a new metric
   */
  record(metric: AggregationMetric): void {
    this.metrics.push(metric);
    this.recordCount++;

    // Log metric for observability
    this.logMetric(metric);

    // Trim to max size (FIFO) - use slice instead of shift for better performance
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Periodic TTL cleanup (every 100 records to avoid overhead)
    if (this.recordCount % 100 === 0) {
      this.cleanupExpiredMetrics();
    }
  }

  /**
   * Remove metrics older than TTL
   */
  private cleanupExpiredMetrics(): void {
    const now = Date.now();
    const cutoff = now - this.metricTTLMs;

    const beforeCount = this.metrics.length;
    this.metrics = this.metrics.filter((m) => m.startTime >= cutoff);
    const removedCount = beforeCount - this.metrics.length;

    if (removedCount > 0) {
      logger.info(
        `[AggregationMetrics] Cleaned up ${removedCount} expired metrics (older than 24h)`
      );
    }
  }

  /**
   * Log metric after recording
   */
  private logMetric(metric: AggregationMetric): void {
    // Log metric for observability
    const logLevel = metric.success ? 'info' : 'error';
    logger[logLevel]('[AggregationMetrics] Operation completed:', {
      operation: metric.operation,
      durationMs: metric.durationMs,
      recordCount: metric.recordCount,
      success: metric.success,
      retryCount: metric.retryCount,
      error: metric.error,
      context: metric.context,
    });
  }

  /**
   * Get all metrics for a specific operation
   */
  getMetrics(operation?: string): AggregationMetric[] {
    if (!operation) return [...this.metrics];
    return this.metrics.filter((m) => m.operation === operation);
  }

  /**
   * Get aggregated statistics for an operation
   */
  getStats(operation: string): AggregationStats | null {
    const operationMetrics = this.getMetrics(operation);

    if (operationMetrics.length === 0) {
      return null;
    }

    const successMetrics = operationMetrics.filter((m) => m.success);
    const failureMetrics = operationMetrics.filter((m) => !m.success);
    const durations = operationMetrics.map((m) => m.durationMs);
    const recordCounts = operationMetrics.map((m) => m.recordCount);

    return {
      operation,
      totalExecutions: operationMetrics.length,
      successCount: successMetrics.length,
      failureCount: failureMetrics.length,
      successRate: (successMetrics.length / operationMetrics.length) * 100,
      avgDurationMs: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDurationMs: Math.min(...durations),
      maxDurationMs: Math.max(...durations),
      totalRecordsProcessed: recordCounts.reduce((sum, c) => sum + c, 0),
      avgRecordsPerExecution: recordCounts.reduce((sum, c) => sum + c, 0) / recordCounts.length,
      lastExecutionTime: operationMetrics[operationMetrics.length - 1].startTime,
      lastError: failureMetrics[failureMetrics.length - 1]?.error,
    };
  }

  /**
   * Get all operation names
   */
  getOperations(): string[] {
    const operations = new Set(this.metrics.map((m) => m.operation));
    return Array.from(operations);
  }

  /**
   * Get statistics for all operations
   */
  getAllStats(): Record<string, AggregationStats> {
    const stats: Record<string, AggregationStats> = {};

    for (const operation of this.getOperations()) {
      const operationStats = this.getStats(operation);
      if (operationStats) {
        stats[operation] = operationStats;
      }
    }

    return stats;
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    // Add header comments
    lines.push('# HELP aggregation_duration_seconds Duration of aggregation operations in seconds');
    lines.push('# TYPE aggregation_duration_seconds histogram');

    lines.push('# HELP aggregation_records_total Total number of records aggregated');
    lines.push('# TYPE aggregation_records_total counter');

    lines.push('# HELP aggregation_success_total Total number of successful aggregations');
    lines.push('# TYPE aggregation_success_total counter');

    lines.push('# HELP aggregation_failure_total Total number of failed aggregations');
    lines.push('# TYPE aggregation_failure_total counter');

    // Export per-operation metrics
    for (const operation of this.getOperations()) {
      const stats = this.getStats(operation);
      if (!stats) continue;

      lines.push(
        `aggregation_duration_seconds{operation="${operation}",quantile="avg"} ${(stats.avgDurationMs / 1000).toFixed(3)}`
      );
      lines.push(
        `aggregation_duration_seconds{operation="${operation}",quantile="min"} ${(stats.minDurationMs / 1000).toFixed(3)}`
      );
      lines.push(
        `aggregation_duration_seconds{operation="${operation}",quantile="max"} ${(stats.maxDurationMs / 1000).toFixed(3)}`
      );

      lines.push(
        `aggregation_records_total{operation="${operation}"} ${stats.totalRecordsProcessed}`
      );
      lines.push(`aggregation_success_total{operation="${operation}"} ${stats.successCount}`);
      lines.push(`aggregation_failure_total{operation="${operation}"} ${stats.failureCount}`);
    }

    return lines.join('\n');
  }
}

// Singleton store
export const metricsStore = new AggregationMetricsStore();

/**
 * Measure and record an aggregation operation
 *
 * @param operation - Operation name (e.g., 'daily', 'weekly', 'monthly')
 * @param fn - Async function to measure
 * @param context - Additional context for logging
 * @returns Result of the operation
 *
 * @example
 * const recordCount = await measureAggregation(
 *   'daily',
 *   async () => await aggregateDaily(),
 *   { date: '2025-01-15' }
 * );
 */
export async function measureAggregation<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();
  let success = false;
  let recordCount = 0;
  let error: string | undefined;
  let retryCount = 0;

  try {
    const result = await fn();

    // If result is a number, treat it as record count
    if (typeof result === 'number') {
      recordCount = result;
    }

    success = true;
    return result;
  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : String(err);

    // Check if error includes retry information
    if (err instanceof Error && err.message.includes('attempt')) {
      const match = err.message.match(/attempt (\d+)/);
      if (match) {
        retryCount = parseInt(match[1], 10);
      }
    }

    throw err;
  } finally {
    const durationMs = Date.now() - startTime;

    metricsStore.record({
      operation,
      startTime,
      durationMs,
      success,
      recordCount,
      retryCount,
      error,
      context,
    });
  }
}

/**
 * Get human-readable summary of aggregation metrics
 */
export function getMetricsSummary(): string {
  const allStats = metricsStore.getAllStats();
  const operations = Object.keys(allStats);

  if (operations.length === 0) {
    return 'No aggregation metrics available yet.';
  }

  const lines: string[] = ['Aggregation Metrics Summary:', ''];

  for (const operation of operations) {
    const stats = allStats[operation];
    lines.push(`${operation.toUpperCase()}:`);
    lines.push(`  Total Executions: ${stats.totalExecutions}`);
    lines.push(`  Success Rate: ${stats.successRate.toFixed(1)}%`);
    lines.push(`  Avg Duration: ${stats.avgDurationMs.toFixed(0)}ms`);
    lines.push(`  Records Processed: ${stats.totalRecordsProcessed.toLocaleString()}`);
    lines.push(`  Avg Records/Execution: ${stats.avgRecordsPerExecution.toFixed(0)}`);

    if (stats.lastError) {
      lines.push(`  Last Error: ${stats.lastError}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
