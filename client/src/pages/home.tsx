import { NewHeroSection } from "@/components/new-hero-section";
import { NewPromoBanner } from "@/components/new-promo-banner";
import { NewCategories } from "@/components/new-categories";
import { NewNewsletter } from "@/components/new-newsletter";

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <NewHeroSection />
      
      {/* Promotional Banner */}
      <NewPromoBanner />
      
      {/* Popular Categories */}
      <NewCategories />
      
      {/* Newsletter Section */}
      <NewNewsletter />
    </>
  );
}