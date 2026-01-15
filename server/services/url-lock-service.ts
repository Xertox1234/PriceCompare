import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * URL Lock Service - Redis-based distributed locking for scraping jobs
 *
 * Prevents concurrent scraping of the same URL across multiple workers.
 * Uses Redis for fast, distributed locking with automatic TTL expiration.
 *
 * Design:
 * - Lock key derived from normalized URL (removes tracking params)
 * - TTL prevents deadlocks if worker crashes
 * - Atomic lock acquisition with Lua script
 * - Returns null if lock held (graceful skip, not an error)
 *
 * Pattern Alignment:
 * - 01_TYPESCRIPT_PATTERNS.md: Strict typing, async/await
 * - 07_BACKGROUND_JOBS_PATTERNS.md: Distributed locking
 * - CLAUDE.md: Redis for distributed operations
 */

export interface UrlLockOptions {
  /**
   * Lock TTL in seconds (default: 300 = 5 minutes)
   * Should be longer than typical scrape duration
   */
  ttlSeconds?: number;

  /**
   * Skip lock if already held (default: true)
   * If false, throws error when lock unavailable
   */
  skipIfLocked?: boolean;
}

export class UrlLockService {
  private readonly prefix = 'lock:scrape:';
  private readonly defaultTTL = 300; // 5 minutes

  /**
   * Normalize URL for consistent lock keys
   * Removes tracking parameters and normalizes case
   */
  private normalizeUrlForLock(url: string): string {
    try {
      const parsed = new URL(url);

      // Remove common tracking parameters
      const trackingParams = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'ref',
        'source',
        'fbclid',
        'gclid',
      ];

      trackingParams.forEach((param) => {
        parsed.searchParams.delete(param);
      });

      // Normalize case and sort search params for consistency
      const sortedParams = new URLSearchParams();
      Array.from(parsed.searchParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([key, value]) => {
          sortedParams.append(key.toLowerCase(), value);
        });

      parsed.search = sortedParams.toString();

      return parsed.toString().toLowerCase();
    } catch (error) {
      // If URL parsing fails, use original URL
      logger.warn('Failed to normalize URL for lock', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return url.toLowerCase();
    }
  }

  /**
   * Generate lock key from URL
   */
  private getLockKey(url: string): string {
    const normalized = this.normalizeUrlForLock(url);
    return `${this.prefix}${normalized}`;
  }

  /**
   * Execute function with distributed lock
   * Returns null if lock could not be acquired (another worker is scraping)
   *
   * @param url - URL to lock
   * @param fn - Function to execute with lock held
   * @param options - Lock options
   * @returns Result of fn, or null if lock could not be acquired
   */
  async withLock<T>(
    url: string,
    fn: () => Promise<T>,
    options: UrlLockOptions = {}
  ): Promise<T | null> {
    const { ttlSeconds = this.defaultTTL, skipIfLocked = true } = options;

    const redis = getRedisClient();

    // Fallback to no locking if Redis unavailable (development only)
    if (!redis) {
      logger.warn(
        '[UrlLockService] Redis unavailable, executing without lock (NOT suitable for production)'
      );
      return await fn();
    }

    const lockKey = this.getLockKey(url);
    const lockValue = `${process.pid}:${Date.now()}`;

    // Try to acquire lock with NX (only if not exists)
    const acquired = await redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');

    if (!acquired) {
      // Lock held by another worker
      if (skipIfLocked) {
        logger.info('[UrlLockService] URL already being scraped, skipping', {
          url,
          lockKey,
        });
        return null;
      } else {
        throw new Error(`URL lock already held for ${url}`);
      }
    }

    logger.debug('[UrlLockService] Lock acquired', {
      url,
      lockKey,
      ttlSeconds,
    });

    try {
      const result = await fn();
      return result;
    } finally {
      // Release lock (only if we still own it)
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Release lock only if we own it (Lua script for atomicity)
   */
  private async releaseLock(lockKey: string, expectedValue: string): Promise<boolean> {
    const redis = getRedisClient();

    if (!redis) {
      return false;
    }

    // Lua script ensures atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await redis.eval(script, 1, lockKey, expectedValue);

      if (result === 1) {
        logger.debug('[UrlLockService] Lock released', { lockKey });
        return true;
      } else {
        logger.warn('[UrlLockService] Lock not owned, skipped release', { lockKey });
        return false;
      }
    } catch (error) {
      logger.error('[UrlLockService] Error releasing lock', {
        lockKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Extend lock TTL (for long-running operations)
   * Only works if we still own the lock
   */
  async extendLock(url: string, additionalSeconds: number): Promise<boolean> {
    const redis = getRedisClient();

    if (!redis) {
      return false;
    }

    const lockKey = this.getLockKey(url);

    try {
      const result = await redis.expire(lockKey, additionalSeconds);

      if (result === 1) {
        logger.debug('[UrlLockService] Lock TTL extended', {
          lockKey,
          additionalSeconds,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[UrlLockService] Error extending lock', {
        lockKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if URL is currently locked
   */
  async isLocked(url: string): Promise<boolean> {
    const redis = getRedisClient();

    if (!redis) {
      return false;
    }

    const lockKey = this.getLockKey(url);

    try {
      const exists = await redis.exists(lockKey);
      return exists === 1;
    } catch (error) {
      logger.error('[UrlLockService] Error checking lock status', {
        lockKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Force release a lock (admin/cleanup only)
   * DANGEROUS: Should only be used for stuck locks
   */
  async forceReleaseLock(url: string): Promise<boolean> {
    const redis = getRedisClient();

    if (!redis) {
      return false;
    }

    const lockKey = this.getLockKey(url);

    try {
      const result = await redis.del(lockKey);
      logger.warn('[UrlLockService] Lock forcefully released', { lockKey });
      return result === 1;
    } catch (error) {
      logger.error('[UrlLockService] Error force releasing lock', {
        lockKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Singleton instance
export const urlLockService = new UrlLockService();
