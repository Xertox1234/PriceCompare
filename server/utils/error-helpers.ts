/**
 * Error Helper Utilities
 *
 * Provides utility functions for consistent error handling and message extraction.
 */

/**
 * Extract error message from unknown error type
 *
 * Handles Error objects, strings, and other values safely.
 * Use in catch blocks to safely extract error messages for logging.
 *
 * @param error - Unknown error value from catch block
 * @returns String representation of the error
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logger.error('Operation failed:', { error: getErrorMessage(error) });
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}
