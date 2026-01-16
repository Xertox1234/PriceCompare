import { memo, useMemo, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Star, ShoppingCart, ExternalLink, TrendingUp } from 'lucide-react';
import { ProductWithOffers } from '@shared/schema';
import { cn, getProductImageUrl, handleImageError } from '@/lib/utils';
import { ProductDetailDialog } from './product-detail-dialog';
import { WatchlistToggleButton } from '@/components/watchlist/WatchlistToggleButton';

interface ProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: () => void;
}

export const ProductCard = memo(
  ({ product, onAddToComparison }: ProductCardProps) => {
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);

    // Memoize bestOffer calculation to avoid expensive reduce on every render
    const bestOffer = useMemo(() => {
      if (!product.offers || product.offers.length === 0) return null;
      return product.offers.reduce((best, offer) =>
        Number(offer.price) < Number(best.price) ? offer : best
      );
    }, [product.offers]);

    // Memoize price calculations to avoid recalculation on every render
    const priceInfo = useMemo(() => {
      if (!bestOffer) return null;

      const originalPrice = bestOffer.originalPrice
        ? Number(bestOffer.originalPrice)
        : Number(bestOffer.price);
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
                  'h-4 w-4',
                  i < fullStars
                    ? 'star-filled'
                    : i === fullStars && hasHalfStar
                      ? 'star-filled opacity-50'
                      : 'star-empty'
                )}
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="text-muted-foreground text-sm">{rating}</span>
          <span className="text-muted-foreground text-sm">
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
          <div className="text-muted-foreground text-center">
            <p className="font-medium">{product.name}</p>
            <p className="text-sm">No offers available</p>
          </div>
        </Card>
      );
    }

    const { originalPrice, currentPrice, savings, savingsPercentage } = priceInfo;

    return (
      <Card className="product-card group overflow-hidden rounded-2xl" data-testid="product-card">
        <div className="relative">
          <img
            src={getProductImageUrl(product.image)}
            alt={product.description || product.name}
            className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={handleImageError}
          />

          {/* Deal badge with modern styling */}
          {bestOffer.dealType && (
            <div className="absolute top-4 left-4">
              <Badge className="gradient-deal px-3 py-1 font-semibold text-white shadow-lg">
                {bestOffer.dealType === 'best_price' && '🏆 Best Price'}
                {bestOffer.dealType === 'bundle_deal' && '📦 Bundle Deal'}
                {bestOffer.dealType === 'limited_time' && '⚡ Limited Time'}
              </Badge>
            </div>
          )}

          {/* Savings badge */}
          {savings > 0 && (
            <div className="absolute top-4 right-4">
              <Badge className="gradient-success px-2 py-1 text-xs font-bold text-white">
                -{savingsPercentage}%
              </Badge>
            </div>
          )}

          {/* Glass overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
        </div>

        <div className="space-y-4 p-6">
          {/* Product info */}
          <div className="space-y-2">
            <h3 className="text-foreground group-hover:text-primary line-clamp-2 text-xl font-bold transition-colors">
              {product.name}
            </h3>
            {product.brand && (
              <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                {product.brand}
              </p>
            )}
            {product.category && (
              <p
                className="text-muted-foreground text-xs font-medium"
                data-testid="product-category"
              >
                {product.category}
              </p>
            )}
          </div>

          {/* Rating */}
          {starsElement}

          {/* Pricing */}
          <div className="space-y-2">
            <div className="flex items-baseline space-x-2">
              <span className="text-foreground text-3xl font-black">
                ${currentPrice.toFixed(2)}
              </span>
              {savings > 0 && (
                <span className="text-muted-foreground text-lg line-through">
                  ${originalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Availability */}
            <div className="flex items-center space-x-2">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  bestOffer.availability === 'in_stock' && 'bg-success',
                  bestOffer.availability === 'limited_stock' && 'bg-warning',
                  bestOffer.availability === 'out_of_stock' && 'bg-destructive'
                )}
              ></div>
              <span
                className={cn(
                  'text-sm font-medium',
                  bestOffer.availability === 'in_stock' && 'text-success',
                  bestOffer.availability === 'limited_stock' && 'text-warning',
                  bestOffer.availability === 'out_of_stock' && 'text-destructive'
                )}
              >
                {bestOffer.availability === 'in_stock' && 'In Stock'}
                {bestOffer.availability === 'limited_stock' && 'Limited Stock'}
                {bestOffer.availability === 'out_of_stock' && 'Out of Stock'}
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
                className="hover:border-primary hover:text-primary flex-1"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Compare
              </Button>
              <Button
                size="sm"
                className="gradient-brand flex-1 text-white hover:opacity-90"
                onClick={handleViewDeal}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Deal
              </Button>
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-blue-200 text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                onClick={() => setDetailDialogOpen(true)}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Price History
              </Button>
              <WatchlistToggleButton
                productId={product.id}
                variant="outline"
                size="sm"
                showText={false}
                className="flex-1"
              />
            </div>
          </div>

          {/* Retailer info */}
          <div className="border-border border-t pt-3">
            <p className="text-muted-foreground text-center text-xs font-medium">
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
  },
  (prevProps, nextProps) => {
    // Custom comparison function for optimal memoization
    // Only re-render if product ID changes, offers change, or callback changes
    return (
      prevProps.product.id === nextProps.product.id &&
      prevProps.product.offers === nextProps.product.offers &&
      prevProps.onAddToComparison === nextProps.onAddToComparison
    );
  }
);

ProductCard.displayName = 'ProductCard';
