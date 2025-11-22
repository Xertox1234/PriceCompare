import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SharedNavigation } from "@/components/shared-navigation";
import { RateLimitBanner } from "@/components/RateLimitBanner";
import { NewFooter } from "@/components/new-footer";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import Home from "@/pages/home";
import HomeNew from "@/pages/home-new";
import ProductDetailPage from "@/pages/product-detail-new";
import Products from "@/pages/products";
import ProductsNew from "@/pages/products-new";
import WishlistNew from "@/pages/wishlist-new";
import CompareNew from "@/pages/compare-new";
import CartNew from "@/pages/cart-new";
import CheckoutNew from "@/pages/checkout-new";
import ComparisonPage from "@/pages/comparison";
import MonitoringDashboard from "@/pages/monitoring";
import PriceWatch from "@/pages/price-watch";
import NotificationsPage from "@/pages/notifications";
import NotFound from "@/pages/not-found";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import { LazyAdminPage, LazyForumPage, LazyAdvancedSearchPage, LazyPriceHistoryPage, LazyAnalyticsPage, LazyWatchListManager } from "@/components/lazy";
import { ErrorBoundary, RouteErrorBoundary } from "@/components/error-boundary";
import { useRealtimeNotifications } from "@/hooks/useSmartNotifications";
import { ConnectionStatus } from "@/components/connection-status";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWatchListUpdates } from "@/hooks/use-watchlist-updates";
import { useNotificationUpdates } from "@/hooks/use-notification-updates";

function Router() {
  const LoadingFallback = () => (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );

  return (
    <Switch>
      {/* Main homepage with Onsus template layout */}
      <Route path="/" component={HomeNew} />

      {/* Product detail page with Onsus template layout */}
      <Route path="/product/:id" component={ProductDetailPage} />

      {/* Shop/Products page with Onsus template layout */}
      <Route path="/shop" component={ProductsNew} />

      {/* Wishlist page with Onsus template layout */}
      <Route path="/wishlist" component={WishlistNew} />

      {/* Compare page with Onsus template layout */}
      <Route path="/compare" component={CompareNew} />

      {/* Cart page with Onsus template layout */}
      <Route path="/cart" component={CartNew} />

      {/* Checkout page with Onsus template layout */}
      <Route path="/checkout" component={CheckoutNew} />

      {/* Legacy routes with default layout */}
      <Route>
        <div className="min-h-screen bg-background">
          <SharedNavigation />
          <RateLimitBanner />
          <main className="container mx-auto px-6 py-12">
            <Switch>
              <Route path="/legacy" component={Home} />
              <Route path="/products" component={Products} />
              <Route path="/forgot-password" component={ForgotPassword} />
              <Route path="/reset-password" component={ResetPassword} />
              <Route path="/search">
                <RouteErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <LazyAdvancedSearchPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>
              <Route path="/search/advanced">
                <RouteErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <LazyAdvancedSearchPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>
              <Route path="/forum">
                <RouteErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <LazyForumPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>
              <Route path="/admin">
                <RouteErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <LazyAdminPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>
              <Route path="/monitoring" component={MonitoringDashboard} />
              <Route path="/price-watch" component={PriceWatch} />
              <Route path="/notifications" component={NotificationsPage} />
              <Route path="/watchlists">
                <RouteErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <LazyWatchListManager />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>
              <Route path="/products/:id/price-history">
                <RouteErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <LazyPriceHistoryPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>
              <Route path="/products/:id/analytics">
                <RouteErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <LazyAnalyticsPage />
                  </Suspense>
                </RouteErrorBoundary>
              </Route>
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
      <div className="min-h-screen bg-background">
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
