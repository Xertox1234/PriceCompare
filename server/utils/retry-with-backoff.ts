/**
 * Retry Utility with Exponential Backoff
 *
 * Provides robust retry logic for transient failures with configurable
 * exponential backoff, jitter, and error classification.
 *
 * Use for operations that may fail transiently:
 * - Database connection errors
 * - Network timeouts
 * - Temporary resource unavailability
 * - Lock acquisition failures
 */

import { logger } from './logger';

/**
 * Configuration for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in milliseconds before first retry (default: 1000ms) */
  initialDelayMs?: number;

  /** Maximum delay in milliseconds between retries (default: 30000ms = 30s) */
  maxDelayMs?: number;

  /** Backoff multiplier for exponential delay (default: 2) */
  backoffMultiplier?: number;

  /** Add random jitter to delay (0-1, default: 0.1 = 10%) */
  jitter?: number;

  /** Total timeout in milliseconds for all retry attempts (default: none) */
  totalTimeoutMs?: number;

  /** Function to determine if error is retryable (default: retries all errors) */
  isRetryable?: (error: unknown) => boolean;

  /** Function called before each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;

  /** Context for logging (operation name, product ID, etc.) */
  context?: Record<string, unknown>;
}

/**
 * Default retry configuration
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'context' | 'totalTimeoutMs'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: 0.1,
  isRetryable: () => true, // Retry all errors by default
  onRetry: (error, attempt, delayMs) => {
    logger.warn('[Retry] Retrying after error:', {
      error: error instanceof Error ? error.message : String(error),
      attempt,
      delayMs,
    });
  },
};

/**
 * Common retryable error patterns
 */
export const isTransientDatabaseError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Check PostgreSQL error codes (from error.cause for Drizzle errors)
  const cause = (error as unknown as { cause?: { code?: string } }).cause;
  if (cause?.code) {
    const pgErrorCode = cause.code;
    // PostgreSQL error codes for retryable errors:
    // 40001 = serialization_failure (SERIALIZABLE transaction conflict)
    // 40P01 = deadlock_detected
    // 08000-08999 = connection errors
    // 53000-53999 = insufficient resources
    const retryableCodes = ['40001', '40P01'];
    if (retryableCodes.includes(pgErrorCode)) {
      return true;
    }
  }

  // PostgreSQL transient errors
  const transientPatterns = [
    'connection refused',
    'connection terminated',
    'connection timeout',
    'connection reset',
    'deadlock detected',
    'could not serialize',
    'lock timeout',
    'temporary failure',
    'too many connections',
    'econnreset',
    'econnrefused',
    'etimedout',
    'epipe',
  ];

  return transientPatterns.some(pattern => message.includes(pattern));
};

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: number
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter: random value between (1 - jitter) and (1 + jitter)
  const jitterMultiplier = 1 + (Math.random() * 2 - 1) * jitter;
  const delayWithJitter = cappedDelay * jitterMultiplier;

  // Cap again after jitter to ensure we never exceed maxDelayMs
  const finalDelay = Math.min(delayWithJitter, maxDelayMs);

  return Math.floor(finalDelay);
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - Async function to retry
 * @param options - Retry configuration options
 * @returns Result of successful operation
 * @throws Last error if all retry attempts fail
 *
 * @example
 * // Basic retry with defaults (3 attempts, 1s initial delay)
 * const result = await retryWithBackoff(
 *   async () => await db.query('SELECT ...'),
 *   { context: { operation: 'fetch-products' } }
 * );
 *
 * @example
 * // Retry only transient database errors
 * const result = await retryWithBackoff(
 *   async () => await aggregateDaily(),
 *   {
 *     maxAttempts: 5,
 *     initialDelayMs: 2000,
 *     isRetryable: isTransientDatabaseError,
 *     context: { operation: 'daily-aggregation', date: '2025-01-15' }
 *   }
 * );
 *
 * @example
 * // Custom retry logic with callback
 * const result = await retryWithBackoff(
 *   async () => await acquireLock('job-name'),
 *   {
 *     maxAttempts: 10,
 *     initialDelayMs: 500,
 *     maxDelayMs: 5000,
 *     onRetry: (error, attempt, delay) => {
 *       logger.info(`Lock acquisition failed, retrying in ${delay}ms (attempt ${attempt})`)
 *     }
 *   }
 * );
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    // Check total timeout before each attempt
    if (options.totalTimeoutMs) {
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs >= options.totalTimeoutMs) {
        const timeoutError = new Error(
          `Retry timeout: exceeded ${options.totalTimeoutMs}ms after ${attempt - 1} attempts`
        );
        logger.error('[Retry] Total timeout exceeded:', {
          totalTimeoutMs: options.totalTimeoutMs,
          elapsedMs,
          attempts: attempt - 1,
          context: options.context,
        });
        throw timeoutError;
      }
    }

    try {
      // Attempt the operation
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const shouldRetry = opts.isRetryable(error);

      if (!shouldRetry) {
        logger.error('[Retry] Non-retryable error encountered:', {
          error: error instanceof Error ? error.message : String(error),
          attempt,
          context: options.context,
        });
        throw error; // Don't retry non-retryable errors
      }

      // Check if we have more attempts left
      if (attempt >= opts.maxAttempts) {
        logger.error('[Retry] Max retry attempts reached:', {
          error: error instanceof Error ? error.message : String(error),
          maxAttempts: opts.maxAttempts,
          context: options.context,
        });
        throw error; // Last attempt failed, throw error
      }

      // Calculate delay for next attempt
      const delayMs = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
        opts.jitter
      );

      // Call retry callback
      opts.onRetry(error, attempt, delayMs);

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}

/**
 * Wrap a service method with retry logic
 *
 * Returns a function that automatically retries the wrapped method.
 * Useful for creating resilient service methods.
 *
 * @example
 * class AggregationService {
 *   // Wrap method with automatic retry
 *   calculateDaily = withRetry(
 *     async () => { ... },
 *     { maxAttempts: 5, isRetryable: isTransientDatabaseError }
 *   );
 * }
 */
export function withRetry<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    return retryWithBackoff(() => fn(...args), options);
  };
}
