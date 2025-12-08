import { useState, useCallback, useMemo } from 'react';
import { EnhancedSearchHeader } from '@/components/enhanced-search-header';
import { FilterSidebar } from '@/components/filter-sidebar';
import { ProductGrid } from '@/components/product-grid';
import { ComparisonModal } from '@/components/comparison-modal';
import { useEnhancedProductsSearch } from '@/hooks/use-enhanced-products-search';
import { useComparison } from '@/hooks/use-comparison';
import { SearchFilters } from '@shared/schema';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Filter } from 'lucide-react';

export default function Products() {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const {
    query,
    setQuery,
    filters,
    setFilters,
    search,
    products,
    metadata: _metadata,
    isLoading,
    error,
    isSearching: _isSearching,
    autoSearchResults,
    defaultProductsQuery,
  } = useEnhancedProductsSearch({
    initialFilters: { sortBy: 'popularity' },
    autoSearch: true,
  });

  const { comparisonItems, addToComparison, removeFromComparison, clearComparison } =
    useComparison();

  // Memoize search handler to prevent unnecessary re-renders of child components
  const handleSearch = useCallback(
    (query: string, searchFilters?: SearchFilters) => {
      setQuery(query);
      if (searchFilters) {
        setFilters(searchFilters);
      }
      search(query, searchFilters);
    },
    [setQuery, setFilters, search]
  );

  // Memoize filter change handler
  const handleFilterChange = useCallback(
    (newFilters: Partial<SearchFilters>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  // Retry handler for error states
  const handleRetry = useCallback(() => {
    if (query.trim()) {
      void autoSearchResults.refetch();
    } else {
      void defaultProductsQuery.refetch();
    }
  }, [query, autoSearchResults, defaultProductsQuery]);

  // Memoize active filter count calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice !== undefined) count++;
    if (filters.maxPrice !== undefined) count++;
    if (filters.retailers?.length) count++;
    if (filters.minRating !== undefined) count++;
    if (filters.availability?.length) count++;
    if (filters.category) count++;
    return count;
  }, [filters]);

  return (
    <>
      <EnhancedSearchHeader
        onSearch={handleSearch}
        searchQuery={query}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Products Section */}
      <main className="bg-muted min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          {/* Search Results Header */}
          <div className="mb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-foreground text-3xl font-black">
                  {query ? `Results for "${query}"` : 'Featured Products'}
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                  {products ? products.length : 0} products found across multiple retailers
                </p>
              </div>

              {/* Sort Options */}
              <div className="flex items-center space-x-4">
                <label
                  htmlFor="sort-select"
                  className="text-muted-foreground text-sm font-semibold"
                >
                  Sort by:
                </label>
                <select
                  id="sort-select"
                  className="border-input bg-background text-foreground focus:border-ring focus:ring-ring rounded-xl border px-4 py-2 text-sm shadow-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-offset-2"
                  value={filters.sortBy || 'popularity'}
                  onChange={(e) =>
                    handleFilterChange({ sortBy: e.target.value as SearchFilters['sortBy'] })
                  }
                >
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="rating">Customer Rating</option>
                  <option value="popularity">Most Popular</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mobile Filter Button */}
          <div className="mb-6 lg:hidden">
            <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="relative w-full">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters & Sort
                  {activeFilterCount > 0 && (
                    <span className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="h-[80vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Filter Products</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <FilterSidebar
                    filters={filters}
                    onFilterChange={(newFilters) => {
                      handleFilterChange(newFilters);
                      if (Object.keys(newFilters).length === 1 && 'sortBy' in newFilters) {
                        setMobileFiltersOpen(false);
                      }
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Main Content Grid */}
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Desktop Filters Sidebar */}
            <aside className="hidden flex-shrink-0 lg:block lg:w-80">
              <div className="bg-card border-border sticky top-6 rounded-2xl border p-6 shadow-md">
                <FilterSidebar filters={filters} onFilterChange={handleFilterChange} />
              </div>
            </aside>

            {/* Products Grid */}
            <div className="flex-1">
              <ProductGrid
                products={products || []}
                isLoading={isLoading}
                error={error}
                onAddToComparison={addToComparison}
                onRetry={handleRetry}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Comparison Modal */}
      {comparisonItems.length > 0 && (
        <ComparisonModal
          items={comparisonItems}
          onRemoveItem={removeFromComparison}
          onClear={clearComparison}
        />
      )}
    </>
  );
}
