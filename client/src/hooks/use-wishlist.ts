/**
 * Wishlist Hooks
 *
 * Manages user wishlists (simple "I want this" lists).
 * Separate from watchlists which track prices.
 */
import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wishlist, WishlistItem, Product, ProductWithOffers } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './use-auth';

// Types
export interface WishlistWithItems extends Wishlist {
  items: Array<WishlistItem & { product: Product }>;
  itemCount: number;
}

export interface WishlistItemWithProduct extends WishlistItem {
  product: ProductWithOffers;
  wishlist?: Wishlist;
}

// Fetch all user wishlists
export function useWishlists() {
  const { data: user } = useAuth();

  return useQuery<{ wishlists: WishlistWithItems[]; count: number }>({
    queryKey: ['/api/wishlists'],
    queryFn: () => apiRequest<{ wishlists: WishlistWithItems[]; count: number }>('/api/wishlists'),
    enabled: !!user, // Only fetch if user is authenticated
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Fetch single wishlist with items
export function useWishlist(wishlistId: number | null) {
  const { data: user } = useAuth();

  return useQuery<WishlistWithItems>({
    queryKey: ['/api/wishlists', wishlistId],
    queryFn: () => apiRequest<WishlistWithItems>(`/api/wishlists/${wishlistId}`),
    staleTime: 2 * 60 * 1000,
    enabled: !!wishlistId && !!user, // Only fetch if wishlist ID exists and user is authenticated
  });
}

// Fetch all wishlist items for user (flat list)
export function useWishlistItems() {
  const { data: user } = useAuth();

  return useQuery<{ items: WishlistItemWithProduct[]; count: number }>({
    queryKey: ['/api/wishlists/items'],
    queryFn: () =>
      apiRequest<{ items: WishlistItemWithProduct[]; count: number }>('/api/wishlists/items'),
    enabled: !!user, // Only fetch if user is authenticated
    staleTime: 2 * 60 * 1000,
  });
}

// Check if product is in any wishlist
export function useIsInWishlist(productId: number | null) {
  const { data: user } = useAuth();

  return useQuery<{ isInWishlist: boolean }>({
    queryKey: ['/api/wishlists/check', productId],
    queryFn: () => apiRequest<{ isInWishlist: boolean }>(`/api/wishlists/check/${productId}`),
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!productId && !!user, // Only fetch if product ID exists and user is authenticated
  });
}

// Create wishlist mutation
export function useCreateWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      isPublic?: boolean;
    }): Promise<WishlistWithItems> => {
      return apiRequest<WishlistWithItems>('/api/wishlists', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
    },
  });
}

// Update wishlist mutation
export function useUpdateWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      wishlistId,
      updates,
    }: {
      wishlistId: number;
      updates: { name?: string; description?: string; isPublic?: boolean };
    }) => {
      return apiRequest<Wishlist>(`/api/wishlists/${wishlistId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, { wishlistId }) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists', wishlistId] });
    },
  });
}

// Delete wishlist mutation
export function useDeleteWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wishlistId: number) => {
      return apiRequest<{ success: boolean }>(`/api/wishlists/${wishlistId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
    },
  });
}

// Add product to wishlist mutation
export function useAddToWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      wishlistId,
      productId,
      notes,
      priority,
    }: {
      wishlistId: number;
      productId: number;
      notes?: string;
      priority?: number;
    }) => {
      return apiRequest<WishlistItem>(`/api/wishlists/${wishlistId}/items`, {
        method: 'POST',
        body: JSON.stringify({ productId, notes, priority }),
      });
    },
    onSuccess: (_, { wishlistId, productId }) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists', wishlistId] });
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists/items'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists/check', productId] });
    },
  });
}

// Remove product from wishlist mutation
export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wishlistId, productId }: { wishlistId: number; productId: number }) => {
      return apiRequest<{ success: boolean }>(`/api/wishlists/${wishlistId}/items/${productId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, { wishlistId, productId }) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists', wishlistId] });
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists/items'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists/check', productId] });
    },
  });
}

// Quick toggle - add to default wishlist or remove
// Uses mutex pattern to prevent race conditions from rapid toggles
export function useToggleWishlist() {
  const queryClient = useQueryClient();
  const { data: wishlists } = useWishlists();

  // Mutex: Track in-flight toggle operations per product to prevent race conditions
  const pendingToggles = useRef(new Set<number>());

  const addMutation = useAddToWishlist();
  const removeMutation = useRemoveFromWishlist();
  const createMutation = useCreateWishlist();

  return useMutation({
    mutationFn: async ({
      productId,
      isCurrentlyInWishlist,
    }: {
      productId: number;
      isCurrentlyInWishlist: boolean;
    }) => {
      // Race condition guard: Prevent duplicate in-flight operations for same product
      if (pendingToggles.current.has(productId)) {
        // Return undefined to signal operation was skipped (not an error)
        return undefined;
      }

      // Mark this product as having an in-flight toggle operation
      pendingToggles.current.add(productId);

      try {
        // Get or create default wishlist
        let defaultWishlist =
          wishlists?.wishlists?.find((w) => w.name === 'My Wishlist') ?? wishlists?.wishlists?.[0];

        if (!defaultWishlist) {
          // Create default wishlist
          const result = await createMutation.mutateAsync({ name: 'My Wishlist' });
          defaultWishlist = result;
        }

        if (isCurrentlyInWishlist) {
          // Find which wishlist has this product and remove it
          const wishlistWithProduct = wishlists?.wishlists?.find((w) =>
            w.items?.some((item) => item.productId === productId)
          );
          if (wishlistWithProduct) {
            return removeMutation.mutateAsync({ wishlistId: wishlistWithProduct.id, productId });
          }
          return undefined;
        } else {
          // Add to default wishlist - defaultWishlist is guaranteed to exist here
          return addMutation.mutateAsync({ wishlistId: defaultWishlist.id, productId });
        }
      } finally {
        // Always remove from pending set, whether success or failure
        pendingToggles.current.delete(productId);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
    },
  });
}
