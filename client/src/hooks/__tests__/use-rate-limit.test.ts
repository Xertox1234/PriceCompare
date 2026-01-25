/**
 * Unit tests for useRateLimit hook
 *
 * Tests the rate limit hook's ability to extract and parse rate limit
 * headers from fetch responses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRateLimit } from '../use-rate-limit';

describe('useRateLimit', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    // Store original fetch
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe('Default state', () => {
    it('initializes with default rate limit values', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.limit).toBe(100);
      expect(result.current.remaining).toBe(100);
      expect(result.current.tier).toBe('unknown');
      expect(result.current.percentage).toBe(100);
      expect(result.current.reset).toBeGreaterThan(Date.now());
    });
  });

  describe('Extracting rate limit headers', () => {
    it('extracts X-RateLimit-Limit header correctly', async () => {
      // Mock fetch to return rate limit headers
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '500',
              'X-RateLimit-Remaining': '499',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'premium',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      // Trigger a fetch request
      await fetch('/api/test');

      // Wait for state to update
      await waitFor(() => {
        expect(result.current.limit).toBe(500);
      });
    });

    it('extracts X-RateLimit-Remaining header correctly', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '75',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'user',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.remaining).toBe(75);
      });
    });

    it('extracts X-RateLimit-Reset header correctly', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now

      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '50',
              'X-RateLimit-Reset': String(resetTime),
              'X-RateLimit-Tier': 'user',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.reset).toBe(resetTime);
      });
    });

    it('extracts X-RateLimit-Tier header correctly', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '1000',
              'X-RateLimit-Remaining': '999',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'moderator',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.tier).toBe('moderator');
      });
    });
  });

  describe('Parsing integer values safely', () => {
    it('parses valid integer headers', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '10000',
              'X-RateLimit-Remaining': '9999',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
              'X-RateLimit-Tier': 'admin',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.limit).toBe(10000);
        expect(result.current.remaining).toBe(9999);
      });
    });

    it('uses fallback values for invalid integer headers', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': 'invalid',
              'X-RateLimit-Remaining': 'NaN',
              'X-RateLimit-Reset': 'not-a-number',
              'X-RateLimit-Tier': 'user',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        // Should use default fallback values
        expect(result.current.limit).toBe(100);
        expect(result.current.remaining).toBe(100);
      });
    });

    it('handles missing headers gracefully', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {}, // No rate limit headers
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      // Should keep default values when headers are missing
      expect(result.current.limit).toBe(100);
      expect(result.current.remaining).toBe(100);
      expect(result.current.tier).toBe('unknown');
    });

    it('handles null header values gracefully', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '',
              'X-RateLimit-Remaining': '',
              'X-RateLimit-Reset': '',
              'X-RateLimit-Tier': '',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        // Empty strings should be treated as missing, use defaults
        expect(result.current.limit).toBe(100);
        expect(result.current.remaining).toBe(100);
        expect(result.current.tier).toBe('unknown');
      });
    });
  });

  describe('Calculating percentage correctly', () => {
    it('calculates 100% when all requests remaining', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '100',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'user',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.percentage).toBe(100);
      });
    });

    it('calculates 0% when no requests remaining', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'user',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.percentage).toBe(0);
      });
    });

    it('calculates 50% when half requests remaining', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '50',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'user',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.percentage).toBe(50);
      });
    });

    it('rounds percentage to nearest integer', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '33',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'user',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        // 33/100 = 0.33 = 33%
        expect(result.current.percentage).toBe(33);
      });
    });

    it('handles zero limit safely (returns 0%)', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '0',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'user',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        // Division by zero should be handled
        expect(result.current.percentage).toBe(0);
      });
    });
  });

  describe('Cleanup on unmount', () => {
    it('restores original fetch on unmount', () => {
      const { unmount } = renderHook(() => useRateLimit());

      // Fetch should be intercepted while mounted
      expect(globalThis.fetch).not.toBe(originalFetch);

      // Unmount hook
      unmount();

      // Fetch should be restored
      expect(globalThis.fetch).toBe(originalFetch);
    });

    it('handles multiple mounts/unmounts correctly', () => {
      const { unmount: unmount1 } = renderHook(() => useRateLimit());

      // Fetch should be intercepted while first hook is mounted
      expect(globalThis.fetch).not.toBe(originalFetch);

      unmount1();

      // After unmount, fetch should be restored
      expect(globalThis.fetch).toBe(originalFetch);

      // Mount another instance
      const { unmount: unmount2 } = renderHook(() => useRateLimit());

      // Fetch should be intercepted again
      expect(globalThis.fetch).not.toBe(originalFetch);

      unmount2();

      // After final unmount, fetch should be restored
      expect(globalThis.fetch).toBe(originalFetch);
    });
  });

  describe('Different tier scenarios', () => {
    it('handles anonymous tier correctly', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '50',
              'X-RateLimit-Remaining': '25',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'anonymous',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.limit).toBe(50);
        expect(result.current.tier).toBe('anonymous');
        expect(result.current.percentage).toBe(50);
      });
    });

    it('handles free tier correctly', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '50',
              'X-RateLimit-Remaining': '40',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'free',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.limit).toBe(50);
        expect(result.current.tier).toBe('free');
      });
    });

    it('handles premium tier correctly', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '500',
              'X-RateLimit-Remaining': '250',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'premium',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.limit).toBe(500);
        expect(result.current.tier).toBe('premium');
      });
    });

    it('handles admin tier correctly', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '10000',
              'X-RateLimit-Remaining': '9950',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'admin',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      await fetch('/api/test');

      await waitFor(() => {
        expect(result.current.limit).toBe(10000);
        expect(result.current.tier).toBe('admin');
        expect(result.current.percentage).toBeGreaterThan(99);
      });
    });
  });

  describe('Multiple fetch requests', () => {
    it('updates state on each fetch with rate limit headers', async () => {
      let requestCount = 0;

      globalThis.fetch = vi.fn(() => {
        requestCount++;
        return Promise.resolve(
          new Response('{}', {
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': String(100 - requestCount),
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900),
              'X-RateLimit-Tier': 'user',
            },
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      // First request
      await fetch('/api/test');
      await waitFor(() => {
        expect(result.current.remaining).toBe(99);
      });

      // Second request
      await fetch('/api/test');
      await waitFor(() => {
        expect(result.current.remaining).toBe(98);
      });

      // Third request
      await fetch('/api/test');
      await waitFor(() => {
        expect(result.current.remaining).toBe(97);
      });
    });

    it('ignores responses without rate limit headers', async () => {
      globalThis.fetch = vi.fn(() => {
        return Promise.resolve(
          new Response('{}', {
            headers: {}, // No rate limit headers
          })
        );
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRateLimit());

      // Initial state
      const initialRemaining = result.current.remaining;

      await fetch('/api/test');

      // State should not change
      expect(result.current.remaining).toBe(initialRemaining);
      expect(result.current.tier).toBe('unknown');
    });
  });
});
