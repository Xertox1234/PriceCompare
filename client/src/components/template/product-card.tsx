import * as React from 'react';
import { Link } from 'wouter';
import { Heart, BarChart2, Eye, TrendingDown, TrendingUp, Minus, Star, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Random interval options: 5, 10, or 15 seconds
const TRANSITION_INTERVALS = [5000, 10000, 15000];

function getRandomInterval() {
  return TRANSITION_INTERVALS[Math.floor(Math.random() * TRANSITION_INTERVALS.length)];
}

export interface ProductData {
  id: number;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  hoverImage?: string;
  rating?: number;
  reviewCount?: number;
  discount?: number;
  priceChange?: 'up' | 'down' | 'stable';
  priceChangePercent?: number;
  retailer?: string;
  retailerLogo?: string;
  inWatchlist?: boolean;
}

interface ProductCardProps {
  product: ProductData;
  variant?: 'default' | 'compact' | 'horizontal' | 'featured';
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  onQuickView?: (product: ProductData) => void;
  className?: string;
}

export function ProductCard({
  product,
  variant = 'default',
  onWatchlist,
  onCompare,
  onQuickView,
  className,
}: ProductCardProps) {
  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : product.discount;

  if (variant === 'horizontal') {
    return <HorizontalProductCard product={product} onWatchlist={onWatchlist} className={className} />;
  }

  if (variant === 'featured') {
    return <FeaturedProductCard product={product} onWatchlist={onWatchlist} className={className} />;
  }

  if (variant === 'compact') {
    return <CompactProductCard product={product} onWatchlist={onWatchlist} className={className} />;
  }

  // Auto-transitioning image state
  const [showHoverImage, setShowHoverImage] = React.useState(false);
  const hasHoverImage = !!product.hoverImage;

  // Set up random interval image transitions
  React.useEffect(() => {
    if (!hasHoverImage) return;

    let timeoutId: NodeJS.Timeout;

    const scheduleNextTransition = () => {
      const interval = getRandomInterval();
      timeoutId = setTimeout(() => {
        setShowHoverImage(prev => !prev);
        scheduleNextTransition();
      }, interval);
    };

    // Start with a random initial delay
    const initialDelay = getRandomInterval();
    timeoutId = setTimeout(() => {
      setShowHoverImage(true);
      scheduleNextTransition();
    }, initialDelay);

    return () => clearTimeout(timeoutId);
  }, [hasHoverImage]);

  const currentImage = showHoverImage && product.hoverImage ? product.hoverImage : product.image;

  // Default variant - Expandable card style
  return (
    <div className={cn("expandable-card", className)}>
      {/* Badges */}
      <div className="expandable-card-badges">
        {discountPercent && discountPercent > 0 && (
          <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded">
            -{discountPercent}%
          </span>
        )}
        {product.priceChange === 'down' && (
          <span className="bg-success text-success-foreground text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            Drop
          </span>
        )}
      </div>

      {/* Quick Actions */}
      <div className="expandable-card-quick-actions">
        {onWatchlist && (
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full bg-background shadow-md hover:bg-muted"
            onClick={(e) => {
              e.preventDefault();
              onWatchlist(product);
            }}
          >
            <Heart className={cn("h-4 w-4", product.inWatchlist && "fill-destructive text-destructive")} />
          </Button>
        )}
        {onCompare && (
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full bg-background shadow-md hover:bg-muted"
            onClick={(e) => {
              e.preventDefault();
              onCompare(product);
            }}
          >
            <BarChart2 className="h-4 w-4" />
          </Button>
        )}
        {onQuickView && (
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full bg-background shadow-md hover:bg-muted"
            onClick={(e) => {
              e.preventDefault();
              onQuickView(product);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Auto-transitioning Image */}
      <Link href={`/product/${product.id}`}>
        <div className="expandable-card-image-container">
          <img
            src={product.image}
            alt={product.name}
            className={cn(
              "expandable-card-image expandable-card-image-layer",
              showHoverImage && hasHoverImage && "opacity-0"
            )}
          />
          {hasHoverImage && (
            <img
              src={product.hoverImage}
              alt={`${product.name} alternate view`}
              className={cn(
                "expandable-card-image expandable-card-image-layer",
                !showHoverImage && "opacity-0"
              )}
            />
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="expandable-card-content">
        {/* Category */}
        <p className="expandable-card-category">
          {product.category}
        </p>

        {/* Name */}
        <Link href={`/product/${product.id}`}>
          <h3 className="expandable-card-name line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        {product.rating && (
          <div className="expandable-card-rating">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-3 w-3",
                    i < Math.floor(product.rating!) ? "fill-warning text-warning" : "text-muted"
                  )}
                />
              ))}
            </div>
            {product.reviewCount && (
              <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="expandable-card-price-row">
          <span className="expandable-card-price">${product.price.toFixed(2)}</span>
          {product.originalPrice && (
            <span className="expandable-card-original-price">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Actions row */}
        <div className="expandable-card-actions">
          {/* Price Change or Retailer */}
          <div className="flex items-center gap-1">
            {product.priceChange && product.priceChangePercent ? (
              <span className={cn(
                "flex items-center gap-1 text-xs",
                product.priceChange === 'down' && "text-success",
                product.priceChange === 'up' && "text-destructive",
                product.priceChange === 'stable' && "text-muted-foreground"
              )}>
                {product.priceChange === 'down' && <TrendingDown className="h-3 w-3" />}
                {product.priceChange === 'up' && <TrendingUp className="h-3 w-3" />}
                {product.priceChange === 'stable' && <Minus className="h-3 w-3" />}
                {product.priceChangePercent}%
              </span>
            ) : product.retailer ? (
              <span className="text-xs text-muted-foreground">{product.retailer}</span>
            ) : null}
          </div>

          {/* View button */}
          <Link href={`/product/${product.id}`}>
            <button className="expandable-card-button">
              View Deal
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function HorizontalProductCard({ product, onWatchlist, className }: Omit<ProductCardProps, 'variant'>) {
  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : product.discount;

  return (
    <div className={cn(
      "group flex gap-4 bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary transition-all",
      className
    )}>
      {/* Image */}
      <Link href={`/product/${product.id}`} className="flex-shrink-0">
        <div className="relative w-24 h-24 bg-muted rounded-lg overflow-hidden">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          {discountPercent && discountPercent > 0 && (
            <span className="absolute top-1 left-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
              -{discountPercent}%
            </span>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{product.category}</p>
        <Link href={`/product/${product.id}`}>
          <h3 className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-bold text-foreground">${product.price.toFixed(2)}</span>
          {product.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {onWatchlist && (
        <Button
          size="icon"
          variant="ghost"
          className="flex-shrink-0"
          onClick={() => onWatchlist(product)}
        >
          <Heart className={cn("h-4 w-4", product.inWatchlist && "fill-destructive text-destructive")} />
        </Button>
      )}
    </div>
  );
}

function CompactProductCard({ product, onWatchlist, className }: Omit<ProductCardProps, 'variant'>) {
  return (
    <Link href={`/product/${product.id}`}>
      <div className={cn(
        "group flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors",
        className
      )}>
        <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate">{product.name}</h4>
          <p className="text-sm font-bold text-primary">${product.price.toFixed(2)}</p>
        </div>
      </div>
    </Link>
  );
}

function FeaturedProductCard({ product, onWatchlist, className }: Omit<ProductCardProps, 'variant'>) {
  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : product.discount;

  return (
    <div className={cn(
      "group relative bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300",
      className
    )}>
      {/* Large Image */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />

        {/* Badges */}
        {discountPercent && discountPercent > 0 && (
          <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground text-sm font-bold px-3 py-1 rounded-full">
            Save {discountPercent}%
          </div>
        )}

        {/* Watchlist Button */}
        {onWatchlist && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-background shadow-md hover:bg-muted"
            onClick={(e) => {
              e.preventDefault();
              onWatchlist(product);
            }}
          >
            <Heart className={cn("h-5 w-5", product.inWatchlist && "fill-destructive text-destructive")} />
          </Button>
        )}

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <p className="text-slate-300 text-sm uppercase tracking-wider mb-1">{product.category}</p>
          <h3 className="text-white text-xl font-bold mb-2">{product.name}</h3>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white">${product.price.toFixed(2)}</span>
            {product.originalPrice && (
              <span className="text-lg text-slate-400 line-through">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
