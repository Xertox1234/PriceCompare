import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Sparkles, TrendingUp, Target, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useDebounce } from '@/hooks/use-debounce';
import type { ProductWithOffers, SearchFilters } from '@shared/schema';

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

interface AdvancedSearchProps {
  onResults?: (results: AdvancedSearchResult[]) => void;
  initialQuery?: string;
  showFilters?: boolean;
}

export function AdvancedSearch({ onResults, initialQuery = '', showFilters = true }: AdvancedSearchProps) {
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
  const { data: analysis } = useQuery<QueryAnalysis>({
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
  });

  // Perform search
  const searchMutation = useMutation({
    mutationFn: async (searchFilters: SearchFilters) => {
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

      const response = await apiRequest(`${endpoint}?${params.toString()}`);
      return response;
    },
    onSuccess: (data) => {
      if (onResults) {
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
      ...filters
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
        ...filters
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
      <Tabs value={searchMode} onValueChange={(value) => setSearchMode(value as any)}>
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search for products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-24 h-12 text-base"
            />
            <Button 
              onClick={handleSearch}
              disabled={!query.trim() || searchMutation.isPending}
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
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
            <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg">
              <CardContent className="p-2">
                <div className="space-y-1">
                  {suggestions.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
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
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Detected Intent: {analysis.intent.replace(/_/g, ' ')}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {(analysis.confidence * 100).toFixed(0)}% confident
                </Badge>
              </div>
              {analysis.suggestions.length > 0 && (
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
              <p className="text-sm text-muted-foreground">
                Simple keyword matching across product names, descriptions, and brands.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Smart Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                AI-powered search with automatic intent detection, synonym matching, and semantic understanding.
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
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Intent-Based Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Search optimized based on your specific intent - price comparison, brand search, or category browsing.
              </p>
              {analysis && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium mb-1">Current Intent:</div>
                  <div className="text-sm text-muted-foreground">
                    {analysis.intent.replace(/_/g, ' ')} ({(analysis.confidence * 100).toFixed(0)}% confidence)
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={filters.category || ''} onValueChange={(value) => 
                  setFilters(prev => ({ ...prev, category: value || undefined }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All categories</SelectItem>
                    <SelectItem value="Smartphones">Smartphones</SelectItem>
                    <SelectItem value="Laptops">Laptops</SelectItem>
                    <SelectItem value="Audio">Audio</SelectItem>
                    <SelectItem value="Tablets">Tablets</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">Min Price</label>
                <Input
                  type="number"
                  placeholder="$0"
                  value={filters.minPrice || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    minPrice: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Max Price</label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={filters.maxPrice || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    maxPrice: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                />
              </div>

              {/* Sort By */}
              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select value={filters.sortBy || ''} onValueChange={(value) => 
                  setFilters(prev => ({ ...prev, sortBy: value as any || undefined }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Relevance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Relevance</SelectItem>
                    <SelectItem value="price_low">Price: Low to High</SelectItem>
                    <SelectItem value="price_high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Best Rating</SelectItem>
                    <SelectItem value="popularity">Most Popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear Filters */}
            {Object.keys(filters).some(key => filters[key as keyof SearchFilters]) && (
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFilters({})}
                >
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
                <Badge variant="outline">
                  {searchMutation.data.results?.length || 0} results
                </Badge>
                {searchMutation.data.metadata?.detectedIntent && (
                  <Badge variant="secondary">
                    {searchMutation.data.metadata.detectedIntent}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Search strategy: {searchMutation.data.metadata?.searchStrategy || searchMode}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}