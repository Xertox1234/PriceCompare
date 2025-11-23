/**
 * Wishlist Hooks
 *
 * Manages user wishlists (simple "I want this" lists).
 * Separate from watchlists which track prices.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wishlist, WishlistItem, Product, ProductWithOffers } from "@shared/schema";

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
  return useQuery<{ success: boolean; data: WishlistWithItems[]; count: number }>({
    queryKey: ['/api/wishlists'],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Fetch single wishlist with items
export function useWishlist(wishlistId: number | null) {
  return useQuery<{ success: boolean; data: WishlistWithItems }>({
    queryKey: ['/api/wishlists', wishlistId],
    queryFn: async () => {
      const response = await fetch(`/api/wishlists/${wishlistId}`);
      if (!response.ok) throw new Error('Failed to fetch wishlist');
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!wishlistId,
  });
}

// Fetch all wishlist items for user (flat list)
export function useWishlistItems() {
  return useQuery<{ success: boolean; data: WishlistItemWithProduct[]; count: number }>({
    queryKey: ['/api/wishlists/items'],
    staleTime: 2 * 60 * 1000,
  });
}

// Check if product is in any wishlist
export function useIsInWishlist(productId: number | null) {
  return useQuery<{ success: boolean; isInWishlist: boolean }>({
    queryKey: ['/api/wishlists/check', productId],
    queryFn: async () => {
      const response = await fetch(`/api/wishlists/check/${productId}`);
      if (!response.ok) throw new Error('Failed to check wishlist');
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!productId,
  });
}

// Create wishlist mutation
export function useCreateWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; isPublic?: boolean }) => {
      const response = await fetch('/api/wishlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create wishlist');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
    },
  });
}

// Update wishlist mutation
export function useUpdateWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wishlistId, updates }: { wishlistId: number; updates: { name?: string; description?: string; isPublic?: boolean } }) => {
      const response = await fetch(`/api/wishlists/${wishlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update wishlist');
      }
      return response.json();
    },
    onSuccess: (_, { wishlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists', wishlistId] });
    },
  });
}

// Delete wishlist mutation
export function useDeleteWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wishlistId: number) => {
      const response = await fetch(`/api/wishlists/${wishlistId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete wishlist');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
    },
  });
}

// Add product to wishlist mutation
export function useAddToWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wishlistId, productId, notes, priority }: { wishlistId: number; productId: number; notes?: string; priority?: number }) => {
      const response = await fetch(`/api/wishlists/${wishlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, notes, priority }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add to wishlist');
      }
      return response.json();
    },
    onSuccess: (_, { wishlistId, productId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists', wishlistId] });
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists/check', productId] });
    },
  });
}

// Remove product from wishlist mutation
export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wishlistId, productId }: { wishlistId: number; productId: number }) => {
      const response = await fetch(`/api/wishlists/${wishlistId}/items/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove from wishlist');
      }
      return response.json();
    },
    onSuccess: (_, { wishlistId, productId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists', wishlistId] });
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists/check', productId] });
    },
  });
}

// Quick toggle - add to default wishlist or remove
export function useToggleWishlist() {
  const queryClient = useQueryClient();
  const { data: wishlists } = useWishlists();

  const addMutation = useAddToWishlist();
  const removeMutation = useRemoveFromWishlist();
  const createMutation = useCreateWishlist();

  return useMutation({
    mutationFn: async ({ productId, isCurrentlyInWishlist }: { productId: number; isCurrentlyInWishlist: boolean }) => {
      // Get or create default wishlist
      let defaultWishlist = wishlists?.data?.find(w => w.name === 'My Wishlist') ?? wishlists?.data?.[0];

      if (!defaultWishlist) {
        // Create default wishlist
        const result = await createMutation.mutateAsync({ name: 'My Wishlist' });
        defaultWishlist = result.data;
      }

      if (isCurrentlyInWishlist) {
        // Find which wishlist has this product and remove it
        const wishlistWithProduct = wishlists?.data?.find(w =>
          w.items?.some(item => item.productId === productId)
        );
        if (wishlistWithProduct) {
          return removeMutation.mutateAsync({ wishlistId: wishlistWithProduct.id, productId });
        }
      } else {
        // Add to default wishlist
        return addMutation.mutateAsync({ wishlistId: defaultWishlist!.id, productId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wishlists'] });
    },
  });
}
