import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Types
interface WatchList {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface WatchListStats {
  totalWatchLists: number;
  totalProducts: number;
  totalPotentialSavings: number;
  activeAlerts: number;
  triggeredAlerts: number;
  bestDeals: Array<{
    productId: number;
    productName: string;
    currentPrice: number;
    lowestPrice: number;
    discountPercent: number;
  }>;
  weeklyStats: {
    newDeals: number;
    triggeredAlerts: number;
  };
}

interface WatchedProduct {
  productId: number;
  watchListId: number;
  watchListName: string;
  productName: string;
  imageUrl: string | null;
  currentPrice: number;
  lowestPrice: number;
  averagePrice: number;
  priceDropPercent: number;
  savingsPotential: number;
  last7Days: Array<{ date: string; price: number }>;
  alertStatus: 'active' | 'triggered' | 'none';
  addedAt: string;
  alertId: number | null; // Price alert ID for editing
  alertTargetPrice: number | null; // Price alert target price
}

interface WatchListWithProducts extends WatchList {
  products: WatchedProduct[];
}

interface CreateWatchListInput {
  name: string;
  description?: string;
}

interface UpdateWatchListInput {
  name?: string;
  description?: string;
}

interface AddProductInput {
  productId: number;
}

// Query hooks
export function useWatchLists() {
  return useQuery<WatchList[]>({
    queryKey: ['/api/watchlists'],
    queryFn: async () => {
      const result = await apiRequest<{ watchLists: WatchList[] }>('/api/watchlists');
      return result.watchLists;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useWatchList(id: number | null) {
  return useQuery<WatchListWithProducts>({
    queryKey: ['/api/watchlists', id],
    queryFn: async () => {
      if (!id) throw new Error('Watch list ID is required');
      return apiRequest<WatchListWithProducts>(`/api/watchlists/${id}`);
    },
    enabled: id !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useWatchListStats() {
  return useQuery<WatchListStats>({
    queryKey: ['/api/watchlists/stats'],
    queryFn: async () => {
      return apiRequest<WatchListStats>('/api/watchlists/stats');
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (more frequently updated)
    gcTime: 6 * 60 * 1000, // 6 minutes
  });
}

export function useWatchedProducts(options?: {
  sortBy?: 'priceDropPercent' | 'savings' | 'dateAdded';
}) {
  // Use dedicated server endpoint with cursor-based pagination for infinite scroll
  return useInfiniteQuery({
    queryKey: ['/api/watchlists/products', options?.sortBy || 'priceDropPercent'],
    queryFn: async ({ pageParam }: { pageParam: number | null }) => {
      const sortBy = options?.sortBy || 'priceDropPercent';
      const params = new URLSearchParams({ sortBy });
      if (pageParam !== null) {
        params.append('cursor', String(pageParam));
      }
      const url = `/api/watchlists/products?${params.toString()}`;
      return apiRequest<{
        products: WatchedProduct[];
        hasMore: boolean;
        nextCursor: number | null;
      }>(url);
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

// Mutation hooks
export function useCreateWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateWatchListInput) => {
      return apiRequest<WatchList>('/api/watchlists', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate watch lists query to refetch
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/stats'] });
    },
  });
}

export function useUpdateWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateWatchListInput }) => {
      return apiRequest<WatchList>(`/api/watchlists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      // Invalidate both list and detail queries
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', data.id] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/stats'] });
    },
  });
}

export function useDeleteWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      return apiRequest<{ success: boolean }>(`/api/watchlists/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      // Invalidate watch lists query
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/stats'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/products'] });
    },
  });
}

export function useAddProductToWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ watchListId, data }: { watchListId: number; data: AddProductInput }) => {
      return apiRequest<{ success: boolean }>(`/api/watchlists/${watchListId}/products`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate specific watch list and stats
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', variables.watchListId] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/stats'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/products'] });
    },
  });
}

export function useRemoveProductFromWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ watchListId, productId }: { watchListId: number; productId: number }) => {
      return apiRequest<{ success: boolean }>(
        `/api/watchlists/${watchListId}/products/${productId}`,
        {
          method: 'DELETE',
        }
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate specific watch list and stats
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', variables.watchListId] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/stats'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/products'] });
    },
  });
}

// Export types for use in components
export type {
  WatchList,
  WatchListStats,
  WatchedProduct,
  WatchListWithProducts,
  CreateWatchListInput,
  UpdateWatchListInput,
  AddProductInput,
};
