import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
 * Price drop information from the API
 */
export interface PriceDrop {
  productOfferId: number;
  previousPrice: number;
  currentPrice: number;
  dropPercent: number;
}

/**
 * Fetch price history for a specific product offer
 *
 * Returns historical price data points for a product offer with optional filtering
 * by date range, source, and limit. Automatically refetches every 10 minutes.
 *
 * @param productId - The product ID
 * @param offerId - The product offer ID
 * @param params - Optional query parameters for filtering
 * @param params.startDate - Filter prices from this date onwards
 * @param params.endDate - Filter prices until this date
 * @param params.source - Filter by data source (e.g., 'scraper', 'api')
 * @param params.limit - Limit the number of results
 * @returns React Query result with PriceHistory array
 *
 * @example
 * ```tsx
 * function PriceChart({ productId, offerId }: Props) {
 *   const { data: history, isLoading } = usePriceHistory(
 *     productId,
 *     offerId,
 *     { days: 30 } // Last 30 days
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return <LineChart data={history} />;
 * }
 * ```
 */
export function usePriceHistory(
  productId: number | undefined,
  offerId: number | undefined,
  params?: PriceHistoryQueryParams
) {
  return useQuery<PriceHistory[]>({
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

      return apiRequest<PriceHistory[]>(
        `/api/products/${productId}/offers/${offerId}/price-history?${queryParams.toString()}`
      );
    },
    enabled: !!productId && !!offerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (3x staleTime)
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

/**
 * Fetch price statistics for a specific product offer
 *
 * Returns aggregated price statistics including current, lowest, highest, average prices,
 * and percentage changes over different time periods (24h, 7d, 30d).
 *
 * @param productId - The product ID
 * @param offerId - The product offer ID
 * @param days - Number of days to calculate statistics over (default: 90)
 * @returns React Query result with PriceStats object
 *
 * @example
 * ```tsx
 * function PriceStats({ productId, offerId }: Props) {
 *   const { data: stats } = usePriceStats(productId, offerId, 30);
 *
 *   return (
 *     <div>
 *       <p>Current: ${stats?.currentPrice}</p>
 *       <p>Lowest: ${stats?.lowestPrice}</p>
 *       <p>24h Change: {stats?.priceChangePercent24h}%</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePriceStats(
  productId: number | undefined,
  offerId: number | undefined,
  days = 90
) {
  return useQuery<PriceStats>({
    queryKey: ['priceStats', productId, offerId, days],
    queryFn: async () => {
      if (!productId || !offerId) {
        throw new Error('Product ID and Offer ID are required');
      }

      return apiRequest<PriceStats>(
        `/api/products/${productId}/offers/${offerId}/price-stats?days=${days}`
      );
    },
    enabled: !!productId && !!offerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (3x staleTime)
  });
}

/**
 * Fetch price snapshots for a product across all retailers
 *
 * Returns price snapshot data for a product across multiple retailers with optional
 * filtering by retailer and date range. Useful for comparing prices across different stores.
 *
 * @param productId - The product ID
 * @param params - Optional query parameters for filtering
 * @param params.retailerId - Filter by specific retailer ID
 * @param params.startDate - Filter snapshots from this date onwards
 * @param params.endDate - Filter snapshots until this date
 * @returns React Query result with PriceSnapshot array
 *
 * @example
 * ```tsx
 * function RetailerPriceComparison({ productId }: Props) {
 *   const { data: snapshots } = usePriceSnapshots(productId);
 *
 *   return (
 *     <ul>
 *       {snapshots?.map(snapshot => (
 *         <li key={snapshot.id}>
 *           {snapshot.retailerName}: ${snapshot.price}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function usePriceSnapshots(
  productId: number | undefined,
  params?: {
    retailerId?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  return useQuery<PriceSnapshot[]>({
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

      return apiRequest<PriceSnapshot[]>(
        `/api/products/${productId}/price-snapshots?${queryParams.toString()}`
      );
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (3x staleTime)
  });
}

/**
 * Fetch recent significant price drops
 *
 * Returns recent price drops that exceed a specified threshold percentage.
 * Automatically refetches every 15 minutes to keep data fresh.
 *
 * @param thresholdPercent - Minimum price drop percentage to include (default: 10%)
 * @param hours - Time window to check for drops (default: 24 hours)
 * @returns React Query result with PriceDrop array
 *
 * @example
 * ```tsx
 * function PriceDropAlerts() {
 *   // Get all drops > 15% in the last 48 hours
 *   const { data: drops } = useRecentPriceDrops(15, 48);
 *
 *   return (
 *     <div>
 *       <h2>Recent Price Drops</h2>
 *       {drops?.map(drop => (
 *         <div key={drop.productOfferId}>
 *           <p>Was: ${drop.previousPrice}</p>
 *           <p>Now: ${drop.currentPrice}</p>
 *           <p>Save: {drop.dropPercent.toFixed(1)}%</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRecentPriceDrops(thresholdPercent = 10, hours = 24) {
  return useQuery<PriceDrop[]>({
    queryKey: ['recentPriceDrops', thresholdPercent, hours],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        thresholdPercent: thresholdPercent.toString(),
        hours: hours.toString()
      });

      return apiRequest<PriceDrop[]>(
        `/api/price-history/recent-drops?${queryParams.toString()}`
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (3x staleTime)
    refetchInterval: 15 * 60 * 1000, // Refetch every 15 minutes
  });
}
