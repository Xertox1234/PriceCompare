import { useState, useMemo } from 'react';
import { useSearch } from 'wouter';
import {
  ChevronRight,
  ChevronDown,
  Star,
  X,
  SlidersHorizontal,
  Grid3X3,
  LayoutList,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { Link } from 'wouter';
import { TemplateHeader } from '@/components/template/header';
import { TemplateFooter } from '@/components/template/footer';
import { ProductCard, type ProductData } from '@/components/template/TemplateProductCard';
import {
  MobileMenu,
  CompareModal,
  SearchModal,
  QuickviewModal,
} from '@/components/template/modals';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { ShopProvider, useShop } from '@/context/shop-context';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/use-products';
import { transformProduct } from '@/hooks/use-home-data';
import { categories } from '@/data/template-data';
import { useToast } from '@/hooks/use-toast';
import { useAddProductToWatchList, useWatchLists } from '@/hooks/use-community';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const { toast } = useToast();
  const {
    toggleWishlist,
    isInWishlist,
    toggleCompare,
    openCart,
    isCartOpen: _isCartOpen,
    closeCart: _closeCart,
  } = useShop();

  const { data: watchlistsData } = useWatchLists();
  const watchlists = watchlistsData ?? [];
  const addToWatchList = useAddProductToWatchList();
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

  // Bulk watchlist add state
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false);
  const [bulkTargetWatchlistId, setBulkTargetWatchlistId] = useState('');

  // Custom price range
  const [customMinPrice, setCustomMinPrice] = useState('');
  const [customMaxPrice, setCustomMaxPrice] = useState('');

  // Build API search filters
  const apiFilters = useMemo(
    () => ({
      query: initialSearch || undefined,
      category: filters.category || undefined,
      minPrice: filters.priceRange?.min,
      maxPrice: filters.priceRange?.max === Infinity ? undefined : filters.priceRange?.max,
      minRating: filters.rating || undefined,
      sortBy:
        sortBy !== 'default'
          ? (sortBy as 'price_low' | 'price_high' | 'rating' | 'popularity')
          : undefined,
    }),
    [initialSearch, filters.category, filters.priceRange, filters.rating, sortBy]
  );

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

  const toggleProductSelection = (productId: number, checked: boolean) => {
    setSelectedProductIds((prev) => {
      if (checked) {
        return prev.includes(productId) ? prev : [...prev, productId];
      }
      return prev.filter((id) => id !== productId);
    });
  };

  const clearBulkSelection = () => {
    setSelectedProductIds([]);
    setBulkTargetWatchlistId('');
  };

  const handleBulkAddToWatchlist = async () => {
    if (selectedProductIds.length === 0) return;

    if (!bulkTargetWatchlistId) {
      toast({
        title: 'Error',
        description: 'Please select a watchlist',
        variant: 'destructive',
      });
      return;
    }

    const listId = parseInt(bulkTargetWatchlistId, 10);
    if (!Number.isFinite(listId) || listId < 1) {
      toast({
        title: 'Error',
        description: 'Invalid watchlist selection',
        variant: 'destructive',
      });
      return;
    }

    const results = await Promise.allSettled(
      selectedProductIds.map((productId) => addToWatchList.mutateAsync({ listId, productId }))
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    if (successCount > 0) {
      toast({
        title: 'Success',
        description: `Added ${successCount} ${successCount === 1 ? 'item' : 'items'} to watchlist`,
      });
    }

    if (failureCount > 0) {
      toast({
        title: 'Some items failed',
        description: `${failureCount} ${failureCount === 1 ? 'item' : 'items'} could not be added`,
        variant: 'destructive',
      });
    }

    setBulkAddDialogOpen(false);
    clearBulkSelection();
  };

  // Filter Sidebar Component
  const FilterSidebar = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={cn('space-y-6', isMobile && 'pb-20')}>
      {/* Categories */}
      <div className="border-border border-b pb-6">
        <h6 className="text-foreground mb-4 font-semibold">Categories</h6>
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li key={cat.slug}>
              <button
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    category: prev.category === cat.slug ? null : cat.slug,
                  }))
                }
                className={cn(
                  'flex w-full items-center justify-between py-1.5 text-sm transition-colors',
                  filters.category === cat.slug
                    ? 'text-primary font-medium'
                    : 'text-foreground hover:text-primary'
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
      <div className="border-border border-b pb-6">
        <h6 className="text-foreground mb-4 font-semibold">Brand</h6>
        <div className="space-y-2">
          {brands.map((brand) => (
            <label key={brand.id} className="group flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={filters.brands.includes(brand.label)}
                onChange={() => toggleBrand(brand.label)}
                className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
              />
              <span className="text-foreground group-hover:text-primary text-sm transition-colors">
                {brand.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="border-border border-b pb-6">
        <h6 className="text-foreground mb-4 font-semibold">Price</h6>
        <div className="space-y-2">
          {priceRanges.map((range, idx) => (
            <label key={idx} className="group flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="priceRange"
                checked={
                  filters.priceRange?.min === range.min && filters.priceRange?.max === range.max
                }
                onChange={() => setFilters((prev) => ({ ...prev, priceRange: range }))}
                className="border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-foreground group-hover:text-primary text-sm transition-colors">
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
            className="border-border bg-background focus:ring-primary w-20 rounded-lg border px-2 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="number"
            placeholder="$ Max"
            value={customMaxPrice}
            onChange={(e) => setCustomMaxPrice(e.target.value)}
            className="border-border bg-background focus:ring-primary w-20 rounded-lg border px-2 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
          <button
            type="submit"
            className="bg-primary hover:bg-primary-hover rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      {/* Customer Rating */}
      <div className="border-border border-b pb-6">
        <h6 className="text-foreground mb-4 font-semibold">Customer Rating</h6>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <label key={rating} className="group flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="rating"
                checked={filters.rating === rating}
                onChange={() =>
                  setFilters((prev) => ({
                    ...prev,
                    rating: prev.rating === rating ? null : rating,
                  }))
                }
                className="border-border text-primary focus:ring-primary h-4 w-4"
              />
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-4 w-4',
                      i < rating ? 'fill-warning text-warning' : 'text-muted'
                    )}
                  />
                ))}
                {rating < 5 && <span className="text-muted-foreground ml-1 text-sm">& Up</span>}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Deals & Discounts */}
      <div className="border-border border-b pb-6">
        <h6 className="text-foreground mb-4 font-semibold">Deals & Discounts</h6>
        <div className="space-y-2">
          <label className="group flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="deals"
              checked={filters.deals === 'discounts'}
              onChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  deals: prev.deals === 'discounts' ? null : 'discounts',
                }))
              }
              className="border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="text-foreground group-hover:text-primary text-sm transition-colors">
              All Discounts
            </span>
          </label>
          <label className="group flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="deals"
              checked={filters.deals === 'today'}
              onChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  deals: prev.deals === 'today' ? null : 'today',
                }))
              }
              className="border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="text-foreground group-hover:text-primary text-sm transition-colors">
              Today's Deals
            </span>
          </label>
        </div>
      </div>

      {/* Condition */}
      <div>
        <h6 className="text-foreground mb-4 font-semibold">Condition</h6>
        <div className="space-y-2">
          <label className="group flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="condition"
              checked={filters.condition === 'new'}
              onChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  condition: prev.condition === 'new' ? null : 'new',
                }))
              }
              className="border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="text-foreground group-hover:text-primary text-sm transition-colors">
              New
            </span>
          </label>
          <label className="group flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="condition"
              checked={filters.condition === 'used'}
              onChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  condition: prev.condition === 'used' ? null : 'used',
                }))
              }
              className="border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="text-foreground group-hover:text-primary text-sm transition-colors">
              Used
            </span>
          </label>
        </div>
      </div>

      {/* Mobile Reset Button */}
      {isMobile && hasActiveFilters && (
        <div className="bg-background border-border fixed right-0 bottom-0 left-0 border-t p-4">
          <button
            onClick={() => {
              clearAllFilters();
              setMobileFilterOpen(false);
            }}
            className="bg-primary hover:bg-primary-hover w-full rounded-xl py-3 font-medium text-white transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-background min-h-screen">
      <TemplateHeader
        onOpenCart={openCart}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCompare={() => setCompareOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Breadcrumbs */}
      <div className="border-border border-b py-4">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground font-medium">Products</span>
            {filters.category && (
              <>
                <ChevronRight className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground font-medium capitalize">{filters.category}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden w-72 flex-shrink-0 lg:block">
            <div className="sticky top-4">
              <FilterSidebar />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Controls Bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Mobile Filter Button */}
                <button
                  onClick={() => setMobileFilterOpen(true)}
                  className="border-border hover:bg-muted flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors lg:hidden"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="font-medium">Filter</span>
                  {hasActiveFilters && (
                    <span className="bg-primary rounded-full px-1.5 py-0.5 text-xs font-bold text-white">
                      {(filters.brands.length || 0) +
                        (filters.category ? 1 : 0) +
                        (filters.priceRange ? 1 : 0) +
                        (filters.rating ? 1 : 0) +
                        (filters.deals ? 1 : 0)}
                    </span>
                  )}
                </button>

                {/* Results count */}
                <p className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium">{products.length}</span> products
                  found
                  {initialSearch && (
                    <span>
                      {' '}
                      for "<span className="text-foreground font-medium">{initialSearch}</span>"
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* View mode toggle */}
                <div className="border-border hidden items-center overflow-hidden rounded-lg border sm:flex">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-2 transition-colors',
                      viewMode === 'grid' ? 'bg-primary text-white' : 'hover:bg-muted'
                    )}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'p-2 transition-colors',
                      viewMode === 'list' ? 'bg-primary text-white' : 'hover:bg-muted'
                    )}
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                </div>

                {/* Sort dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                    className="border-border hover:bg-muted flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors"
                  >
                    <span className="text-sm">
                      Sort:{' '}
                      <span className="font-medium">
                        {sortOptions.find((o) => o.value === sortBy)?.label}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        sortDropdownOpen && 'rotate-180'
                      )}
                    />
                  </button>
                  {sortDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setSortDropdownOpen(false)}
                      />
                      <div className="bg-card border-border absolute top-full right-0 z-20 mt-1 w-48 rounded-xl border py-1 shadow-lg">
                        {sortOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSortBy(option.value);
                              setSortDropdownOpen(false);
                            }}
                            className={cn(
                              'hover:bg-muted w-full px-4 py-2 text-left text-sm transition-colors',
                              sortBy === option.value && 'text-primary font-medium'
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
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">Active filters:</span>
                {filters.category && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, category: null }))}
                    className="bg-muted hover:bg-muted/80 flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors"
                  >
                    <span className="capitalize">{filters.category}</span>
                    <X className="h-3 w-3" />
                  </button>
                )}
                {filters.brands.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className="bg-muted hover:bg-muted/80 flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors"
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
                    className="bg-muted hover:bg-muted/80 flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors"
                  >
                    ${filters.priceRange.min} - $
                    {filters.priceRange.max === Infinity ? '∞' : filters.priceRange.max}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {filters.rating && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, rating: null }))}
                    className="bg-muted hover:bg-muted/80 flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors"
                  >
                    {filters.rating}+ Stars
                    <X className="h-3 w-3" />
                  </button>
                )}
                {filters.deals && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, deals: null }))}
                    className="bg-muted hover:bg-muted/80 flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors"
                  >
                    {filters.deals === 'discounts' ? 'All Discounts' : "Today's Deals"}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {filters.condition && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, condition: null }))}
                    className="bg-muted hover:bg-muted/80 flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors"
                  >
                    {filters.condition === 'new' ? 'New' : 'Used'}
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={clearAllFilters}
                  className="text-destructive flex items-center gap-1 px-3 py-1 text-sm hover:underline"
                >
                  Remove All
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Products Grid */}
            {selectedProductIds.length > 0 && (
              <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 backdrop-blur">
                <div className="text-sm">
                  <span className="font-medium">{selectedProductIds.length}</span> selected
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={clearBulkSelection}
                    aria-label="Clear selection"
                  >
                    Clear
                  </Button>
                  <Button
                    data-testid="bulk-add-to-watchlist"
                    onClick={() => setBulkAddDialogOpen(true)}
                  >
                    Add to Watchlist
                  </Button>
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <span className="text-muted-foreground ml-2">Loading products...</span>
              </div>
            ) : error ? (
              <div className="py-16 text-center">
                <p className="text-destructive mb-2 text-lg font-medium">Error loading products</p>
                <p className="text-muted-foreground">Please try again later</p>
              </div>
            ) : products.length > 0 ? (
              <div
                className={cn(
                  'grid gap-4',
                  viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'
                )}
              >
                {products.map((product) => (
                  <div key={product.id} className="relative">
                    <div className="bg-background/80 absolute top-2 left-2 z-20 rounded p-1 backdrop-blur">
                      <Checkbox
                        data-testid={`product-checkbox-${product.id}`}
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={(checked) =>
                          toggleProductSelection(product.id, checked === true)
                        }
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${product.name}`}
                      />
                    </div>
                    <ProductCard
                      product={product}
                      variant={viewMode === 'list' ? 'horizontal' : 'default'}
                      onWatchlist={() => handleWatchlist(product)}
                      onCompare={() => handleCompare(product)}
                      onQuickView={() => handleQuickView(product)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-foreground mb-2 text-lg font-medium">No products found</p>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your filters or search terms
                </p>
                <button
                  onClick={clearAllFilters}
                  className="bg-primary hover:bg-primary-hover rounded-xl px-6 py-3 font-medium text-white transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Pagination */}
            {products.length > 0 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  className="border-border hover:bg-muted rounded-lg border p-2 transition-colors disabled:opacity-50"
                  disabled
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button className="bg-primary h-10 w-10 rounded-lg font-medium text-white">
                  1
                </button>
                <button className="border-border hover:bg-muted h-10 w-10 rounded-lg border font-medium transition-colors">
                  2
                </button>
                <button className="border-border hover:bg-muted h-10 w-10 rounded-lg border font-medium transition-colors">
                  3
                </button>
                <span className="text-muted-foreground px-2">...</span>
                <button className="border-border hover:bg-muted h-10 w-10 rounded-lg border font-medium transition-colors">
                  10
                </button>
                <button className="border-border hover:bg-muted rounded-lg border p-2 transition-colors">
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
          'fixed inset-0 z-50 bg-black/70 transition-opacity lg:hidden',
          mobileFilterOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setMobileFilterOpen(false)}
      />
      <div
        className={cn(
          'bg-background fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] overflow-y-auto transition-transform lg:hidden',
          mobileFilterOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="border-border bg-background sticky top-0 flex items-center justify-between border-b p-4">
          <h5 className="text-lg font-semibold">Filter</h5>
          <button
            onClick={() => setMobileFilterOpen(false)}
            className="hover:bg-muted rounded-full p-2 transition-colors"
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

      {/* Bulk Add to Watchlist Dialog */}
      <Dialog open={bulkAddDialogOpen} onOpenChange={setBulkAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Watchlist</DialogTitle>
            <DialogDescription>
              Select a watchlist to add the selected products to
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-watchlist-select">Select watchlist</Label>
              <Select value={bulkTargetWatchlistId} onValueChange={setBulkTargetWatchlistId}>
                <SelectTrigger id="bulk-watchlist-select">
                  <SelectValue placeholder="Choose a watchlist" />
                </SelectTrigger>
                <SelectContent>
                  {watchlists.map((watchlist) => (
                    <SelectItem key={watchlist.id} value={watchlist.id.toString()}>
                      {watchlist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleBulkAddToWatchlist()}
              disabled={addToWatchList.isPending}
            >
              {addToWatchList.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
