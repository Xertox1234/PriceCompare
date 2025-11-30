'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import type { Swiper as SwiperType } from 'swiper';
import {
  Flame,
  Heart,
  Eye,
  GitCompare,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-destructive/10 text-destructive rounded-xl flex items-center justify-center">
            <Flame className="h-5 w-5 animate-pulse" />
          </div>
          <h2 className="text-xl lg:text-2xl font-bold text-primary">
            Deal Of The Day
          </h2>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-5 gap-6">
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
            <div className="space-y-4 h-full">
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
  const images = product.images || [
    product.image,
    product.hoverImage || product.image,
    product.image,
  ].filter(Boolean);

  const discount = product.originalPrice
    ? product.originalPrice - product.price
    : 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 lg:p-6 h-full">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Image Gallery Section */}
        <div className="flex-1">
          {/* Main Image Container */}
          <div className="relative rounded-xl overflow-hidden bg-muted mb-4">
            {/* Save Badge */}
            {discount > 0 && (
              <span className="absolute top-4 left-4 z-10 inline-flex flex-col items-center bg-red-500 text-white px-3 py-2 rounded-lg">
                <span className="text-xs uppercase font-medium">Save</span>
                <span className="text-lg font-bold">${discount.toFixed(0)}</span>
              </span>
            )}

            {/* Main Image */}
            <Link href={`/product/${product.id}`} className="block aspect-square">
              <img
                src={images[activeImage]}
                alt={product.name}
                className="w-full h-full object-cover"
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
                  'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors',
                  activeImage === index ? 'border-primary' : 'border-transparent hover:border-primary/50'
                )}
              >
                <img
                  src={img}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info Section */}
        <div className="lg:w-2/5 flex flex-col">
          {/* Title */}
          <Link href={`/product/${product.id}`}>
            <h3 className="text-lg lg:text-xl font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 mb-4">
              {product.name}
            </h3>
          </Link>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-2xl lg:text-3xl font-bold text-primary">
              ${product.price.toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="text-lg text-muted-foreground line-through">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-auto">
            <button
              onClick={() => onWatchlist?.(product)}
              className={cn(
                'p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors',
                product.inWatchlist && 'bg-destructive/10 border-destructive text-destructive'
              )}
              title="Add to Wishlist"
            >
              <Heart className={cn('h-5 w-5', product.inWatchlist && 'fill-current')} />
            </button>
            <button
              onClick={() => onQuickView?.(product)}
              className="p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
              title="Quick View"
            >
              <Eye className="h-5 w-5" />
            </button>
            <button
              onClick={() => onCompare?.(product)}
              className="p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
              title="Compare"
            >
              <GitCompare className="h-5 w-5" />
            </button>
          </div>

          {/* Countdown Timer */}
          <div className="mt-6 pt-6 border-t border-border">
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
      className="group bg-card rounded-xl border border-border p-3 hover:shadow-lg hover:border-primary/50 transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-4">
        {/* Product Image with Hover Effect */}
        <Link href={`/product/${product.id}`} className="flex-shrink-0">
          <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted">
            <img
              src={product.image}
              alt={product.name}
              className={cn(
                'w-full h-full object-cover transition-opacity duration-300',
                isHovered && product.hoverImage ? 'opacity-0' : 'opacity-100'
              )}
            />
            {product.hoverImage && (
              <img
                src={product.hoverImage}
                alt={product.name}
                className={cn(
                  'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              />
            )}
          </div>
        </Link>

        {/* Product Info */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Category */}
          <p className="text-xs text-muted-foreground mb-1">{product.category}</p>

          {/* Title */}
          <Link href={`/product/${product.id}`}>
            <h4 className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2 text-sm mb-2">
              {product.name}
            </h4>
          </Link>

          {/* Price and Actions Row */}
          <div className="flex items-center justify-between mt-auto">
            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-primary">${product.price.toFixed(2)}</span>
              {product.originalPrice && (
                <span className="text-xs text-muted-foreground line-through">
                  ${product.originalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Action Buttons - Appear on Hover */}
            <div
              className={cn(
                'flex items-center gap-1 transition-all duration-300',
                isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
              )}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onAddToCart?.(product);
                }}
                className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
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
                  'p-1.5 rounded-lg border border-border hover:border-primary transition-colors',
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
                className="p-1.5 rounded-lg border border-border hover:border-primary transition-colors"
                title="Quick View"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onCompare?.(product);
                }}
                className="p-1.5 rounded-lg border border-border hover:border-primary transition-colors"
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
      <p className="text-sm text-muted-foreground mb-3">Hurry up! Offer ends in:</p>
      <div className="flex items-center gap-2">
        <TimeBlock value={hours} label="Hours" />
        <span className="text-2xl font-bold text-muted-foreground">:</span>
        <TimeBlock value={minutes} label="Mins" />
        <span className="text-2xl font-bold text-muted-foreground">:</span>
        <TimeBlock value={seconds} label="Secs" />
      </div>
    </div>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-muted rounded-xl px-4 py-2 text-center min-w-[70px]">
      <p className="text-2xl font-bold text-foreground">{value.toString().padStart(2, '0')}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default DealOfTheDaySection;
