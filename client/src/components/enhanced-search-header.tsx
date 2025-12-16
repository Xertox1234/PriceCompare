import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, Bell, User, Sparkles, Filter, X, Clock, TrendingUp, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAdvancedSearch } from '@/hooks/use-advanced-search';
import { SearchFilters, SearchSuggestion } from '@shared/schema';

interface EnhancedSearchHeaderProps {
  onSearch: (query: string, filters?: SearchFilters) => void;
  searchQuery: string;
  filters?: SearchFilters;
  onFilterChange?: (filters: Partial<SearchFilters>) => void;
}

export function EnhancedSearchHeader({
  onSearch,
  searchQuery,
  filters = {},
  onFilterChange,
}: EnhancedSearchHeaderProps) {
  const [query, setQuery] = useState(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showQuickFilters, setShowQuickFilters] = useState(false);
  const [searchMode, setSearchMode] = useState<'basic' | 'smart' | 'intent'>('smart');
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Use advanced search hook for suggestions and intelligent features
  const {
    suggestions,
    analysis,
    isSearching,
    suggestionsLoading,
    analysisLoading,
    searchHistory,
    quickSearch: _quickSearch,
  } = useAdvancedSearch({ mode: searchMode, autoSearch: false });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update query when prop changes
  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  // Search mode and suggestions are handled reactively by the component
  // No additional side effects needed

  // Handle search submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;

      onSearch(query.trim(), filters);
      setShowSuggestions(false);
    },
    [query, filters, onSearch]
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: SearchSuggestion) => {
      setQuery(suggestion.query);
      setShowSuggestions(false);

      // Use the suggestion's intent for optimized search
      const optimizedFilters = suggestion.intent
        ? {
            ...filters,
            intent: suggestion.intent,
          }
        : filters;

      onSearch(suggestion.query, optimizedFilters);
    },
    [filters, onSearch]
  );

  // Handle input focus/blur
  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    } else if (e.key === 'ArrowDown' && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      const firstSuggestion = suggestionsRef.current?.querySelector('button') as HTMLButtonElement;
      if (firstSuggestion) {
        firstSuggestion.focus();
      }
    } else if (e.key === 'Escape' && showSuggestions) {
      setShowSuggestions(false);
    }
  };

  // Quick filter application
  const applyQuickFilter = (filterType: string, value: string | null) => {
    const newFilters: Partial<SearchFilters> = { ...filters };

    switch (filterType) {
      case 'price-low':
        newFilters.sortBy = 'price_low';
        break;
      case 'price-high':
        newFilters.sortBy = 'price_high';
        break;
      case 'rating':
        newFilters.sortBy = 'rating';
        break;
      case 'category':
        newFilters.category = value || undefined;
        break;
      case 'retailer':
        // Note: retailers filter requires retailer IDs (numbers), not names
        // This would need to be implemented with a proper retailer lookup
        // For now, we skip this functionality
        break;
    }

    onFilterChange?.(newFilters);
    setShowQuickFilters(false);
  };

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.minPrice !== undefined) count++;
    if (filters.maxPrice !== undefined) count++;
    if (filters.retailers?.length) count++;
    if (filters.minRating !== undefined) count++;
    if (filters.availability?.length) count++;
    if (filters.category) count++;
    return count;
  };

  return (
    <header
      className="bg-background border-border sticky top-0 z-40 border-b shadow-sm"
      role="banner"
    >
      <div className="mx-auto max-w-[1280px] px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="gradient-text-brand font-sans text-3xl font-black">
                PriceCompare Community
              </h1>
            </div>
          </div>

          {/* Enhanced Search Bar */}
          <div className="relative mx-8 max-w-[600px] flex-1" role="search">
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative">
                <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">
                  {isSearching ? (
                    <Zap size={20} className="text-primary animate-pulse" />
                  ) : searchMode === 'smart' ? (
                    <Sparkles size={20} className="text-primary" />
                  ) : (
                    <Search size={20} className="text-muted-foreground" />
                  )}
                </div>

                <Input
                  ref={inputRef}
                  type="search"
                  placeholder={
                    searchMode === 'smart'
                      ? "AI-powered search: describe what you're looking for..."
                      : 'Search for products to compare prices...'
                  }
                  className="border-border bg-muted focus:border-primary focus:shadow-primary/10 focus:bg-card w-full rounded-2xl border-2 py-4 pr-32 pl-12 font-sans text-lg transition-all duration-300 outline-none focus:shadow-lg"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onKeyDown={handleKeyDown}
                  aria-label={
                    searchMode === 'smart'
                      ? 'AI-powered search input. Press Ctrl+K to focus, use arrow keys to navigate suggestions'
                      : 'Search for products input. Press Ctrl+K to focus, use arrow keys to navigate suggestions'
                  }
                  aria-describedby="search-help"
                  aria-expanded={showSuggestions}
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                  role="combobox"
                />

                {/* Hidden help text for screen readers */}
                <div id="search-help" className="sr-only">
                  Search help: Use Ctrl+K to focus search, arrow keys to navigate suggestions, Enter
                  to search, Escape to close suggestions.
                </div>

                {/* Search Mode Toggle */}
                <div className="absolute top-1/2 right-16 -translate-y-1/2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchMode((prev) => (prev === 'smart' ? 'basic' : 'smart'))}
                    className="h-6 px-2 text-xs"
                    aria-label={
                      searchMode === 'smart'
                        ? 'Switch to basic search mode'
                        : 'Switch to smart AI search mode'
                    }
                    title={
                      searchMode === 'smart'
                        ? 'Switch to basic search'
                        : 'Switch to smart AI search'
                    }
                  >
                    {searchMode === 'smart' ? (
                      <>
                        <Sparkles className="mr-1 h-3 w-3" />
                        AI
                      </>
                    ) : (
                      <>
                        <Search className="mr-1 h-3 w-3" />
                        Basic
                      </>
                    )}
                  </Button>
                </div>

                {/* Filter Toggle */}
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickFilters(!showQuickFilters)}
                    className="relative"
                    aria-label={showQuickFilters ? 'Hide filters' : 'Show filters'}
                  >
                    <Filter className="h-4 w-4" />
                    {getActiveFilterCount() > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs"
                      >
                        {getActiveFilterCount()}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {/* Search Suggestions Dropdown */}
            {showSuggestions && query.length > 1 && (
              <Card
                ref={suggestionsRef}
                className="absolute top-full right-0 left-0 z-50 mt-2 max-h-96 overflow-y-auto"
                role="listbox"
                aria-label="Search suggestions"
              >
                <CardContent className="p-0">
                  {/* Loading state */}
                  {suggestionsLoading && (
                    <div className="text-muted-foreground p-4 text-center text-sm">
                      <Zap className="mx-auto mb-2 h-4 w-4 animate-pulse" />
                      Generating smart suggestions...
                    </div>
                  )}

                  {/* Query Analysis */}
                  {analysis && !analysisLoading && (
                    <div className="bg-muted/50 border-b p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="text-primary h-4 w-4" />
                        <span className="text-sm font-medium">AI Analysis</span>
                      </div>
                      <div className="text-muted-foreground text-sm">
                        <p>
                          <strong>Intent:</strong> {analysis.intent}
                        </p>
                        <p>
                          <strong>Category:</strong> {analysis.category}
                        </p>
                        {analysis.confidence && (
                          <p>
                            <strong>Confidence:</strong> {Math.round(analysis.confidence * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {suggestions && suggestions.length > 0 && (
                    <div className="py-2">
                      <div className="text-muted-foreground px-4 py-2 text-xs font-medium tracking-wider uppercase">
                        Smart Suggestions
                      </div>
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              const nextButton = e.currentTarget
                                .nextElementSibling as HTMLButtonElement;
                              if (nextButton) {
                                nextButton.focus();
                              }
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              const prevButton = e.currentTarget
                                .previousElementSibling as HTMLButtonElement;
                              if (prevButton) {
                                prevButton.focus();
                              } else {
                                // Focus back to search input
                                inputRef.current?.focus();
                              }
                            } else if (e.key === 'Escape') {
                              setShowSuggestions(false);
                              inputRef.current?.focus();
                            }
                          }}
                          className="hover:bg-muted group focus:bg-muted focus:ring-primary flex w-full items-center gap-3 px-4 py-2 text-left focus:ring-2 focus:outline-none focus:ring-inset"
                          role="option"
                          aria-selected={false}
                          aria-label={`Search suggestion: ${suggestion.query}`}
                        >
                          <div className="text-primary flex items-center gap-2">
                            {suggestion.type === 'trending' && <TrendingUp className="h-4 w-4" />}
                            {suggestion.type === 'history' && <Clock className="h-4 w-4" />}
                            {suggestion.type === 'suggestion' && <Sparkles className="h-4 w-4" />}
                            {suggestion.type === 'completion' && <Search className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{suggestion.query}</div>
                            {suggestion.description && (
                              <div className="text-muted-foreground text-xs">
                                {suggestion.description}
                              </div>
                            )}
                          </div>
                          {suggestion.intent && (
                            <Badge variant="secondary" className="text-xs">
                              {suggestion.intent}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Recent Searches */}
                  {searchHistory && searchHistory.length > 0 && (
                    <>
                      <Separator />
                      <div className="py-2">
                        <div className="text-muted-foreground px-4 py-2 text-xs font-medium tracking-wider uppercase">
                          Recent Searches
                        </div>
                        {searchHistory.slice(0, 3).map((historyItem, index) => (
                          <button
                            key={index}
                            onClick={() =>
                              handleSuggestionClick({ query: historyItem, type: 'history' })
                            }
                            className="hover:bg-muted flex w-full items-center gap-3 px-4 py-2 text-left"
                          >
                            <Clock className="text-muted-foreground h-4 w-4" />
                            <span className="text-sm">{historyItem}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Filters Dropdown */}
            {showQuickFilters && (
              <Card className="absolute top-full right-0 z-50 mt-2 w-80">
                <CardContent className="p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-medium">Quick Filters</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowQuickFilters(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="mb-2 text-sm font-medium">Sort by</div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => applyQuickFilter('price-low', null)}
                        >
                          Price: Low to High
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => applyQuickFilter('price-high', null)}
                        >
                          Price: High to Low
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => applyQuickFilter('rating', null)}
                        >
                          Best Rating
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-medium">Categories</div>
                      <div className="flex flex-wrap gap-2">
                        {['Smartphones', 'Laptops', 'Audio', 'Tablets'].map((category) => (
                          <Button
                            key={category}
                            variant="outline"
                            size="sm"
                            onClick={() => applyQuickFilter('category', category)}
                          >
                            {category}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-medium">Retailers</div>
                      <div className="flex flex-wrap gap-2">
                        {['Amazon', 'Walmart', 'Best Buy', 'Target'].map((retailer) => (
                          <Button
                            key={retailer}
                            variant="outline"
                            size="sm"
                            onClick={() => applyQuickFilter('retailer', retailer)}
                          >
                            {retailer}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right side buttons */}
          <div className="flex items-center gap-4">
            <button
              className="bg-muted hover:bg-muted/80 cursor-pointer rounded-xl border-0 p-3 transition-all duration-300 hover:scale-105"
              aria-label="Notifications"
            >
              <Bell size={20} className="text-foreground" />
            </button>

            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-2 rounded-xl border-0 px-5 py-3 font-sans text-base font-semibold transition-all duration-300 hover:-translate-y-0.5"
              aria-label="User profile"
            >
              <User size={18} />
              Profile
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
