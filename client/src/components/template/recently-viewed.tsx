'use client';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { ProductCard, type ProductData } from './TemplateProductCard';
import { cn } from '@/lib/utils';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const STORAGE_KEY = 'pricecompare_recently_viewed';
const MAX_ITEMS = 20;

export interface RecentlyViewedItem {
  id: number;
  viewedAt: number;
}

// Helper functions for localStorage
export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentlyViewedItem[];
  } catch {
    return [];
  }
}

export function addToRecentlyViewed(productId: number): void {
  if (typeof window === 'undefined') return;
  try {
    const items = getRecentlyViewed();
    // Remove if already exists
    const filtered = items.filter((item) => item.id !== productId);
    // Add to beginning
    filtered.unshift({ id: productId, viewedAt: Date.now() });
    // Limit to MAX_ITEMS
    const limited = filtered.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch {
    // Ignore localStorage errors
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

interface RecentlyViewedProps {
  allProducts: ProductData[];
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  className?: string;
  title?: string;
  maxDisplay?: number;
}

export function RecentlyViewed({
  allProducts,
  onWatchlist,
  onCompare,
  className,
  title = 'Recently Viewed',
  maxDisplay = 12,
}: RecentlyViewedProps) {
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>([]);
  const navigationPrevRef = React.useRef<HTMLButtonElement>(null);
  const navigationNextRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const items = getRecentlyViewed();
    setRecentlyViewedIds(items.map((item) => item.id));
  }, []);

  // Match product IDs to actual products
  const recentProducts = React.useMemo(() => {
    const productMap = new Map(allProducts.map((p) => [p.id, p]));
    return recentlyViewedIds
      .map((id) => productMap.get(id))
      .filter((p): p is ProductData => p !== undefined)
      .slice(0, maxDisplay);
  }, [recentlyViewedIds, allProducts, maxDisplay]);

  // Don't render if no recently viewed items
  if (recentProducts.length === 0) {
    return null;
  }

  return (
    <section className={cn('py-8', className)}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted text-primary flex h-10 w-10 items-center justify-center rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
            <h2 className="text-foreground text-xl font-bold lg:text-2xl">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              ref={navigationPrevRef}
              className="border-border bg-background hover:bg-muted hover:border-primary text-foreground flex h-10 w-10 items-center justify-center rounded-full border transition-all disabled:opacity-50"
              aria-label="Previous products"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              ref={navigationNextRef}
              className="border-border bg-background hover:bg-muted hover:border-primary text-foreground flex h-10 w-10 items-center justify-center rounded-full border transition-all disabled:opacity-50"
              aria-label="Next products"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Product Carousel */}
        <Swiper
          modules={[Navigation, Pagination]}
          spaceBetween={15}
          slidesPerView={2}
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
            el: '.recently-viewed-pagination',
          }}
          breakpoints={{
            0: { slidesPerView: 2, spaceBetween: 10 },
            575: { slidesPerView: 3, spaceBetween: 15 },
            768: { slidesPerView: 4, spaceBetween: 20 },
            992: { slidesPerView: 4, spaceBetween: 30 },
          }}
          className="w-full"
        >
          {recentProducts.map((product) => (
            <SwiperSlide key={product.id}>
              <ProductCard product={product} onWatchlist={onWatchlist} onCompare={onCompare} />
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Mobile Pagination Dots */}
        <div className="recently-viewed-pagination mt-4 flex justify-center gap-1 xl:hidden" />
      </div>
    </section>
  );
}

// Hook for tracking product views
export function useTrackProductView() {
  const trackView = useCallback((productId: number) => {
    addToRecentlyViewed(productId);
  }, []);

  return trackView;
}
