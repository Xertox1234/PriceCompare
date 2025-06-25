import { useState } from "react";
import { SearchHeader } from "@/components/search-header";
import { FilterSidebar } from "@/components/filter-sidebar";
import { ProductGrid } from "@/components/product-grid";
import { ComparisonModal } from "@/components/comparison-modal";
import { HeroSection } from "@/components/hero-section";
import { FeaturedCategories } from "@/components/featured-categories";
import { useProducts } from "@/hooks/use-products";
import { useComparison } from "@/hooks/use-comparison";
import { SearchFilters } from "@shared/schema";

export default function Home() {
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

  const bestDeal = products && products.length > 0 ? 
    products.reduce((best, product) => 
      (product.bestPrice || 0) < (best.bestPrice || Infinity) ? product : best
    ) : null;

  // Show hero and categories only when no search is active
  const showHeroSection = !searchQuery;

  return (
    <>
      <SearchHeader 
        onSearch={handleSearch}
        searchQuery={searchQuery}
      />
      
      {/* Hero Section - Only show when not searching */}
      {showHeroSection && <HeroSection />}
      
      {/* Featured Categories - Only show when not searching */}
      {showHeroSection && <FeaturedCategories />}
      
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main">
        {/* Search Results Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {searchQuery ? `"${searchQuery}" - Price Comparison` : "Featured Products - Price Comparison"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {products ? products.length : 0} results found across multiple retailers
              </p>
            </div>
            
            {/* Sort Options */}
            <div className="flex items-center space-x-4">
              <label htmlFor="sort-select" className="text-sm font-medium text-foreground">
                Sort by:
              </label>
              <select 
                id="sort-select" 
                className="border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-background"
                value={filters.sortBy || "popularity"}
                onChange={(e) => handleFilterChange({ sortBy: e.target.value as SearchFilters["sortBy"] })}
                aria-label="Sort products by"
              >
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="rating">Customer Rating</option>
                <option value="popularity">Most Popular</option>
              </select>
            </div>
          </div>
        </div>

        {/* Best Deal Banner */}
        {bestDeal && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-4 mb-6" role="region" aria-label="Best deal highlight">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-foreground">Best Deal</h2>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="deal-badge best-price">Lowest Price</span>
                  <span className="price-highlight">${bestDeal.bestPrice}</span>
                  {bestDeal.savings && (
                    <>
                      <span className="price-original">${(bestDeal.bestPrice! + bestDeal.savings).toFixed(2)}</span>
                      <span className="price-savings">Save ${bestDeal.savings.toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>
              <button 
                className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 focus-visible transition-colors"
                onClick={() => window.open(bestDeal.offers[0]?.productUrl, '_blank')}
              >
                View Deal
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <FilterSidebar 
            filters={filters}
            onFilterChange={handleFilterChange}
          />
          
          <ProductGrid 
            products={products || []}
            isLoading={isLoading}
            error={error}
            onAddToComparison={addToComparison}
          />
        </div>
      </main>

      <ComparisonModal 
        items={comparisonItems}
        onRemoveItem={removeFromComparison}
        onClear={clearComparison}
      />

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <h2 className="text-xl font-bold text-primary mb-4">
                📊 Insightify
              </h2>
              <p className="text-muted-foreground mb-4">
                Your go-to platform for real-time price comparison, intelligent product tracking, and insightful price trend analysis. Save money and make informed purchasing decisions.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Features</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-primary focus:outline-none focus:underline">Price Comparison</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary focus:outline-none focus:underline">Price Alerts</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary focus:outline-none focus:underline">Product Tracking</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary focus:outline-none focus:underline">Price History</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-primary focus:outline-none focus:underline">Help Center</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary focus:outline-none focus:underline">Contact Us</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary focus:outline-none focus:underline">Privacy Policy</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary focus:outline-none focus:underline">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © 2024 Insightify. All rights reserved. Built with ❤️ for smart shoppers.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
