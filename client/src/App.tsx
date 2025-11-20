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
import Products from "@/pages/products";
import ComparisonPage from "@/pages/comparison";
import MonitoringDashboard from "@/pages/monitoring";
import NotFound from "@/pages/not-found";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import { LazyAdminPage, LazyForumPage, LazyAdvancedSearchPage, LazyPriceHistoryPage, LazyAnalyticsPage, LazyWatchListManager } from "@/components/lazy";
import { ErrorBoundary, RouteErrorBoundary } from "@/components/error-boundary";

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
    <div className="min-h-screen bg-background">
      <SharedNavigation />
      <RateLimitBanner />
      <main className="container mx-auto px-6 py-12">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/products" component={Products} />
          <Route path="/compare" component={ComparisonPage} />
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
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider defaultTheme="light" storageKey="pricecompare-theme">
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <div className="min-h-screen bg-background">
                <Router />
                <Toaster />
              </div>
            </TooltipProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
