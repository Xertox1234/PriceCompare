import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ProductWatch,
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
