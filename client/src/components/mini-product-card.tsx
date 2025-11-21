import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { MockProduct } from "@/lib/mock-deals";

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

export const MiniProductCard = memo(function MiniProductCard({
  product,
  badgeText,
  onClick,
  className,
}: MiniProductCardProps) {
  // Determine badge display text
  const displayBadge = badgeText ?? `${product.savingsPercent}% off`;

  // Handle click event
  const handleClick = useCallback(() => {
    onClick?.(product);
  }, [onClick, product]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
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
        "relative cursor-pointer rounded-md overflow-hidden",
        // Size constraints - compact design
        "w-full",
        // Hover effects
        "transition-all duration-200",
        "hover:scale-[1.02] hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className
      )}
      aria-label={`${product.name} - ${displayBadge}`}
    >
      {/* Image Container */}
      <div className="relative aspect-square bg-muted overflow-hidden rounded-md">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Amazon-style Corner Savings Badge */}
        <div className="absolute top-1 left-1 bg-red-600 text-white px-1.5 py-0.5 rounded-sm shadow-md">
          <span className="text-[10px] font-bold leading-none">
            {displayBadge}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="mt-1.5 space-y-0.5">
        {/* Product Name */}
        <p className="text-xs text-foreground line-clamp-2 leading-tight">
          {product.name}
        </p>
        {/* Price Display */}
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-foreground">
            ${product.currentPrice.toFixed(2)}
          </span>
          {product.originalPrice > product.currentPrice && (
            <span className="text-[10px] text-muted-foreground line-through">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

MiniProductCard.displayName = "MiniProductCard";

// ============================================================================
// Skeleton Component for Loading States
// ============================================================================

export function MiniProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      {/* Image Skeleton */}
      <div className="aspect-square bg-muted rounded-md animate-pulse" />
      {/* Title Skeleton */}
      <div className="mt-2 h-3 bg-muted rounded animate-pulse w-3/4" />
    </div>
  );
}

export default MiniProductCard;
