import { useQuery } from '@tanstack/react-query';
import { ProductWithOffers, SearchFilters } from '@shared/schema';
import { useDebounce } from './use-debounce';
import { apiRequest } from '@/lib/queryClient';

export function useProducts(filters: SearchFilters) {
  // Debounce search query to reduce API calls
  const debouncedQuery = useDebounce(filters.query, 500);

  // Use debounced query for the actual filters
  const optimizedFilters = { ...filters, query: debouncedQuery };

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

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/products/search?${queryString}` : '/api/products';

  return useQuery<ProductWithOffers[]>({
    queryKey: [endpoint],
    queryFn: () => apiRequest<ProductWithOffers[]>(endpoint),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    enabled:
      !!debouncedQuery ||
      Object.keys(optimizedFilters).some(
        (key) => key !== 'query' && optimizedFilters[key as keyof SearchFilters]
      ),
  });
}
