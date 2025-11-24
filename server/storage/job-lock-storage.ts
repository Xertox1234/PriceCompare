/**
 * Job Lock Storage Repository
 *
 * Manages distributed job locks to prevent concurrent execution of scheduled tasks
 * across multiple server instances. Provides TTL-based locking with automatic expiration.
 *
 * Key Features:
 * - Atomic lock acquisition with conflict detection
 * - TTL-based automatic expiration
 * - Lock extension for long-running jobs
 * - Cleanup of expired locks
 * - Support for metadata storage
 *
 * Use Cases:
 * - Cron jobs that should only run on one server
 * - Price snapshot operations
 * - Batch processing tasks
 * - Database maintenance jobs
 *
 * @example
 * ```typescript
 * // Acquire lock for daily price snapshot
 * const result = await jobLockStorage.acquireJobLock(
 *   'daily-price-snapshot',
 *   'server-1',
 *   3600 // 1 hour TTL
 * );
 *
 * if (result.success) {
 *   try {
 *     await performPriceSnapshot();
 *   } finally {
 *     await jobLockStorage.releaseJobLock('daily-price-snapshot', 'server-1');
 *   }
 * }
 * ```
 */

import { eq, and, lte, sql } from 'drizzle-orm';
import { jobLocks } from '@shared/schema';
import { BaseStorage } from './base-storage';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { JobLock, InsertJobLock, AcquireLockResult } from './types';

/**
 * Constants for job lock operations
 */
const JOB_LOCK_CONSTANTS = {
  VALIDATION: {
    MIN_JOB_NAME_LENGTH: 1,
    MAX_JOB_NAME_LENGTH: 100,
    MIN_LOCKED_BY_LENGTH: 1,
    MAX_LOCKED_BY_LENGTH: 200,
    MIN_TTL_SECONDS: 1,
    MAX_TTL_SECONDS: 86400, // 24 hours
  },
  QUERY: {
    CLEANUP_BATCH_SIZE: 100,
  },
} as const;

/**
 * Job Lock Storage Interface
 */
export interface IJobLockStorage {
  /**
   * Acquire a distributed lock for a job
   */
  acquireJobLock(jobName: string, lockedBy: string, ttlSeconds: number): Promise<AcquireLockResult>;

  /**
   * Get lock information by job name
   */
  getJobLockByName(jobName: string): Promise<JobLock | null>;

  /**
   * Update an expired lock (acquire if expired)
   */
  updateExpiredJobLock(jobName: string, lockedBy: string, newExpiresAt: Date): Promise<AcquireLockResult>;

  /**
   * Release a lock held by specific instance
   */
  releaseJobLock(jobName: string, lockedBy: string): Promise<boolean>;

  /**
   * Extend lock expiration time
   */
  extendJobLock(jobName: string, lockedBy: string, additionalSeconds: number): Promise<boolean>;

  /**
   * Check if a job is currently locked
   */
  isJobLocked(jobName: string): Promise<boolean>;

  /**
   * Clean up expired locks
   */
  cleanupExpiredJobLocks(): Promise<number>;
}

/**
 * Job Lock Storage Implementation
 *
 * Provides distributed locking mechanism for scheduled jobs using PostgreSQL.
 * Uses unique constraints and database-level locking to ensure atomicity.
 */
export class JobLockStorage extends BaseStorage implements IJobLockStorage {
  constructor(db: NodePgDatabase) {
    super(db);
  }

