import { Star, Clock, CheckCircle, AlertTriangle, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProductWithOffers } from "@shared/schema";

interface ProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: () => void;
}

export function ProductCard({ product, onAddToComparison }: ProductCardProps) {
  // Get the best offer (lowest price) - handle empty offers array
  const bestOffer = product.offers.length > 0 
    ? product.offers.reduce((best, current) => 
        parseFloat(current.price) < parseFloat(best.price) ? current : best
      )
    : null;

  const getAvailabilityIcon = (availability: string) => {
    switch (availability) {
      case "in_stock":
        return <CheckCircle className="h-4 w-4" aria-hidden="true" />;
      case "limited_stock":
        return <Clock className="h-4 w-4" aria-hidden="true" />;
      case "out_of_stock":
        return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
      default:
        return <CheckCircle className="h-4 w-4" aria-hidden="true" />;
    }
  };

  const getAvailabilityText = (availability: string) => {
    switch (availability) {
      case "in_stock":
        return "In Stock";
      case "limited_stock":
        return "Limited Stock";
      case "out_of_stock":
        return "Out of Stock";
      default:
        return "In Stock";
    }
  };

  const getAvailabilityClass = (availability: string) => {
    switch (availability) {
      case "in_stock":
        return "availability-indicator in-stock";
      case "limited_stock":
        return "availability-indicator limited-stock";
      case "out_of_stock":
        return "availability-indicator out-of-stock";
      default:
        return "availability-indicator in-stock";
    }
  };

  const getDealBadge = (dealType: string | null) => {
    if (!dealType) return null;

    const badgeProps = {
      "best_price": { text: "Best Price", className: "deal-badge best-price" },
      "bundle_deal": { text: "Bundle Deal", className: "deal-badge bundle" },
      "limited_time": { text: "Limited Time", className: "deal-badge limited" },
    };

    const badge = badgeProps[dealType as keyof typeof badgeProps];
    return badge ? <Badge variant="secondary" className={badge.className}>{badge.text}</Badge> : null;
  };

  const renderStars = (rating: string | null) => {
    if (!rating) return null;
    
    const numRating = parseFloat(rating);
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 >= 0.5;
    
    return (
      <div className="flex items-center space-x-1">
        <div className="flex rating-star" aria-label={`${rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < fullStars 
                  ? "fill-accent text-accent" 
                  : i === fullStars && hasHalfStar 
                    ? "fill-accent/50 text-accent" 
                    : "text-muted-foreground"
              }`}
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
  };

  return (
    <article className="product-card bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="relative">
        <img
          src={product.image || "/api/placeholder/400/300"}
          alt={product.description || product.name}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
        <div className="absolute top-2 left-2">
          {getDealBadge(bestOffer.dealType)}
        </div>
      </div>
      
      <div className="p-4">
        <header className="mb-3">
          <h3 className="font-semibold text-foreground text-lg mb-1 line-clamp-2">
            {product.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {bestOffer.retailer.name}
          </p>
        </header>
        
        {/* Rating */}
        <div className="mb-3">
          {renderStars(bestOffer.rating)}
        </div>
        
        {/* Pricing */}
        <div className="mb-4">
          <div className="flex items-baseline space-x-2">
            <span className="price-highlight">
              ${parseFloat(bestOffer.price).toFixed(2)}
            </span>
            {bestOffer.originalPrice && (
              <span className="price-original">
                ${parseFloat(bestOffer.originalPrice).toFixed(2)}
              </span>
            )}
          </div>
          {product.savings && (
            <div className="flex items-center space-x-2 mt-1">
              <span className="price-savings">
                Save ${product.savings.toFixed(2)} ({product.savingsPercentage}%)
              </span>
              {bestOffer.shippingInfo && (
                <Badge variant="outline" className="text-xs">
                  {bestOffer.shippingInfo}
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {/* Availability */}
        <div className="flex items-center justify-between mb-4">
          <span className={getAvailabilityClass(bestOffer.availability || "in_stock")}>
            {getAvailabilityIcon(bestOffer.availability || "in_stock")}
            {getAvailabilityText(bestOffer.availability || "in_stock")}
          </span>
          <span className="text-sm text-muted-foreground">
            {product.offers.length} offer{product.offers.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button 
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible"
            onClick={() => window.open(bestOffer.productUrl, '_blank')}
          >
            View Deal
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="focus-visible"
            onClick={onAddToComparison}
            aria-label={`Add ${product.name} to comparison`}
          >
            <Scale className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}
