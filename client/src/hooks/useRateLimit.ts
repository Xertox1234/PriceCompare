import { useState, useEffect, useRef } from 'react';

/**
 * Rate limit information extracted from API response headers
 */
export interface RateLimitInfo {
  /** Total requests allowed in the current window */
  limit: number;
  /** Requests remaining in the current window */
  remaining: number;
  /** Unix timestamp (milliseconds) when the limit resets */
  reset: number;
  /** User's current rate limit tier */
  tier: string;
  /** Percentage of requests remaining (0-100) */
  percentage: number;
}

/**
 * Default rate limit values used when headers are not available
 */
const DEFAULT_RATE_LIMIT: RateLimitInfo = {
  limit: 100,
  remaining: 100,
  reset: Date.now() + 15 * 60 * 1000, // 15 minutes from now
  tier: 'unknown',
  percentage: 100,
};

/**
 * Safely parse an integer from a string, returning a fallback value if invalid
 */
function parseIntSafe(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Calculate percentage of remaining requests
 */
function calculatePercentage(remaining: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.round((remaining / limit) * 100);
}

/**
 * Custom hook to track rate limit information from API response headers
 *
 * Uses fetch interceptor to capture rate limit headers from all API responses:
 * - X-RateLimit-Limit: Total requests allowed
 * - X-RateLimit-Remaining: Requests remaining
 * - X-RateLimit-Reset: Unix timestamp when limit resets
 * - X-RateLimit-Tier: User's current tier
 *
 * @returns Current rate limit information with reactive updates
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const rateLimit = useRateLimit();
 *
 *   if (rateLimit.percentage < 20) {
 *     return <Warning>Only {rateLimit.remaining} requests left!</Warning>;
 *   }
 *
 *   return <div>Tier: {rateLimit.tier}</div>;
 * }
 * ```
 */
export function useRateLimit(): RateLimitInfo {
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>(DEFAULT_RATE_LIMIT);
  const originalFetchRef = useRef<typeof fetch | null>(null);

  useEffect(() => {
    // Store original fetch if not already stored
    if (!originalFetchRef.current) {
      originalFetchRef.current = window.fetch;
    }

    // Intercept fetch to capture rate limit headers
    const interceptedFetch: typeof fetch = async (input, init?) => {
      const response = await originalFetchRef.current!(input, init);

      // Extract rate limit headers
      const limitHeader = response.headers.get('X-RateLimit-Limit');
      const remainingHeader = response.headers.get('X-RateLimit-Remaining');
      const resetHeader = response.headers.get('X-RateLimit-Reset');
      const tierHeader = response.headers.get('X-RateLimit-Tier');

      // Only update if we have rate limit headers
      if (limitHeader || remainingHeader || resetHeader || tierHeader) {
        const limit = parseIntSafe(limitHeader, DEFAULT_RATE_LIMIT.limit);
        const remaining = parseIntSafe(remainingHeader, DEFAULT_RATE_LIMIT.remaining);
        const reset = parseIntSafe(resetHeader, DEFAULT_RATE_LIMIT.reset);
        const tier = tierHeader || DEFAULT_RATE_LIMIT.tier;
        const percentage = calculatePercentage(remaining, limit);

        setRateLimit({
          limit,
          remaining,
          reset,
          tier,
          percentage,
        });
      }

      return response;
    };

    // Replace global fetch
    window.fetch = interceptedFetch;

    // Cleanup: restore original fetch on unmount
    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
    };
  }, []);

  return rateLimit;
}
