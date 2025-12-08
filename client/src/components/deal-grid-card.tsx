import { memo, useCallback, useMemo } from 'react';
import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { MiniProductCard } from '@/components/mini-product-card';
import { cn } from '@/lib/utils';
import type { MockProduct } from '@/lib/mock-deals';

// ============================================================================
// Type Definitions
// ============================================================================

export type BadgeStyle = 'percent' | 'text';

export interface DealGridCardProps {
  title: string;
  products: MockProduct[]; // Takes first 4
  seeMoreLink?: string;
  seeMoreText?: string; // Default: "See more deals"
  badgeStyle?: BadgeStyle; // Show "30% off" or custom badge text
  customBadges?: Record<number, string>; // Map productId to custom badge text
  onProductClick?: (product: MockProduct) => void;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export const DealGridCard = memo(
  ({
    title,
    products,
    seeMoreLink,
    seeMoreText = 'See more deals',
    badgeStyle = 'percent',
    customBadges,
    onProductClick,
    className,
  }: DealGridCardProps) => {
    // Take only the first 4 products
    const displayProducts = useMemo(() => products.slice(0, 4), [products]);

    // Generate badge text for a product
    const getBadgeText = useCallback(
      (product: MockProduct): string | undefined => {
        // Check for custom badge first
        if (customBadges?.[product.id]) {
          return customBadges[product.id];
        }

        // Return undefined to use default (percent) or return text style
        if (badgeStyle === 'percent') {
          return undefined; // MiniProductCard will use default
        }

        // For text style, we could customize based on product properties
        return `Save $${(product.originalPrice - product.currentPrice).toFixed(0)}`;
      },
      [badgeStyle, customBadges]
    );

    return (
      <Card
        className={cn(
          'flex h-full flex-col',
          'transition-shadow duration-200 hover:shadow-md',
          className
        )}
      >
        {/* Card Header */}
        <CardHeader className="px-4 pt-4 pb-3">
          <CardTitle className="text-foreground text-lg leading-tight font-bold">{title}</CardTitle>
        </CardHeader>

        {/* Card Content - 2x2 Grid */}
        <CardContent className="flex-1 px-4 pb-3">
          <div className="grid grid-cols-2 gap-3">
            {displayProducts.map((product) => (
              <MiniProductCard
                key={product.id}
                product={product}
                badgeText={getBadgeText(product)}
                onClick={onProductClick}
              />
            ))}
          </div>

          {/* Show placeholders if less than 4 products */}
          {displayProducts.length < 4 &&
            Array.from({ length: 4 - displayProducts.length }).map((_, index) => (
              <div key={`placeholder-${index}`} className="bg-muted/50 aspect-square rounded-md" />
            ))}
        </CardContent>

        {/* Card Footer - See More Link */}
        {seeMoreLink && (
          <CardFooter className="px-4 pt-0 pb-4">
            <Link
              href={seeMoreLink}
              className={cn(
                'text-primary text-sm font-medium',
                'flex items-center gap-1',
                'focus-visible:ring-primary rounded hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
              )}
            >
              {seeMoreText}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardFooter>
        )}
      </Card>
    );
  }
);

DealGridCard.displayName = 'DealGridCard';

// ============================================================================
// Skeleton Component for Loading States
// ============================================================================

export function DealGridCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('flex h-full flex-col', className)}>
      {/* Header Skeleton */}
      <CardHeader className="px-4 pt-4 pb-3">
        <div className="bg-muted h-5 w-3/4 animate-pulse rounded" />
      </CardHeader>

      {/* Grid Skeleton */}
      <CardContent className="flex-1 px-4 pb-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <div className="bg-muted aspect-square animate-pulse rounded-md" />
              <div className="bg-muted mt-2 h-3 w-3/4 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </CardContent>

      {/* Footer Skeleton */}
      <CardFooter className="px-4 pt-0 pb-4">
        <div className="bg-muted h-4 w-28 animate-pulse rounded" />
      </CardFooter>
    </Card>
  );
}

export default DealGridCard;
