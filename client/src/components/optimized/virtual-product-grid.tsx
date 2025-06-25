import { useVirtualList } from '@/hooks/use-virtual-list';
import { MemoizedProductCard } from './memoized-product-card';
import type { ProductWithOffers } from '@shared/schema';

interface VirtualProductGridProps {
  products: ProductWithOffers[];
  onAddToComparison: (product: ProductWithOffers) => void;
  containerHeight?: number;
}

export function VirtualProductGrid({ 
  products, 
  onAddToComparison, 
  containerHeight = 600 
}: VirtualProductGridProps) {
  const { visibleItems, totalHeight, offsetY, onScroll } = useVirtualList(products, {
    itemHeight: 300, // Approximate height of a product card
    containerHeight,
    overscan: 3,
  });

  if (products.length <= 20) {
    // For small lists, use regular rendering
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <MemoizedProductCard
            key={product.id}
            product={product}
            onAddToComparison={() => onAddToComparison(product)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleItems.map(({ item: product, index }) => (
              <MemoizedProductCard
                key={product.id}
                product={product}
                onAddToComparison={() => onAddToComparison(product)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}