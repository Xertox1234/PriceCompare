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
import { CartModal, QuickviewModal, CompareModal, MobileMenu, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import {
  dealOfTheDayProducts,
  bestSellerProducts,
  newArrivalsProducts,
  trendingProducts,
  laptopsProducts,
  smartHomeProducts,
  allProducts,
  categories,
  type TemplateProduct,
} from '@/data/template-data';

// Convert template products to ProductData format for ProductCard
function toProductData(products: TemplateProduct[]) {
  return products.map((p) => ({
    id: p.id,
    name: p.title,
    category: p.category,
    price: p.price,
    originalPrice: p.oldPrice,
    image: p.imgSrc,
    hoverImage: p.imgHover,
    rating: p.rating,
    reviewCount: p.reviewCount,
    priceChange: p.salePercentage ? ('down' as const) : ('stable' as const),
    priceChangePercent: p.salePercentage ? parseInt(p.salePercentage) : undefined,
    retailer: p.brand,
    discount: p.salePercentage ? parseInt(p.salePercentage) : undefined,
    // Deal specific
    countdownTimer: p.countdownTimer,
    sold: p.sold,
    available: p.available,
  }));
}

function HomeNewContent() {
  const { toggleWishlist, isInWishlist, toggleCompare, addSimpleToCart } = useShop();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickviewProduct, setQuickviewProduct] = useState<ProductData | null>(null);

  // Add watchlist status to products
  const dealProducts = toProductData(dealOfTheDayProducts).map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const bestSellers = toProductData(bestSellerProducts).map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const newArrivals = toProductData(newArrivalsProducts).map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const trending = toProductData(trendingProducts).map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const laptops = toProductData(laptopsProducts).map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const smartHome = toProductData(smartHomeProducts).map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const allProductsData = toProductData(allProducts).map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

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

  return (
    <div className="min-h-screen bg-background">
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

        {/* Deal of the Day */}
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
          products={[...laptops, ...bestSellers.filter(p =>
            p.category?.toLowerCase().includes('laptop') ||
            p.category?.toLowerCase().includes('tablet')
          )]}
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
        <TrendingNow
          products={trending}
          onWatchlist={handleWatchlist}
        />

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
