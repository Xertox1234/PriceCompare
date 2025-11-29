import { memo, useCallback } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MockProduct } from "@/lib/mock-deals";

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

const PriceTierItem = memo(({
  tier,
  onClick,
}: PriceTierItemProps) => {
  const handleClick = useCallback(() => {
    onClick?.(tier);
  }, [onClick, tier]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
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
        "relative cursor-pointer rounded-md overflow-hidden",
        "w-full",
        // Hover effects
        "transition-all duration-200",
        "hover:scale-[1.02] hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      )}
      aria-label={`${tier.label} - ${tier.product.name}`}
    >
      {/* Image Container */}
      <div className="relative aspect-square bg-muted overflow-hidden rounded-md">
        <img
          src={tier.product.imageUrl}
          alt={tier.product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Price Tier Label */}
      <p className="mt-2 text-xs font-semibold text-primary">
        {tier.label}
      </p>
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

PriceTierItem.displayName = "PriceTierItem";

// ============================================================================
// Main Component
// ============================================================================

export const PriceTierCard = memo(({
  title,
  tiers,
  seeAllLink,
  seeAllText = "Shop all",
  onTierClick,
  className,
}: PriceTierCardProps) => {
  // Take only the first 4 tiers
  const displayTiers = tiers.slice(0, 4);

  return (
    <Card
      className={cn(
        "flex flex-col h-full",
        "transition-shadow duration-200 hover:shadow-md",
        className
      )}
    >
      {/* Card Header */}
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-lg font-bold text-foreground leading-tight">
          {title}
        </CardTitle>
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
              <div className="aspect-square bg-muted/50 rounded-md" />
              <div className="mt-2 h-3 w-1/2 bg-muted/50 rounded" />
            </div>
          ))}
      </CardContent>

      {/* Card Footer - See All Link */}
      {seeAllLink && (
        <CardFooter className="pt-0 pb-4 px-4">
          <Link
            href={seeAllLink}
            className={cn(
              "text-sm font-medium text-primary",
              "flex items-center gap-1",
              "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
            )}
          >
            {seeAllText}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </CardFooter>
      )}
    </Card>
  );
});

PriceTierCard.displayName = "PriceTierCard";

// ============================================================================
// Skeleton Component for Loading States
// ============================================================================

export function PriceTierCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("flex flex-col h-full", className)}>
      {/* Header Skeleton */}
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
      </CardHeader>

      {/* Grid Skeleton */}
      <CardContent className="flex-1 px-4 pb-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <div className="aspect-square bg-muted rounded-md animate-pulse" />
              <div className="mt-2 h-3 w-1/2 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </CardContent>

      {/* Footer Skeleton */}
      <CardFooter className="pt-0 pb-4 px-4">
        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
      </CardFooter>
    </Card>
  );
}

export default PriceTierCard;
