import { useQuery } from "@tanstack/react-query";
import { ProductWithOffers, SearchFilters } from "@shared/schema";
import { useDebounce } from "./use-debounce";

export function useProducts(filters: SearchFilters) {
  // Debounce search query to reduce API calls
  const debouncedQuery = useDebounce(filters.query, 300);
  const queryParams = new URLSearchParams();
  
  if (debouncedQuery) queryParams.append('query', debouncedQuery);
  if (filters.category) queryParams.append('category', filters.category);
  if (filters.minPrice) queryParams.append('minPrice', filters.minPrice.toString());
  if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice.toString());
  if (filters.retailers) {
    filters.retailers.forEach(retailerId => 
      queryParams.append('retailers', retailerId.toString())
    );
  }
  if (filters.minRating) queryParams.append('minRating', filters.minRating.toString());
  if (filters.availability) {
    filters.availability.forEach(availability => 
      queryParams.append('availability', availability)
    );
  }
  if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);

  const queryString = queryParams.toString();
  const endpoint = queryString 
    ? `/api/products/search?${queryString}` 
    : '/api/products';

  return useQuery<ProductWithOffers[]>({
    queryKey: [endpoint],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
