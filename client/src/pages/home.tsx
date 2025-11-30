import { useCallback, useState, useMemo } from 'react';
import { HeroSection } from '@/components/hero-section';
import { FlashDealsSection } from '@/components/flash-deals-section';
import { CategoryPillsBar } from '@/components/category-pills-bar';
import { ProductCarousel } from '@/components/product-carousel';
import { ProductDealCard } from '@/components/product-deal-card';
import { DealGridCard } from '@/components/deal-grid-card';
import { PriceTierCard } from '@/components/price-tier-card';
import { RetailerSpotlight } from '@/components/retailer-spotlight';
import { NewsletterBanner } from '@/components/newsletter-banner';
import {
  getProductsByCategory,
  getTrendingProducts,
  getTopDeals,
  getProductsByPriceRange,
  MockProduct,
} from '@/lib/mock-deals';
import { createLogger } from '@/utils/logger';

const log = createLogger('Home');

/**
 * Home Page - "Busy Hub" Experience
 *
 * A content-rich homepage with multiple carousels and sections
 * designed to showcase deals and drive engagement.
 *
 * Sections:
 * 1. Hero Section - Search and main CTA
 * 2. Flash Deals - Time-limited urgency section
 * 3. Category Pills Bar - Horizontal filter navigation
 * 4. Electronics Carousel - Category deals
 * 5. Fashion Carousel - Category deals
 * 6. Home & Living Carousel - Category deals
 * 7. Retailer Spotlight - Amazon featured deals
 * 8. Trending Now Carousel - Most watched products
 * 9. Gaming Carousel - Category deals
 * 10. Newsletter Banner - Email signup CTA
 */
