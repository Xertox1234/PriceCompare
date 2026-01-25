import { memo, useCallback } from 'react';
import { ProductCard } from '@/components/product-card';
import type { ProductWithOffers } from '@shared/schema';

interface MemoizedProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: (product: ProductWithOffers) => void;
}

export const MemoizedProductCard = memo(
  ({ product, onAddToComparison }: MemoizedProductCardProps) => {
    // Create stable callback that binds the product
    // This is memoized per-component instance, preventing unnecessary re-renders
    const handleAddToComparison = useCallback(() => {
      onAddToComparison(product);
    }, [onAddToComparison, product]);

    return <ProductCard product={product} onAddToComparison={handleAddToComparison} />;
  },
  (prevProps, nextProps) => {
    // Custom comparison function for better memoization
    // Note: We compare onAddToComparison by reference - parent must provide stable callback
    return (
      prevProps.product.id === nextProps.product.id &&
      prevProps.product.bestPrice === nextProps.product.bestPrice &&
      prevProps.product.offers.length === nextProps.product.offers.length &&
      prevProps.onAddToComparison === nextProps.onAddToComparison
    );
  }
);

MemoizedProductCard.displayName = 'MemoizedProductCard';
