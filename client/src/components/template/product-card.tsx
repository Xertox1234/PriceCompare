import * as React from 'react';
import { Link } from 'wouter';
import { Heart, BarChart2, Eye, TrendingDown, TrendingUp, Minus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, getProductImageUrl, handleImageError } from '@/lib/utils';

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
    return (
      <HorizontalProductCard product={product} onWatchlist={onWatchlist} className={className} />
    );
  }

  if (variant === 'featured') {
    return (
      <FeaturedProductCard product={product} onWatchlist={onWatchlist} className={className} />
    );
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
        setShowHoverImage((prev) => !prev);
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

  const _currentImage = showHoverImage && product.hoverImage ? product.hoverImage : product.image;

  // Default variant - Expandable card style
  return (
    <div className={cn('expandable-card', className)}>
      {/* Badges */}
      <div className="expandable-card-badges">
        {discountPercent && discountPercent > 0 && (
          <span className="bg-destructive text-destructive-foreground rounded px-2 py-1 text-xs font-bold">
            -{discountPercent}%
          </span>
        )}
        {product.priceChange === 'down' && (
          <span className="bg-success text-success-foreground flex items-center gap-1 rounded px-2 py-1 text-xs font-medium">
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
            className="bg-background hover:bg-muted h-8 w-8 rounded-full shadow-md"
            onClick={(e) => {
              e.preventDefault();
              onWatchlist(product);
            }}
          >
            <Heart
              className={cn('h-4 w-4', product.inWatchlist && 'fill-destructive text-destructive')}
            />
          </Button>
        )}
        {onCompare && (
          <Button
            size="icon"
            variant="secondary"
            className="bg-background hover:bg-muted h-8 w-8 rounded-full shadow-md"
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
            className="bg-background hover:bg-muted h-8 w-8 rounded-full shadow-md"
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
            src={getProductImageUrl(product.image)}
            alt={product.name}
            className={cn(
              'expandable-card-image expandable-card-image-layer',
              showHoverImage && hasHoverImage && 'opacity-0'
            )}
            onError={handleImageError}
          />
          {hasHoverImage && (
            <img
              src={product.hoverImage}
              alt={`${product.name} alternate view`}
              className={cn(
                'expandable-card-image expandable-card-image-layer',
                !showHoverImage && 'opacity-0'
              )}
              onError={handleImageError}
            />
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="expandable-card-content">
        {/* Category */}
        <p className="expandable-card-category">{product.category}</p>

        {/* Name */}
        <Link href={`/product/${product.id}`}>
          <h3 className="expandable-card-name hover:text-primary line-clamp-2 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        {product.rating && (
          <div className="expandable-card-rating">
            <div className="flex items-center">
              {(() => {
                const rating = product.rating;
                if (!rating) return null;
                return Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3 w-3',
                      i < Math.floor(rating) ? 'fill-warning text-warning' : 'text-muted'
                    )}
                  />
                ));
              })()}
            </div>
            {product.reviewCount && (
              <span className="text-muted-foreground text-xs">({product.reviewCount})</span>
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
              <span
                className={cn(
                  'flex items-center gap-1 text-xs',
                  product.priceChange === 'down' && 'text-success',
                  product.priceChange === 'up' && 'text-destructive',
                  product.priceChange === 'stable' && 'text-muted-foreground'
                )}
              >
                {product.priceChange === 'down' && <TrendingDown className="h-3 w-3" />}
                {product.priceChange === 'up' && <TrendingUp className="h-3 w-3" />}
                {product.priceChange === 'stable' && <Minus className="h-3 w-3" />}
                {product.priceChangePercent}%
              </span>
            ) : product.retailer ? (
              <span className="text-muted-foreground text-xs">{product.retailer}</span>
            ) : null}
          </div>

          {/* View button */}
          <Link href={`/product/${product.id}`}>
            <button className="expandable-card-button">View Deal</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function HorizontalProductCard({
  product,
  onWatchlist,
  className,
}: Omit<ProductCardProps, 'variant'>) {
  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : product.discount;

  return (
    <div
      className={cn(
        'group bg-card border-border hover:border-primary flex gap-4 rounded-xl border p-4 transition-all hover:shadow-md',
        className
      )}
    >
      {/* Image */}
      <Link href={`/product/${product.id}`} className="flex-shrink-0">
        <div className="bg-muted relative h-24 w-24 overflow-hidden rounded-lg">
          <img src={getProductImageUrl(product.image)} alt={product.name} className="h-full w-full object-cover" onError={handleImageError} />
          {discountPercent && discountPercent > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute top-1 left-1 rounded px-1.5 py-0.5 text-2xs font-bold">
              -{discountPercent}%
            </span>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs tracking-wider uppercase">{product.category}</p>
        <Link href={`/product/${product.id}`}>
          <h3 className="text-foreground hover:text-primary line-clamp-1 font-semibold transition-colors">
            {product.name}
          </h3>
        </Link>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-foreground font-bold">${product.price.toFixed(2)}</span>
          {product.originalPrice && (
            <span className="text-muted-foreground text-sm line-through">
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
          <Heart
            className={cn('h-4 w-4', product.inWatchlist && 'fill-destructive text-destructive')}
          />
        </Button>
      )}
    </div>
  );
}

function CompactProductCard({
  product,
  onWatchlist: _onWatchlist,
  className,
}: Omit<ProductCardProps, 'variant'>) {
  return (
    <Link href={`/product/${product.id}`}>
      <div
        className={cn(
          'group hover:bg-accent flex items-center gap-3 rounded-lg p-2 transition-colors',
          className
        )}
      >
        <div className="bg-muted h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
          <img src={getProductImageUrl(product.image)} alt={product.name} className="h-full w-full object-cover" onError={handleImageError} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-foreground truncate text-sm font-medium">{product.name}</h4>
          <p className="text-primary text-sm font-bold">${product.price.toFixed(2)}</p>
        </div>
      </div>
    </Link>
  );
}

function FeaturedProductCard({
  product,
  onWatchlist,
  className,
}: Omit<ProductCardProps, 'variant'>) {
  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : product.discount;

  return (
    <div
      className={cn(
        'group bg-card border-border relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl',
        className
      )}
    >
      {/* Large Image */}
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        <img
          src={getProductImageUrl(product.image)}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={handleImageError}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />

        {/* Badges */}
        {discountPercent && discountPercent > 0 && (
          <div className="bg-destructive text-destructive-foreground absolute top-4 left-4 rounded-full px-3 py-1 text-sm font-bold">
            Save {discountPercent}%
          </div>
        )}

        {/* Watchlist Button */}
        {onWatchlist && (
          <Button
            size="icon"
            variant="secondary"
            className="bg-background hover:bg-muted absolute top-4 right-4 h-10 w-10 rounded-full shadow-md"
            onClick={(e) => {
              e.preventDefault();
              onWatchlist(product);
            }}
          >
            <Heart
              className={cn('h-5 w-5', product.inWatchlist && 'fill-destructive text-destructive')}
            />
          </Button>
        )}

        {/* Content Overlay */}
        <div className="absolute right-0 bottom-0 left-0 p-6">
          <p className="mb-1 text-sm tracking-wider text-slate-300 uppercase">{product.category}</p>
          <h3 className="mb-2 text-xl font-bold text-white">{product.name}</h3>
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