  /**
   * Acquire a distributed lock for a job
   *
   * Attempts to acquire a lock with the specified TTL. Uses PostgreSQL's
   * ON CONFLICT DO NOTHING to ensure atomic lock acquisition. Only succeeds
   * if no active lock exists for the job name.
   *
   * @param jobName - Unique identifier for the job (1-100 characters)
   * @param lockedBy - Server instance identifier (1-200 characters)
   * @param ttlSeconds - Time-to-live in seconds (1-86400)
   * @returns Object with success flag and lock ID if acquired
   *
   * @throws Error if validation fails
   *
   * @example
   * ```typescript
   * const result = await storage.acquireJobLock(
   *   'price-snapshot',
   *   'server-1',
   *   3600
   * );
   * if (result.success) {
   *   console.log('Lock acquired:', result.id);
   * }
   * ```
   */
  async acquireJobLock(
    jobName: string,
    lockedBy: string,
    ttlSeconds: number
  ): Promise<AcquireLockResult> {
    return this.handleError('acquireJobLock', async () => {
      // Validate inputs
      if (!jobName || typeof jobName !== 'string') {
        throw new Error('Job name is required and must be a string');
      }
      if (jobName.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH) {
        throw new Error(`Job name must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH} character`);
      }
      if (jobName.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH) {
        throw new Error(`Job name cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH} characters`);
      }

      if (!lockedBy || typeof lockedBy !== 'string') {
        throw new Error('Locked by identifier is required and must be a string');
      }
      if (lockedBy.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_LOCKED_BY_LENGTH) {
        throw new Error(`Locked by identifier must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_LOCKED_BY_LENGTH} character`);
      }
      if (lockedBy.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH) {
        throw new Error(`Locked by identifier cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH} characters`);
      }

      if (!ttlSeconds || typeof ttlSeconds !== 'number' || !Number.isInteger(ttlSeconds)) {
        throw new Error('TTL must be a positive integer');
      }
      if (ttlSeconds < JOB_LOCK_CONSTANTS.VALIDATION.MIN_TTL_SECONDS) {
        throw new Error(`TTL must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_TTL_SECONDS} second`);
      }
      if (ttlSeconds > JOB_LOCK_CONSTANTS.VALIDATION.MAX_TTL_SECONDS) {
        throw new Error(`TTL cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_TTL_SECONDS} seconds (24 hours)`);
      }

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      // Attempt to acquire lock
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

      return result.length > 0
        ? { success: true, id: result[0].id }
        : { success: false };
    });
  }

  /**
   * Get lock information by job name
   *
   * Retrieves the current lock record for a job, if it exists.
   * Does not check if the lock is expired.
   *
   * @param jobName - Unique identifier for the job
   * @returns Lock record or null if not found
   *
   * @throws Error if job name is invalid
   *
   * @example
   * ```typescript
   * const lock = await storage.getJobLockByName('price-snapshot');
   * if (lock) {
   *   console.log('Locked by:', lock.lockedBy);
   *   console.log('Expires at:', lock.expiresAt);
   * }
   * ```
   */
  async getJobLockByName(jobName: string): Promise<JobLock | null> {
    return this.handleError('getJobLockByName', async () => {
      // Validate job name
      if (!jobName || typeof jobName !== 'string') {
        throw new Error('Job name is required and must be a string');
      }
      if (jobName.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH) {
        throw new Error(`Job name must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH} character`);
      }
      if (jobName.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH) {
        throw new Error(`Job name cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH} characters`);
      }

      const [lock] = await this.db
        .select()
        .from(jobLocks)
        .where(eq(jobLocks.jobName, jobName))
        .limit(1);

      return lock ?? null;
    });
  }

  /**
   * Update an expired lock (acquire if expired)
   *
   * Attempts to acquire a lock that has expired. Only succeeds if the lock
   * exists and is expired. This allows a new server to take over a job from
   * a server that died without releasing the lock.
   *
   * @param jobName - Unique identifier for the job
   * @param lockedBy - New server instance identifier
   * @param newExpiresAt - New expiration timestamp
   * @returns Object with success flag and lock ID if updated
   *
   * @throws Error if validation fails
   *
   * @example
   * ```typescript
   * const newExpiresAt = new Date(Date.now() + 3600 * 1000);
   * const result = await storage.updateExpiredJobLock(
   *   'price-snapshot',
   *   'server-2',
   *   newExpiresAt
   * );
   * if (result.success) {
   *   console.log('Acquired expired lock');
   * }
   * ```
   */
  async updateExpiredJobLock(
    jobName: string,
    lockedBy: string,
    newExpiresAt: Date
  ): Promise<AcquireLockResult> {
    return this.handleError('updateExpiredJobLock', async () => {
      // Validate inputs
      if (!jobName || typeof jobName !== 'string') {
        throw new Error('Job name is required and must be a string');
      }
      if (jobName.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH) {
        throw new Error(`Job name must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH} character`);
      }
      if (jobName.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH) {
        throw new Error(`Job name cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH} characters`);
      }

      if (!lockedBy || typeof lockedBy !== 'string') {
        throw new Error('Locked by identifier is required and must be a string');
      }
      if (lockedBy.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_LOCKED_BY_LENGTH) {
        throw new Error(`Locked by identifier must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_LOCKED_BY_LENGTH} character`);
      }
      if (lockedBy.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH) {
        throw new Error(`Locked by identifier cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH} characters`);
      }

      if (!(newExpiresAt instanceof Date) || isNaN(newExpiresAt.getTime())) {
        throw new Error('New expiration date must be a valid Date object');
      }

      if (newExpiresAt <= new Date()) {
        throw new Error('New expiration date must be in the future');
      }

      // Attempt to update expired lock
      const result = await this.db
        .update(jobLocks)
        .set({
          lockedBy,
          lockedAt: new Date(),
          expiresAt: newExpiresAt,
        })
        .where(
          and(
            eq(jobLocks.jobName, jobName),
            lte(jobLocks.expiresAt, new Date())
          )
        )
        .returning({ id: jobLocks.id });

      return result.length > 0
        ? { success: true, id: result[0].id }
        : { success: false };
    });
  }

