import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { log } from '../vite';

/**
 * Lock acquisition result
 */
export interface LockResult {
  /** Unique lock identifier */
  lockId: string;
  /** Lock key */
  key: string;
  /** Lock expiration time in ms */
  ttl: number;
  /** Time when lock was acquired */
  acquiredAt: Date;
}

/**
 * Lock metrics for monitoring
 */
export interface LockMetrics {
  /** Total lock acquisition attempts */
  acquisitionAttempts: number;
  /** Successful lock acquisitions */
  acquisitionsSucceeded: number;
  /** Failed lock acquisitions */
  acquisitionsFailed: number;
  /** Total locks released */
  locksReleased: number;
  /** Active locks currently held */
  activeLocks: number;
  /** Average acquisition time in ms */
  avgAcquisitionTime: number;
  /** Lock contention rate (0-1) */
  contentionRate: number;
}

/**
 * Distributed Lock Service using Redis
 *
 * Provides distributed locking for coordinating work across multiple instances.
 * Implements lock renewal, automatic expiration, and contention metrics.
 *
 * Features:
 * - Atomic lock acquisition with SET NX
 * - Automatic lock renewal for long-running tasks
 * - Safe release using Lua scripts
 * - Deadlock prevention with TTL
 * - Comprehensive metrics tracking
 */
export class DistributedLock {
  private redis: Redis;
  private renewalIntervals: Map<string, NodeJS.Timeout> = new Map();
  private activeLocks: Map<string, LockResult> = new Map();
  private metrics = {
    acquisitionAttempts: 0,
    acquisitionsSucceeded: 0,
    acquisitionsFailed: 0,
    locksReleased: 0,
    totalAcquisitionTime: 0,
  };

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(url, {
      retryStrategy: (times: number) => {
        if (times > 3) {
          log(`Distributed Lock: Failed to connect to Redis after ${times} attempts`);
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000); // Exponential backoff
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err) => {
      log(`Distributed Lock Redis Error: ${err.message}`);
    });

    this.redis.on('connect', () => {
      log('Distributed Lock: Connected to Redis');
    });
  }

