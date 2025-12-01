/**
 * Lazy-loaded components for code splitting
 * 
 * Route-based code splitting reduces initial bundle size by loading page components
 * on demand. This improves First Contentful Paint (FCP) and Time to Interactive (TTI).
 * 
 * Guidelines:
 * - Eager load: Home page, login/register (needed immediately)
 * - Lazy load: All other routes (loaded on navigation)
 * - Chart-heavy pages: Always lazy (recharts is 367KB)
 * 
 * @see docs/PERFORMANCE_GUIDE.md for code splitting best practices
 */
import { lazy } from 'react';

// ============================================
// Page Components - Lazy Loaded
// ============================================

/**
 * Admin dashboard - Heavy page with management features
 * Contains: Data tables, forms, charts
 */
export const LazyAdminPage = lazy(() => import('@/pages/admin'));

/**
 * Advanced search page - Search filters and results
 * Named export requires module transform
 */
export const LazyAdvancedSearchPage = lazy(() =>
  import('@/pages/advanced-search').then(module => ({ default: module.AdvancedSearchPage }))
);

/**
 * Price history page - Chart-heavy, loads recharts bundle
 * Critical to lazy load to avoid 367KB on initial load
 */
export const LazyPriceHistoryPage = lazy(() => import('@/pages/price-history'));

/**
 * Analytics page - Chart-heavy, data visualization
 * Critical to lazy load to avoid 367KB on initial load
 */
export const LazyAnalyticsPage = lazy(() => import('@/pages/analytics'));

/**
 * Watch list manager - Community feature
 * Named export requires module transform
 */
export const LazyWatchListManager = lazy(() =>
  import('@/components/community/watch-list-manager').then(m => ({ default: m.WatchListManager }))
);

/**
 * Monitoring dashboard - Admin/debug feature
 * Contains: WebSocket connections, real-time metrics, charts
 */
export const LazyMonitoringDashboard = lazy(() => import('@/pages/monitoring'));

/**
 * Price watch page - Tracking features
 */
export const LazyPriceWatch = lazy(() => import('@/pages/price-watch'));

/**
 * Notifications page - User notifications
 */
export const LazyNotificationsPage = lazy(() => import('@/pages/notifications'));

/**
 * Products page (legacy) - Product listing
 */
export const LazyProductsPage = lazy(() => import('@/pages/products'));

/**
 * Products page (new template) - Product listing with filters
 */
export const LazyProductsNewPage = lazy(() => import('@/pages/products-new'));

/**
 * Product detail page - Single product view
 */
export const LazyProductDetailPage = lazy(() => import('@/pages/product-detail-new'));

/**
 * Wishlist page - User wishlist
 */
export const LazyWishlistPage = lazy(() => import('@/pages/wishlist-new'));

/**
 * Compare page - Product comparison
 */
export const LazyComparePage = lazy(() => import('@/pages/compare-new'));

/**
 * Cart page - Shopping cart
 */
export const LazyCartPage = lazy(() => import('@/pages/cart-new'));

/**
 * Checkout page - Order checkout
 */
export const LazyCheckoutPage = lazy(() => import('@/pages/checkout-new'));

/**
 * Legacy home page
 */
export const LazyHomeLegacy = lazy(() => import('@/pages/home'));