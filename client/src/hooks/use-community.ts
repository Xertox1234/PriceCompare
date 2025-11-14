import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ProductWatch,
  WatchList,
  UserReputation,
  DealSpotting
} from '@shared/schema';

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

// Add product to watch list
export function useAddProductWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: number) => {
      const response = await fetch(`/api/community/watch/${productId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add product watch');
      }

      return response.json();
    },
    onSuccess: (_, productId) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      queryClient.invalidateQueries({ queryKey: [`/api/community/watch-count/${productId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/community/is-watching/${productId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/community/most-watched'] });
    },
  });
}

// Remove product from watch list
export function useRemoveProductWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: number) => {
      const response = await fetch(`/api/community/watch/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove product watch');
      }

      return response.json();
    },
    onSuccess: (_, productId) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      queryClient.invalidateQueries({ queryKey: [`/api/community/watch-count/${productId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/community/is-watching/${productId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/community/most-watched'] });
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
export function useMostWatchedProducts(limit: number = 10) {
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
export function useLeaderboard(limit: number = 10) {
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
export function useRecentDeals(limit: number = 10) {
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
      const response = await fetch('/api/community/watch-lists', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create watch list');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/watch-lists'] });
    },
  });
}

// Get all user's watch lists
export function useWatchLists() {
  return useQuery<{ data: WatchListWithStats[] }>({
    queryKey: ['/api/community/watch-lists'],
    queryFn: async () => {
      const response = await fetch('/api/community/watch-lists', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch watch lists');
      }

      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Get a specific watch list with details
export function useWatchList(listId: number) {
  return useQuery<{ data: WatchListWithStats }>({
    queryKey: ['/api/community/watch-lists', listId],
    queryFn: async () => {
      const response = await fetch(`/api/community/watch-lists/${listId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch watch list');
      }

      return response.json();
    },
    enabled: !!listId,
  });
}

// Update a watch list
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
      const response = await fetch(`/api/community/watch-lists/${listId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update watch list');
      }

      return response.json();
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/watch-lists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community/watch-lists', listId] });
    },
  });
}

// Delete a watch list
export function useDeleteWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: number) => {
      const response = await fetch(`/api/community/watch-lists/${listId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete watch list');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/watch-lists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    },
  });
}

// Get products in a watch list
export function useWatchListProducts(listId: number) {
  return useQuery<{ data: WatchListProduct[] }>({
    queryKey: ['/api/community/watch-lists', listId, 'products'],
    queryFn: async () => {
      const response = await fetch(`/api/community/watch-lists/${listId}/products`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch watch list products');
      }

      return response.json();
    },
    enabled: !!listId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Update a product watch (category, notes, priority, target price, list)
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
      const response = await fetch(`/api/community/product-watches/${watchId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update product watch');
      }

      return response.json();
    },
    onSuccess: (data, { updates }) => {
      // Invalidate watch lists
      queryClient.invalidateQueries({ queryKey: ['/api/community/watch-lists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });

      // If moving to a different list, invalidate that list's products
      if (updates.watchListId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: ['/api/community/watch-lists', updates.watchListId, 'products']
        });
      }
    },
  });
}

// Move multiple products to a different watch list (bulk operation)
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
      const response = await fetch('/api/community/product-watches/bulk-move', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productWatchIds, targetListId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to move products');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all watch list queries
      queryClient.invalidateQueries({ queryKey: ['/api/community/watch-lists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    },
  });
}

// Remove multiple products from watch lists (bulk delete)
export function useBulkRemoveProductWatches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productWatchIds: number[]) => {
      const response = await fetch('/api/community/product-watches/bulk-delete', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productWatchIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete products');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all watch list queries
      queryClient.invalidateQueries({ queryKey: ['/api/community/watch-lists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community/most-watched'] });
    },
  });
}

// Export watch lists as JSON
export function useExportWatchLists() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/community/watch-lists/export', {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export watch lists');
      }

      const data = await response.json();

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

// Import watch lists from JSON
export function useImportWatchLists() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importData: any) => {
      const response = await fetch('/api/community/watch-lists/import', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import watch lists');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all watch list queries
      queryClient.invalidateQueries({ queryKey: ['/api/community/watch-lists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    },
  });
}
