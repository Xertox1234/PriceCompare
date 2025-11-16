import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

// Types for analytics data
export interface WeeklyAggregate {
  id: number;
  productId: number;
  retailerId: number;
  year: number;
  week: number;
  minPrice: string;
  maxPrice: string;
  avgPrice: string;
  medianPrice: string | null;
  volatilityScore: string | null;
  recordCount: number;
  weekOverWeekChange: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyAggregate {
  id: number;
  productId: number;
  retailerId: number;
  year: number;
  month: number;
  minPrice: string;
  maxPrice: string;
  avgPrice: string;
  medianPrice: string | null;
  volatilityScore: string | null;
  recordCount: number;
  monthOverMonthChange: string | null;
  yearOverYearChange: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PriceTrend {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string | null;
  retailerLogo: string | null;
  trendDirection: "uptrend" | "downtrend" | "stable";
  trendSlope: string | null;
  trendStrength: string | null;
  predictedNextPrice: string | null;
  confidenceLevel: string | null;
  analysisPeriodDays: number;
  lastAnalyzedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsOverview {
  weeklyAggregates: number;
  monthlyAggregates: number;
  totalTrends: number;
  trendBreakdown: {
    uptrend: number;
    downtrend: number;
    stable: number;
  };
}

/**
 * Fetch weekly price aggregates for a product
 */
export function useWeeklyAggregates(
  productId: number | undefined,
  options?: { year?: number; week?: number; limit?: number }
) {
  return useQuery({
    queryKey: ["weeklyAggregates", productId, options],
    queryFn: async () => {
      if (!productId) return null;

      const params = new URLSearchParams();
      if (options?.year) params.append("year", options.year.toString());
      if (options?.week) params.append("week", options.week.toString());
      if (options?.limit) params.append("limit", options.limit.toString());

      const response = await fetch(
        `/api/products/${productId}/aggregates/weekly?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch weekly aggregates");
      }

      return response.json() as Promise<WeeklyAggregate[]>;
    },
    enabled: !!productId,
  });
}

/**
 * Fetch monthly price aggregates for a product
 */
export function useMonthlyAggregates(
  productId: number | undefined,
  options?: { year?: number; month?: number; limit?: number }
) {
  return useQuery({
    queryKey: ["monthlyAggregates", productId, options],
    queryFn: async () => {
      if (!productId) return null;

      const params = new URLSearchParams();
      if (options?.year) params.append("year", options.year.toString());
      if (options?.month) params.append("month", options.month.toString());
      if (options?.limit) params.append("limit", options.limit.toString());

      const response = await fetch(
        `/api/products/${productId}/aggregates/monthly?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch monthly aggregates");
      }

      return response.json() as Promise<MonthlyAggregate[]>;
    },
    enabled: !!productId,
  });
}

/**
 * Fetch weekly aggregates for a specific product-retailer combination
 */
export function useRetailerWeeklyAggregates(
  productId: number | undefined,
  retailerId: number | undefined,
  options?: { limit?: number }
) {
  return useQuery({
    queryKey: ["retailerWeeklyAggregates", productId, retailerId, options],
    queryFn: async () => {
      if (!productId || !retailerId) return null;

      const params = new URLSearchParams();
      if (options?.limit) params.append("limit", options.limit.toString());

      const response = await fetch(
        `/api/products/${productId}/retailers/${retailerId}/aggregates/weekly?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch retailer weekly aggregates");
      }

      return response.json() as Promise<WeeklyAggregate[]>;
    },
    enabled: !!productId && !!retailerId,
  });
}

/**
 * Fetch monthly aggregates for a specific product-retailer combination
 */
export function useRetailerMonthlyAggregates(
  productId: number | undefined,
  retailerId: number | undefined,
  options?: { limit?: number }
) {
  return useQuery({
    queryKey: ["retailerMonthlyAggregates", productId, retailerId, options],
    queryFn: async () => {
      if (!productId || !retailerId) return null;

      const params = new URLSearchParams();
      if (options?.limit) params.append("limit", options.limit.toString());

      const response = await fetch(
        `/api/products/${productId}/retailers/${retailerId}/aggregates/monthly?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch retailer monthly aggregates");
      }

      return response.json() as Promise<MonthlyAggregate[]>;
    },
    enabled: !!productId && !!retailerId,
  });
}

/**
 * Fetch price trends for a product (all retailers)
 */
export function useProductTrends(productId: number | undefined) {
  return useQuery({
    queryKey: ["productTrends", productId],
    queryFn: async () => {
      if (!productId) return null;

      const response = await fetch(`/api/products/${productId}/trends`);

      if (!response.ok) {
        throw new Error("Failed to fetch product trends");
      }

      return response.json() as Promise<PriceTrend[]>;
    },
    enabled: !!productId,
  });
}

/**
 * Fetch price trend for a specific product-retailer combination
 */
export function useRetailerTrend(
  productId: number | undefined,
  retailerId: number | undefined
) {
  return useQuery({
    queryKey: ["retailerTrend", productId, retailerId],
    queryFn: async () => {
      if (!productId || !retailerId) return null;

      const response = await fetch(
        `/api/products/${productId}/retailers/${retailerId}/trend`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error("Failed to fetch retailer trend");
      }

      return response.json() as Promise<PriceTrend>;
    },
    enabled: !!productId && !!retailerId,
  });
}

/**
 * Fetch analytics overview
 */
export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ["analyticsOverview"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/overview");

      if (!response.ok) {
        throw new Error("Failed to fetch analytics overview");
      }

      return response.json() as Promise<AnalyticsOverview>;
    },
  });
}
