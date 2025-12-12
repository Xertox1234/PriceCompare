import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ProductWatch, WatchList, UserReputation, DealSpotting } from '@shared/schema';

// Type-safe error extraction from unknown JSON response
interface ApiErrorResponse {
  error?: string;
  message?: string;
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null) {
    const obj = data as ApiErrorResponse;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
  }
  return fallback;
}

// Type-safe JSON parsing helper
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  return data as T;
}

// API response types
interface WatchStats {
  productId: number;
  productName: string;
  watchCount: number;
}

interface LeaderboardEntry {
  userId: number;
  username: string;
  reputationPoints: number;
  level: number;
  dealsSpotted: number;
  badges: string[];
}

interface RecentDeal extends DealSpotting {
  productName: string;
  username: string;
}

/**
 * Add product to watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @returns Mutation hook for adding products to watchlists
 */
export function useAddProductWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest<unknown>(`/api/community/watch/${productId}`, {
        method: 'POST',
      });
    },
    onSuccess: (_, productId) => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/watch-count/${productId}`] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/is-watching/${productId}`] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/most-watched'] });
    },
  });
}

/**
 * Remove product from watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @returns Mutation hook for removing products from watchlists
 */
export function useRemoveProductWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest<unknown>(`/api/community/watch/${productId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, productId) => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/watch-count/${productId}`] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/is-watching/${productId}`] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/most-watched'] });
    },
  });
}

// Get user's watched products
export function useWatchedProducts() {
  return useQuery<{ data: ProductWatch[] }>({
    queryKey: ['/api/community/watches'],
    queryFn: async () => {
      const response = await fetch('/api/community/watches', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch watched products');
      }

      return response.json();
    },
  });
}

// Get watch count for a product
export function useWatchCount(productId: number) {
  return useQuery<{ data: number }>({
    queryKey: [`/api/community/watch-count/${productId}`],
    queryFn: async () => {
      const response = await fetch(`/api/community/watch-count/${productId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch watch count');
      }

      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Check if user is watching a product
