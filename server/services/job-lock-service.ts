import { db } from "../db";
import { jobLocks } from "../../shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { logger } from "../utils/logger";
import os from "os";

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
    // Create unique instance ID from hostname + process ID
    this.instanceId = `${os.hostname()}-${process.pid}`;
  }

  /**
   * Acquire a lock for a job
   *
   * @param jobName - Unique name of the job
   * @param ttlSeconds - Lock time-to-live in seconds (default: 3600 = 1 hour)
   * @returns true if lock acquired, false if already locked by another instance
   */
  async acquireLock(jobName: string, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      // Clean up expired locks first
      await this.cleanupExpiredLocks();

      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      // Try to insert a new lock
      const result = await db
        .insert(jobLocks)
        .values({
          jobName,
          lockedBy: this.instanceId,
          expiresAt,
          lockedAt: new Date(),
        })
        .onConflictDoNothing() // If lock exists, do nothing
        .returning({ id: jobLocks.id });

      if (result.length > 0) {
        logger.info(`[JobLock] Acquired lock for job "${jobName}"`, {
          instanceId: this.instanceId,
          expiresAt: expiresAt.toISOString(),
        });
        return true;
      }

      // Lock already exists, check if it's ours or expired
      const existingLock = await db
        .select()
        .from(jobLocks)
        .where(eq(jobLocks.jobName, jobName))
        .limit(1);

      if (existingLock.length > 0) {
        const lock = existingLock[0];

        // Check if lock is expired
        if (new Date(lock.expiresAt) < new Date()) {
          // Try to acquire expired lock
          const updated = await db
            .update(jobLocks)
            .set({
              lockedBy: this.instanceId,
              lockedAt: new Date(),
              expiresAt,
            })
            .where(
              and(
                eq(jobLocks.jobName, jobName),
                lte(jobLocks.expiresAt, new Date()) // Only update if still expired
              )
            )
            .returning({ id: jobLocks.id });

          if (updated.length > 0) {
            logger.info(`[JobLock] Acquired expired lock for job "${jobName}"`, {
              instanceId: this.instanceId,
              previousOwner: lock.lockedBy,
            });
            return true;
          }
        }

        logger.debug(`[JobLock] Job "${jobName}" is already locked by "${lock.lockedBy}"`, {
          expiresAt: lock.expiresAt,
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
      const result = await db
        .delete(jobLocks)
        .where(
          and(
            eq(jobLocks.jobName, jobName),
            eq(jobLocks.lockedBy, this.instanceId)
          )
        )
        .returning({ id: jobLocks.id });

      if (result.length > 0) {
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
      const result = await db
        .update(jobLocks)
        .set({
          expiresAt: sql`${jobLocks.expiresAt} + INTERVAL '${sql.raw(additionalSeconds.toString())} seconds'`,
        })
        .where(
          and(
            eq(jobLocks.jobName, jobName),
            eq(jobLocks.lockedBy, this.instanceId)
          )
        )
        .returning({ id: jobLocks.id });

      if (result.length > 0) {
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
      const locks = await db
        .select({ id: jobLocks.id })
        .from(jobLocks)
        .where(
          and(
            eq(jobLocks.jobName, jobName),
            sql`${jobLocks.expiresAt} > NOW()` // Not expired
          )
        )
        .limit(1);

      return locks.length > 0;
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
      const result = await db
        .delete(jobLocks)
        .where(lte(jobLocks.expiresAt, new Date()))
        .returning({ id: jobLocks.id });

      if (result.length > 0) {
        logger.info(`[JobLock] Cleaned up ${result.length} expired locks`);
      }

      return result.length;
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
    ttlSeconds: number = 3600
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
