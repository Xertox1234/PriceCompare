import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ProductWithOffers, SearchFilters } from '@shared/schema';
import { ApiPaginatedResponse } from '@shared/api-types';
import { useDebounce } from './use-debounce';
import { apiRequestRaw } from '@/lib/queryClient';

export function useProducts(filters: SearchFilters, page = 1, limit = 20) {
  // Debounce search query to reduce API calls
  const debouncedQuery = useDebounce(filters.query, 500);

  // Use debounced query for the actual filters
  const optimizedFilters = { ...filters, query: debouncedQuery };

  // CRITICAL: Stable filter serialization prevents unnecessary refetches
  // Only include defined values to ensure { query: undefined } and { query: "" }
  // are treated as the same cache key
  const stableFilters = useMemo(() => {
    const stable: Record<string, string | number | string[] | number[]> = {};

    if (optimizedFilters.query) stable.query = optimizedFilters.query;
    if (optimizedFilters.category) stable.category = optimizedFilters.category;
    if (optimizedFilters.minPrice !== undefined) stable.minPrice = optimizedFilters.minPrice;
    if (optimizedFilters.maxPrice !== undefined) stable.maxPrice = optimizedFilters.maxPrice;
    if (optimizedFilters.retailers?.length) stable.retailers = optimizedFilters.retailers;
    if (optimizedFilters.minRating !== undefined) stable.minRating = optimizedFilters.minRating;
    if (optimizedFilters.availability?.length) stable.availability = optimizedFilters.availability;
    if (optimizedFilters.sortBy) stable.sortBy = optimizedFilters.sortBy;

    return stable;
  }, [
    optimizedFilters.query,
    optimizedFilters.category,
    optimizedFilters.minPrice,
    optimizedFilters.maxPrice,
    optimizedFilters.retailers,
    optimizedFilters.minRating,
    optimizedFilters.availability,
    optimizedFilters.sortBy,
  ]);

  const queryParams = new URLSearchParams();

  if (optimizedFilters.query) queryParams.append('query', optimizedFilters.query);
  if (optimizedFilters.category) queryParams.append('category', optimizedFilters.category);
  if (optimizedFilters.minPrice)
    queryParams.append('minPrice', optimizedFilters.minPrice.toString());
  if (optimizedFilters.maxPrice)
    queryParams.append('maxPrice', optimizedFilters.maxPrice.toString());
  if (optimizedFilters.retailers) {
    optimizedFilters.retailers.forEach((retailerId) =>
      queryParams.append('retailers', retailerId.toString())
    );
  }
  if (optimizedFilters.minRating)
    queryParams.append('minRating', optimizedFilters.minRating.toString());
  if (optimizedFilters.availability) {
    optimizedFilters.availability.forEach((availability) =>
      queryParams.append('availability', availability)
    );
  }
  if (optimizedFilters.sortBy) queryParams.append('sortBy', optimizedFilters.sortBy);

  // Add pagination parameters
  queryParams.append('page', page.toString());
  queryParams.append('limit', limit.toString());

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/products/search?${queryString}` : `/api/products?page=${page}&limit=${limit}`;

  return useQuery<ApiPaginatedResponse<ProductWithOffers>>({
    // Structured query key with stable filters for proper cache management
    queryKey: ['products', 'search', stableFilters, page, limit],
    queryFn: () => apiRequestRaw<ApiPaginatedResponse<ProductWithOffers>>(endpoint),
    staleTime: 2 * 60 * 1000, // 2 minutes
    // Prevent layout shift during page transitions
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    // Always enabled - endpoint handles empty filters gracefully
    // Returns all products sorted by popularity when no filters applied
  });
}
