// Template Components - Home 5 Style
// Converted from Envato Onsus template to Tailwind CSS

export { TemplateHeader, CompactHeader } from './header';
export { HeroGrid, HeroCompact } from './hero-grid';
export { FeaturesBar, StatsBar } from './features-bar';
export { ProductCard, type ProductData } from './product-card';
export {
  ProductSection,
  DealOfTheDay,
  TrendingNow,
  NewArrivals,
  CategoryGrid,
} from './product-section';
export {
  PromotionalBanner,
  BannerGrid,
  NewsletterBanner,
  AppBanner,
} from './promotional-banner';
export { TemplateFooter, CompactFooter } from './footer';

// New Carousel Components (Swiper-based)
export {
  TabbedProductSection,
  FeaturedProductTabs,
  type TabConfig,
} from './tabbed-product-section';
export {
  CategoryCarousel,
  LaptopsAndComputers,
  SmartHomeAppliances,
  AudioEquipment,
} from './category-carousel';
export { GroupedProductCarousel } from './grouped-product-carousel';
export {
  RecentlyViewed,
  addToRecentlyViewed,
  getRecentlyViewed,
  clearRecentlyViewed,
  useTrackProductView,
} from './recently-viewed';
export {
  DualBannerCarousel,
  defaultDualBanners,
  type DualBannerItem,
} from './dual-banner-carousel';
export { DealOfTheDaySection } from './deal-of-the-day';

// Re-export data types
export type {
  TemplateProduct,
  TemplateCategory,
  TemplateBanner,
  TemplateFeature,
} from '@/data/template-data';
