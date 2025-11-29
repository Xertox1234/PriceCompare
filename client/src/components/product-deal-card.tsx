import { memo, useMemo, useCallback, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, Heart, ExternalLink, Clock, TrendingDown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { MockProduct } from "@/lib/mock-deals";

// ============================================================================
// Type Definitions
// ============================================================================

export type ProductDealCardVariant = "default" | "flash" | "price-drop" | "trending";

export interface ProductDealCardProps {
  product: MockProduct;
  variant?: ProductDealCardVariant;
  onViewDeal?: (product: MockProduct) => void;
  onWatchlist?: (product: MockProduct) => void;
  isInWatchlist?: boolean;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

interface CountdownTimerProps {
  endsAt: Date;
}

function CountdownTimer({ endsAt }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const diff = endsAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <div className="flex items-center gap-1 text-xs font-semibold">
      <Clock className="h-3 w-3" />
      <span>{timeLeft}</span>
    </div>
  );
}

interface StarRatingProps {
  rating: number;
  reviewCount: number;
}

const StarRating = memo(({ rating, reviewCount }: StarRatingProps) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className="flex items-center gap-1">
      <div className="flex" aria-label={`${rating} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              i < fullStars
                ? "star-filled"
                : i === fullStars && hasHalfStar
                  ? "star-filled opacity-50"
                  : "star-empty"
            )}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {rating.toFixed(1)} ({reviewCount.toLocaleString()})
      </span>
    </div>
  );
});

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ago`;
  }
  return `${minutes}m ago`;
}

// ============================================================================
// Main Component
// ============================================================================

export const ProductDealCard = memo(({
  product,
  variant = "default",
  onViewDeal,
  onWatchlist,
  isInWatchlist = false,
  className,
}: ProductDealCardProps) => {
  const [isWatchlisted, setIsWatchlisted] = useState(isInWatchlist);

  // Sync with prop changes
  useEffect(() => {
    setIsWatchlisted(isInWatchlist);
  }, [isInWatchlist]);

  // Memoize price calculations
  const priceDisplay = useMemo(() => {
    const savings = product.originalPrice - product.currentPrice;
    return {
      current: product.currentPrice.toFixed(2),
      original: product.originalPrice.toFixed(2),
      savings: savings.toFixed(2),
      savingsPercent: product.savingsPercent,
    };
  }, [product.currentPrice, product.originalPrice, product.savingsPercent]);

  // Memoize variant-specific content
  const variantContent = useMemo(() => {
    switch (variant) {
      case "flash":
        return product.flashDealEndsAt ? (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-destructive text-destructive-foreground px-2 py-1">
              <CountdownTimer endsAt={product.flashDealEndsAt} />
            </Badge>
          </div>
        ) : null;

      case "price-drop":
        return product.priceDroppedAt ? (
          <div className="flex items-center gap-1 text-success text-xs font-medium">
            <TrendingDown className="h-3 w-3" />
            <span>Dropped {formatTimeAgo(product.priceDroppedAt)}</span>
          </div>
        ) : null;

      case "trending":
        return product.watchCount ? (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Eye className="h-3 w-3" />
            <span>{product.watchCount.toLocaleString()} watching</span>
          </div>
        ) : null;

      default:
        return null;
    }
  }, [variant, product.flashDealEndsAt, product.priceDroppedAt, product.watchCount]);

  // Handle view deal click
  const handleViewDeal = useCallback(() => {
    onViewDeal?.(product);
  }, [onViewDeal, product]);

  // Handle watchlist toggle
  const handleWatchlistToggle = useCallback(() => {
    setIsWatchlisted((prev) => !prev);
    onWatchlist?.(product);
  }, [onWatchlist, product]);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1",
        "flex flex-col h-full",
        className
      )}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Savings Badge - Top Left */}
        <div className="absolute top-3 left-3 z-10">
          <Badge className="gradient-success text-white px-2 py-1 text-xs font-bold shadow-lg">
            -{priceDisplay.savingsPercent}% OFF
          </Badge>
        </div>

        {/* Variant-specific badge for flash deals - Top Right */}
        {variant === "flash" && variantContent}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content Container */}
      <div className="flex flex-col flex-1 p-4 space-y-3">
        {/* Product Name - 2 line clamp */}
        <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {/* Price Section */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">
              ${priceDisplay.current}
            </span>
            <span className="text-sm text-muted-foreground line-through">
              ${priceDisplay.original}
            </span>
          </div>
        </div>

        {/* Rating */}
        <StarRating rating={product.rating} reviewCount={product.reviewCount} />

        {/* Retailer */}
        <p className="text-xs text-muted-foreground">
          at <span className="font-medium text-foreground">{product.retailer.name}</span>
        </p>

        {/* Variant-specific content (price-drop or trending) */}
        {(variant === "price-drop" || variant === "trending") && variantContent && (
          <div className="pt-1">{variantContent}</div>
        )}

        {/* Spacer to push buttons to bottom */}
        <div className="flex-1 min-h-2" />

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1 gradient-brand text-white hover:opacity-90"
            onClick={handleViewDeal}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            View Deal
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "px-3 transition-colors",
              isWatchlisted
                ? "bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20"
                : "hover:border-destructive hover:text-destructive"
            )}
            onClick={handleWatchlistToggle}
            aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Heart
              className={cn("h-4 w-4", isWatchlisted && "fill-current")}
            />
          </Button>
        </div>
      </div>
    </Card>
  );
});

ProductDealCard.displayName = "ProductDealCard";

// ============================================================================
// Skeleton Component for Loading States
// ============================================================================

export function ProductDealCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Image Skeleton */}
      <div className="aspect-square bg-muted animate-pulse" />

      {/* Content Skeleton */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <div className="h-6 w-20 bg-muted rounded animate-pulse" />
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        </div>

        {/* Rating */}
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />

        {/* Retailer */}
        <div className="h-3 w-24 bg-muted rounded animate-pulse" />

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <div className="flex-1 h-9 bg-muted rounded animate-pulse" />
          <div className="w-10 h-9 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </Card>
  );
}

export default ProductDealCard;
