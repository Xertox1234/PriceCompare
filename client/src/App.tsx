import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { SharedNavigation } from '@/components/shared-navigation';
import { RateLimitBanner } from '@/components/RateLimitBanner';
import { NewFooter } from '@/components/new-footer';
import { Suspense } from 'react';
import { PageLoadingFallback, ProductGridLoadingFallback } from '@/components/loading-spinner';

// ============================================
// Eager-loaded pages (critical path, needed immediately)
// ============================================
import HomeNew from '@/pages/home-new';
import ForgotPassword from '@/pages/forgot-password';
import ResetPassword from '@/pages/reset-password';
import NotFound from '@/pages/not-found';

// ============================================
// Lazy-loaded pages (loaded on demand)
// Reduces initial bundle from ~1.2MB to ~300KB
// ============================================
import {
  LazyAdminPage,
  LazyAdvancedSearchPage,
  LazyPriceHistoryPage,
  LazyAnalyticsPage,
  LazyWatchListManager,
  LazyMonitoringDashboard,
  LazyPriceWatch,
  LazyNotificationsPage,
  LazyProductsPage,
  LazyProductsNewPage,
  LazyProductDetailPage,
  LazyWishlistPage,
  LazyComparePage,
  LazyHomeLegacy,
} from '@/components/lazy';
import { ErrorBoundary, RouteErrorBoundary } from '@/components/error-boundary';
import { useRealtimeNotifications } from '@/hooks/useSmartNotifications';
import { ConnectionStatus } from '@/components/connection-status';
import { useWebSocket } from '@/hooks/use-websocket';
import { useWatchListUpdates } from '@/hooks/use-watchlist-updates';
import { useNotificationUpdates } from '@/hooks/use-notification-updates';

function Router() {
  return (
    <Switch>
      {/* ============================================
       * Main routes with Onsus template layout
       * Home page is eager-loaded (critical path)
       * ============================================ */}
      <Route path="/" component={HomeNew} />

      {/* Product detail page - Lazy loaded (chart-heavy with price history) */}
      <Route path="/product/:id">
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoadingFallback />}>
            <LazyProductDetailPage />
          </Suspense>
        </RouteErrorBoundary>
      </Route>

      {/* Shop/Products page - Lazy loaded (large component with filters) */}
      <Route path="/shop">
        <RouteErrorBoundary>
          <Suspense fallback={<ProductGridLoadingFallback />}>
            <LazyProductsNewPage />
          </Suspense>
        </RouteErrorBoundary>
      </Route>

      {/* Wishlist page - Lazy loaded */}
      <Route path="/wishlist">
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoadingFallback />}>
            <LazyWishlistPage />
          </Suspense>
        </RouteErrorBoundary>
      </Route>

      {/* Compare page - Lazy loaded */}
      <Route path="/compare">
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoadingFallback />}>
            <LazyComparePage />
          </Suspense>
        </RouteErrorBoundary>
      </Route>

      {/* ============================================
       * Legacy routes with default layout
       * Wrapped in SharedNavigation + Footer
       * ============================================ */}
      <Route>
        <div className="bg-background min-h-screen">
          <SharedNavigation />
          <RateLimitBanner />
          <main className="container mx-auto px-6 py-12">
            <Switch>
              {/* Legacy home - Lazy loaded */}
              <Route path="/legacy">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyHomeLegacy />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* Legacy products - Lazy loaded */}
              <Route path="/products">
                <RouteErrorBoundary>
                  <Suspense fallback={<ProductGridLoadingFallback />}>
                    <LazyProductsPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* Auth pages - Eager loaded (critical for user flow) */}
              <Route path="/forgot-password" component={ForgotPassword} />
              <Route path="/reset-password" component={ResetPassword} />

              {/* Search pages - Lazy loaded */}
              <Route path="/search">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyAdvancedSearchPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>
              <Route path="/search/advanced">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyAdvancedSearchPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* Admin page - Lazy loaded (heavy, admin-only) */}
              <Route path="/admin">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyAdminPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* Monitoring dashboard - Lazy loaded (charts, WebSocket) */}
              <Route path="/monitoring">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyMonitoringDashboard />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* Price watch - Lazy loaded */}
              <Route path="/price-watch">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyPriceWatch />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* Notifications - Lazy loaded */}
              <Route path="/notifications">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyNotificationsPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* Watch lists - Lazy loaded */}
              <Route path="/watchlists">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyWatchListManager />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* Price history - Lazy loaded (chart-heavy, loads recharts) */}
              <Route path="/products/:id/price-history">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyPriceHistoryPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* Analytics - Lazy loaded (chart-heavy, loads recharts) */}
              <Route path="/products/:id/analytics">
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <LazyAnalyticsPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>

              {/* 404 - Eager loaded (small component) */}
              <Route component={NotFound} />
            </Switch>
          </main>
          <NewFooter />
        </div>
      </Route>
    </Switch>
  );
}

/**
 * AppContent - Component that uses hooks requiring QueryClient context
 * Must be rendered inside QueryClientProvider
 */
function AppContent() {
  // Initialize WebSocket connection for real-time updates
  useWebSocket();

  // Subscribe to real-time watch list updates
  useWatchListUpdates();

  // Subscribe to real-time notification updates
  useNotificationUpdates();

  // Initialize WebSocket connection for real-time smart notifications
  useRealtimeNotifications();

  return (
    <TooltipProvider>
      <div className="bg-background min-h-screen">
        <Router />
        <Toaster />
        <ConnectionStatus />
      </div>
    </TooltipProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider defaultTheme="light" storageKey="pricecompare-theme">
          <QueryClientProvider client={queryClient}>
            <AppContent />
          </QueryClientProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
