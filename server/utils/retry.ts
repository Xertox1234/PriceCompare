/**
 * Retry Utility with Exponential Backoff and Jitter
 *
 * Provides smart retry logic for transient failures (network timeouts, rate limits)
 * while failing fast on non-retryable errors (validation, auth, 404).
 *
 * Features:
 * - Exponential backoff with jitter (prevents thundering herd)
 * - Configurable retry conditions
 * - Retry attempt logging
 * - Type-safe implementation
 *
 * Pattern Alignment:
 * - 01_TYPESCRIPT_PATTERNS.md: Strict typing, async/await, proper error handling
 * - 06_ERROR_HANDLING_PATTERNS.md: Smart error classification
 * - CLAUDE.md: Zero tolerance for 'any' types
 */

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in milliseconds before first retry (default: 1000ms) */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 30000ms) */
  maxDelayMs: number;
  /** Custom function to determine if error should be retried */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback invoked before each retry attempt */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

/**
 * Default retry configuration
 * Conservative defaults suitable for most scraping scenarios
 */
const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Execute a function with automatic retry on transient failures
 *
 * Implements exponential backoff with jitter:
 * - Attempt 1: ~1s delay
 * - Attempt 2: ~2s delay
 * - Attempt 3: ~4s delay
 * - Jitter: ±0-1s random to prevent thundering herd
 *
 * @param fn - Async function to execute with retry
 * @param options - Retry configuration
 * @returns Promise resolving to function result
 * @throws Last error if all retry attempts exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => scrapeProductPrice(url),
 *   {
 *     maxAttempts: 3,
 *     baseDelayMs: 2000,
 *     shouldRetry: isRetryableError,
 *     onRetry: (error, attempt, delay) => {
 *       logger.warn(`Retry attempt ${attempt} after ${delay}ms: ${error.message}`);
 *     },
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry this error
      if (opts.shouldRetry && !opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt >= opts.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 1000; // 0-1 second jitter
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelayMs);

      // Notify about retry
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt, delay);
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  // All attempts exhausted, throw last error
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 * Used internally for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if error is retryable (transient failure)
 *
 * Retryable errors include:
 * - Network timeouts (ETIMEDOUT, ECONNRESET)
 * - Connection errors (ENOTFOUND, ECONNREFUSED)
 * - Browser/navigation timeouts
 * - Playwright target closed/protocol errors
 * - HTTP 429 (rate limit) or 5xx (server errors)
 *
 * @param error - Error to classify
 * @returns true if error should be retried
 *
 * @example
 * ```typescript
 * try {
 *   await scrapePrice(url);
 * } catch (error) {
 *   if (isRetryableError(error as Error)) {
 *     // Retry the operation
 *   } else {
 *     // Fail fast
 *   }
 * }
 * ```
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  const retryablePatterns = [
    'timeout',
    'econnreset',
    'etimedout',
    'enotfound',
    'econnrefused',
    'net::err_',
    'navigation timeout',
    'waiting for selector',
    'target closed',
    'protocol error',
    'socket hang up',
    'network error',
    'connection refused',
    'connection reset',
  ];

  // Check error message for retryable patterns
  if (retryablePatterns.some((pattern) => message.includes(pattern))) {
    return true;
  }

  // Check for HTTP status codes that warrant retry
  // Type-safe check for statusCode property
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const status = error.statusCode;
    // Retry rate limits (429) and server errors (5xx)
    return status === 429 || (status >= 500 && status < 600);
  }

  return false;
}

/**
 * Determine if error is non-retryable (permanent failure)
 *
 * Non-retryable errors include:
 * - SSRF protection blocks (not in allowlist)
 * - Validation errors (invalid URL)
 * - Auth errors (unauthorized, forbidden)
 * - 404 Not Found
 *
 * These errors will never succeed on retry and should fail fast.
 *
 * @param error - Error to classify
 * @returns true if error should NOT be retried
 *
 * @example
 * ```typescript
 * const shouldRetry = (error: Error) => {
 *   if (isNonRetryableError(error)) return false;
 *   return isRetryableError(error);
 * };
 *
 * await withRetry(() => scrape(url), { shouldRetry });
 * ```
 */
export function isNonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  const nonRetryablePatterns = [
    'not in allowlist', // SSRF protection
    'invalid url', // Validation error
    'unauthorized', // Auth error (401)
    'forbidden', // Auth error (403)
    '404', // Not found
    'validation error', // Input validation
    'bad request', // 400 error
  ];

  return nonRetryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Create a smart retry condition function
 *
 * Combines retryable and non-retryable checks with configurable logic.
 * This is the recommended shouldRetry function for most use cases.
 *
 * @returns Function suitable for RetryOptions.shouldRetry
 *
 * @example
 * ```typescript
 * await withRetry(
 *   () => scrapeProduct(url),
 *   {
 *     maxAttempts: 3,
 *     shouldRetry: createSmartRetryCondition(),
 *   }
 * );
 * ```
 */
export function createSmartRetryCondition(): (error: Error, attempt: number) => boolean {
  return (error: Error, _attempt: number): boolean => {
    // Never retry on last attempt (handled by withRetry)
    // This check is redundant but makes intent clear

    // Don't retry validation/auth errors (fail fast)
    if (isNonRetryableError(error)) {
      return false;
    }

    // Retry transient errors
    return isRetryableError(error);
  };
}