export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Handle view deal action for all carousels
  const handleViewDeal = useCallback((product: MockProduct) => {
    // Navigate to product detail page
    window.open(`/products/${product.id}`, '_blank');
  }, []);

  // Handle watchlist toggle for all carousels
  const handleWatchlist = useCallback((product: MockProduct) => {
    // Toggle watchlist status - integrates with actual watchlist state in future
    log.info(`Toggled watchlist for product: ${product.id}`);
  }, []);

  // Handle category change from pills bar
  const handleCategoryChange = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    // In future: scroll to relevant section or filter content
  }, []);

  // Get products for each category carousel
  const electronicsProducts = getProductsByCategory('Electronics');
  const fashionProducts = getProductsByCategory('Fashion');
  const homeProducts = getProductsByCategory('Home');
  const gamingProducts = getProductsByCategory('Gaming');
  const phonesProducts = getProductsByCategory('Phones');
  const trendingProducts = getTrendingProducts();
  const topDeals = getTopDeals(16);

  // Price tiers for the PriceTierCard
  const priceTiers = useMemo(() => {
    const under25 = getProductsByPriceRange(0, 25);
    const under50 = getProductsByPriceRange(25, 50);
    const under100 = getProductsByPriceRange(50, 100);
    const under200 = getProductsByPriceRange(100, 200);

    return [
      { maxPrice: 25, label: 'Under $25', product: under25[0] || topDeals[0] },
      { maxPrice: 50, label: 'Under $50', product: under50[0] || topDeals[1] },
      { maxPrice: 100, label: 'Under $100', product: under100[0] || topDeals[2] },
      { maxPrice: 200, label: 'Under $200', product: under200[0] || topDeals[3] },
    ];
  }, [topDeals]);

  return (
    <div className="space-y-12 pb-12">
      {/* 1. Hero Section - Main search and headline */}
      <HeroSection />

      {/* 2. Flash Deals - Time-limited urgency section */}
      <section className="px-4 sm:px-6 lg:px-8">
        <FlashDealsSection />
      </section>

      {/* 3. Category Pills Bar - Horizontal filter navigation */}
      <section className="px-4 sm:px-6 lg:px-8">
        <CategoryPillsBar
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />
      </section>

      {/* 4. Amazon-style Grid Cards Section */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DealGridCard
            title="Top Deals"
            products={topDeals.slice(0, 4)}
            seeMoreLink="/deals"
            seeMoreText="See all deals"
            onProductClick={handleViewDeal}
          />
          <DealGridCard
            title="Electronics"
            products={electronicsProducts.slice(0, 4)}
            seeMoreLink="/products?category=electronics"
            seeMoreText="Shop electronics"
            onProductClick={handleViewDeal}
          />
          <DealGridCard
            title="Gaming Gear"
            products={gamingProducts.slice(0, 4)}
            seeMoreLink="/products?category=gaming"
            seeMoreText="Shop gaming"
            onProductClick={handleViewDeal}
          />
          <PriceTierCard
            title="Deals by Price"
            tiers={priceTiers}
            seeAllLink="/deals"
            seeAllText="Shop all deals"
          />
        </div>
      </section>

      {/* 5. Second Row of Grid Cards */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DealGridCard
            title="Fashion Finds"
            products={fashionProducts.slice(0, 4)}
            seeMoreLink="/products?category=fashion"
            seeMoreText="Shop fashion"
            onProductClick={handleViewDeal}
          />
          <DealGridCard
            title="Home Essentials"
            products={homeProducts.slice(0, 4)}
            seeMoreLink="/products?category=home"
            seeMoreText="Shop home"
            onProductClick={handleViewDeal}
          />
          <DealGridCard
            title="Trending Now"
            products={trendingProducts.slice(0, 4)}
            seeMoreLink="/products?sort=trending"
            seeMoreText="See trending"
            onProductClick={handleViewDeal}
          />
          <DealGridCard
            title="Phones & Tech"
            products={phonesProducts.slice(0, 4)}
            seeMoreLink="/products?category=phones"
            seeMoreText="Shop phones"
            onProductClick={handleViewDeal}
          />
        </div>
      </section>

      {/* 6. Electronics Carousel */}
      <section className="px-4 sm:px-6 lg:px-8">
        <ProductCarousel
          title="Hot in Electronics"
          emoji="&#128293;"
          seeAllLink="/products?category=electronics"
        >
          {electronicsProducts.map((product) => (
            <ProductDealCard
              key={product.id}
              product={product}
              variant="default"
              onViewDeal={handleViewDeal}
              onWatchlist={handleWatchlist}
            />
          ))}
        </ProductCarousel>
      </section>

      {/* 5. Fashion Carousel */}
      <section className="px-4 sm:px-6 lg:px-8">
        <ProductCarousel
          title="Fashion Steals"
          emoji="&#128087;"
          seeAllLink="/products?category=fashion"
        >
          {fashionProducts.map((product) => (
            <ProductDealCard
              key={product.id}
              product={product}
              variant="default"
              onViewDeal={handleViewDeal}
              onWatchlist={handleWatchlist}
            />
          ))}
        </ProductCarousel>
      </section>

      {/* 6. Home & Living Carousel */}
      <section className="px-4 sm:px-6 lg:px-8">
        <ProductCarousel
          title="Home & Living"
          emoji="&#127968;"
          seeAllLink="/products?category=home"
        >
          {homeProducts.map((product) => (
            <ProductDealCard
              key={product.id}
              product={product}
              variant="default"
              onViewDeal={handleViewDeal}
              onWatchlist={handleWatchlist}
            />
          ))}
        </ProductCarousel>
      </section>

      {/* 7. Retailer Spotlight - Amazon featured deals */}
      <section className="px-4 sm:px-6 lg:px-8">
        <RetailerSpotlight
          retailerId="1"
          tagline="Top deals from the world's largest retailer"
        />
      </section>

      {/* 8. Trending Now Carousel */}
      <section className="px-4 sm:px-6 lg:px-8">
        <ProductCarousel
          title="Trending Now"
          emoji="&#128200;"
          seeAllLink="/products?sort=trending"
        >
          {trendingProducts.map((product) => (
            <ProductDealCard
              key={product.id}
              product={product}
              variant="trending"
              onViewDeal={handleViewDeal}
              onWatchlist={handleWatchlist}
            />
          ))}
        </ProductCarousel>
      </section>

      {/* 9. Gaming Carousel */}
      <section className="px-4 sm:px-6 lg:px-8">
        <ProductCarousel
          title="Gaming Deals"
          emoji="&#127918;"
          seeAllLink="/products?category=gaming"
        >
          {gamingProducts.map((product) => (
            <ProductDealCard
              key={product.id}
              product={product}
              variant="default"
              onViewDeal={handleViewDeal}
              onWatchlist={handleWatchlist}
            />
          ))}
        </ProductCarousel>
      </section>

      {/* 10. Newsletter CTA */}
      <section className="px-4 sm:px-6 lg:px-8">
        <NewsletterBanner />
      </section>
    </div>
  );
}
