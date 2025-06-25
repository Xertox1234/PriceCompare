import { useState } from "react";
import { SearchHeader } from "@/components/search-header";
import { FilterSidebar } from "@/components/filter-sidebar";
import { ProductGrid } from "@/components/product-grid";
import { ComparisonModal } from "@/components/comparison-modal";
import { useProducts } from "@/hooks/use-products";
import { useComparison } from "@/hooks/use-comparison";
import { SearchFilters } from "@shared/schema";

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: "popularity"
  });
  
  const { data: products, isLoading, error } = useProducts(filters);
  const { comparisonItems, addToComparison, removeFromComparison, clearComparison } = useComparison();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFilters(prev => ({ ...prev, query }));
  };

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <>
      <SearchHeader 
        onSearch={handleSearch}
        searchQuery={searchQuery}
      />
      
      {/* Products Section */}
      <main className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          {/* Search Results Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-gray-900">
                  {searchQuery ? `Results for "${searchQuery}"` : "Featured Products"}
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  {products ? products.length : 0} products found across multiple retailers
                </p>
              </div>
              
              {/* Sort Options */}
              <div className="flex items-center space-x-4">
                <label htmlFor="sort-select" className="text-sm font-semibold text-gray-700">
                  Sort by:
                </label>
                <select 
                  id="sort-select" 
                  className="border border-gray-300 rounded-xl px-4 py-2 text-sm bg-white shadow-sm"
                  style={{
                    outline: 'none',
                    transition: 'all 200ms ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
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

          {/* Main Content Grid */}
          <div className="flex flex-col lg:flex-row gap-8">
            
            {/* Filters Sidebar */}
            <aside className="lg:w-80 flex-shrink-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Filters</h2>
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