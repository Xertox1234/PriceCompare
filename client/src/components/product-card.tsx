import { memo, useMemo, useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, ShoppingCart, ExternalLink, TrendingUp } from "lucide-react";
import { ProductWithOffers } from "@shared/schema";
import { cn } from "@/lib/utils";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/constants";
import { ProductDetailDialog } from "./product-detail-dialog";

interface ProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: () => void;
}

export const ProductCard = memo(({ product, onAddToComparison }: ProductCardProps) => {
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Memoize bestOffer calculation to avoid expensive reduce on every render
  const bestOffer = useMemo(() => {
    if (!product.offers || product.offers.length === 0) return null;
    return product.offers.reduce((best, offer) =>
      offer.price < best.price ? offer : best
    );
  }, [product.offers]);

  // Memoize price calculations to avoid recalculation on every render
  const priceInfo = useMemo(() => {
    if (!bestOffer) return null;

    const originalPrice = bestOffer.originalPrice ? Number(bestOffer.originalPrice) : Number(bestOffer.price);
    const currentPrice = Number(bestOffer.price);
    const savings = originalPrice > currentPrice ? originalPrice - currentPrice : 0;
    const savingsPercentage = savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;

    return { originalPrice, currentPrice, savings, savingsPercentage };
  }, [bestOffer]);

  // Memoize stars rendering to avoid creating new arrays on every render
  const starsElement = useMemo(() => {
    if (!bestOffer?.rating) return null;

    const rating = bestOffer.rating;
    const numRating = parseFloat(rating);
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 >= 0.5;

    return (
      <div className="flex items-center space-x-1">
        <div className="flex" aria-label={`${rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
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
        <span className="text-sm text-muted-foreground">{rating}</span>
        <span className="text-sm text-muted-foreground">
          ({bestOffer.reviewCount?.toLocaleString() || 0})
        </span>
      </div>
    );
  }, [bestOffer?.rating, bestOffer?.reviewCount]);

  // Memoize click handler for View Deal button
  const handleViewDeal = useCallback(() => {
    if (bestOffer?.productUrl) {
      // Security: Use noopener and noreferrer to prevent tabnabbing
      const link = document.createElement('a');
      link.href = bestOffer.productUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    }
  }, [bestOffer?.productUrl]);

  if (!bestOffer || !priceInfo) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          <p className="font-medium">{product.name}</p>
          <p className="text-sm">No offers available</p>
        </div>
      </Card>
    );
  }

  const { originalPrice, currentPrice, savings, savingsPercentage } = priceInfo;

  return (
    <Card className="rounded-2xl overflow-hidden group">
      <div className="relative">
        <img
          src={product.image || DEFAULT_PRODUCT_IMAGE}
          alt={product.description || product.name}
          className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Deal badge with modern styling */}
        {bestOffer.dealType && (
          <div className="absolute top-4 left-4">
            <Badge className="gradient-deal text-white px-3 py-1 font-semibold shadow-lg">
              {bestOffer.dealType === "best_price" && "🏆 Best Price"}
              {bestOffer.dealType === "bundle_deal" && "📦 Bundle Deal"}
              {bestOffer.dealType === "limited_time" && "⚡ Limited Time"}
            </Badge>
          </div>
        )}

        {/* Savings badge */}
        {savings > 0 && (
          <div className="absolute top-4 right-4">
            <Badge className="gradient-success text-white px-2 py-1 text-xs font-bold">
              -{savingsPercentage}%
            </Badge>
          </div>
        )}

        {/* Glass overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>
      
      <div className="p-6 space-y-4">
        {/* Product info */}
        <div className="space-y-2">
          <h3 className="font-bold text-xl text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          {product.brand && (
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {product.brand}
            </p>
          )}
        </div>

        {/* Rating */}
        {starsElement}

        {/* Pricing */}
        <div className="space-y-2">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-foreground">
              ${currentPrice.toFixed(2)}
            </span>
            {savings > 0 && (
              <span className="text-lg text-muted-foreground line-through">
                ${originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* Availability */}
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              bestOffer.availability === "in_stock" && "bg-success",
              bestOffer.availability === "limited_stock" && "bg-warning",
              bestOffer.availability === "out_of_stock" && "bg-destructive"
            )}></div>
            <span className={cn(
              "text-sm font-medium",
              bestOffer.availability === "in_stock" && "text-success",
              bestOffer.availability === "limited_stock" && "text-warning",
              bestOffer.availability === "out_of_stock" && "text-destructive"
            )}>
              {bestOffer.availability === "in_stock" && "In Stock"}
              {bestOffer.availability === "limited_stock" && "Limited Stock"}
              {bestOffer.availability === "out_of_stock" && "Out of Stock"}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          <div className="flex space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onAddToComparison}
              className="flex-1 hover:border-primary hover:text-primary"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Compare
            </Button>
            <Button
              size="sm"
              className="flex-1 gradient-brand text-white hover:opacity-90"
              onClick={handleViewDeal}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Deal
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => setDetailDialogOpen(true)}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            View Price History
          </Button>
        </div>
        
        {/* Retailer info */}
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center font-medium">
            Available at <span className="text-foreground">{bestOffer.retailer.name}</span>
          </p>
        </div>
      </div>

      {/* Product Detail Dialog with Price History */}
      <ProductDetailDialog
        product={product}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal memoization
  // Only re-render if product ID changes, offers change, or callback changes
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.offers === nextProps.product.offers &&
    prevProps.onAddToComparison === nextProps.onAddToComparison
  );
});

ProductCard.displayName = 'ProductCard';