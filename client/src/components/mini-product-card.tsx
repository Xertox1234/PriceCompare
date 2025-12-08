import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { MockProduct } from '@/lib/mock-deals';

// ============================================================================
// Type Definitions
// ============================================================================

export interface MiniProductCardProps {
  product: MockProduct;
  badgeText?: string; // Override savings text, e.g. "Black Friday Deal"
  onClick?: (product: MockProduct) => void;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export const MiniProductCard = memo(
  ({ product, badgeText, onClick, className }: MiniProductCardProps) => {
    // Determine badge display text
    const displayBadge = badgeText ?? `${product.savingsPercent}% off`;

    // Handle click event
    const handleClick = useCallback(() => {
      onClick?.(product);
    }, [onClick, product]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(product);
        }
      },
      [onClick, product]
    );

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          // Base styles
          'relative cursor-pointer overflow-hidden rounded-md',
          // Size constraints - compact design
          'w-full',
          // Hover effects
          'transition-all duration-200',
          'hover:scale-[1.02] hover:shadow-md',
          'focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          className
        )}
        aria-label={`${product.name} - ${displayBadge}`}
      >
        {/* Image Container */}
        <div className="bg-muted relative aspect-square overflow-hidden rounded-md">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />

          {/* Amazon-style Corner Savings Badge */}
          <div className="absolute top-1 left-1 rounded-sm bg-red-600 px-1.5 py-0.5 text-white shadow-md">
            <span className="text-2xs font-bold">{displayBadge}</span>
          </div>
        </div>

        {/* Product Info */}
        <div className="mt-1.5 space-y-0.5">
          {/* Product Name */}
          <p className="text-foreground line-clamp-2 text-xs leading-tight">{product.name}</p>
          {/* Price Display */}
          <div className="flex items-baseline gap-1">
            <span className="text-foreground text-sm font-bold">
              ${product.currentPrice.toFixed(2)}
            </span>
            {product.originalPrice > product.currentPrice && (
              <span className="text-muted-foreground text-2xs line-through">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
);

MiniProductCard.displayName = 'MiniProductCard';

// ============================================================================
// Skeleton Component for Loading States
// ============================================================================

export function MiniProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('w-full', className)}>
      {/* Image Skeleton */}
      <div className="bg-muted aspect-square animate-pulse rounded-md" />
      {/* Title Skeleton */}
      <div className="bg-muted mt-2 h-3 w-3/4 animate-pulse rounded" />
    </div>
  );
}

export default MiniProductCard;
