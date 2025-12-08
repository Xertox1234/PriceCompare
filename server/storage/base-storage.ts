/**
 * Base Storage Class
 *
 * Provides common utilities and error handling for all domain-specific storage classes.
 * This foundation class ensures consistent logging, error handling, and database access
 * across all repository implementations.
 *
 * IMPLEMENTATION GUIDANCE FOR PHASE 2+ DOMAIN REPOSITORIES:
 *
 * 1. **Input Validation**: Validate all numeric IDs are positive (use parseIntSafe for request params)
 * 2. **N+1 Prevention**: Use explicit field selection and JOINs, never query in loops
 * 3. **Security**: NEVER expose passwordHash (SECURITY: NEVER expose) - always use SafeUser type
 * 4. **Error Handling**: Use handleError() for storage errors; routes must use createErrorResponse()
 * 5. **Transactions**: Wrap multi-step operations in db.transaction() for atomicity
 * 6. **Retry Logic**: Handle transient DB errors with retryWithBackoff utility
 * 7. **Logging**: Use logSuccess() for completed operations to maintain consistency
 *
 * Phase 1: Foundation - Extracted from monolithic storage.ts
 */

import type { db } from '../db';
import { logger } from '../utils/logger';

// Type alias for the database connection
type Database = typeof db;

/**
 * Abstract base class for all domain-specific storage repositories.
 *
 * Responsibilities:
 * - Provides protected database connection access
 * - Implements standardized error handling (internal use only - routes use createErrorResponse)
 * - Ensures consistent logging across all repositories
 * - Foundation for domain-specific implementations
 */
export abstract class BaseStorage {
  /**
   * Protected database connection available to all child repositories
   */
  protected db: Database;

  /**
   * @param db - Drizzle database connection instance
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Standardized error handler for storage operations
   *
   * @param error - The error that occurred
   * @param operation - Name of the operation that failed (for logging context)
   * @throws The original error after logging
   */
  protected handleError(error: unknown, operation: string): never {
    logger.error(`${operation} failed`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }

  /**
   * Logs successful operations (optional utility for repositories)
   *
   * @param operation - Name of the completed operation
   * @param details - Additional context for logging
   */
  protected logSuccess(operation: string, details?: Record<string, unknown>): void {
    logger.info(`${operation} completed successfully`, details);
  }
}
