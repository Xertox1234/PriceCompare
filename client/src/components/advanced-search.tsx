import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Sparkles, TrendingUp, Target, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useDebounce } from '@/hooks/use-debounce';
import type {
  ProductWithOffers,
  SearchFilters,
  SearchSuggestion,
  QueryAnalysis,
} from '@shared/schema';

interface AdvancedSearchResult {
  product: ProductWithOffers;
  relevanceScore: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'synonym';
}

interface SearchResponse {
  results: AdvancedSearchResult[];
  metadata?: {
    detectedIntent?: string;
    searchStrategy?: string;
    totalCount?: number;
  };
}

interface AdvancedSearchProps {
  onResults?: (results: AdvancedSearchResult[]) => void;
  initialQuery?: string;
  showFilters?: boolean;
}

export function AdvancedSearch({
  onResults,
  initialQuery = '',
  showFilters = true,
}: AdvancedSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<'basic' | 'smart' | 'intent'>('smart');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  // Get search suggestions
  const { data: suggestions } = useQuery<{ suggestions: SearchSuggestion[] }>({
    queryKey: ['/api/search/suggestions', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    staleTime: 5 * 60 * 1000,
  });

  // Analyze query intent
  const { data: analysis } = useQuery<QueryAnalysis | null>({
    queryKey: ['/api/search/analyze', debouncedQuery],
    queryFn: async (): Promise<QueryAnalysis | null> => {
      if (debouncedQuery.length < 3) return null;
      return apiRequest('/api/search/analyze', {
        method: 'POST',
        body: JSON.stringify({ query: debouncedQuery }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    enabled: debouncedQuery.length > 2,
    staleTime: 10 * 60 * 1000,
  });

  // Perform search
  const searchMutation = useMutation<SearchResponse, Error, SearchFilters>({
    mutationFn: async (searchFilters: SearchFilters): Promise<SearchResponse> => {
      const params = new URLSearchParams();

      if (searchFilters.query) params.append('query', searchFilters.query);
      if (searchFilters.category) params.append('category', searchFilters.category);
      if (searchFilters.minPrice) params.append('minPrice', searchFilters.minPrice.toString());
      if (searchFilters.maxPrice) params.append('maxPrice', searchFilters.maxPrice.toString());
      if (searchFilters.minRating) params.append('minRating', searchFilters.minRating.toString());
      if (searchFilters.sortBy) params.append('sortBy', searchFilters.sortBy);

      let endpoint = '/api/search/advanced';
      if (searchMode === 'smart') {
        endpoint = '/api/search/smart';
      } else if (searchMode === 'intent' && analysis) {
        endpoint = `/api/search/intent/${analysis.intent}`;
      }

      const response = await apiRequest<SearchResponse>(`${endpoint}?${params.toString()}`);
      return response;
    },
    onSuccess: (data) => {
      if (onResults && data.results) {
        onResults(data.results);
      }
      queryClient.setQueryData(['/api/search/last-results'], data);
    },
  });

  // Handle search
  const handleSearch = () => {
    if (!query.trim()) return;

    const searchFilters: SearchFilters = {
      query: query.trim(),
      ...filters,
    };

    searchMutation.mutate(searchFilters);
    setShowSuggestions(false);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.query);
    setShowSuggestions(false);
    // Trigger search after a short delay
    setTimeout(() => {
      const searchFilters: SearchFilters = {
        query: suggestion.query,
        ...filters,
      };
      searchMutation.mutate(searchFilters);
    }, 100);
  };

  // Handle input focus/blur
  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Mode Selector */}
      <Tabs
        value={searchMode}
        onValueChange={(value) => setSearchMode(value as 'basic' | 'smart' | 'intent')}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Basic
          </TabsTrigger>
          <TabsTrigger value="smart" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Smart
          </TabsTrigger>
          <TabsTrigger value="intent" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Intent
          </TabsTrigger>
        </TabsList>

        {/* Search Input */}
        <div className="relative mt-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search for products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              className="h-12 pr-24 pl-10 text-base"
            />
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || searchMutation.isPending}
              className="absolute top-1/2 right-2 -translate-y-1/2 transform"
            >
              {searchMutation.isPending ? (
                <Zap className="h-4 w-4 animate-pulse" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Search Suggestions */}
          {showSuggestions && suggestions?.suggestions && suggestions.suggestions.length > 0 && (
            <Card className="absolute top-full right-0 left-0 z-50 mt-1 shadow-lg">
              <CardContent className="p-2">
                <div className="space-y-1">
                  {suggestions.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="hover:bg-muted flex cursor-pointer items-center justify-between rounded p-2"
                    >
                      <span className="text-sm">{suggestion.query}</span>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Intent Analysis */}
        {analysis && analysis.confidence > 0.7 && (
          <Card className="bg-primary dark:bg-primary/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="text-primary h-4 w-4" />
                <span className="text-primary dark:text-primary text-sm font-medium">
                  Detected Intent: {analysis.intent.replace(/_/g, ' ')}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {(analysis.confidence * 100).toFixed(0)}% confident
                </Badge>
              </div>
              {analysis.suggestions && analysis.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {analysis.suggestions.map((suggestion, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Search Mode Content */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Search</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Simple keyword matching across product names, descriptions, and brands.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5" />
                Smart Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3 text-sm">
                AI-powered search with automatic intent detection, synonym matching, and semantic
                understanding.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Fuzzy Matching</Badge>
                <Badge variant="secondary">Synonym Detection</Badge>
                <Badge variant="secondary">Semantic Search</Badge>
                <Badge variant="secondary">Auto-correction</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5" />
                Intent-Based Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3 text-sm">
                Search optimized based on your specific intent - price comparison, brand search, or
                category browsing.
              </p>
              {analysis && (
                <div className="bg-muted rounded-lg p-3">
                  <div className="mb-1 text-sm font-medium">Current Intent:</div>
                  <div className="text-muted-foreground text-sm">
                    {analysis.intent.replace(/_/g, ' ')} ({(analysis.confidence * 100).toFixed(0)}%
                    confidence)
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Advanced Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Category Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium">Category</label>
                <Select
                  value={filters.category || ''}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, category: value || undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="Smartphones">Smartphones</SelectItem>
                    <SelectItem value="Laptops">Laptops</SelectItem>
                    <SelectItem value="Audio">Audio</SelectItem>
                    <SelectItem value="Tablets">Tablets</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div>
                <label className="mb-2 block text-sm font-medium">Min Price</label>
                <Input
                  type="number"
                  placeholder="$0"
                  value={filters.minPrice || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      minPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Max Price</label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={filters.maxPrice || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      maxPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                />
              </div>

              {/* Sort By */}
              <div>
                <label className="mb-2 block text-sm font-medium">Sort By</label>
                <Select
                  value={filters.sortBy || ''}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      sortBy: (value || undefined) as SearchFilters['sortBy'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Relevance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="price_low">Price: Low to High</SelectItem>
                    <SelectItem value="price_high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Best Rating</SelectItem>
                    <SelectItem value="popularity">Most Popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear Filters */}
            {Object.keys(filters).some((key) => filters[key as keyof SearchFilters]) && (
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setFilters({})}>
                  Clear All Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Results Summary */}
      {searchMutation.data && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{searchMutation.data.results?.length || 0} results</Badge>
                {searchMutation.data.metadata?.detectedIntent && (
                  <Badge variant="secondary">{searchMutation.data.metadata.detectedIntent}</Badge>
                )}
              </div>
              <div className="text-muted-foreground text-sm">
                Search strategy: {searchMutation.data.metadata?.searchStrategy || searchMode}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
