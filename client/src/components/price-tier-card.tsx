import { memo, useCallback } from 'react';
import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MockProduct } from '@/lib/mock-deals';

// ============================================================================
// Type Definitions
// ============================================================================

export interface PriceTier {
  maxPrice: number;
  label: string; // e.g., "Under $25"
  product: MockProduct; // Representative product for this tier
  link?: string; // Optional link for this specific tier
}

export interface PriceTierCardProps {
  title: string;
  tiers: PriceTier[]; // 4 tiers
  seeAllLink?: string;
  seeAllText?: string; // Default: "Shop all"
  onTierClick?: (tier: PriceTier) => void;
  className?: string;
}

// ============================================================================
// Price Tier Item Component
// ============================================================================

interface PriceTierItemProps {
  tier: PriceTier;
  onClick?: (tier: PriceTier) => void;
}

const PriceTierItem = memo(({ tier, onClick }: PriceTierItemProps) => {
  const handleClick = useCallback(() => {
    onClick?.(tier);
  }, [onClick, tier]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(tier);
      }
    },
    [onClick, tier]
  );

  const content = (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        // Base styles
        'relative cursor-pointer overflow-hidden rounded-md',
        'w-full',
        // Hover effects
        'transition-all duration-200',
        'hover:scale-[1.02] hover:shadow-md',
        'focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
      )}
      aria-label={`${tier.label} - ${tier.product.name}`}
    >
      {/* Image Container */}
      <div className="bg-muted relative aspect-square overflow-hidden rounded-md">
        <img
          src={tier.product.imageUrl}
          alt={tier.product.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Price Tier Label */}
      <p className="text-primary mt-2 text-xs font-semibold">{tier.label}</p>
    </div>
  );

  // If tier has a link, wrap in Link component
  if (tier.link) {
    return (
      <Link href={tier.link} className="block">
        {content}
      </Link>
    );
  }

  return content;
});

PriceTierItem.displayName = 'PriceTierItem';

// ============================================================================
// Main Component
// ============================================================================

export const PriceTierCard = memo(
  ({
    title,
    tiers,
    seeAllLink,
    seeAllText = 'Shop all',
    onTierClick,
    className,
  }: PriceTierCardProps) => {
    // Take only the first 4 tiers
    const displayTiers = tiers.slice(0, 4);

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
            {displayTiers.map((tier, index) => (
              <PriceTierItem
                key={`tier-${tier.maxPrice}-${index}`}
                tier={tier}
                onClick={onTierClick}
              />
            ))}
          </div>

          {/* Show placeholders if less than 4 tiers */}
          {displayTiers.length < 4 &&
            Array.from({ length: 4 - displayTiers.length }).map((_, index) => (
              <div key={`placeholder-${index}`} className="w-full">
                <div className="bg-muted/50 aspect-square rounded-md" />
                <div className="bg-muted/50 mt-2 h-3 w-1/2 rounded" />
              </div>
            ))}
        </CardContent>

        {/* Card Footer - See All Link */}
        {seeAllLink && (
          <CardFooter className="px-4 pt-0 pb-4">
            <Link
              href={seeAllLink}
              className={cn(
                'text-primary text-sm font-medium',
                'flex items-center gap-1',
                'focus-visible:ring-primary rounded hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
              )}
            >
              {seeAllText}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardFooter>
        )}
      </Card>
    );
  }
);

PriceTierCard.displayName = 'PriceTierCard';

// ============================================================================
// Skeleton Component for Loading States
// ============================================================================

export function PriceTierCardSkeleton({ className }: { className?: string }) {
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
              <div className="bg-muted mt-2 h-3 w-1/2 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </CardContent>

      {/* Footer Skeleton */}
      <CardFooter className="px-4 pt-0 pb-4">
        <div className="bg-muted h-4 w-20 animate-pulse rounded" />
      </CardFooter>
    </Card>
  );
}

export default PriceTierCard;
