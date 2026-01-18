import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  isRetryableError,
  isNonRetryableError,
  createSmartRetryCondition,
} from '../retry';

describe('retry utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1000 });
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient failure and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn();

      const promise = withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 1000,
        shouldRetry: isRetryableError,
        onRetry,
      });

      // Advance timers to trigger retry
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'ETIMEDOUT' }),
        1,
        expect.any(Number)
      );
    });

    it('should throw after max attempts exhausted', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      // IMPORTANT: Capture the rejection to prevent unhandled rejection error
      let caughtError: Error | null = null;
      const promise = withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 100,
        shouldRetry: isRetryableError,
      }).catch((e: Error) => {
        caughtError = e;
        return e; // Return instead of throwing
      });

      // Advance timers through all retry attempts
      await vi.advanceTimersByTimeAsync(10000);

      await promise;
      expect(caughtError).toBeInstanceOf(Error);
      // After toBeInstanceOf check, TypeScript knows caughtError is Error (not null)
      expect(caughtError!.message).toBe('ETIMEDOUT');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid URL'));

      const shouldRetry = (error: Error) => {
        if (isNonRetryableError(error)) return false;
        return isRetryableError(error);
      };

      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          baseDelayMs: 1000,
          shouldRetry,
        })
      ).rejects.toThrow('Invalid URL');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should apply exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      const delays: number[] = [];
      const onRetry = vi.fn((error, attempt, delayMs) => {
        delays.push(delayMs);
      });

      const promise = withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        shouldRetry: isRetryableError,
        onRetry,
      });

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(10000); // Advance enough for all retries

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(delays.length).toBe(2);

      // Verify exponential backoff pattern (with jitter tolerance)
      expect(delays[0]).toBeGreaterThanOrEqual(1000); // ~1s
      expect(delays[0]).toBeLessThan(2100); // 1s + 1s jitter
      expect(delays[1]).toBeGreaterThanOrEqual(2000); // ~2s
      expect(delays[1]).toBeLessThan(3100); // 2s + 1s jitter
    });

    it('should respect maxDelayMs cap', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      const delays: number[] = [];
      const onRetry = vi.fn((error, attempt, delayMs) => {
        delays.push(delayMs);
      });

      const promise = withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 100000, // Very large base
        maxDelayMs: 5000, // Should cap at 5s
        shouldRetry: isRetryableError,
        onRetry,
      });

      await vi.advanceTimersByTimeAsync(6000);

      const result = await promise;

      expect(result).toBe('success');
      expect(delays[0]).toBeLessThanOrEqual(5000);
    });

    it('should add jitter to prevent thundering herd', async () => {
      const fn1 = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));
      const fn2 = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      const delays1: number[] = [];
      const delays2: number[] = [];

      const onRetry1 = vi.fn((_error, _attempt, delayMs) => delays1.push(delayMs));
      const onRetry2 = vi.fn((_error, _attempt, delayMs) => delays2.push(delayMs));

      // IMPORTANT: Attach .catch() immediately to prevent unhandled rejection
      // when vi.advanceTimersByTimeAsync() triggers the rejection
      const promise1 = withRetry(fn1, {
        maxAttempts: 2,
        baseDelayMs: 1000,
        shouldRetry: isRetryableError,
        onRetry: onRetry1,
      }).catch(() => {
        /* Expected to fail */
      });

      const promise2 = withRetry(fn2, {
        maxAttempts: 2,
        baseDelayMs: 1000,
        shouldRetry: isRetryableError,
        onRetry: onRetry2,
      }).catch(() => {
        /* Expected to fail */
      });

      await vi.advanceTimersByTimeAsync(3000);

      await Promise.allSettled([promise1, promise2]);

      // Delays should be different due to jitter (very high probability)
      // Note: There's a tiny chance this could flake if random jitter is identical
      expect(delays1[0]).not.toBe(delays2[0]);
    });
  });

  describe('isRetryableError', () => {
    it('should identify network timeout errors', () => {
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
      expect(isRetryableError(new Error('Connection timeout'))).toBe(true);
      expect(isRetryableError(new Error('navigation timeout exceeded'))).toBe(true);
    });

    it('should identify connection errors', () => {
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
      expect(isRetryableError(new Error('socket hang up'))).toBe(true);
    });

    it('should identify Playwright errors', () => {
      expect(isRetryableError(new Error('waiting for selector timeout'))).toBe(true);
      expect(isRetryableError(new Error('target closed'))).toBe(true);
      expect(isRetryableError(new Error('protocol error'))).toBe(true);
    });

    it('should identify rate limit errors', () => {
      const error = new Error('Rate limited') as Error & { statusCode: number };
      error.statusCode = 429;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify server errors (5xx)', () => {
      const error500 = new Error('Server error') as Error & { statusCode: number };
      error500.statusCode = 500;
      expect(isRetryableError(error500)).toBe(true);

      const error503 = new Error('Service unavailable') as Error & { statusCode: number };
      error503.statusCode = 503;
      expect(isRetryableError(error503)).toBe(true);
    });

    it('should not identify client errors as retryable', () => {
      const error400 = new Error('Bad request') as Error & { statusCode: number };
      error400.statusCode = 400;
      expect(isRetryableError(error400)).toBe(false);

      const error404 = new Error('Not found') as Error & { statusCode: number };
      error404.statusCode = 404;
      expect(isRetryableError(error404)).toBe(false);
    });
  });

  describe('isNonRetryableError', () => {
    it('should identify SSRF protection errors', () => {
      expect(isNonRetryableError(new Error('URL not in allowlist'))).toBe(true);
    });

    it('should identify validation errors', () => {
      expect(isNonRetryableError(new Error('Invalid URL format'))).toBe(true);
      expect(isNonRetryableError(new Error('Validation error: missing field'))).toBe(true);
    });

    it('should identify auth errors', () => {
      expect(isNonRetryableError(new Error('Unauthorized'))).toBe(true);
      expect(isNonRetryableError(new Error('Forbidden'))).toBe(true);
    });

    it('should identify 404 errors', () => {
      expect(isNonRetryableError(new Error('404 Not Found'))).toBe(true);
    });

    it('should not identify transient errors as non-retryable', () => {
      expect(isNonRetryableError(new Error('ETIMEDOUT'))).toBe(false);
      expect(isNonRetryableError(new Error('Connection reset'))).toBe(false);
    });
  });

  describe('createSmartRetryCondition', () => {
    it('should retry transient errors', () => {
      const shouldRetry = createSmartRetryCondition();
      expect(shouldRetry(new Error('ETIMEDOUT'), 1)).toBe(true);
      expect(shouldRetry(new Error('ECONNRESET'), 1)).toBe(true);
    });

    it('should not retry non-retryable errors', () => {
      const shouldRetry = createSmartRetryCondition();
      expect(shouldRetry(new Error('Invalid URL'), 1)).toBe(false);
      expect(shouldRetry(new Error('Unauthorized'), 1)).toBe(false);
    });

    it('should not retry unknown errors by default', () => {
      const shouldRetry = createSmartRetryCondition();
      expect(shouldRetry(new Error('Unknown error'), 1)).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle mixed error types correctly', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT')) // Retryable
        .mockRejectedValueOnce(new Error('Invalid URL')); // Non-retryable

      const shouldRetry = createSmartRetryCondition();

      // IMPORTANT: Capture the rejection - don't re-throw to avoid unhandled rejection
      // The error will be caught and verified via the captured value
      let caughtError: Error | null = null;
      const promise = withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 100,
        shouldRetry,
      }).catch((e: Error) => {
        caughtError = e;
        return e; // Return error instead of throwing to prevent unhandled rejection
      });

      await vi.advanceTimersByTimeAsync(2000);

      await promise; // Wait for promise to settle
      expect(caughtError).toBeInstanceOf(Error);
      // After toBeInstanceOf check, TypeScript knows caughtError is Error (not null)
      expect(caughtError!.message).toBe('Invalid URL');
      expect(fn).toHaveBeenCalledTimes(2); // First attempt + 1 retry, then fail fast
    });

    it('should work with custom shouldRetry logic', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Custom retryable'))
        .mockResolvedValueOnce('success');

      const customRetry = (error: Error) => error.message.includes('Custom retryable');

      const promise = withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 100,
        shouldRetry: customRetry,
      });

      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