  /**
   * Release a lock held by specific instance
   *
   * Deletes the lock record for a job if it's held by the specified instance.
   * This should be called when a job completes successfully or encounters an
   * error that should allow other instances to retry.
   *
   * @param jobName - Unique identifier for the job
   * @param lockedBy - Server instance identifier that holds the lock
   * @returns True if lock was released, false if not found or owned by different instance
   *
   * @throws Error if validation fails
   *
   * @example
   * ```typescript
   * const released = await storage.releaseJobLock(
   *   'price-snapshot',
   *   'server-1'
   * );
   * if (released) {
   *   console.log('Lock released successfully');
   * }
   * ```
   */
  async releaseJobLock(jobName: string, lockedBy: string): Promise<boolean> {
    return this.handleError('releaseJobLock', async () => {
      // Validate inputs
      if (!jobName || typeof jobName !== 'string') {
        throw new Error('Job name is required and must be a string');
      }
      if (jobName.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH) {
        throw new Error(`Job name must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH} character`);
      }
      if (jobName.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH) {
        throw new Error(`Job name cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH} characters`);
      }

      if (!lockedBy || typeof lockedBy !== 'string') {
        throw new Error('Locked by identifier is required and must be a string');
      }
      if (lockedBy.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_LOCKED_BY_LENGTH) {
        throw new Error(`Locked by identifier must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_LOCKED_BY_LENGTH} character`);
      }
      if (lockedBy.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH) {
        throw new Error(`Locked by identifier cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH} characters`);
      }

      // Attempt to delete lock
      const result = await this.db
        .delete(jobLocks)
        .where(
          and(
            eq(jobLocks.jobName, jobName),
            eq(jobLocks.lockedBy, lockedBy)
          )
        )
        .returning({ id: jobLocks.id });

      return result.length > 0;
    });
  }

