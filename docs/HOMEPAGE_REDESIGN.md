# Homepage Redesign Documentation

This document details the homepage redesign project based on the Onsus Envato template (Home 5 style).

## Overview

The homepage has been redesigned to provide a modern e-commerce experience with improved visual hierarchy, interactive components, and better user engagement features.

**Source Template**: Onsus Envato Template - Home 5 Style
**Location**: `/Users/williamtower/Downloads/onsus-template/onsus-package/onsus-nextjs`

## Implementation Status

### Completed Sprints

#### Sprint 1: Homepage Sections (Completed)
- Hero Grid with featured products
- Features Bar highlighting key benefits
- Deal of the Day section with countdown
- Category Grid for browsing
- Promotional Banners
- Featured Product Tabs (Feature/Top Rated/On Sale)
- Category Carousels (Laptops, Smart Home)
- Dual Banner Carousel
- Best Sellers & New Arrivals sections
- Trending Now carousel
- Recently Viewed (localStorage persistence)
- Newsletter signup

#### Sprint 2: Core Pages (Completed)
- Product Detail page with image gallery
- Cart page with quantity management
- Checkout page with multi-step flow
- Compare page for side-by-side product comparison

#### Sprint 3: Route Migration & Polish (In Progress)
- [x] Route migration: `/new` → `/` (homepage)
- [x] Route migration: `/compare-new` → `/compare`
- [x] Updated all internal navigation links
- [x] Fixed Deal of the Day Save badge positioning issue

## File Structure

### Template Components
Location: `client/src/components/template/`

```
template/
├── index.ts                    # Main exports barrel file
├── header.tsx                  # TemplateHeader, CompactHeader
├── footer.tsx                  # TemplateFooter, CompactFooter
├── hero-grid.tsx               # HeroGrid, HeroCompact
├── features-bar.tsx            # FeaturesBar, StatsBar
├── product-card.tsx            # ProductCard component + ProductData type
├── product-section.tsx         # ProductSection, DealOfTheDay, TrendingNow, NewArrivals, CategoryGrid
├── promotional-banner.tsx      # PromotionalBanner, BannerGrid, NewsletterBanner, AppBanner
├── deal-of-the-day.tsx         # DealOfTheDaySection (enhanced with image gallery)
├── tabbed-product-section.tsx  # TabbedProductSection, FeaturedProductTabs
├── category-carousel.tsx       # CategoryCarousel, LaptopsAndComputers, SmartHomeAppliances
├── grouped-product-carousel.tsx # GroupedProductCarousel
├── recently-viewed.tsx         # RecentlyViewed, useTrackProductView
├── dual-banner-carousel.tsx    # DualBannerCarousel
└── modals/
    ├── index.ts                # Modal exports
    ├── cart-modal.tsx          # Cart slide-out modal
    ├── quickview-modal.tsx     # Product quick view
    ├── compare-modal.tsx       # Compare products modal
    ├── mobile-menu.tsx         # Mobile navigation menu
    └── search-modal.tsx        # Search overlay modal
```

### Pages
Location: `client/src/pages/`

```
pages/
├── home-new.tsx          # New homepage (now at `/`)
├── product-detail-new.tsx # Product detail page
├── cart-new.tsx          # Shopping cart page
├── checkout-new.tsx      # Checkout flow page
└── compare-new.tsx       # Product comparison page (now at `/compare`)
```

### Data
Location: `client/src/data/`

```
data/
└── template-data.ts      # Mock product data, categories, banners
```

### Context
Location: `client/src/context/`

```
context/
└── shop-context.tsx      # ShopProvider for cart, wishlist, compare state
```

## Key Components

### DealOfTheDaySection
Enhanced component with:
- Featured product card with image gallery (state-based thumbnail switching)
- Save badge overlay (red badge in top-left corner)
- Horizontal deal cards for side products with hover effects
- Countdown timer to end of day
- Action buttons (wishlist, quickview, compare, add to cart)

**Technical Note**: The original Swiper-based image gallery was replaced with a simpler state-based approach to fix CSS positioning issues with the Save badge.

### ProductCard
Reusable product card with:
- Image with hover effect
- Price display (current + original with strikethrough)
- Discount badge
- Rating stars
- Watchlist toggle
- Quick view and compare buttons

### ShopProvider Context
Manages:
- Cart items (add, remove, update quantity)
- Wishlist items (toggle)
- Compare list (toggle, max 4 items)
- Recently viewed products

## Route Configuration

### Current Routes (App.tsx)
```typescript
// Main pages - new template design
<Route path="/" component={HomeNew} />
<Route path="/compare" component={CompareNew} />
<Route path="/cart" component={CartNew} />
<Route path="/checkout" component={CheckoutNew} />
<Route path="/product/:id" component={ProductDetailNew} />
```

## Theme Support

All components support:
- Light mode
- Dark mode
- High Contrast mode (accessibility)

Uses Tailwind CSS with design system tokens:
- `bg-card`, `bg-muted`, `bg-background`
- `text-foreground`, `text-muted-foreground`
- `border-border`
- `text-primary`, `bg-primary`
- `text-destructive`, `bg-destructive`

## Dependencies

### Required Packages
- `swiper` - Carousel/slider functionality
- `lucide-react` - Icons
- `wouter` - Client-side routing
- `@radix-ui/react-*` - UI primitives

### Swiper Modules Used
- Navigation
- Pagination
- Thumbs
- FreeMode
- Autoplay

## Known Issues & Solutions

### Issue: Save Badge Covering Entire Interface
**Problem**: The "Save $XX" badge on Deal of the Day was expanding to cover the entire featured product area.

**Root Cause**: Swiper CSS was interfering with absolute positioning within flex containers.

**Solution**: Replaced Swiper-based image gallery with state-based image switching using `useState` for the active image index. Used `<span>` with `inline-flex` for the badge to ensure predictable sizing.

## Future Improvements

1. **Add Swiper back to image gallery** - Once CSS isolation is properly handled
2. **Product data integration** - Connect to real API endpoints instead of mock data
3. **Search functionality** - Implement actual search in SearchModal
4. **User authentication** - Connect cart/wishlist to user accounts
5. **Responsive testing** - Thorough mobile/tablet testing
6. **Performance optimization** - Image lazy loading, component code splitting

## Development Commands

```bash
# Start development server
npm run dev

# View homepage
open http://localhost:5001/

# View Onsus template reference (if running)
open http://localhost:3001/home-5
```

## Related Documentation

- `DESIGN_SYSTEM.md` - Color tokens and typography
- `docs/COMPONENT_GUIDE.md` - Component usage patterns
- `CLAUDE.md` - Development guidelines
