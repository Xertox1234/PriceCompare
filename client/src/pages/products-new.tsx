import { useState, useMemo } from 'react';
import { useSearch } from 'wouter';
import { ChevronRight, ChevronDown, Star, X, SlidersHorizontal, Grid3X3, LayoutList, ChevronLeft, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { TemplateHeader } from '@/components/template/header';
import { TemplateFooter } from '@/components/template/footer';
import { ProductCard, type ProductData } from '@/components/template/product-card';
import { MobileMenu, CompareModal, SearchModal, QuickviewModal } from '@/components/template/modals';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { ShopProvider, useShop } from '@/context/shop-context';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/use-products';
import { transformProduct } from '@/hooks/use-home-data';
import { categories } from '@/data/template-data';

// Filter options
const brands = [
  { id: 1, label: 'Apple' },
  { id: 2, label: 'Samsung' },
  { id: 3, label: 'Sony' },
  { id: 4, label: 'Bose' },
  { id: 5, label: 'LG' },
  { id: 6, label: 'Dell' },
];

const priceRanges = [
  { label: 'Under $100', min: 0, max: 99 },
  { label: '$100 to $300', min: 100, max: 300 },
  { label: '$300 to $500', min: 300, max: 500 },
  { label: '$500 & Above', min: 500, max: Infinity },
];

const sortOptions = [
  { value: 'default', label: 'Default' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Customer Rating' },
  { value: 'popularity', label: 'Most Popular' },
];

interface Filters {
  category: string | null;
  brands: string[];
  priceRange: { min: number; max: number } | null;
  rating: number | null;
  deals: 'all' | 'discounts' | 'today' | null;
  condition: 'new' | 'used' | null;
}

function ProductsContent() {
  const { toggleWishlist, isInWishlist, toggleCompare, openCart, isCartOpen: _isCartOpen, closeCart: _closeCart } = useShop();
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const initialCategory = urlParams.get('category');
  const initialSearch = urlParams.get('search');

  // Modal states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickviewProduct, setQuickviewProduct] = useState<ProductData | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Filter states
  const [filters, setFilters] = useState<Filters>({
    category: initialCategory,
    brands: [],
    priceRange: null,
    rating: null,
    deals: null,
    condition: null,
  });
  const [sortBy, setSortBy] = useState('default');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Custom price range
  const [customMinPrice, setCustomMinPrice] = useState('');
  const [customMaxPrice, setCustomMaxPrice] = useState('');

  // Build API search filters
  const apiFilters = useMemo(() => ({
    query: initialSearch || undefined,
    category: filters.category || undefined,
    minPrice: filters.priceRange?.min,
    maxPrice: filters.priceRange?.max === Infinity ? undefined : filters.priceRange?.max,
    minRating: filters.rating || undefined,
    sortBy: sortBy !== 'default' ? sortBy as 'price_low' | 'price_high' | 'rating' | 'popularity' : undefined,
  }), [initialSearch, filters.category, filters.priceRange, filters.rating, sortBy]);

  // Fetch products from API
  const { data: productsData, isLoading, error } = useProducts(apiFilters);

  // Transform API products to ProductData format
  const filteredProducts = useMemo(() => {
    if (!productsData) return [];

    let result = productsData.map(transformProduct);

    // Apply client-side brand filter (not available in API)
    if (filters.brands.length > 0) {
      result = result.filter((p) => p.retailer && filters.brands.includes(p.retailer));
    }

    // Apply deals filter client-side
    if (filters.deals === 'discounts') {
      result = result.filter((p) => p.originalPrice && p.originalPrice > p.price);
    }

    return result;
  }, [productsData, filters.brands, filters.deals]);

  // Add watchlist status to products
  const products = filteredProducts.map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  // Check if any filters are active
  const hasActiveFilters =
    filters.category ||
    filters.brands.length > 0 ||
    filters.priceRange ||
    filters.rating ||
    filters.deals ||
    filters.condition;

  const clearAllFilters = () => {
    setFilters({
      category: null,
      brands: [],
      priceRange: null,
      rating: null,
      deals: null,
      condition: null,
    });
    setCustomMinPrice('');
    setCustomMaxPrice('');
  };

  const toggleBrand = (brand: string) => {
    setFilters((prev) => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter((b) => b !== brand)
        : [...prev.brands, brand],
    }));
  };

  const handleCustomPriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const min = customMinPrice ? parseFloat(customMinPrice) : 0;
    const max = customMaxPrice ? parseFloat(customMaxPrice) : Infinity;
    if (min <= max) {
      setFilters((prev) => ({ ...prev, priceRange: { min, max } }));
    }
  };

  const handleWatchlist = (product: { id: number }) => {
    toggleWishlist(product.id);
  };

  const handleCompare = (product: { id: number }) => {
    toggleCompare(product.id);
    setCompareOpen(true);
  };

  const handleQuickView = (product: ProductData) => {
    setQuickviewProduct(product);
  };

  // Filter Sidebar Component
  const FilterSidebar = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={cn("space-y-6", isMobile && "pb-20")}>
      {/* Categories */}
      <div className="border-b border-border pb-6">
        <h6 className="font-semibold text-foreground mb-4">Categories</h6>
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li key={cat.slug}>
              <button
                onClick={() => setFilters((prev) => ({
                  ...prev,
                  category: prev.category === cat.slug ? null : cat.slug
                }))}
                className={cn(
                  "w-full flex items-center justify-between py-1.5 text-sm transition-colors",
                  filters.category === cat.slug
                    ? "text-primary font-medium"
                    : "text-foreground hover:text-primary"
                )}
              >
                <span>{cat.name}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Brands */}
      <div className="border-b border-border pb-6">
        <h6 className="font-semibold text-foreground mb-4">Brand</h6>
        <div className="space-y-2">
          {brands.map((brand) => (
            <label
              key={brand.id}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={filters.brands.includes(brand.label)}
                onChange={() => toggleBrand(brand.label)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                {brand.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="border-b border-border pb-6">
        <h6 className="font-semibold text-foreground mb-4">Price</h6>
        <div className="space-y-2">
          {priceRanges.map((range, idx) => (
            <label
              key={idx}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="radio"
                name="priceRange"
                checked={
                  filters.priceRange?.min === range.min &&
                  filters.priceRange?.max === range.max
                }
                onChange={() => setFilters((prev) => ({ ...prev, priceRange: range }))}
                className="w-4 h-4 border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                {range.label}
              </span>
            </label>
          ))}
        </div>
        {/* Custom price range */}
        <form onSubmit={handleCustomPriceSubmit} className="mt-4 flex items-center gap-2">
          <input
            type="number"
            placeholder="$ Min"
            value={customMinPrice}
            onChange={(e) => setCustomMinPrice(e.target.value)}
            className="w-20 px-2 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="number"
            placeholder="$ Max"
            value={customMaxPrice}
            onChange={(e) => setCustomMaxPrice(e.target.value)}
            className="w-20 px-2 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      {/* Customer Rating */}
      <div className="border-b border-border pb-6">
        <h6 className="font-semibold text-foreground mb-4">Customer Rating</h6>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <label
              key={rating}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="radio"
                name="rating"
                checked={filters.rating === rating}
                onChange={() => setFilters((prev) => ({
                  ...prev,
                  rating: prev.rating === rating ? null : rating
                }))}
                className="w-4 h-4 border-border text-primary focus:ring-primary"
              />
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < rating ? "fill-warning text-warning" : "text-muted"
                    )}
                  />
                ))}
                {rating < 5 && <span className="text-sm text-muted-foreground ml-1">& Up</span>}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Deals & Discounts */}
      <div className="border-b border-border pb-6">
        <h6 className="font-semibold text-foreground mb-4">Deals & Discounts</h6>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="deals"
              checked={filters.deals === 'discounts'}
              onChange={() => setFilters((prev) => ({
                ...prev,
                deals: prev.deals === 'discounts' ? null : 'discounts'
              }))}
              className="w-4 h-4 border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground group-hover:text-primary transition-colors">
              All Discounts
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="deals"
              checked={filters.deals === 'today'}
              onChange={() => setFilters((prev) => ({
                ...prev,
                deals: prev.deals === 'today' ? null : 'today'
              }))}
              className="w-4 h-4 border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground group-hover:text-primary transition-colors">
              Today's Deals
            </span>
          </label>
        </div>
      </div>

      {/* Condition */}
      <div>
        <h6 className="font-semibold text-foreground mb-4">Condition</h6>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="condition"
              checked={filters.condition === 'new'}
              onChange={() => setFilters((prev) => ({
                ...prev,
                condition: prev.condition === 'new' ? null : 'new'
              }))}
              className="w-4 h-4 border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground group-hover:text-primary transition-colors">
              New
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="condition"
              checked={filters.condition === 'used'}
              onChange={() => setFilters((prev) => ({
                ...prev,
                condition: prev.condition === 'used' ? null : 'used'
              }))}
              className="w-4 h-4 border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground group-hover:text-primary transition-colors">
              Used
            </span>
          </label>
        </div>
      </div>

      {/* Mobile Reset Button */}
      {isMobile && hasActiveFilters && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
          <button
            onClick={() => {
              clearAllFilters();
              setMobileFilterOpen(false);
            }}
            className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-hover transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <TemplateHeader
        onOpenCart={openCart}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCompare={() => setCompareOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Breadcrumbs */}
      <div className="border-b border-border py-4">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground font-medium">Products</span>
            {filters.category && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground font-medium capitalize">{filters.category}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-4">
              <FilterSidebar />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                {/* Mobile Filter Button */}
                <button
                  onClick={() => setMobileFilterOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="font-medium">Filter</span>
                  {hasActiveFilters && (
                    <span className="bg-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {(filters.brands.length || 0) + (filters.category ? 1 : 0) + (filters.priceRange ? 1 : 0) + (filters.rating ? 1 : 0) + (filters.deals ? 1 : 0)}
                    </span>
                  )}
                </button>

                {/* Results count */}
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{products.length}</span> products found
                  {initialSearch && (
                    <span> for "<span className="font-medium text-foreground">{initialSearch}</span>"</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* View mode toggle */}
                <div className="hidden sm:flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === 'grid' ? "bg-primary text-white" : "hover:bg-muted"
                    )}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === 'list' ? "bg-primary text-white" : "hover:bg-muted"
                    )}
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                </div>

                {/* Sort dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="text-sm">
                      Sort: <span className="font-medium">{sortOptions.find(o => o.value === sortBy)?.label}</span>
                    </span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", sortDropdownOpen && "rotate-180")} />
                  </button>
                  {sortDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSortDropdownOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-20 py-1">
                        {sortOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSortBy(option.value);
                              setSortDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors",
                              sortBy === option.value && "text-primary font-medium"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {filters.category && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, category: null }))}
                    className="flex items-center gap-1 px-3 py-1 bg-muted text-sm rounded-full hover:bg-muted/80 transition-colors"
                  >
                    <span className="capitalize">{filters.category}</span>
                    <X className="h-3 w-3" />
                  </button>
                )}
                {filters.brands.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className="flex items-center gap-1 px-3 py-1 bg-muted text-sm rounded-full hover:bg-muted/80 transition-colors"
                  >
                    {brand}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                {filters.priceRange && (
                  <button
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, priceRange: null }));
                      setCustomMinPrice('');
                      setCustomMaxPrice('');
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-muted text-sm rounded-full hover:bg-muted/80 transition-colors"
                  >
                    ${filters.priceRange.min} - ${filters.priceRange.max === Infinity ? '∞' : filters.priceRange.max}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {filters.rating && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, rating: null }))}
                    className="flex items-center gap-1 px-3 py-1 bg-muted text-sm rounded-full hover:bg-muted/80 transition-colors"
                  >
                    {filters.rating}+ Stars
                    <X className="h-3 w-3" />
                  </button>
                )}
                {filters.deals && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, deals: null }))}
                    className="flex items-center gap-1 px-3 py-1 bg-muted text-sm rounded-full hover:bg-muted/80 transition-colors"
                  >
                    {filters.deals === 'discounts' ? 'All Discounts' : "Today's Deals"}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {filters.condition && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, condition: null }))}
                    className="flex items-center gap-1 px-3 py-1 bg-muted text-sm rounded-full hover:bg-muted/80 transition-colors"
                  >
                    {filters.condition === 'new' ? 'New' : 'Used'}
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-destructive hover:underline"
                >
                  Remove All
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Products Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading products...</span>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <p className="text-lg font-medium text-destructive mb-2">Error loading products</p>
                <p className="text-muted-foreground">Please try again later</p>
              </div>
            ) : products.length > 0 ? (
              <div
                className={cn(
                  "grid gap-4",
                  viewMode === 'grid'
                    ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                    : "grid-cols-1"
                )}
              >
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    variant={viewMode === 'list' ? 'horizontal' : 'default'}
                    onWatchlist={() => handleWatchlist(product)}
                    onCompare={() => handleCompare(product)}
                    onQuickView={() => handleQuickView(product)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-lg font-medium text-foreground mb-2">No products found</p>
                <p className="text-muted-foreground mb-6">Try adjusting your filters or search terms</p>
                <button
                  onClick={clearAllFilters}
                  className="px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-hover transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Pagination */}
            {products.length > 0 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button className="p-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50" disabled>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button className="w-10 h-10 bg-primary text-white font-medium rounded-lg">1</button>
                <button className="w-10 h-10 border border-border rounded-lg hover:bg-muted transition-colors font-medium">2</button>
                <button className="w-10 h-10 border border-border rounded-lg hover:bg-muted transition-colors font-medium">3</button>
                <span className="px-2 text-muted-foreground">...</span>
                <button className="w-10 h-10 border border-border rounded-lg hover:bg-muted transition-colors font-medium">10</button>
                <button className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <TemplateFooter />

      {/* Mobile Filter Drawer */}
      <div
        className={cn(
          "fixed inset-0 bg-black/70 z-50 lg:hidden transition-opacity",
          mobileFilterOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileFilterOpen(false)}
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-background z-50 lg:hidden transition-transform overflow-y-auto",
          mobileFilterOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-border bg-background">
          <h5 className="font-semibold text-lg">Filter</h5>
          <button
            onClick={() => setMobileFilterOpen(false)}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <FilterSidebar isMobile />
        </div>
      </div>

      {/* Modals */}
      <CartSidebar />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <CompareModal isOpen={compareOpen} onClose={() => setCompareOpen(false)} />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickviewModal
        isOpen={!!quickviewProduct}
        onClose={() => setQuickviewProduct(null)}
        product={quickviewProduct}
      />
    </div>
  );
}

export default function ProductsNew() {
  return (
    <ShopProvider>
      <ProductsContent />
    </ShopProvider>
  );
}
