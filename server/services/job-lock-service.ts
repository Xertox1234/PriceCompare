import { storage } from "../storage";
import { logger } from "../utils/logger";
import os from "os";
import crypto from "crypto";

/**
 * Job Lock Service
 *
 * Provides distributed locking mechanism to prevent duplicate job execution
 * in multi-server deployments. Uses database-level locks with automatic expiration.
 *
 * Features:
 * - Prevents race conditions in scheduled jobs
 * - Automatic lock expiration (handles server crashes)
 * - Lock extension for long-running jobs
 * - Cleanup of expired locks
 */
export class JobLockService {
  private readonly instanceId: string;

  constructor() {
    // Create unique instance ID from hostname + process ID + short UUID
    // UUID ensures uniqueness even in containerized environments with identical hostnames
    const shortUuid = crypto.randomUUID().slice(0, 8);
    this.instanceId = `${os.hostname()}-${process.pid}-${shortUuid}`;
  }

  /**
   * Acquire a lock for a job
   *
   * @param jobName - Unique name of the job
   * @param ttlSeconds - Lock time-to-live in seconds (default: 3600 = 1 hour)
   * @returns true if lock acquired, false if already locked by another instance
   */
  async acquireLock(jobName: string, ttlSeconds = 3600): Promise<boolean> {
    try {
      // Clean up expired locks first
      await this.cleanupExpiredLocks();

      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      // Try to insert a new lock
      const result = await storage.acquireJobLock(jobName, this.instanceId, ttlSeconds);

      if (result.success) {
        logger.info(`[JobLock] Acquired lock for job "${jobName}"`, {
          instanceId: this.instanceId,
          expiresAt: expiresAt.toISOString(),
        });
        return true;
      }

      // Lock already exists, check if it's ours or expired
      const existingLock = await storage.getJobLockByName(jobName);

      if (existingLock) {
        // Check if lock is expired
        if (new Date(existingLock.expiresAt) < new Date()) {
          // Try to acquire expired lock
          const updated = await storage.updateExpiredJobLock(jobName, this.instanceId, expiresAt);

          if (updated.success) {
            logger.info(`[JobLock] Acquired expired lock for job "${jobName}"`, {
              instanceId: this.instanceId,
              previousOwner: existingLock.lockedBy,
            });
            return true;
          }
        }

        logger.debug(`[JobLock] Job "${jobName}" is already locked by "${existingLock.lockedBy}"`, {
          expiresAt: existingLock.expiresAt,
        });
        return false;
      }

      return false;
    } catch (error) {
      logger.error(`[JobLock] Error acquiring lock for job "${jobName}":`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Release a lock for a job
   *
   * @param jobName - Name of the job to release
   * @returns true if lock released, false otherwise
   */
  async releaseLock(jobName: string): Promise<boolean> {
    try {
      const released = await storage.releaseJobLock(jobName, this.instanceId);

      if (released) {
        logger.info(`[JobLock] Released lock for job "${jobName}"`, {
          instanceId: this.instanceId,
        });
        return true;
      }

      logger.warn(`[JobLock] Failed to release lock for job "${jobName}" - not owned by this instance`, {
        instanceId: this.instanceId,
      });
      return false;
    } catch (error) {
      logger.error(`[JobLock] Error releasing lock for job "${jobName}":`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Extend an existing lock's expiration time
   * Useful for long-running jobs
   *
   * @param jobName - Name of the job
   * @param additionalSeconds - Additional seconds to extend
   * @returns true if extended, false otherwise
   */
  async extendLock(jobName: string, additionalSeconds: number): Promise<boolean> {
    try {
      const extended = await storage.extendJobLock(jobName, this.instanceId, additionalSeconds);

      if (extended) {
        logger.debug(`[JobLock] Extended lock for job "${jobName}" by ${additionalSeconds}s`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[JobLock] Error extending lock for job "${jobName}":`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if a job is currently locked
   *
   * @param jobName - Name of the job
   * @returns true if locked, false otherwise
   */
  async isLocked(jobName: string): Promise<boolean> {
    try {
      return await storage.isJobLocked(jobName);
    } catch (error) {
      logger.error(`[JobLock] Error checking lock for job "${jobName}":`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false; // Assume not locked on error (fail open)
    }
  }

  /**
   * Clean up all expired locks
   * Should be run periodically
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const cleanedCount = await storage.cleanupExpiredJobLocks();

      if (cleanedCount > 0) {
        logger.info(`[JobLock] Cleaned up ${cleanedCount} expired locks`);
      }

      return cleanedCount;
    } catch (error) {
      logger.error('[JobLock] Error cleaning up expired locks:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Execute a job with automatic locking
   * Acquires lock, runs job, and releases lock (even on error)
   *
   * @param jobName - Unique name of the job
   * @param jobFn - Async function to execute
   * @param ttlSeconds - Lock TTL in seconds
   * @returns Result of jobFn, or null if lock couldn't be acquired
   */
  async withLock<T>(
    jobName: string,
    jobFn: () => Promise<T>,
    ttlSeconds = 3600
  ): Promise<T | null> {
    const acquired = await this.acquireLock(jobName, ttlSeconds);

    if (!acquired) {
      logger.info(`[JobLock] Skipping job "${jobName}" - already running elsewhere`);
      return null;
    }

    try {
      logger.info(`[JobLock] Executing job "${jobName}"`);
      const result = await jobFn();
      logger.info(`[JobLock] Job "${jobName}" completed successfully`);
      return result;
    } catch (error) {
      logger.error(`[JobLock] Job "${jobName}" failed:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await this.releaseLock(jobName);
    }
  }
}

// Singleton instance
export const jobLockService = new JobLockService();
