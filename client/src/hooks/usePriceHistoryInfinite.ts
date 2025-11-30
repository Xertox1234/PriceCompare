/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- API responses from fetch need runtime type checking */
import { useState, useEffect, useCallback, useRef } from "react";
import { createLogger } from "@/utils/logger";

const log = createLogger('PriceHistoryInfinite');

interface PriceHistoryData {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string;
  retailerLogo: string | null;
  price: string;
  recordedAt: Date | string;
}

interface UsePriceHistoryInfiniteOptions {
  productId: number;
  initialDays?: number;
  maxDays?: number;
  incrementDays?: number;
  enabled?: boolean;
}

/**
 * Hook for progressive/infinite loading of price history data
 * Starts with recent data and loads older data on demand
 */
export function usePriceHistoryInfinite({
  productId,
  initialDays = 30,
  maxDays = 365,
  incrementDays = 30,
  enabled = true,
}: UsePriceHistoryInfiniteOptions) {
  const [data, setData] = useState<PriceHistoryData[]>([]);
  const [currentDays, setCurrentDays] = useState(initialDays);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Cache to avoid refetching
  const cacheRef = useRef<Map<string, PriceHistoryData[]>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch price history from API
  const fetchPriceHistory = useCallback(
    async (days: number, isLoadMore = false) => {
      const cacheKey = `${productId}-${days}`;

      // Check cache first
      if (cacheRef.current.has(cacheKey)) {
        const cachedData = cacheRef.current.get(cacheKey)!;
        setData(cachedData);
        return cachedData;
      }

      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        if (isLoadMore) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const response = await fetch(
          `/api/products/${productId}/price-history?days=${days}`,
          {
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch price history: ${response.statusText}`);
        }

        const result = await response.json();
        const historyData = result.data || [];

        // Cache the result
        cacheRef.current.set(cacheKey, historyData);

        setData(historyData);
        setError(null);

        // Check if there's more data to load
        setHasMore(days < maxDays && historyData.length > 0);

        return historyData;
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            log.debug('Request aborted');
            return;
          }
          setError(err);
        } else {
          setError(new Error('An unknown error occurred'));
        }
        return [];
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [productId, maxDays]
  );

  // Initial load
  useEffect(() => {
    if (!enabled) return;

    void fetchPriceHistory(initialDays);

    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [productId, initialDays, enabled]);

  // Load more data
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    const nextDays = Math.min(currentDays + incrementDays, maxDays);
    setCurrentDays(nextDays);

    await fetchPriceHistory(nextDays, true);
  }, [currentDays, incrementDays, maxDays, hasMore, isLoadingMore, fetchPriceHistory]);

  // Refresh data
  const refresh = useCallback(async () => {
    // Clear cache for this product
    Array.from(cacheRef.current.keys())
      .filter((key) => key.startsWith(`${productId}-`))
      .forEach((key) => cacheRef.current.delete(key));

    setCurrentDays(initialDays);
    await fetchPriceHistory(initialDays);
  }, [productId, initialDays, fetchPriceHistory]);

  // Prefetch next batch in background
  const prefetchNext = useCallback(() => {
    if (!hasMore || isLoadingMore) return;

    const nextDays = Math.min(currentDays + incrementDays, maxDays);
    const cacheKey = `${productId}-${nextDays}`;

    // Only prefetch if not already cached
    if (!cacheRef.current.has(cacheKey)) {
      // Prefetch silently without updating state
      fetch(`/api/products/${productId}/price-history?days=${nextDays}`)
        .then((res) => res.json())
        .then((result) => {
          const historyData = result.data || [];
          cacheRef.current.set(cacheKey, historyData);
        })
        .catch((err) => {
          log.error('Prefetch error:', { error: err });
        });
    }
  }, [productId, currentDays, incrementDays, maxDays, hasMore, isLoadingMore]);

  return {
    data,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    prefetchNext,
    currentDays,
  };
}
