/**
 * Job Lock Storage Domain
 *
 * Handles all job lock-related database operations for distributed job coordination.
 * Provides lock acquisition, release, extension, and cleanup operations.
 *
 * Phase 3F: Job Lock Domain Extraction - Final phase of storage layer refactoring
 */

import { eq, and, lte, sql, desc, count } from 'drizzle-orm';
import { jobLocks } from '@shared/schema';
import { BaseStorage } from '../base-storage';
import type { JobLock } from '../types';
import { db } from '../../db';
import { JOB_LOCK_CONSTANTS } from '../../utils/constants';

/**
 * JobLockStorage Class
 *
 * Domain repository for distributed job locking operations. Extends BaseStorage
 * to provide consistent error handling, logging, and validation patterns.
 *
 * IMPLEMENTATION GUIDANCE:
 * - **Input Validation**: All lock names and TTL values validated before database operations
 * - **Atomicity**: Lock operations use database-level concurrency controls (onConflictDoNothing)
 * - **Expiration**: All locks have TTL to prevent orphaned locks from server crashes
 * - **Security**: Lock ownership validated before release/extension operations
 */
export class JobLockStorage extends BaseStorage {
  constructor(database: typeof db) {
    super(database);
  }

  // ============================================================================
  // Validation Helpers (3 helpers)
  // ============================================================================

  /**
   * Validates that jobName is a non-empty string
   */
  private validateJobName(jobName: string): void {
    if (!jobName || typeof jobName !== 'string' || jobName.trim().length === 0) {
      throw new Error(`Invalid jobName: "${jobName}". Must be a non-empty string.`);
    }
    if (jobName.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH) {
      throw new Error(
        `Invalid jobName: "${jobName}". Must be ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH} characters or less.`
      );
    }
  }

  /**
   * Validates that ttlSeconds is a positive integer within reasonable bounds
   */
  private validateTTL(ttlSeconds: number): void {
    if (
      !Number.isInteger(ttlSeconds) ||
      ttlSeconds < JOB_LOCK_CONSTANTS.VALIDATION.MIN_TTL_SECONDS
    ) {
      throw new Error(`Invalid ttlSeconds: ${ttlSeconds}. Must be a positive integer.`);
    }
    if (ttlSeconds > JOB_LOCK_CONSTANTS.VALIDATION.MAX_TTL_SECONDS) {
      throw new Error(
        `Invalid ttlSeconds: ${ttlSeconds}. Must be ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_TTL_SECONDS} seconds (7 days) or less.`
      );
    }
  }

  /**
   * Validates that lockedBy identifier is a non-empty string
   */
  private validateLockedBy(lockedBy: string): void {
    if (!lockedBy || typeof lockedBy !== 'string' || lockedBy.trim().length === 0) {
      throw new Error(`Invalid lockedBy: "${lockedBy}". Must be a non-empty string.`);
    }
    if (lockedBy.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH) {
      throw new Error(
        `Invalid lockedBy: "${lockedBy}". Must be ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH} characters or less.`
      );
    }
  }

  // ============================================================================
  // Core Lock Operations (7 methods)
  // ============================================================================

  /**
   * Get all job locks (ordered by most recent first)
   * @returns Array of all job locks
   */
  async getJobLocks(): Promise<JobLock[]> {
    try {
      const result = await this.db
        .select({
          id: jobLocks.id,
          jobName: jobLocks.jobName,
          lockedBy: jobLocks.lockedBy,
          lockedAt: jobLocks.lockedAt,
          expiresAt: jobLocks.expiresAt,
          metadata: jobLocks.metadata,
        })
        .from(jobLocks)
        .orderBy(desc(jobLocks.lockedAt));

      this.logSuccess('getJobLocks', { count: result.length });
      return result;
    } catch (error) {
      this.handleError(error, 'getJobLocks');
    }
  }