  /**
   * Acquire a distributed lock
   *
   * @param key - Lock key (e.g., "job:123")
   * @param ttl - Lock time-to-live in milliseconds (default: 30s)
   * @param retries - Number of retry attempts (default: 3)
   * @param retryDelay - Delay between retries in ms (default: 100ms)
   * @returns LockResult if acquired, null if failed
   */
  async acquire(
    key: string,
    ttl: number = 30000,
    retries: number = 3,
    retryDelay: number = 100
  ): Promise<LockResult | null> {
    const startTime = Date.now();
    const lockId = randomUUID();
    const lockKey = `lock:${key}`;

    this.metrics.acquisitionAttempts++;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Try to acquire lock with SET NX (only set if not exists)
        const result = await this.redis.set(
          lockKey,
          lockId,
          'PX', // milliseconds
          ttl,
          'NX' // only set if not exists
        );

        if (result === 'OK') {
          const acquisitionTime = Date.now() - startTime;
          this.metrics.acquisitionsSucceeded++;
          this.metrics.totalAcquisitionTime += acquisitionTime;

          const lockResult: LockResult = {
            lockId,
            key,
            ttl,
            acquiredAt: new Date(),
          };

          // Store active lock
          this.activeLocks.set(lockKey, lockResult);

          // Start automatic renewal
          this.startLockRenewal(lockKey, lockId, ttl);

          log(`Lock acquired: ${key} (attempt ${attempt + 1}, ${acquisitionTime}ms)`);
          return lockResult;
        }

        // Lock is held by someone else, wait before retry
        if (attempt < retries - 1) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      } catch (error) {
        log(`Lock acquisition error for ${key}: ${error}`);
        if (attempt < retries - 1) {
          await this.delay(retryDelay * Math.pow(2, attempt));
        }
      }
    }

    this.metrics.acquisitionsFailed++;
    log(`Failed to acquire lock: ${key} after ${retries} attempts`);
    return null;
  }

  /**
   * Release a distributed lock
   *
   * Uses Lua script for atomic check-and-delete to ensure only
   * the lock owner can release it.
   *
   * @param key - Lock key
   * @param lockId - Lock identifier from acquisition
   * @returns true if released, false if not owned or already released
   */
  async release(key: string, lockId: string): Promise<boolean> {
    const lockKey = `lock:${key}`;

    // Stop renewal first
    this.stopLockRenewal(lockKey);

    try {
      // Lua script for atomic check-and-delete
      // Only delete if the lock value matches our lockId
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, lockKey, lockId);

      if (result === 1) {
        this.metrics.locksReleased++;
        this.activeLocks.delete(lockKey);
        log(`Lock released: ${key}`);
        return true;
      }

      log(`Failed to release lock ${key}: not owned or already released`);
      return false;
    } catch (error) {
      log(`Error releasing lock ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Extend a lock's TTL
   *
   * @param key - Lock key
   * @param lockId - Lock identifier
   * @param ttl - New TTL in milliseconds
   * @returns true if extended, false if not owned
   */
  async extend(key: string, lockId: string, ttl: number): Promise<boolean> {
    const lockKey = `lock:${key}`;

    try {
      // Lua script to extend only if we own the lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, lockKey, lockId, ttl);
      return result === 1;
    } catch (error) {
      log(`Error extending lock ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Check if a lock is currently held
   *
   * @param key - Lock key
   * @returns true if locked, false otherwise
   */
  async isLocked(key: string): Promise<boolean> {
    try {
      const lockKey = `lock:${key}`;
      const exists = await this.redis.exists(lockKey);
      return exists === 1;
    } catch (error) {
      log(`Error checking lock ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Get remaining TTL for a lock
   *
   * @param key - Lock key
   * @returns TTL in milliseconds, -1 if no expiration, -2 if doesn't exist
   */
  async getTTL(key: string): Promise<number> {
    try {
      const lockKey = `lock:${key}`;
      const ttl = await this.redis.pttl(lockKey);
      return ttl;
    } catch (error) {
      log(`Error getting TTL for ${key}: ${error}`);
      return -2;
    }
  }

  /**
   * Start automatic lock renewal
   *
   * Renews the lock at half its TTL to prevent expiration during long tasks
   */
  private startLockRenewal(lockKey: string, lockId: string, ttl: number): void {
    // Renew at half the TTL to ensure it doesn't expire
    const renewalInterval = ttl / 2;

    const interval = setInterval(async () => {
      const extended = await this.extend(lockKey.replace('lock:', ''), lockId, ttl);

      if (!extended) {
        // Lock was lost or expired, stop renewal
        log(`Lock renewal failed for ${lockKey}, stopping renewal`);
        this.stopLockRenewal(lockKey);
        this.activeLocks.delete(lockKey);
      }
    }, renewalInterval);

    this.renewalIntervals.set(lockKey, interval);
  }

  /**
   * Stop automatic lock renewal
   */
  private stopLockRenewal(lockKey: string): void {
    const interval = this.renewalIntervals.get(lockKey);
    if (interval) {
      clearInterval(interval);
      this.renewalIntervals.delete(lockKey);
    }
  }

  /**
   * Get lock metrics for monitoring
   */
  getMetrics(): LockMetrics {
    const avgAcquisitionTime = this.metrics.acquisitionsSucceeded > 0
      ? this.metrics.totalAcquisitionTime / this.metrics.acquisitionsSucceeded
      : 0;

    const contentionRate = this.metrics.acquisitionAttempts > 0
      ? this.metrics.acquisitionsFailed / this.metrics.acquisitionAttempts
      : 0;

    return {
      acquisitionAttempts: this.metrics.acquisitionAttempts,
      acquisitionsSucceeded: this.metrics.acquisitionsSucceeded,
      acquisitionsFailed: this.metrics.acquisitionsFailed,
      locksReleased: this.metrics.locksReleased,
      activeLocks: this.activeLocks.size,
      avgAcquisitionTime: Math.round(avgAcquisitionTime),
      contentionRate: Math.round(contentionRate * 100) / 100,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      acquisitionAttempts: 0,
      acquisitionsSucceeded: 0,
      acquisitionsFailed: 0,
      locksReleased: 0,
      totalAcquisitionTime: 0,
    };
  }

  /**
   * Release all active locks (cleanup on shutdown)
   */
  async releaseAll(): Promise<void> {
    log(`Releasing ${this.activeLocks.size} active locks...`);

    const releases = Array.from(this.activeLocks.entries()).map(([lockKey, lock]) =>
      this.release(lock.key, lock.lockId)
    );

    await Promise.allSettled(releases);
    log('All locks released');
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.releaseAll();

    // Stop all renewal intervals
    for (const interval of this.renewalIntervals.values()) {
      clearInterval(interval);
    }
    this.renewalIntervals.clear();

    await this.redis.quit();
    log('Distributed Lock: Disconnected from Redis');
  }

  /**
   * Utility: Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance for the application
export const distributedLock = new DistributedLock();

// Cleanup on process exit
process.on('SIGINT', async () => {
  await distributedLock.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await distributedLock.disconnect();
  process.exit(0);
});
