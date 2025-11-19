import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SearchFilters, Product } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useDebounce } from './use-debounce';

interface SearchFacets {
  categories?: Record<string, number>;
  brands?: Record<string, number>;
  priceRanges?: Array<{ min: number; max: number; count: number }>;
  [key: string]: unknown;
}

interface EnhancedSearchResults {
  results: Product[];
  metadata: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    facets?: SearchFacets;
    searchTime?: number;
    searchMode?: string;
    suggestions?: string[];
  };
}

interface UseEnhancedProductsSearchProps {
  initialFilters?: SearchFilters;
  autoSearch?: boolean;
  debounceMs?: number;
}

export function useEnhancedProductsSearch({
  initialFilters = {},
  autoSearch = true,
  debounceMs = 300
}: UseEnhancedProductsSearchProps = {}) {
  const [query, setQuery] = useState(initialFilters.query || '');
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [searchMode, setSearchMode] = useState<'basic' | 'smart' | 'intent'>('smart');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const queryClient = useQueryClient();
  const debouncedQuery = useDebounce(query, debounceMs);

  // Enhanced search mutation with multiple search strategies
  const searchMutation = useMutation({
    mutationFn: async (params: {
      searchQuery: string;
      searchFilters: SearchFilters;
      searchMode: 'basic' | 'smart' | 'intent';
    }) => {
      const { searchQuery, searchFilters, searchMode } = params;
      
      // Choose the appropriate search endpoint based on mode
      let endpoint = '/api/search/advanced';
      
      switch (searchMode) {
        case 'smart':
          endpoint = '/api/search/smart';
          break;
        case 'intent':
          // First analyze intent, then search with optimized filters
          try {
            const analysis = await apiRequest('/api/search/analyze', {
              method: 'POST',
              body: JSON.stringify({ query: searchQuery })
            });
            
            if (analysis && analysis.intent) {
              endpoint = `/api/search/intent/${analysis.intent}`;
            }
          } catch (error) {
            // Fall back to advanced search if intent analysis fails
            // Silently fall through to use default endpoint
          }
          break;
        case 'basic':
        default:
          endpoint = '/api/search/advanced';
          break;
      }
      
      // Prepare search parameters
      const searchParams = new URLSearchParams();
      searchParams.append('query', searchQuery);
      
      // Add filters to search params
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, v.toString()));
          } else {
            searchParams.append(key, value.toString());
          }
        }
      });
      
      // apiRequest already returns parsed JSON
      return await apiRequest(`${endpoint}?${searchParams.toString()}`);
    },
    onSuccess: (data, variables) => {
      // Update search history
      const newQuery = variables.searchQuery.trim();
      if (newQuery && !searchHistory.includes(newQuery)) {
        setSearchHistory(prev => [newQuery, ...prev.slice(0, 4)]);
      }
      
      // Cache the results
      queryClient.setQueryData(
        ['/api/products/search', variables.searchFilters],
        data
      );
    },
    onError: (error) => {
      // Error is handled by React Query and displayed via UI
      // Additional error reporting could be added here if needed
    }
  });

  // Auto-search with debounced query
  const autoSearchResults = useQuery<EnhancedSearchResults>({
    queryKey: ['/api/products/search', { query: debouncedQuery, ...filters }],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        // Return default products when no query
        // apiRequest already returns parsed JSON
        return await apiRequest('/api/products/search');
      }
      
      // Use the search mutation's function for consistency
      return searchMutation.mutateAsync({
        searchQuery: debouncedQuery,
        searchFilters: { query: debouncedQuery, ...filters },
        searchMode
      });
    },
    enabled: autoSearch && debouncedQuery.length > 0,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Fallback to regular products query when no search query
  const defaultProductsQuery = useQuery({
    queryKey: ['/api/products/search', filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, v.toString()));
          } else {
            searchParams.append(key, value.toString());
          }
        }
      });
      
      // apiRequest already returns parsed JSON
      return await apiRequest(`/api/products/search?${searchParams.toString()}`);
    },
    enabled: !autoSearch || !debouncedQuery.trim(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Manual search function
  const search = useCallback((customQuery?: string, customFilters?: SearchFilters, customMode?: 'basic' | 'smart' | 'intent') => {
    const searchQuery = customQuery || query;
    const searchFilters = customFilters || filters;
    const mode = customMode || searchMode;
    
    if (!searchQuery.trim()) {
      // Clear search results and show default products
      queryClient.invalidateQueries({ queryKey: ['/api/products/search'] });
      return;
    }

    searchMutation.mutate({
      searchQuery: searchQuery.trim(),
      searchFilters: { query: searchQuery.trim(), ...searchFilters },
      searchMode: mode
    });
  }, [query, filters, searchMode, searchMutation, queryClient]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setFilters(initialFilters);
    queryClient.removeQueries({ queryKey: ['/api/products/search'] });
  }, [initialFilters, queryClient]);

  // Get the appropriate data source
  const getCurrentData = () => {
    if (searchMutation.data) {
      return searchMutation.data;
    }
    
    if (autoSearch && debouncedQuery.trim()) {
      return autoSearchResults.data;
    }
    
    return defaultProductsQuery.data;
  };

  // Get loading state
  const isLoading = searchMutation.isPending || 
    (autoSearch && debouncedQuery.trim() ? autoSearchResults.isLoading : defaultProductsQuery.isLoading);

  // Get error state
  const error = searchMutation.error || 
    (autoSearch && debouncedQuery.trim() ? autoSearchResults.error : defaultProductsQuery.error);

  return {
    // State
    query,
    setQuery,
    filters,
    setFilters: updateFilters,
    searchMode,
    setSearchMode,
    searchHistory,
    
    // Actions
    search,
    clearSearch,
    
    // Data
    data: getCurrentData(),
    products: getCurrentData()?.results || [],
    metadata: getCurrentData()?.metadata,
    
    // Loading/Error states
    isLoading,
    error,
    isSearching: searchMutation.isPending,
    
    // Direct access to queries
    searchMutation,
    autoSearchResults,
    defaultProductsQuery,
  };
}