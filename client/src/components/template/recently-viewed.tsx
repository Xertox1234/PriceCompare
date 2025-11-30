/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
'use client';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { ProductCard, type ProductData } from './product-card';
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
    return stored ? JSON.parse(stored) : [];
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted text-primary rounded-xl flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              ref={navigationPrevRef}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center transition-all bg-background hover:bg-muted hover:border-primary text-foreground disabled:opacity-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              ref={navigationNextRef}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center transition-all bg-background hover:bg-muted hover:border-primary text-foreground disabled:opacity-50"
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
              <ProductCard
                product={product}
                onWatchlist={onWatchlist}
                onCompare={onCompare}
              />
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Mobile Pagination Dots */}
        <div className="flex xl:hidden recently-viewed-pagination justify-center mt-4 gap-1" />
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
