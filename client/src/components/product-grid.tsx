import { ProductCard } from './product-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import type { ProductWithOffers } from '@shared/schema';
import { PRODUCT_SKELETON_COUNT, LOAD_MORE_THRESHOLD } from '@/lib/constants';

interface ProductGridProps {
  products: ProductWithOffers[];
  isLoading: boolean;
  error: Error | null;
  onAddToComparison: (product: ProductWithOffers) => void;
  onRetry?: () => void;
}

export function ProductGrid({
  products,
  isLoading,
  error,
  onAddToComparison,
  onRetry,
}: ProductGridProps) {
  const [, setLocation] = useLocation();

  if (error) {
    return (
      <section className="flex-1" aria-label="Product comparison results">
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="max-w-md space-y-4 text-center">
            <div className="flex justify-center">
              <div className="bg-destructive/10 rounded-full p-4">
                <AlertCircle className="text-destructive h-12 w-12" aria-hidden="true" />
              </div>
            </div>
            <div>
              <h3 className="text-foreground text-lg font-semibold">Error loading products</h3>
              <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
            </div>
            <div className="flex justify-center gap-3">
              {onRetry && (
                <Button onClick={onRetry} variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
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

  if (isLoading && products.length === 0) {
    return (
      <section className="flex-1" aria-label="Loading products" role="status" aria-live="polite">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: PRODUCT_SKELETON_COUNT }, (_, i) => (
            <div key={i} className="bg-card overflow-hidden rounded-lg border shadow-sm">
              <Skeleton className="h-48 w-full" />
              <div className="space-y-3 p-4">
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
          <div className="py-12 text-center">
            <div className="mb-4 text-6xl" role="img" aria-label="No products found">
              🔍
            </div>
            <h3 className="text-foreground mb-2 text-lg font-semibold">No products found</h3>
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
          <p className="text-muted-foreground mt-2 text-sm">Showing {products.length} results</p>
        </div>
      )}
    </section>
  );
}
