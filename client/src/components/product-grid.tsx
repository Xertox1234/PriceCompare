import { ProductCard } from "./product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import type { ProductWithOffers } from "@shared/schema";
import { PRODUCT_SKELETON_COUNT, LOAD_MORE_THRESHOLD } from "@/lib/constants";

interface ProductGridProps {
  products: ProductWithOffers[];
  isLoading: boolean;
  error: Error | null;
  onAddToComparison: (product: ProductWithOffers) => void;
  onRetry?: () => void;
}

export function ProductGrid({ products, isLoading, error, onAddToComparison, onRetry }: ProductGridProps) {
  const [, setLocation] = useLocation();

  if (error) {
    return (
      <section className="flex-1" aria-label="Product comparison results">
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Error loading products</h3>
              <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
            </div>
            <div className="flex gap-3 justify-center">
              {onRetry && (
                <Button onClick={onRetry} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              <Button onClick={() => setLocation('/products')} variant="outline">
                Go to Products
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="flex-1" aria-label="Loading products" role="status" aria-live="polite">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: PRODUCT_SKELETON_COUNT }, (_, i) => (
            <div key={i} className="bg-card rounded-lg shadow-sm border overflow-hidden">
              <Skeleton className="w-full h-48" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="flex-1" aria-label="Product comparison results">
        <div className="empty-state">
          <div className="text-center py-12">
            <div className="text-6xl mb-4" role="img" aria-label="No products found">
              🔍
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search query or filters to find what you're looking for.
            </p>
            <Button variant="outline" onClick={() => setLocation('/products')}>
              Clear Search
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1" aria-label="Product comparison results">
      {/* Product Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToComparison={() => onAddToComparison(product)}
          />
        ))}
      </div>

      {/* Load More Section - Placeholder for future pagination */}
      {products.length >= LOAD_MORE_THRESHOLD && (
        <div className="mt-8 text-center">
          <Button variant="outline" className="px-6 py-3">
            Load More Results
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Showing {products.length} results
          </p>
        </div>
      )}
    </section>
  );
}
