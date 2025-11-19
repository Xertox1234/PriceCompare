import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Bell, User, Sparkles, Filter, X, Clock, TrendingUp, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAdvancedSearch } from "@/hooks/use-advanced-search";
import { SearchFilters, SearchSuggestion } from "@shared/schema";
import { cn } from "@/lib/utils";

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
  onFilterChange 
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
    quickSearch
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
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    onSearch(query.trim(), filters);
    setShowSuggestions(false);
  }, [query, filters, onSearch]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.query);
    setShowSuggestions(false);
    
    // Use the suggestion's intent for optimized search
    const optimizedFilters = suggestion.intent ? {
      ...filters,
      intent: suggestion.intent
    } : filters;
    
    onSearch(suggestion.query, optimizedFilters);
  }, [filters, onSearch]);

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
    <header className="bg-background border-b border-border shadow-sm sticky top-0 z-40" role="banner">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo and Brand */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-black gradient-text-brand font-sans">
                PriceCompare Community
              </h1>
            </div>
          </div>

          {/* Enhanced Search Bar */}
          <div className="flex-1 max-w-[600px] mx-8 relative" role="search">
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative">
                <div className="absolute top-1/2 left-4 -translate-y-1/2 pointer-events-none">
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
                  placeholder={searchMode === 'smart' 
                    ? "AI-powered search: describe what you're looking for..." 
                    : "Search for products to compare prices..."
                  }
                  className="w-full pl-12 pr-32 py-4 text-lg border-2 border-border rounded-2xl bg-muted outline-none transition-all duration-300 font-sans focus:border-primary focus:shadow-primary/10 focus:shadow-lg focus:bg-card"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onKeyDown={handleKeyDown}
                  aria-label={searchMode === 'smart' 
                    ? "AI-powered search input. Press Ctrl+K to focus, use arrow keys to navigate suggestions" 
                    : "Search for products input. Press Ctrl+K to focus, use arrow keys to navigate suggestions"
                  }
                  aria-describedby="search-help"
                  aria-expanded={showSuggestions}
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                  role="combobox"
                />
                
                {/* Hidden help text for screen readers */}
                <div id="search-help" className="sr-only">
                  Search help: Use Ctrl+K to focus search, arrow keys to navigate suggestions, Enter to search, Escape to close suggestions.
                </div>
                
                {/* Search Mode Toggle */}
                <div className="absolute right-16 top-1/2 -translate-y-1/2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchMode(prev => prev === 'smart' ? 'basic' : 'smart')}
                    className="text-xs px-2 h-6"
                    aria-label={searchMode === 'smart' ? 'Switch to basic search mode' : 'Switch to smart AI search mode'}
                    title={searchMode === 'smart' ? 'Switch to basic search' : 'Switch to smart AI search'}
                  >
                    {searchMode === 'smart' ? (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI
                      </>
                    ) : (
                      <>
                        <Search className="h-3 w-3 mr-1" />
                        Basic
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Filter Toggle */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickFilters(!showQuickFilters)}
                    className="relative"
                  >
                    <Filter className="h-4 w-4" />
                    {getActiveFilterCount() > 0 && (
                      <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
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
                className="absolute top-full left-0 right-0 mt-2 z-50 max-h-96 overflow-y-auto"
                role="listbox"
                aria-label="Search suggestions"
              >
                <CardContent className="p-0">
                  {/* Loading state */}
                  {suggestionsLoading && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      <Zap className="h-4 w-4 animate-pulse mx-auto mb-2" />
                      Generating smart suggestions...
                    </div>
                  )}

                  {/* Query Analysis */}
                  {analysis && !analysisLoading && (
                    <div className="p-4 border-b bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">AI Analysis</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p><strong>Intent:</strong> {analysis.intent}</p>
                        <p><strong>Category:</strong> {analysis.category}</p>
                        {analysis.confidence && (
                          <p><strong>Confidence:</strong> {Math.round(analysis.confidence * 100)}%</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {suggestions && suggestions.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Smart Suggestions
                      </div>
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              const nextButton = e.currentTarget.nextElementSibling as HTMLButtonElement;
                              if (nextButton) {
                                nextButton.focus();
                              }
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              const prevButton = e.currentTarget.previousElementSibling as HTMLButtonElement;
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
                          className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3 group focus:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                          role="option"
                          aria-selected={false}
                          aria-label={`Search suggestion: ${suggestion.query}`}
                        >
                          <div className="flex items-center gap-2 text-primary">
                            {suggestion.type === 'trending' && <TrendingUp className="h-4 w-4" />}
                            {suggestion.type === 'history' && <Clock className="h-4 w-4" />}
                            {suggestion.type === 'suggestion' && <Sparkles className="h-4 w-4" />}
                            {suggestion.type === 'completion' && <Search className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{suggestion.query}</div>
                            {suggestion.description && (
                              <div className="text-xs text-muted-foreground">{suggestion.description}</div>
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
                        <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Recent Searches
                        </div>
                        {searchHistory.slice(0, 3).map((historyItem, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick({ query: historyItem, type: 'history' })}
                            className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3"
                          >
                            <Clock className="h-4 w-4 text-muted-foreground" />
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
              <Card className="absolute top-full right-0 mt-2 z-50 w-80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Quick Filters</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowQuickFilters(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium mb-2">Sort by</div>
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
                      <div className="text-sm font-medium mb-2">Categories</div>
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
                      <div className="text-sm font-medium mb-2">Retailers</div>
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
              className="p-3 bg-muted border-0 rounded-xl cursor-pointer transition-all duration-300 hover:bg-muted/80 hover:scale-105"
              aria-label="Notifications"
            >
              <Bell size={20} className="text-foreground" />
            </button>
            
            <button
              className="bg-primary text-primary-foreground px-5 py-3 border-0 rounded-xl text-base font-semibold cursor-pointer flex items-center gap-2 transition-all duration-300 font-sans hover:bg-primary/90 hover:-translate-y-0.5"
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