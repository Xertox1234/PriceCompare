/**
 * Base Storage Class
 *
 * Abstract base class for all domain-specific storage repositories.
 * Provides common utilities, error handling, and database access patterns
 * that are shared across all storage modules.
 *
 * Key Features:
 * - Standardized error handling and logging
 * - Retry logic for transient database errors
 * - Common database query utilities
 * - Transaction support
 *
 * Usage:
 * ```typescript
 * export class UserStorage extends BaseStorage {
 *   async getUserById(id: number): Promise<SafeUser | null> {
 *     return this.handleError('getUserById', async () => {
 *       const result = await this.db.select({...}).from(users);
 *       return result[0] || null;
 *     });
 *   }
 * }
 * ```
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { logger } from '../utils/logger';
import { retryWithBackoff, isTransientDatabaseError } from '../utils/retry-with-backoff';

/**
 * Abstract base class for domain-specific storage repositories
 */
export abstract class BaseStorage {
  /**
   * Drizzle database instance
   * Protected to allow access from child classes
   */
  protected db: NodePgDatabase;

  /**
   * Constructor - initializes database connection
   * @param database - Drizzle database instance
   */
  constructor(database: NodePgDatabase) {
    this.db = database;
  }

  /**
   * Standardized error handling wrapper
   * Logs errors with context and rethrows them
   *
   * @param operation - Name of the operation being performed
   * @param fn - Async function to execute
   * @returns Result of the function
   * @throws Re-throws any errors after logging
   */
  protected async handleError<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      logger.error(`Storage operation '${operation}' failed`, {
        error: error instanceof Error ? error.message : String(error),
        operation,
        repository: this.constructor.name,
      });
      throw error;
    }
  }

  /**
   * Execute operation with retry logic for transient errors
   * Useful for handling temporary database connection issues
   *
   * @param operation - Name of the operation
   * @param fn - Async function to execute
   * @param options - Retry configuration options
   * @returns Result of the function
   */
  protected async withRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: {
      maxRetries?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      backoffFactor?: number;
    }
  ): Promise<T> {
    return retryWithBackoff(
      async () => {
        try {
          return await fn();
        } catch (error) {
          logger.error(`Storage operation '${operation}' failed`, {
            error: error instanceof Error ? error.message : String(error),
            operation,
            repository: this.constructor.name,
          });
          throw error;
        }
      },
      {
        maxRetries: options?.maxRetries ?? 3,
        initialDelayMs: options?.initialDelayMs ?? 100,
        maxDelayMs: options?.maxDelayMs ?? 1000,
        backoffFactor: options?.backoffFactor ?? 2,
        shouldRetry: (error: unknown) => isTransientDatabaseError(error),
      }
    );
  }

  /**
   * Execute a database transaction
   * Provides type-safe transaction support for complex operations
   *
   * @param fn - Function to execute within transaction
   * @param options - Transaction options (e.g., isolation level)
   * @returns Result of the transaction function
   *
   * @example
   * ```typescript
   * await this.executeTransaction(async (tx) => {
   *   await tx.insert(users).values(userData);
   *   await tx.insert(profiles).values(profileData);
   * }, { isolationLevel: 'serializable' });
   * ```
   */
  protected async executeTransaction<T>(
    fn: (tx: NodePgDatabase) => Promise<T>,
    options?: { isolationLevel?: 'serializable' | 'repeatable read' | 'read committed' | 'read uncommitted' }
  ): Promise<T> {
    return this.db.transaction(fn, options);
  }

  /**
   * Log debug information for storage operations
   * Only logs in development mode to avoid production log spam
   *
   * @param operation - Operation name
   * @param details - Additional details to log
   */
  protected logDebug(operation: string, details?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Storage: ${operation}`, {
        repository: this.constructor.name,
        ...details,
      });
    }
  }

  /**
   * Check if a database error is a constraint violation
   * Useful for handling unique constraint violations, foreign key violations, etc.
   *
   * @param error - Error to check
   * @returns True if error is a constraint violation
   */
  protected isConstraintViolation(error: unknown): boolean {
    if (error instanceof Error) {
      // PostgreSQL constraint violation codes
      const constraintErrorCodes = ['23505', '23503', '23502', '23514'];
      const errorCode = (error as any).code;
      return constraintErrorCodes.includes(errorCode);
    }
    return false;
  }

  /**
   * Check if a database error is a "not found" error
   * Useful for distinguishing between "not found" and other errors
   *
   * @param error - Error to check
   * @returns True if error indicates record not found
   */
  protected isNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('not found') || message.includes('no rows');
    }
    return false;
  }
}
