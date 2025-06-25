import { ProductCard } from './product-card';
import type { ProductWithOffers } from '@/shared/schema';

interface FallbackProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: () => void;
}

// Fallback component in case EnhancedProductCard fails to load
export function FallbackProductCard({ product, onAddToComparison }: FallbackProductCardProps) {
  return <ProductCard product={product} onAddToComparison={onAddToComparison} />;
}