import { memo } from 'react';
import { ProductCard } from '@/components/product-card';
import type { ProductWithOffers } from '@shared/schema';

interface MemoizedProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: () => void;
}

export const MemoizedProductCard = memo(
  ({ product, onAddToComparison }: MemoizedProductCardProps) => {
    return <ProductCard product={product} onAddToComparison={onAddToComparison} />;
  },
  (prevProps, nextProps) => {
    // Custom comparison function for better memoization
    return (
      prevProps.product.id === nextProps.product.id &&
      prevProps.product.bestPrice === nextProps.product.bestPrice &&
      prevProps.product.offers.length === nextProps.product.offers.length
    );
  }
);

MemoizedProductCard.displayName = 'MemoizedProductCard';
