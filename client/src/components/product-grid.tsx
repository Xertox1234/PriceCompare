import { EnhancedProductCard } from "./enhanced-product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { ProductWithOffers } from "@shared/schema";

interface ProductGridProps {
  products: ProductWithOffers[];
  isLoading: boolean;
  error: Error | null;
  onAddToComparison: (product: ProductWithOffers) => void;
}

export function ProductGrid({ products, isLoading, error, onAddToComparison }: ProductGridProps) {
  if (error) {
    return (
      <section className="flex-1" aria-label="Product comparison results">
        <div className="error-message flex items-center gap-2">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Error loading products</h3>
            <p className="text-sm">{error.message}</p>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="flex-1" aria-label="Loading products" role="status" aria-live="polite">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
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
            <Button variant="outline" onClick={() => window.location.reload()}>
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
          <EnhancedProductCard
            key={product.id}
            product={product}
            onAddToComparison={() => onAddToComparison(product)}
          />
        ))}
      </div>

      {/* Load More Section - Placeholder for future pagination */}
      {products.length >= 6 && (
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
