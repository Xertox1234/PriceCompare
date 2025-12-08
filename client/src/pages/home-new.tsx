import { useState } from 'react';
import {
  TemplateHeader,
  HeroGrid,
  FeaturesBar,
  ProductSection,
  DealOfTheDaySection,
  TrendingNow,
  CategoryGrid,
  BannerGrid,
  NewsletterBanner,
  TemplateFooter,
  FeaturedProductTabs,
  CategoryCarousel,
  GroupedProductCarousel,
  RecentlyViewed,
  DualBannerCarousel,
  defaultDualBanners,
  type ProductData,
} from '@/components/template';
import {
  CartModal,
  QuickviewModal,
  CompareModal,
  MobileMenu,
  SearchModal,
} from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { useHomePageData } from '@/hooks/use-home-data';
import { Loader2 } from 'lucide-react';

// Static categories for now (could be fetched from API later)
const categories = [
  { slug: 'laptops', name: 'Laptops', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop', productCount: 0 },
  { slug: 'smartphones', name: 'Smartphones', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop', productCount: 0 },
  { slug: 'tablets', name: 'Tablets', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&fit=crop', productCount: 0 },
  { slug: 'headphones', name: 'Headphones', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', productCount: 0 },
  { slug: 'cameras', name: 'Cameras', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=400&fit=crop', productCount: 0 },
  { slug: 'gaming', name: 'Gaming', image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=400&fit=crop', productCount: 0 },
];

function HomeNewContent() {
  const { toggleWishlist, isInWishlist, toggleCompare, addSimpleToCart } = useShop();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickviewProduct, setQuickviewProduct] = useState<ProductData | null>(null);

  // Fetch real data from API
  const { products, isLoading, error: _error } = useHomePageData();

  // Add watchlist status to products
  const addWatchlistStatus = (productList: typeof products.all) =>
    productList.map((p) => ({ ...p, inWatchlist: isInWishlist(p.id) }));

  const dealProducts = addWatchlistStatus(products.deals);
  const bestSellers = addWatchlistStatus(products.bestSellers);
  const newArrivals = addWatchlistStatus(products.newArrivals);
  const trending = addWatchlistStatus(products.trending);
  const laptops = addWatchlistStatus(products.laptops);
  const smartHome = addWatchlistStatus(products.smartphones); // Use smartphones as smart home for now
  const allProductsData = addWatchlistStatus(products.all);

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

  const categoryData = categories.map((c) => ({
    id: c.slug,
    name: c.name,
    image: c.image,
    productCount: c.productCount,
    link: `/shop?category=${c.slug}`,
  }));

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <TemplateHeader
          onOpenCart={() => setCartOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenCompare={() => setCompareOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <span className="text-muted-foreground ml-2">Loading products...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <TemplateHeader
        onOpenCart={() => setCartOpen(true)}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCompare={() => setCompareOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Main Content */}
      <main>
        {/* Hero Grid */}
        <HeroGrid />

        {/* Features Bar */}
        <FeaturesBar />

        {/* Deal of the Day - only show if we have deals */}
        {dealProducts.length > 0 && (
          <DealOfTheDaySection
            featuredProduct={dealProducts[0]}
            sideProducts={dealProducts.slice(1)}
            onWatchlist={handleWatchlist}
            onCompare={handleCompare}
            onQuickView={handleQuickView}
            onAddToCart={(product) => {
              addSimpleToCart({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1,
              });
              setCartOpen(true);
            }}
          />
        )}

        {/* Category Grid */}
        <CategoryGrid categories={categoryData} />

        {/* Promotional Banners */}
        <BannerGrid />

        {/* Featured Product Tabs (Feature/Top Rated/On Sale) */}
        <FeaturedProductTabs
          products={allProductsData}
          onWatchlist={handleWatchlist}
          onCompare={handleCompare}
        />

        {/* Laptops & Computers Carousel */}
        <CategoryCarousel
          title="Laptops, Computers & Tablets"
          products={[
            ...laptops,
            ...bestSellers.filter(
              (p) =>
                p.category?.toLowerCase().includes('laptop') ||
                p.category?.toLowerCase().includes('tablet')
            ),
          ]}
          onWatchlist={handleWatchlist}
          onCompare={handleCompare}
        />

        {/* Dual Banner Carousel */}
        <DualBannerCarousel banners={defaultDualBanners} />

        {/* Smart Home Appliances (Grouped Layout) */}
        <GroupedProductCarousel
          title="Smart Home Appliances"
          products={smartHome}
          onWatchlist={handleWatchlist}
          onCompare={handleCompare}
          onAddToCart={(product) => {
            addSimpleToCart({
              id: product.id,
              name: product.name,
              price: product.price,
              image: product.image,
              quantity: 1,
            });
            setCartOpen(true);
          }}
        />

        {/* Best Sellers */}
        <ProductSection
          title="Best Sellers"
          subtitle="Top-rated products across all categories"
          products={bestSellers}
          columns={4}
          seeAllLink="/shop?sort=bestselling"
          seeAllText="View All Best Sellers"
          onWatchlist={handleWatchlist}
          onCompare={handleCompare}
        />

        {/* New Arrivals */}
        <ProductSection
          title="New Arrivals"
          subtitle="Fresh products just added"
          products={newArrivals}
          columns={4}
          seeAllLink="/shop?sort=newest"
          seeAllText="View All New Arrivals"
          onWatchlist={handleWatchlist}
          onCompare={handleCompare}
        />

        {/* Trending Now */}
        <TrendingNow products={trending} onWatchlist={handleWatchlist} />

        {/* Recently Viewed (only shows if user has viewed products) */}
        <RecentlyViewed
          allProducts={allProductsData}
          onWatchlist={handleWatchlist}
          onCompare={handleCompare}
        />

        {/* Newsletter */}
        <NewsletterBanner />
      </main>

      {/* Footer */}
      <TemplateFooter />

      {/* Modals */}
      <CartModal isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <CompareModal isOpen={compareOpen} onClose={() => setCompareOpen(false)} />
      <QuickviewModal
        isOpen={!!quickviewProduct}
        onClose={() => setQuickviewProduct(null)}
        product={quickviewProduct}
      />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

/**
 * New Homepage - Home 5 Template Style
 *
 * Features:
 * - Hero grid with featured product and deal cards
 * - Features bar highlighting key benefits
 * - Deal of the Day with countdown
 * - Category browsing carousel
 * - Promotional banners
 * - Featured Product Tabs (Feature/Top Rated/On Sale)
 * - Category-specific carousels (Laptops, Smart Home)
 * - Dual banner carousel
 * - Grouped product carousel
 * - Best Sellers & New Arrivals sections
 * - Trending Now carousel
 * - Recently Viewed (localStorage persistence)
 * - Newsletter signup
 *
 * Supports: Light mode, Dark mode, High Contrast mode
 */
export default function HomeNew() {
  return (
    <ShopProvider>
      <HomeNewContent />
    </ShopProvider>
  );
}