  /**
   * Acquire a lock for a job (atomic operation using onConflictDoNothing)
   * @param jobName - Unique name of the job
   * @param lockedBy - Identifier of the lock owner (usually instanceId)
   * @param ttlSeconds - Lock time-to-live in seconds
   * @returns Object with success flag and optional lock ID
   */
  async acquireJobLock(
    jobName: string,
    lockedBy: string,
    ttlSeconds: number
  ): Promise<{ success: boolean; id?: number }> {
    this.validateJobName(jobName);
    this.validateLockedBy(lockedBy);
    this.validateTTL(ttlSeconds);

    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const result = await this.db
        .insert(jobLocks)
        .values({
          jobName,
          lockedBy,
          expiresAt,
          lockedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: jobLocks.id });

      const success = result.length > 0;

      if (success) {
        this.logSuccess('acquireJobLock', {
          jobName,
          lockedBy,
          ttlSeconds,
          lockId: result[0].id,
        });
        return { success: true, id: result[0].id };
      }

      return { success: false };
    } catch (error) {
      this.handleError(error, 'acquireJobLock');
    }
  }

  /**
   * Get a job lock by job name
   * @param jobName - Name of the job
   * @returns JobLock object or null if not found
   */
  async getJobLockByName(jobName: string): Promise<JobLock | null> {
    this.validateJobName(jobName);

    try {
      const [lock] = await this.db
        .select()
        .from(jobLocks)
        .where(eq(jobLocks.jobName, jobName))
        .limit(1);

      return lock ?? null;
    } catch (error) {
      this.handleError(error, 'getJobLockByName');
    }
  }

  /**
   * Update an expired lock with new owner (atomic operation)
   * Used for acquiring expired locks during race conditions
   * @param jobName - Name of the job
   * @param lockedBy - New lock owner identifier
   * @param newExpiresAt - New expiration time
   * @returns Object with success flag and optional lock ID
   */
  async updateExpiredJobLock(
    jobName: string,
    lockedBy: string,
    newExpiresAt: Date
  ): Promise<{ success: boolean; id?: number }> {
    this.validateJobName(jobName);
    this.validateLockedBy(lockedBy);

    try {
      const result = await this.db
        .update(jobLocks)
        .set({
          lockedBy,
          lockedAt: new Date(),
          expiresAt: newExpiresAt,
        })
        .where(and(eq(jobLocks.jobName, jobName), lte(jobLocks.expiresAt, new Date())))
        .returning({ id: jobLocks.id });

      const success = result.length > 0;

      if (success) {
        this.logSuccess('updateExpiredJobLock', {
          jobName,
          lockedBy,
          lockId: result[0].id,
        });
        return { success: true, id: result[0].id };
      }

      return { success: false };
    } catch (error) {
      this.handleError(error, 'updateExpiredJobLock');
    }
  }

  /**
   * Release a job lock (validates ownership)
   * @param jobName - Name of the job
   * @param lockedBy - Lock owner identifier (must match)
   * @returns true if lock released, false if not found or not owned
   */
  async releaseJobLock(jobName: string, lockedBy: string): Promise<boolean> {
    this.validateJobName(jobName);
    this.validateLockedBy(lockedBy);

    try {
      const result = await this.db
        .delete(jobLocks)
        .where(and(eq(jobLocks.jobName, jobName), eq(jobLocks.lockedBy, lockedBy)))
        .returning({ id: jobLocks.id });

      const released = result.length > 0;

      if (released) {
        this.logSuccess('releaseJobLock', { jobName, lockedBy });
      }

      return released;
    } catch (error) {
      this.handleError(error, 'releaseJobLock');
    }
  }

  /**
   * Extend a job lock's expiration time (validates ownership)
   * Useful for long-running jobs
   * @param jobName - Name of the job
   * @param lockedBy - Lock owner identifier (must match)
   * @param additionalSeconds - Additional seconds to extend
   * @returns true if extended, false if not found or not owned
   */
  async extendJobLock(
    jobName: string,
    lockedBy: string,
    additionalSeconds: number
  ): Promise<boolean> {
    this.validateJobName(jobName);
    this.validateLockedBy(lockedBy);
    this.validateTTL(additionalSeconds);

    try {
      const result = await this.db
        .update(jobLocks)
        .set({
          expiresAt: sql`${jobLocks.expiresAt} + (${additionalSeconds} * INTERVAL '1 second')`,
        })
        .where(and(eq(jobLocks.jobName, jobName), eq(jobLocks.lockedBy, lockedBy)))
        .returning({ id: jobLocks.id });

      const extended = result.length > 0;

      if (extended) {
        this.logSuccess('extendJobLock', { jobName, lockedBy, additionalSeconds });
      }

      return extended;
    } catch (error) {
      this.handleError(error, 'extendJobLock');
    }
  }

  /**
   * Check if a job is currently locked (not expired)
   * @param jobName - Name of the job
   * @returns true if locked, false otherwise
   */
  async isJobLocked(jobName: string): Promise<boolean> {
    this.validateJobName(jobName);

    try {
      const locks = await this.db
        .select({ id: jobLocks.id })
        .from(jobLocks)
        .where(and(eq(jobLocks.jobName, jobName), sql`${jobLocks.expiresAt} > NOW()`))
        .limit(1);

      return locks.length > 0;
    } catch (error) {
      this.handleError(error, 'isJobLocked');
    }
  }

  /**
   * Clean up all expired job locks
   * Should be run periodically to prevent table bloat
   * @returns Number of locks cleaned up
   */
  async cleanupExpiredJobLocks(): Promise<number> {
    try {
      const result = await this.db
        .delete(jobLocks)
        .where(lte(jobLocks.expiresAt, new Date()))
        .returning({ id: jobLocks.id });

      const cleanedCount = result.length;

      if (cleanedCount > 0) {
        this.logSuccess('cleanupExpiredJobLocks', { count: cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      this.handleError(error, 'cleanupExpiredJobLocks');
    }
  }

  // ============================================================================
  // Analytics Operations (1 method)
  // ============================================================================

  /**
   * Get count of active job locks (not expired)
   * Used for monitoring and admin dashboards
   * @returns Number of active locks where expiresAt > NOW()
   */
  async getActiveJobLocksCount(): Promise<number> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(jobLocks)
        .where(sql`${jobLocks.expiresAt} > NOW()`);

      const activeCount = Number(result[0]?.count ?? 0);

      this.logSuccess('getActiveJobLocksCount', { count: activeCount });
      return activeCount;
    } catch (error) {
      this.handleError(error, 'getActiveJobLocksCount');
    }
  }
}
