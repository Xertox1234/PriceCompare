'use client';
import * as React from 'react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, ShoppingCart, Heart, Eye, GitCompare } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { type ProductData } from './product-card';
import { cn, getProductImageUrl, handleImageError } from '@/lib/utils';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface GroupedProductCarouselProps {
  title: string;
  products: ProductData[];
  groupSize?: number;
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  onQuickview?: (product: ProductData) => void;
  onAddToCart?: (product: ProductData) => void;
  className?: string;
}

export function GroupedProductCarousel({
  title,
  products,
  groupSize = 2,
  onWatchlist,
  onCompare,
  onQuickview,
  onAddToCart,
  className,
}: GroupedProductCarouselProps) {
  const navigationPrevRef = React.useRef<HTMLButtonElement>(null);
  const navigationNextRef = React.useRef<HTMLButtonElement>(null);
  const uniqueId = React.useId().replace(/:/g, '');

  // Group products into pairs (or specified size)
  const groupedProducts = React.useMemo(() => {
    const groups: ProductData[][] = [];
    for (let i = 0; i < products.length; i += groupSize) {
      groups.push(products.slice(i, i + groupSize).filter(Boolean));
    }
    return groups;
  }, [products, groupSize]);

  return (
    <section className={cn('py-8', className)}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-foreground text-xl font-bold lg:text-2xl">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              ref={navigationPrevRef}
              className="border-border bg-background hover:bg-muted hover:border-primary text-foreground flex h-10 w-10 items-center justify-center rounded-full border transition-all disabled:opacity-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              ref={navigationNextRef}
              className="border-border bg-background hover:bg-muted hover:border-primary text-foreground flex h-10 w-10 items-center justify-center rounded-full border transition-all disabled:opacity-50"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Grouped Product Carousel */}
        <Swiper
          modules={[Navigation, Pagination]}
          spaceBetween={15}
          slidesPerView={1}
          navigation={{
            prevEl: navigationPrevRef.current,
            nextEl: navigationNextRef.current,
          }}
          onBeforeInit={(swiper) => {
            // @ts-expect-error - Swiper types don't include navigation object assignment
            swiper.params.navigation.prevEl = navigationPrevRef.current;
            // @ts-expect-error - Swiper types don't include navigation object assignment
            swiper.params.navigation.nextEl = navigationNextRef.current;
          }}
          pagination={{
            clickable: true,
            el: `.grouped-pagination-${uniqueId}`,
          }}
          breakpoints={{
            0: { slidesPerView: 1, spaceBetween: 10 },
            575: { slidesPerView: 2, spaceBetween: 15 },
            768: { slidesPerView: 2, spaceBetween: 20 },
            992: { slidesPerView: 3, spaceBetween: 30 },
          }}
          className="w-full"
        >
          {groupedProducts.map((group, groupIndex) => (
            <SwiperSlide key={groupIndex}>
              <div className="space-y-3">
                {group.map((product) => (
                  <HorizontalProductCard
                    key={product.id}
                    product={product}
                    onWatchlist={onWatchlist}
                    onCompare={onCompare}
                    onQuickview={onQuickview}
                    onAddToCart={onAddToCart}
                  />
                ))}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Mobile Pagination Dots */}
        <div
          className={`flex xl:hidden grouped-pagination-${uniqueId} mt-4 justify-center gap-1`}
        />
      </div>
    </section>
  );
}

// Horizontal Product Card for grouped layout
interface HorizontalProductCardProps {
  product: ProductData;
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  onQuickview?: (product: ProductData) => void;
  onAddToCart?: (product: ProductData) => void;
}

function HorizontalProductCard({
  product,
  onWatchlist,
  onCompare,
  onQuickview,
  onAddToCart,
}: HorizontalProductCardProps) {
  return (
    <div className="group bg-card border-border hover:border-primary/30 flex gap-4 rounded-xl border p-3 transition-all hover:shadow-md">
      {/* Product Image */}
      <Link href={`/product/${product.id}`} className="flex-shrink-0">
        <div className="bg-muted h-20 w-20 overflow-hidden rounded-lg sm:h-24 sm:w-24">
          <img
            src={getProductImageUrl(product.image)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={handleImageError}
          />
        </div>
      </Link>

      {/* Product Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
            {product.category}
          </p>
          <Link href={`/product/${product.id}`}>
            <h3 className="text-foreground hover:text-primary line-clamp-2 text-sm font-semibold transition-colors sm:text-base">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Price and Actions */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-primary text-base font-bold sm:text-lg">
              ${product.price.toFixed(2)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-muted-foreground text-xs line-through sm:text-sm">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {onAddToCart && (
              <button
                onClick={() => onAddToCart(product)}
                className="bg-primary/10 text-primary hover:bg-primary rounded-md p-1.5 transition-colors hover:text-white"
                title="Add to Cart"
              >
                <ShoppingCart className="h-4 w-4" />
              </button>
            )}
            {onWatchlist && (
              <button
                onClick={() => onWatchlist(product)}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  product.inWatchlist
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                )}
                title="Add to Wishlist"
              >
                <Heart className={cn('h-4 w-4', product.inWatchlist && 'fill-current')} />
              </button>
            )}
            {onQuickview && (
              <button
                onClick={() => onQuickview(product)}
                className="bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-md p-1.5 transition-colors"
                title="Quick View"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            {onCompare && (
              <button
                onClick={() => onCompare(product)}
                className="bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary hidden rounded-md p-1.5 transition-colors sm:block"
                title="Compare"
              >
                <GitCompare className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
