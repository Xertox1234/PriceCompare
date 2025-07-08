import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { NewHeader } from "@/components/new-header";
import { NewFooter } from "@/components/new-footer";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import Home from "@/pages/home";
import Products from "@/pages/products";
import NotFound from "@/pages/not-found";
import { LazyAdminPage, LazyForumPage, LazyAdvancedSearchPage } from "@/components/lazy";

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
      <NewHeader />
      <main className="container mx-auto px-6 py-12">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/products" component={Products} />
          <Route path="/search">
            <Suspense fallback={<LoadingFallback />}>
              <LazyAdvancedSearchPage />
            </Suspense>
          </Route>
          <Route path="/forum">
            <Suspense fallback={<LoadingFallback />}>
              <LazyForumPage />
            </Suspense>
          </Route>
          <Route path="/admin">
            <Suspense fallback={<LoadingFallback />}>
              <LazyAdminPage />
            </Suspense>
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
    <HelmetProvider>
      <ThemeProvider defaultTheme="light" storageKey="pricecompare-theme">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
          <div className="min-h-screen bg-background">
            {/* Skip to main content link for accessibility */}
            <a 
              href="#main-content" 
              className="skip-link focus-visible"
              tabIndex={0}
            >
              Skip to main content
            </a>
            <Router />
            <Toaster />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
  );
}

export default App;
