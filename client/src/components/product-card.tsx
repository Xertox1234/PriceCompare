import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, ShoppingCart, ExternalLink } from "lucide-react";
import { ProductWithOffers } from "@shared/schema";

interface ProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: () => void;
}

export function ProductCard({ product, onAddToComparison }: ProductCardProps) {
  const bestOffer = product.offers && product.offers.length > 0 
    ? product.offers.reduce((best, offer) => 
        offer.price < best.price ? offer : best
      ) 
    : null;

  if (!bestOffer) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          <p className="font-medium">{product.name}</p>
          <p className="text-sm">No offers available</p>
        </div>
      </Card>
    );
  }

  const originalPrice = bestOffer.originalPrice ? Number(bestOffer.originalPrice) : Number(bestOffer.price);
  const currentPrice = Number(bestOffer.price);
  const savings = originalPrice > currentPrice ? originalPrice - currentPrice : 0;
  const savingsPercentage = savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;

  const renderStars = (rating: string | null) => {
    if (!rating) return null;
    
    const numRating = parseFloat(rating);
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 >= 0.5;
    
    return (
      <div className="flex items-center space-x-1">
        <div className="flex" aria-label={`${rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < fullStars 
                  ? "fill-yellow-400 text-yellow-400" 
                  : i === fullStars && hasHalfStar 
                    ? "fill-yellow-400/50 text-yellow-400" 
                    : "text-gray-300"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
        <span className="text-sm text-gray-600">{rating}</span>
        <span className="text-sm text-gray-600">
          ({bestOffer.reviewCount?.toLocaleString() || 0})
        </span>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <div className="relative">
        <img
          src={product.image || "/api/placeholder/400/300"}
          alt={product.description || product.name}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
        {bestOffer.dealType && (
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              {bestOffer.dealType === "best_price" && "Best Price"}
              {bestOffer.dealType === "bundle_deal" && "Bundle Deal"}
              {bestOffer.dealType === "limited_time" && "Limited Time"}
            </Badge>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-lg mb-1 line-clamp-2">
            {product.name}
          </h3>
          {product.brand && (
            <p className="text-sm text-gray-600">{product.brand}</p>
          )}
        </div>

        {renderStars(bestOffer.rating)}

        <div className="mt-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-primary">
              ${currentPrice.toFixed(2)}
            </span>
            {savings > 0 && (
              <>
                <span className="text-sm text-gray-500 line-through">
                  ${originalPrice.toFixed(2)}
                </span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Save {savingsPercentage}%
                </Badge>
              </>
            )}
          </div>
          
          <div className="flex items-center mt-2">
            <span className={`text-sm ${
              bestOffer.availability === "in_stock" ? "text-green-600" :
              bestOffer.availability === "limited_stock" ? "text-yellow-600" :
              "text-red-600"
            }`}>
              {bestOffer.availability === "in_stock" && "✓ In Stock"}
              {bestOffer.availability === "limited_stock" && "⚠ Limited Stock"}
              {bestOffer.availability === "out_of_stock" && "✗ Out of Stock"}
            </span>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onAddToComparison}
            className="flex-1"
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Compare
          </Button>
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => bestOffer.productUrl && window.open(bestOffer.productUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View Deal
          </Button>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 text-center">
          at {bestOffer.retailer.name}
        </div>
      </div>
    </Card>
  );
}