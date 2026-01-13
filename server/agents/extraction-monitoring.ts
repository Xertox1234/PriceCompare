import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

/**
 * Production monitoring for Playwright extraction agent
 * Tracks success rates, performance, and errors via Redis metrics
 *
 * Pattern Alignment:
 * - 07_BACKGROUND_JOBS_PATTERNS.md: Monitoring patterns for background services
 * - 06_ERROR_HANDLING_PATTERNS.md: Graceful degradation (monitoring failures don't break extraction)
 * - CLAUDE.md: Redis MANDATORY in production (metrics use Redis)
 */
export class ExtractionMonitoring {
  private static readonly REDIS_KEY_PREFIX = 'extraction:metrics:';
  private static readonly METRICS_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

  /**
   * Record extraction attempt for monitoring
   * Non-blocking: Failures won't prevent extraction from completing
   */
  static async recordAttempt(
    retailer: string,
    success: boolean,
    durationMs: number,
    error?: string
  ): Promise<void> {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
    const key = `${this.REDIS_KEY_PREFIX}${date}:${retailer}`;

    try {
      const redis = getRedisClient();
      if (!redis) {
        throw new Error('Redis client not available');
      }

      // Increment counters (atomic operations)
      await redis.hincrby(key, 'total_attempts', 1);
      if (success) {
        await redis.hincrby(key, 'successful', 1);
      } else {
        await redis.hincrby(key, 'failed', 1);
        if (error) {
          // Track error types for debugging
          const errorKey = `error:${this.sanitizeErrorKey(error)}`;
          await redis.hincrby(key, errorKey, 1);
        }
      }

      // Track duration (for average calculation)
      await redis.hincrbyfloat(key, 'total_duration_ms', durationMs);

      // Set expiration (only if not already set)
      await redis.expire(key, this.METRICS_TTL_SECONDS, 'NX');

      // Log to console for immediate visibility
      logger.info('Extraction metrics', {
        retailer,
        success,
        duration_ms: durationMs,
        error: error || 'none',
        timestamp: new Date().toISOString(),
      });
    } catch (redisError) {
      // CRITICAL: Don't fail extraction if monitoring fails
      logger.error('Failed to record extraction metrics', {
        error: redisError instanceof Error ? redisError.message : String(redisError),
        retailer,
      });
    }
  }

  /**
   * Get success rate for a retailer (last 24 hours)
   */
  static async getSuccessRate(retailer: string): Promise<number> {
    const date = new Date().toISOString().split('T')[0];
    const key = `${this.REDIS_KEY_PREFIX}${date}:${retailer}`;

    try {
      const redis = getRedisClient();
      if (!redis) {
        throw new Error('Redis client not available');
      }
      const metrics = await redis.hgetall(key);

      if (!metrics || Object.keys(metrics).length === 0) {
        return 0; // No data yet
      }

      const total = parseInt(metrics.total_attempts || '0');
      const successful = parseInt(metrics.successful || '0');

      return total > 0 ? (successful / total) * 100 : 0;
    } catch (error) {
      logger.error('Failed to get success rate', {
        error: error instanceof Error ? error.message : String(error),
        retailer,
      });
      return 0;
    }
  }

  /**
   * Get average extraction duration (last 24 hours)
   */
  static async getAverageDuration(retailer: string): Promise<number> {
    const date = new Date().toISOString().split('T')[0];
    const key = `${this.REDIS_KEY_PREFIX}${date}:${retailer}`;

    try {
      const redis = getRedisClient();
      if (!redis) {
        throw new Error('Redis client not available');
      }
      const metrics = await redis.hgetall(key);

      if (!metrics || Object.keys(metrics).length === 0) {
        return 0; // No data yet
      }

      const total = parseInt(metrics.total_attempts || '0');
      const totalDuration = parseFloat(metrics.total_duration_ms || '0');

      return total > 0 ? totalDuration / total : 0;
    } catch (error) {
      logger.error('Failed to get average duration', {
        error: error instanceof Error ? error.message : String(error),
        retailer,
      });
      return 0;
    }
  }

  /**
   * Get detailed metrics for admin dashboard
   */
  static async getDetailedMetrics(retailer: string): Promise<{
    totalAttempts: number;
    successful: number;
    failed: number;
    successRate: number;
    avgDuration: number;
    errors: Record<string, number>;
  }> {
    const date = new Date().toISOString().split('T')[0];
    const key = `${this.REDIS_KEY_PREFIX}${date}:${retailer}`;

    try {
      const redis = getRedisClient();
      if (!redis) {
        throw new Error('Redis client not available');
      }
      const metrics = await redis.hgetall(key);

      if (!metrics || Object.keys(metrics).length === 0) {
        return {
          totalAttempts: 0,
          successful: 0,
          failed: 0,
          successRate: 0,
          avgDuration: 0,
          errors: {},
        };
      }

      const totalAttempts = parseInt(metrics.total_attempts || '0');
      const successful = parseInt(metrics.successful || '0');
      const failed = parseInt(metrics.failed || '0');
      const totalDuration = parseFloat(metrics.total_duration_ms || '0');

      // Extract error counts
      const errors: Record<string, number> = {};
      for (const [key, value] of Object.entries(metrics)) {
        if (key.startsWith('error:')) {
          const errorType = key.replace('error:', '');
          errors[errorType] = parseInt(value);
        }
      }

      return {
        totalAttempts,
        successful,
        failed,
        successRate: totalAttempts > 0 ? (successful / totalAttempts) * 100 : 0,
        avgDuration: totalAttempts > 0 ? totalDuration / totalAttempts : 0,
        errors,
      };
    } catch (error) {
      logger.error('Failed to get detailed metrics', {
        error: error instanceof Error ? error.message : String(error),
        retailer,
      });
      return {
        totalAttempts: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        avgDuration: 0,
        errors: {},
      };
    }
  }

  /**
   * Sanitize error message for use as Redis key
   * Limit length and remove special characters
   */
  private static sanitizeErrorKey(error: string): string {
    return error
      .substring(0, 100) // Limit length
      .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars
      .toLowerCase();
  }
}