export function useIsWatching(productId: number) {
  return useQuery<{ data: boolean }>({
    queryKey: [`/api/community/is-watching/${productId}`],
    queryFn: async () => {
      const response = await fetch(`/api/community/is-watching/${productId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check watch status');
      }

      return response.json();
    },
  });
}

// Get most watched products
export function useMostWatchedProducts(limit = 10) {
  return useQuery<{ data: WatchStats[] }>({
    queryKey: ['/api/community/most-watched', limit],
    queryFn: async () => {
      const response = await fetch(`/api/community/most-watched?limit=${limit}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch most watched products');
      }

      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

// Get user reputation
export function useUserReputation() {
  return useQuery<{ data: UserReputation & { badges: string[] } }>({
    queryKey: ['/api/community/reputation'],
    queryFn: async () => {
      const response = await fetch('/api/community/reputation', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user reputation');
      }

      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

// Get leaderboard
export function useLeaderboard(limit = 10) {
  return useQuery<{ data: LeaderboardEntry[] }>({
    queryKey: ['/api/community/leaderboard', limit],
    queryFn: async () => {
      const response = await fetch(`/api/community/leaderboard?limit=${limit}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      return response.json();
    },
    refetchInterval: 120000, // Refresh every 2 minutes
  });
}

// Get recent deal spottings
export function useRecentDeals(limit = 10) {
  return useQuery<{ data: RecentDeal[] }>({
    queryKey: ['/api/community/recent-deals', limit],
    queryFn: async () => {
      const response = await fetch(`/api/community/recent-deals?limit=${limit}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recent deals');
      }

      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * WATCH LIST MANAGEMENT HOOKS
 */

export interface WatchListWithStats extends WatchList {
  watchCount: number;
  highPriorityCount: number;
}

export interface WatchListProduct extends ProductWatch {
  productName?: string;
  productImage?: string;
}

// Create a new watch list
export function useCreateWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
    }) => {
      return apiRequest<WatchList>('/api/watchlists', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    },
  });
}

// Get all user's watch lists
export function useWatchLists() {
  return useQuery<{ data: WatchListWithStats[] }>({
    queryKey: ['/api/watchlists'],
    queryFn: async () => {
      const response = await fetch('/api/watchlists', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch watch lists');
      }

      return parseJsonResponse<{ data: WatchListWithStats[] }>(response);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Get a specific watch list with details
export function useWatchList(listId: number) {
  return useQuery<{ data: WatchListWithStats }>({
    queryKey: ['/api/watchlists', listId],
    queryFn: async () => {
      const response = await fetch(`/api/watchlists/${listId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch watch list');
      }

      return parseJsonResponse<{ data: WatchListWithStats }>(response);
    },
    enabled: !!listId,
  });
}

/**
 * Update a watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Ownership validated - Server ensures user owns the watch list
 * @returns Mutation hook for updating watch list metadata
 */
export function useUpdateWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      updates,
    }: {
      listId: number;
      updates: {
        name?: string;
        description?: string | null;
        color?: string | null;
        icon?: string | null;
        sortOrder?: number;
      };
    }) => {
      return apiRequest<WatchList>(`/api/watchlists/${listId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, { listId }) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', listId] });
    },
  });
}

/**
 * Delete a watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Ownership validated - Server ensures user owns the watch list
 * @returns Mutation hook for deleting watch lists
 */
export function useDeleteWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: number) => {
      return apiRequest<{ success: boolean }>(`/api/watchlists/${listId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    },
  });
}

// Get products in a watch list
export function useWatchListProducts(listId: number) {
  return useQuery<{ data: WatchListProduct[] }>({
    queryKey: ['/api/watchlists', listId, 'products'],
    queryFn: async () => {
      const response = await fetch(`/api/watchlists/${listId}/products`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch watch list products');
      }

      return parseJsonResponse<{ data: WatchListProduct[] }>(response);
    },
    enabled: !!listId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Update a product watch (category, notes, priority, target price, list)
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Ownership validated - Server ensures user owns the product watch
 * @returns Mutation hook for updating product watch metadata
 */
export function useUpdateProductWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      watchId,
      updates,
    }: {
      watchId: number;
      updates: {
        category?: string | null;
        notes?: string | null;
        priority?: number;
        targetPrice?: string | null;
        watchListId?: number | null;
      };
    }) => {
      return apiRequest<ProductWatch>(`/api/community/product-watches/${watchId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, { updates }) => {
      // Invalidate watch lists
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });

      // If moving to a different list, invalidate that list's products
      if (updates.watchListId !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: ['/api/watchlists', updates.watchListId, 'products'],
        });
      }
    },
  });
}

/**
 * Move multiple products to a different watch list (bulk operation)
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Ownership validated - Server ensures user owns all product watches
 * @security Input validation - Server validates productWatchIds array and targetListId
 * @returns Mutation hook for bulk moving products between watch lists
 */
export function useMoveProductsToWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productWatchIds,
      targetListId,
    }: {
      productWatchIds: number[];
      targetListId: number | null;
    }) => {
      return apiRequest<{ success: boolean }>('/api/community/product-watches/bulk-move', {
        method: 'POST',
        body: JSON.stringify({ productWatchIds, targetListId }),
      });
    },
    onSuccess: () => {
      // Invalidate all watch list queries
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    },
  });
}

/**
 * Remove multiple products from watch lists (bulk delete)
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Input validation - Server validates productWatchIds array
 * @returns Mutation hook for bulk deletion of product watches
 */
export function useBulkRemoveProductWatches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productWatchIds: number[]) => {
      return apiRequest<{ success: boolean }>('/api/community/product-watches/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ productWatchIds }),
      });
    },
    onSuccess: () => {
      // Invalidate all watch list queries
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/most-watched'] });
    },
  });
}

// Export watch lists as JSON
export function useExportWatchLists() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/watchlists/export', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        throw new Error(extractErrorMessage(errorData, 'Failed to export watch lists'));
      }

      interface ExportResponse {
        data: unknown;
      }
      const data = await parseJsonResponse<ExportResponse>(response);

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watchlists-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return data;
    },
  });
}

interface WatchListImportData {
  watchLists?: Array<{
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    products?: Array<{
      productId: number;
      notes?: string;
      priority?: number;
      targetPrice?: string;
    }>;
  }>;
  [key: string]: unknown;
}

/**
 * Import watch lists from JSON
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Input validation - Server validates importData structure and user ownership
 * @returns Mutation hook for importing watch lists with created/skipped counts
 */
export function useImportWatchLists() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importData: WatchListImportData) => {
      return apiRequest<{ created: number; skipped: number }>('/api/watchlists/import', {
        method: 'POST',
        body: JSON.stringify(importData),
      });
    },
    onSuccess: () => {
      // Invalidate all watch list queries
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    },
  });
}
