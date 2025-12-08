'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import type { Swiper as SwiperType } from 'swiper';
import { Flame, Heart, Eye, GitCompare, ShoppingCart } from 'lucide-react';
import { cn, getProductImageUrl, handleImageError } from '@/lib/utils';
import { type ProductData } from './product-card';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/thumbs';
import 'swiper/css/free-mode';

interface DealOfTheDaySectionProps {
  featuredProduct: ProductData & { images?: string[] };
  sideProducts: ProductData[];
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  onQuickView?: (product: ProductData) => void;
  onAddToCart?: (product: ProductData) => void;
  className?: string;
}

export function DealOfTheDaySection({
  featuredProduct,
  sideProducts,
  onWatchlist,
  onCompare,
  onQuickView,
  onAddToCart,
  className,
}: DealOfTheDaySectionProps) {
  return (
    <section className={cn('py-8', className)}>
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-destructive/10 text-destructive flex h-10 w-10 items-center justify-center rounded-xl">
            <Flame className="h-5 w-5 animate-pulse" />
          </div>
          <h2 className="text-primary text-xl font-bold lg:text-2xl">Deal Of The Day</h2>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Featured Product - Takes 3 columns */}
          <div className="lg:col-span-3">
            <FeaturedDealCard
              product={featuredProduct}
              onWatchlist={onWatchlist}
              onCompare={onCompare}
              onQuickView={onQuickView}
            />
          </div>

          {/* Side Products List - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="h-full space-y-4">
              {sideProducts.slice(0, 4).map((product) => (
                <HorizontalDealCard
                  key={product.id}
                  product={product}
                  onWatchlist={onWatchlist}
                  onCompare={onCompare}
                  onQuickView={onQuickView}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Featured Deal Card with Image Gallery
function FeaturedDealCard({
  product,
  onWatchlist,
  onCompare,
  onQuickView,
}: {
  product: ProductData & { images?: string[] };
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  onQuickView?: (product: ProductData) => void;
}) {
  const [_thumbsSwiper, _setThumbsSwiper] = useState<SwiperType | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  // Generate images array from product data
  const images =
    product.images ||
    [product.image, product.hoverImage || product.image, product.image].filter(Boolean);

  const discount = product.originalPrice ? product.originalPrice - product.price : 0;

  return (
    <div className="bg-card border-border h-full rounded-2xl border p-4 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Image Gallery Section */}
        <div className="flex-1">
          {/* Main Image Container */}
          <div className="bg-muted relative mb-4 overflow-hidden rounded-xl">
            {/* Save Badge */}
            {discount > 0 && (
              <span className="absolute top-4 left-4 z-10 inline-flex flex-col items-center rounded-lg bg-red-500 px-3 py-2 text-white">
                <span className="text-xs font-medium uppercase">Save</span>
                <span className="text-lg font-bold">${discount.toFixed(0)}</span>
              </span>
            )}

            {/* Main Image */}
            <Link href={`/product/${product.id}`} className="block aspect-square">
              <img
                src={images[activeImage]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </Link>
          </div>

          {/* Thumbnail Gallery */}
          <div className="flex gap-2">
            {images.map((img, index) => (
              <button
                key={index}
                onClick={() => setActiveImage(index)}
                className={cn(
                  'h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                  activeImage === index
                    ? 'border-primary'
                    : 'hover:border-primary/50 border-transparent'
                )}
              >
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info Section */}
        <div className="flex flex-col lg:w-2/5">
          {/* Title */}
          <Link href={`/product/${product.id}`}>
            <h3 className="text-foreground hover:text-primary mb-4 line-clamp-2 text-lg font-semibold transition-colors lg:text-xl">
              {product.name}
            </h3>
          </Link>

          {/* Price */}
          <div className="mb-4 flex items-baseline gap-3">
            <span className="text-primary text-2xl font-bold lg:text-3xl">
              ${product.price.toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="text-muted-foreground text-lg line-through">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-auto flex items-center gap-2">
            <button
              onClick={() => onWatchlist?.(product)}
              className={cn(
                'border-border hover:border-primary hover:bg-primary/5 rounded-xl border p-3 transition-colors',
                product.inWatchlist && 'bg-destructive/10 border-destructive text-destructive'
              )}
              title="Add to Wishlist"
            >
              <Heart className={cn('h-5 w-5', product.inWatchlist && 'fill-current')} />
            </button>
            <button
              onClick={() => onQuickView?.(product)}
              className="border-border hover:border-primary hover:bg-primary/5 rounded-xl border p-3 transition-colors"
              title="Quick View"
            >
              <Eye className="h-5 w-5" />
            </button>
            <button
              onClick={() => onCompare?.(product)}
              className="border-border hover:border-primary hover:bg-primary/5 rounded-xl border p-3 transition-colors"
              title="Compare"
            >
              <GitCompare className="h-5 w-5" />
            </button>
          </div>

          {/* Countdown Timer */}
          <div className="border-border mt-6 border-t pt-6">
            <CountdownTimer />
          </div>
        </div>
      </div>
    </div>
  );
}

// Horizontal Deal Card for Side Products
function HorizontalDealCard({
  product,
  onWatchlist,
  onCompare,
  onQuickView,
  onAddToCart,
}: {
  product: ProductData;
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  onQuickView?: (product: ProductData) => void;
  onAddToCart?: (product: ProductData) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group bg-card border-border hover:border-primary/50 rounded-xl border p-3 transition-all hover:shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-4">
        {/* Product Image with Hover Effect */}
        <Link href={`/product/${product.id}`} className="flex-shrink-0">
          <div className="bg-muted relative h-24 w-24 overflow-hidden rounded-lg">
            <img
              src={getProductImageUrl(product.image)}
              alt={product.name}
              className={cn(
                'h-full w-full object-cover transition-opacity duration-300',
                isHovered && product.hoverImage ? 'opacity-0' : 'opacity-100'
              )}
              onError={handleImageError}
            />
            {product.hoverImage && (
              <img
                src={product.hoverImage}
                alt={product.name}
                className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
                onError={handleImageError}
              />
            )}
          </div>
        </Link>

        {/* Product Info */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Category */}
          <p className="text-muted-foreground mb-1 text-xs">{product.category}</p>

          {/* Title */}
          <Link href={`/product/${product.id}`}>
            <h4 className="text-foreground hover:text-primary mb-2 line-clamp-2 text-sm font-medium transition-colors">
              {product.name}
            </h4>
          </Link>

          {/* Price and Actions Row */}
          <div className="mt-auto flex items-center justify-between">
            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-primary font-bold">${product.price.toFixed(2)}</span>
              {product.originalPrice && (
                <span className="text-muted-foreground text-xs line-through">
                  ${product.originalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Action Buttons - Appear on Hover */}
            <div
              className={cn(
                'flex items-center gap-1 transition-all duration-300',
                isHovered ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
              )}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onAddToCart?.(product);
                }}
                className="bg-primary hover:bg-primary-hover rounded-lg p-1.5 text-white transition-colors"
                title="Add to Cart"
              >
                <ShoppingCart className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onWatchlist?.(product);
                }}
                className={cn(
                  'border-border hover:border-primary rounded-lg border p-1.5 transition-colors',
                  product.inWatchlist && 'bg-destructive/10 border-destructive text-destructive'
                )}
                title="Add to Wishlist"
              >
                <Heart className={cn('h-4 w-4', product.inWatchlist && 'fill-current')} />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onQuickView?.(product);
                }}
                className="border-border hover:border-primary rounded-lg border p-1.5 transition-colors"
                title="Quick View"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onCompare?.(product);
                }}
                className="border-border hover:border-primary rounded-lg border p-1.5 transition-colors"
                title="Compare"
              >
                <GitCompare className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Countdown Timer Component
function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return Math.max(0, endOfDay.getTime() - now.getTime());
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      setTimeLeft(Math.max(0, endOfDay.getTime() - now.getTime()));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div>
      <p className="text-muted-foreground mb-3 text-sm">Hurry up! Offer ends in:</p>
      <div className="flex items-center gap-2">
        <TimeBlock value={hours} label="Hours" />
        <span className="text-muted-foreground text-2xl font-bold">:</span>
        <TimeBlock value={minutes} label="Mins" />
        <span className="text-muted-foreground text-2xl font-bold">:</span>
        <TimeBlock value={seconds} label="Secs" />
      </div>
    </div>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-muted min-w-[70px] rounded-xl px-4 py-2 text-center">
      <p className="text-foreground text-2xl font-bold">{value.toString().padStart(2, '0')}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

export default DealOfTheDaySection;
