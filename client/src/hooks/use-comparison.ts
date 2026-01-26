import { useCallback, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, ApiError } from '@/lib/queryClient';
import type { ProductWithOffers, UserCompareItemWithProduct } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { MAX_COMPARISON_ITEMS } from '@/lib/constants';

// Server response type
interface CompareListResponse {
  items: UserCompareItemWithProduct[];
  count: number;
  maxItems: number;
}

// LocalStorage key
const COMPARISON_STORAGE_KEY = 'comparison-items';

/**
 * Comparison list hook with server persistence for authenticated users
 *
 * Features:
 * - Server-backed for authenticated users (persistent across sessions)
 * - localStorage fallback for guest users
 * - Optimistic updates for instant UI feedback
 * - Login migration (localStorage → server)
 * - Max 4 items enforced
 */
export function useComparison() {
  const { data: user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Server-backed comparison list for authenticated users
  const {
    data: serverData,
    isLoading: isServerLoading,
    error: serverError,
  } = useQuery<CompareListResponse>({
    queryKey: ['/api/user/compare'],
    queryFn: async () => apiRequest<CompareListResponse>('/api/user/compare'),
    enabled: !!user, // Only fetch if authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  // Extract products from server items
  const serverItems = serverData?.items?.map((item) => item.product) ?? [];

  // localStorage for guest users
  const [localItems, setLocalItems] = useState<ProductWithOffers[]>(() => {
    if (user) return []; // Don't use localStorage for authenticated users
    try {
      const stored = localStorage.getItem(COMPARISON_STORAGE_KEY);
      if (!stored) return [];
      // Type assertion: localStorage data was written by this hook with known ProductWithOffers[] shape
      // If data is corrupted, the catch block handles it gracefully by returning empty array
      const parsed = JSON.parse(stored) as ProductWithOffers[];
      // Validate max items constraint
      return parsed.slice(0, MAX_COMPARISON_ITEMS);
    } catch {
      return [];
    }
  });

  // Sync localStorage when it changes (guest users only)
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(localItems));
      } catch {
        // Silently fail if localStorage is not available
      }
    }
  }, [localItems, user]);

  // Login migration: Move localStorage items to server
  useEffect(() => {
    if (user && localItems.length > 0) {
      const migrateItems = async () => {
        try {
          // Fetch current server items to avoid duplicates
          const serverData = await apiRequest<CompareListResponse>('/api/user/compare');
          const existingProductIds = new Set(serverData.items.map((item) => item.productId));

          // Filter out items already on server
          const itemsToMigrate = localItems.filter((item) => !existingProductIds.has(item.id));

          if (itemsToMigrate.length === 0) {
            // Clear localStorage (all items already on server)
            setLocalItems([]);
            localStorage.removeItem(COMPARISON_STORAGE_KEY);
            return;
          }

          // Migrate each item (respecting max items limit)
          const maxAllowed = MAX_COMPARISON_ITEMS - existingProductIds.size;
          const toMigrate = itemsToMigrate.slice(0, maxAllowed);

          for (const item of toMigrate) {
            try {
              await apiRequest('/api/user/compare', {
                method: 'POST',
                body: JSON.stringify({ productId: item.id }),
              });
            } catch {
              // Skip items that fail (e.g., list full, product deleted)
            }
          }

          // Clear localStorage after migration
          setLocalItems([]);
          localStorage.removeItem(COMPARISON_STORAGE_KEY);

          // Invalidate server query to refresh
          void queryClient.invalidateQueries({ queryKey: ['/api/user/compare'] });

          // Show success toast
          toast({
            title: 'Comparison list migrated',
            description: `${toMigrate.length} product(s) moved to your account.`,
            variant: 'default',
          });
        } catch {
          // Silently fail migration (user can still use localStorage)
        }
      };

      void migrateItems();
    }
  }, [user, localItems, queryClient, toast]);

  // Determine which items to use
  const comparisonItems = user ? serverItems : localItems;
  const isLoading = user ? isServerLoading : false;

  // Add to comparison mutation (server)
  const addMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest('/api/user/compare', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
    },
    onMutate: async (_productId) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['/api/user/compare'] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<CompareListResponse>(['/api/user/compare']);

      // Optimistically update (we don't have the full product, so we'll refetch)
      // Just increment count for optimistic feedback
      if (previousData) {
        queryClient.setQueryData<CompareListResponse>(['/api/user/compare'], {
          ...previousData,
          count: previousData.count + 1,
        });
      }

      return { previousData };
    },
    onError: (error, _productId, context) => {
      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(['/api/user/compare'], context.previousData);
      }

      // Show error toast
      if (error instanceof ApiError && error.status === 400) {
        toast({
          title: 'Comparison list full',
          description: `You can only compare up to ${MAX_COMPARISON_ITEMS} products at once.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to add product',
          description: 'Please try again later.',
          variant: 'destructive',
        });
      }
    },
    onSuccess: () => {
      // Refetch to get full product data
      void queryClient.invalidateQueries({ queryKey: ['/api/user/compare'] });

      toast({
        title: 'Added to comparison',
        description: 'Product has been added to your comparison list.',
        variant: 'default',
      });
    },
  });

  // Remove from comparison mutation (server)
  const removeMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest(`/api/user/compare/${productId}`, {
        method: 'DELETE',
      });
    },
    onMutate: async (productId) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['/api/user/compare'] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<CompareListResponse>(['/api/user/compare']);

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<CompareListResponse>(['/api/user/compare'], {
          ...previousData,
          items: previousData.items.filter((item) => item.productId !== productId),
          count: previousData.count - 1,
        });
      }

      return { previousData };
    },
    onError: (_error, _productId, context) => {
      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(['/api/user/compare'], context.previousData);
      }

      toast({
        title: 'Failed to remove product',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Removed from comparison',
        description: 'Product has been removed from your comparison list.',
        variant: 'default',
      });
    },
  });

  // Clear comparison mutation (server)
  const clearMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/user/compare', {
        method: 'DELETE',
      });
    },
    onMutate: async () => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['/api/user/compare'] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<CompareListResponse>(['/api/user/compare']);

      // Optimistically update
      queryClient.setQueryData<CompareListResponse>(['/api/user/compare'], {
        items: [],
        count: 0,
        maxItems: MAX_COMPARISON_ITEMS,
      });

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(['/api/user/compare'], context.previousData);
      }

      toast({
        title: 'Failed to clear comparison',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Comparison cleared',
        description: 'All products have been removed from your comparison list.',
        variant: 'default',
      });
    },
  });

  // Add to comparison (unified interface)
  const addToComparison = useCallback(
    (product: ProductWithOffers) => {
      if (user) {
        // Server-backed
        // Check if already in list
        const existing = serverItems.find((item) => item.id === product.id);
        if (existing) {
          toast({
            title: 'Already in comparison',
            description: `${product.name} is already in your comparison list.`,
            variant: 'default',
          });
          return;
        }

        // Check max items
        if (serverItems.length >= MAX_COMPARISON_ITEMS) {
          toast({
            title: 'Comparison list full',
            description: `You can only compare up to ${MAX_COMPARISON_ITEMS} products at once.`,
            variant: 'destructive',
          });
          return;
        }

        addMutation.mutate(product.id);
      } else {
        // Guest user - localStorage
        setLocalItems((current) => {
          // Check if product is already in comparison
          if (current.some((item) => item.id === product.id)) {
            toast({
              title: 'Already in comparison',
              description: `${product.name} is already in your comparison list.`,
              variant: 'default',
            });
            return current;
          }

          // Check if we've reached the maximum
          if (current.length >= MAX_COMPARISON_ITEMS) {
            toast({
              title: 'Comparison list full',
              description: `You can only compare up to ${MAX_COMPARISON_ITEMS} products at once.`,
              variant: 'destructive',
            });
            return current;
          }

          toast({
            title: 'Added to comparison',
            description: `${product.name} has been added to your comparison list.`,
            variant: 'default',
          });

          return [...current, product];
        });
      }
    },
    [user, serverItems, toast, addMutation]
  );

  // Remove from comparison (unified interface)
  const removeFromComparison = useCallback(
    (productId: number) => {
      if (user) {
        // Server-backed
        removeMutation.mutate(productId);
      } else {
        // Guest user - localStorage
        setLocalItems((current) => {
          const product = current.find((item) => item.id === productId);
          if (product) {
            toast({
              title: 'Removed from comparison',
              description: `${product.name} has been removed from your comparison list.`,
              variant: 'default',
            });
          }
          return current.filter((item) => item.id !== productId);
        });
      }
    },
    [user, toast, removeMutation]
  );

  // Clear comparison (unified interface)
  const clearComparison = useCallback(() => {
    if (user) {
      // Server-backed
      if (serverItems.length === 0) {
        return;
      }
      clearMutation.mutate();
    } else {
      // Guest user - localStorage
      setLocalItems((current) => {
        if (current.length > 0) {
          toast({
            title: 'Comparison cleared',
            description: 'All products have been removed from your comparison list.',
            variant: 'default',
          });
        }
        return [];
      });
    }
  }, [user, serverItems.length, toast, clearMutation]);

  return {
    comparisonItems,
    addToComparison,
    removeFromComparison,
    clearComparison,
    isLoading,
    error: serverError,
  };
}
