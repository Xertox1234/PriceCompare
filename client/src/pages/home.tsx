import { HeroSection } from "@/components/hero-section";
import { FeaturedCategories } from "@/components/featured-categories";
import { TrendingProducts } from "@/components/trending-products";

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />
      
      {/* Featured Categories */}
      <FeaturedCategories />
      
      {/* Trending Products */}
      <TrendingProducts />
    </>
  );
}