import { useQuery } from "@tanstack/react-query";
import type { PriceHistory, PriceSnapshot } from "@shared/schema";

export interface PriceStats {
  currentPrice: number;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  priceChange24h?: number;
  priceChange7d?: number;
  priceChange30d?: number;
  priceChangePercent24h?: number;
  priceChangePercent7d?: number;
  priceChangePercent30d?: number;
}

export interface PriceHistoryQueryParams {
  startDate?: Date;
  endDate?: Date;
  source?: string;
  limit?: number;
  days?: number;
}

/**
 * Hook to fetch price history for a specific product offer
 */
export function usePriceHistory(
  productId: number | undefined,
  offerId: number | undefined,
  params?: PriceHistoryQueryParams
) {
  return useQuery({
    queryKey: ['priceHistory', productId, offerId, params],
    queryFn: async () => {
      if (!productId || !offerId) {
        throw new Error('Product ID and Offer ID are required');
      }

      const queryParams = new URLSearchParams();
      if (params?.startDate) {
        queryParams.append('startDate', params.startDate.toISOString());
      }
      if (params?.endDate) {
        queryParams.append('endDate', params.endDate.toISOString());
      }
      if (params?.source) {
        queryParams.append('source', params.source);
      }
      if (params?.limit) {
        queryParams.append('limit', params.limit.toString());
      }

      const response = await fetch(
        `/api/products/${productId}/offers/${offerId}/price-history?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch price history');
      }

      const data = await response.json();
      return data.data as PriceHistory[];
    },
    enabled: !!productId && !!offerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (3x staleTime)
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

/**
 * Hook to fetch price statistics for a specific product offer
 */
export function usePriceStats(
  productId: number | undefined,
  offerId: number | undefined,
  days: number = 90
) {
  return useQuery({
    queryKey: ['priceStats', productId, offerId, days],
    queryFn: async () => {
      if (!productId || !offerId) {
        throw new Error('Product ID and Offer ID are required');
      }

      const response = await fetch(
        `/api/products/${productId}/offers/${offerId}/price-stats?days=${days}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch price statistics');
      }

      const data = await response.json();
      return data.data as PriceStats;
    },
    enabled: !!productId && !!offerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (3x staleTime)
  });
}

/**
 * Hook to fetch price snapshots for a product across all retailers
 */
export function usePriceSnapshots(
  productId: number | undefined,
  params?: {
    retailerId?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  return useQuery({
    queryKey: ['priceSnapshots', productId, params],
    queryFn: async () => {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      const queryParams = new URLSearchParams();
      if (params?.retailerId) {
        queryParams.append('retailerId', params.retailerId.toString());
      }
      if (params?.startDate) {
        queryParams.append('startDate', params.startDate.toISOString());
      }
      if (params?.endDate) {
        queryParams.append('endDate', params.endDate.toISOString());
      }

      const response = await fetch(
        `/api/products/${productId}/price-snapshots?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch price snapshots');
      }

      const data = await response.json();
      return data.data as PriceSnapshot[];
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (3x staleTime)
  });
}

/**
 * Hook to fetch recent significant price drops
 */
export function useRecentPriceDrops(thresholdPercent: number = 10, hours: number = 24) {
  return useQuery({
    queryKey: ['recentPriceDrops', thresholdPercent, hours],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        thresholdPercent: thresholdPercent.toString(),
        hours: hours.toString()
      });

      const response = await fetch(
        `/api/price-history/recent-drops?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch recent price drops');
      }

      const data = await response.json();
      return data.data as Array<{
        productOfferId: number;
        previousPrice: number;
        currentPrice: number;
        dropPercent: number;
      }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (3x staleTime)
    refetchInterval: 15 * 60 * 1000, // Refetch every 15 minutes
  });
}
