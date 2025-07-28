import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDebounce } from './use-debounce';
import type { SearchFilters, ProductWithOffers } from '@shared/schema';

interface AdvancedSearchResult {
  product: ProductWithOffers;
  relevanceScore: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'synonym';
}

interface SearchSuggestion {
  query: string;
  type: 'completion' | 'correction' | 'synonym';
  confidence: number;
}

interface QueryAnalysis {
  intent: 'product_search' | 'price_comparison' | 'brand_search' | 'category_browse';
  confidence: number;
  suggestions: string[];
}

interface SearchResponse {
  results: AdvancedSearchResult[];
  analysis?: QueryAnalysis;
  suggestions?: string[];
  metadata: {
    totalResults: number;
    searchStrategy?: string;
    detectedIntent?: string;
    confidence?: number;
  };
}

interface UseAdvancedSearchOptions {
  mode?: 'basic' | 'smart' | 'intent';
  autoSearch?: boolean;
  debounceMs?: number;
}

export function useAdvancedSearch(options: UseAdvancedSearchOptions = {}) {
  const {
    mode = 'smart',
    autoSearch = false,
    debounceMs = 300
  } = options;

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const debouncedQuery = useDebounce(query, debounceMs);

  // Get search suggestions
  const {
    data: suggestions,
    isLoading: suggestionsLoading
  } = useQuery<{ suggestions: SearchSuggestion[] }>({
    queryKey: ['/api/search/suggestions', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Analyze query intent
  const {
    data: analysis,
    isLoading: analysisLoading
  } = useQuery<QueryAnalysis>({
    queryKey: ['/api/search/analyze', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 3) return null;
      return apiRequest('/api/search/analyze', {
        method: 'POST',
        body: { query: debouncedQuery }
      });
    },
    enabled: debouncedQuery.length > 2,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Auto-search when query changes (if enabled)
  const {
    data: autoSearchResults,
    isLoading: autoSearchLoading
  } = useQuery<SearchResponse>({
    queryKey: ['/api/search/auto', debouncedQuery, filters, mode],
    queryFn: () => performSearch(debouncedQuery, filters, mode),
    enabled: autoSearch && debouncedQuery.length > 2,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Manual search mutation
  const searchMutation = useMutation({
    mutationFn: async ({ 
      searchQuery, 
      searchFilters, 
      searchMode 
    }: { 
      searchQuery: string; 
      searchFilters: SearchFilters; 
      searchMode: string;
    }) => {
      return performSearch(searchQuery, searchFilters, searchMode);
    },
    onSuccess: (data, variables) => {
      // Add to search history
      if (variables.searchQuery && !searchHistory.includes(variables.searchQuery)) {
        setSearchHistory(prev => [variables.searchQuery, ...prev.slice(0, 9)]); // Keep last 10 searches
      }
      
      // Cache the results
      queryClient.setQueryData(['/api/search/last-results'], data);
    },
  });

  // Helper function to perform search
  const performSearch = async (
    searchQuery: string, 
    searchFilters: SearchFilters, 
    searchMode: string
  ): Promise<SearchResponse> => {
    const params = new URLSearchParams();
    
    if (searchQuery) params.append('query', searchQuery);
    if (searchFilters.category) params.append('category', searchFilters.category);
    if (searchFilters.minPrice) params.append('minPrice', searchFilters.minPrice.toString());
    if (searchFilters.maxPrice) params.append('maxPrice', searchFilters.maxPrice.toString());
    if (searchFilters.minRating) params.append('minRating', searchFilters.minRating.toString());
    if (searchFilters.sortBy) params.append('sortBy', searchFilters.sortBy);
    if (searchFilters.retailers) {
      searchFilters.retailers.forEach(id => params.append('retailers', id.toString()));
    }
    if (searchFilters.availability) {
      searchFilters.availability.forEach(avail => params.append('availability', avail));
    }

    let endpoint = '/api/search/advanced';
    
    switch (searchMode) {
      case 'smart':
        endpoint = '/api/search/smart';
        break;
      case 'intent':
        if (analysis?.intent) {
          endpoint = `/api/search/intent/${analysis.intent}`;
        }
        break;
      case 'basic':
      default:
        endpoint = '/api/products/search'; // Fallback to basic search
        break;
    }

    return apiRequest(`${endpoint}?${params.toString()}`);
  };

  // Search function
  const search = useCallback((customQuery?: string, customFilters?: SearchFilters) => {
    const searchQuery = customQuery || query;
    const searchFilters = customFilters || filters;
    
    if (!searchQuery.trim()) return;

    searchMutation.mutate({
      searchQuery: searchQuery.trim(),
      searchFilters: { query: searchQuery.trim(), ...searchFilters },
      searchMode: mode
    });
  }, [query, filters, mode, searchMutation]);

  // Quick search with suggestions
  const quickSearch = useCallback((suggestionQuery: string) => {
    setQuery(suggestionQuery);
    search(suggestionQuery, filters);
  }, [filters, search]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setFilters({});
    queryClient.removeQueries({ queryKey: ['/api/search'] });
  }, [queryClient]);

  // Get search facets for dynamic filtering
  const {
    data: facets,
    isLoading: facetsLoading
  } = useQuery({
    queryKey: ['/api/search/facets', query],
    enabled: query.length > 2,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    // State
    query,
    setQuery,
    filters,
    setFilters: updateFilters,
    searchHistory,
    
    // Search actions
    search,
    quickSearch,
    clearFilters,
    clearSearch,
    
    // Data
    suggestions: suggestions?.suggestions || [],
    analysis,
    facets,
    results: autoSearch ? autoSearchResults?.results : searchMutation.data?.results,
    metadata: autoSearch ? autoSearchResults?.metadata : searchMutation.data?.metadata,
    
    // Loading states
    isSearching: searchMutation.isPending || autoSearchLoading,
    suggestionsLoading,
    analysisLoading,
    facetsLoading,
    
    // Error states
    searchError: searchMutation.error,
    
    // Mutation object for direct access
    searchMutation,
  };
}

// Helper hook for search suggestions only
export function useSearchSuggestions(query: string, enabled = true) {
  const debouncedQuery = useDebounce(query, 200);
  
  return useQuery<{ suggestions: SearchSuggestion[] }>({
    queryKey: ['/api/search/suggestions', debouncedQuery],
    enabled: enabled && debouncedQuery.length > 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Helper hook for query analysis
export function useQueryAnalysis(query: string, enabled = true) {
  const debouncedQuery = useDebounce(query, 300);
  
  return useQuery<QueryAnalysis>({
    queryKey: ['/api/search/analyze', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 3) return null;
      return apiRequest('/api/search/analyze', {
        method: 'POST',
        body: { query: debouncedQuery }
      });
    },
    enabled: enabled && debouncedQuery.length > 2,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}