  /**
   * Extend lock expiration time
   *
   * Adds additional seconds to the lock's expiration time. Useful for long-running
   * jobs that need to maintain the lock beyond the initial TTL. Only succeeds if
   * the lock is held by the specified instance.
   *
   * @param jobName - Unique identifier for the job
   * @param lockedBy - Server instance identifier that holds the lock
   * @param additionalSeconds - Number of seconds to add (1-86400)
   * @returns True if lock was extended, false if not found or owned by different instance
   *
   * @throws Error if validation fails
   *
   * @example
   * ```typescript
   * // Extend lock by 30 minutes
   * const extended = await storage.extendJobLock(
   *   'price-snapshot',
   *   'server-1',
   *   1800
   * );
   * if (extended) {
   *   console.log('Lock extended successfully');
   * }
   * ```
   */
  async extendJobLock(
    jobName: string,
    lockedBy: string,
    additionalSeconds: number
  ): Promise<boolean> {
    return this.handleError('extendJobLock', async () => {
      // Validate inputs
      if (!jobName || typeof jobName !== 'string') {
        throw new Error('Job name is required and must be a string');
      }
      if (jobName.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH) {
        throw new Error(`Job name must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH} character`);
      }
      if (jobName.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH) {
        throw new Error(`Job name cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH} characters`);
      }

      if (!lockedBy || typeof lockedBy !== 'string') {
        throw new Error('Locked by identifier is required and must be a string');
      }
      if (lockedBy.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_LOCKED_BY_LENGTH) {
        throw new Error(`Locked by identifier must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_LOCKED_BY_LENGTH} character`);
      }
      if (lockedBy.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH) {
        throw new Error(`Locked by identifier cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_LOCKED_BY_LENGTH} characters`);
      }

      if (!additionalSeconds || typeof additionalSeconds !== 'number' || !Number.isInteger(additionalSeconds)) {
        throw new Error('Additional seconds must be a positive integer');
      }
      if (additionalSeconds < JOB_LOCK_CONSTANTS.VALIDATION.MIN_TTL_SECONDS) {
        throw new Error(`Additional seconds must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_TTL_SECONDS} second`);
      }
      if (additionalSeconds > JOB_LOCK_CONSTANTS.VALIDATION.MAX_TTL_SECONDS) {
        throw new Error(`Additional seconds cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_TTL_SECONDS} seconds (24 hours)`);
      }

      // Extend lock expiration
      const result = await this.db
        .update(jobLocks)
        .set({
          expiresAt: sql`${jobLocks.expiresAt} + (${additionalSeconds} * INTERVAL '1 second')`,
        })
        .where(
          and(
            eq(jobLocks.jobName, jobName),
            eq(jobLocks.lockedBy, lockedBy)
          )
        )
        .returning({ id: jobLocks.id });

      return result.length > 0;
    });
  }

  /**
   * Check if a job is currently locked
   *
   * Determines if an active (non-expired) lock exists for a job.
   * Useful for checking lock status before attempting operations.
   *
   * @param jobName - Unique identifier for the job
   * @returns True if job is currently locked and not expired, false otherwise
   *
   * @throws Error if job name is invalid
   *
   * @example
   * ```typescript
   * const isLocked = await storage.isJobLocked('price-snapshot');
   * if (isLocked) {
   *   console.log('Job is currently running on another server');
   * }
   * ```
   */
  async isJobLocked(jobName: string): Promise<boolean> {
    return this.handleError('isJobLocked', async () => {
      // Validate job name
      if (!jobName || typeof jobName !== 'string') {
        throw new Error('Job name is required and must be a string');
      }
      if (jobName.length < JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH) {
        throw new Error(`Job name must be at least ${JOB_LOCK_CONSTANTS.VALIDATION.MIN_JOB_NAME_LENGTH} character`);
      }
      if (jobName.length > JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH) {
        throw new Error(`Job name cannot exceed ${JOB_LOCK_CONSTANTS.VALIDATION.MAX_JOB_NAME_LENGTH} characters`);
      }

      const locks = await this.db
        .select({ id: jobLocks.id })
        .from(jobLocks)
        .where(
          and(
            eq(jobLocks.jobName, jobName),
            sql`${jobLocks.expiresAt} > NOW()`
          )
        )
        .limit(1);

      return locks.length > 0;
    });
  }

  /**
   * Clean up expired locks
   *
   * Removes all lock records that have expired. This should be called
   * periodically (e.g., via cron job) to prevent table bloat.
   *
   * Performance: Uses indexed expiresAt column for efficient deletion.
   *
   * @returns Number of locks cleaned up
   *
   * @example
   * ```typescript
   * const cleaned = await storage.cleanupExpiredJobLocks();
   * console.log(`Cleaned up ${cleaned} expired locks`);
   * ```
   */
  async cleanupExpiredJobLocks(): Promise<number> {
    return this.handleError('cleanupExpiredJobLocks', async () => {
      const result = await this.db
        .delete(jobLocks)
        .where(lte(jobLocks.expiresAt, new Date()))
        .returning({ id: jobLocks.id });

      const count = result.length;

      if (count > 0) {
        this.logDebug('cleanupExpiredJobLocks', {
          message: `Cleaned up ${count} expired job locks`,
          count,
        });
      }

      return count;
    });
  }
}
