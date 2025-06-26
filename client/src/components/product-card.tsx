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
        <span className="text-sm text-gray-600 dark:text-gray-400">{rating}</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          ({bestOffer.reviewCount?.toLocaleString() || 0})
        </span>
      </div>
    );
  };

  return (
    <Card className="product-card-modern rounded-2xl overflow-hidden group">
      <div className="relative">
        <img
          src={product.image || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=300&fit=crop"}
          alt={product.description || product.name}
          className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        
        {/* Deal badge with modern styling */}
        {bestOffer.dealType && (
          <div className="absolute top-4 left-4">
            <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1 font-semibold shadow-lg">
              {bestOffer.dealType === "best_price" && "🏆 Best Price"}
              {bestOffer.dealType === "bundle_deal" && "📦 Bundle Deal"}
              {bestOffer.dealType === "limited_time" && "⚡ Limited Time"}
            </Badge>
          </div>
        )}
        
        {/* Savings badge */}
        {savings > 0 && (
          <div className="absolute top-4 right-4">
            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 text-xs font-bold">
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
          <h3 className="font-bold text-xl text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {product.name}
          </h3>
          {product.brand && (
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {product.brand}
            </p>
          )}
        </div>

        {/* Rating */}
        {renderStars(bestOffer.rating)}

        {/* Pricing */}
        <div className="space-y-2">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              ${currentPrice.toFixed(2)}
            </span>
            {savings > 0 && (
              <span className="text-lg text-gray-400 dark:text-gray-500 line-through">
                ${originalPrice.toFixed(2)}
              </span>
            )}
          </div>
          
          {/* Availability */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              bestOffer.availability === "in_stock" ? "bg-green-500" :
              bestOffer.availability === "limited_stock" ? "bg-yellow-500" :
              "bg-red-500"
            }`}></div>
            <span className={`text-sm font-medium ${
              bestOffer.availability === "in_stock" ? "text-green-600" :
              bestOffer.availability === "limited_stock" ? "text-yellow-600" :
              "text-red-600"
            }`}>
              {bestOffer.availability === "in_stock" && "In Stock"}
              {bestOffer.availability === "limited_stock" && "Limited Stock"}
              {bestOffer.availability === "out_of_stock" && "Out of Stock"}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex space-x-3 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onAddToComparison}
            className="flex-1 btn-modern border-gray-200 hover:border-blue-300 hover:text-blue-600"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Compare
          </Button>
          <Button 
            size="sm" 
            className="flex-1 btn-modern bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            onClick={() => bestOffer.productUrl && window.open(bestOffer.productUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Deal
          </Button>
        </div>
        
        {/* Retailer info */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center font-medium">
            Available at <span className="text-gray-700 dark:text-gray-300">{bestOffer.retailer.name}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}