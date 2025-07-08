import { useState } from "react";
import { SearchHeader } from "@/components/search-header";
import { FilterSidebar } from "@/components/filter-sidebar";
import { ProductGrid } from "@/components/product-grid";
import { ComparisonModal } from "@/components/comparison-modal";
import { useProducts } from "@/hooks/use-products";
import { useComparison } from "@/hooks/use-comparison";
import { SearchFilters } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Filter, X } from "lucide-react";

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: "popularity"
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  const { data: products, isLoading, error } = useProducts(filters);
  const { comparisonItems, addToComparison, removeFromComparison, clearComparison } = useComparison();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFilters(prev => ({ ...prev, query }));
  };

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Count active filters for mobile indicator
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
    <>
      <SearchHeader 
        onSearch={handleSearch}
        searchQuery={searchQuery}
      />
      
      {/* Products Section */}
      <main className="bg-muted min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          {/* Search Results Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-foreground">
                  {searchQuery ? `Results for "${searchQuery}"` : "Featured Products"}
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                  {products ? products.length : 0} products found across multiple retailers
                </p>
              </div>
              
              {/* Sort Options */}
              <div className="flex items-center space-x-4">
                <label htmlFor="sort-select" className="text-sm font-semibold text-muted-foreground">
                  Sort by:
                </label>
                <select 
                  id="sort-select" 
                  className="border border-input rounded-xl px-4 py-2 text-sm bg-background text-foreground shadow-sm outline-none transition-all duration-200 focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={filters.sortBy || "popularity"}
                  onChange={(e) => handleFilterChange({ sortBy: e.target.value as SearchFilters["sortBy"] })}
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
          <div className="lg:hidden mb-6">
            <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full relative">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters & Sort
                  {getActiveFilterCount() > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {getActiveFilterCount()}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md h-[80vh] overflow-y-auto">
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
          <div className="flex flex-col lg:flex-row gap-8">
            
            {/* Desktop Filters Sidebar */}
            <aside className="hidden lg:block lg:w-80 flex-shrink-0">
              <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 sticky top-6">
                <FilterSidebar 
                  filters={filters} 
                  onFilterChange={handleFilterChange} 
                />
              </div>
            </aside>

            {/* Products Grid */}
            <div className="flex-1">
              <ProductGrid 
                products={products || []}
                isLoading={isLoading}
                error={error}
                onAddToComparison={addToComparison}
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