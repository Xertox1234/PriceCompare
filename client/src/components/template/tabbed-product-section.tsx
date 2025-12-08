'use client';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { ProductCard, type ProductData } from './product-card';
import { cn } from '@/lib/utils';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export interface TabConfig {
  id: string;
  label: string;
  filter?: (product: ProductData) => boolean;
}

interface TabbedProductSectionProps {
  tabs: TabConfig[];
  products: ProductData[];
  defaultTab?: string;
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  className?: string;
}

export function TabbedProductSection({
  tabs,
  products,
  defaultTab,
  onWatchlist,
  onCompare,
  className,
}: TabbedProductSectionProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');
  const navigationPrevRef = React.useRef<HTMLButtonElement>(null);
  const navigationNextRef = React.useRef<HTMLButtonElement>(null);

  const filteredProducts = useMemo(() => {
    const activeTabConfig = tabs.find((t) => t.id === activeTab);
    if (!activeTabConfig?.filter) return products;
    return products.filter(activeTabConfig.filter);
  }, [activeTab, products, tabs]);

  return (
    <section className={cn('py-8', className)}>
      <div className="container mx-auto px-4">
        {/* Header with tabs and navigation */}
        <div className="mb-6 flex items-center justify-between">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:px-4 sm:text-base',
                  activeTab === tab.id
                    ? 'text-primary border-primary border-b-2'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Navigation Arrows */}
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
            el: '.tabbed-pagination',
          }}
          breakpoints={{
            0: { slidesPerView: 2, spaceBetween: 10 },
            575: { slidesPerView: 3, spaceBetween: 15 },
            768: { slidesPerView: 4, spaceBetween: 20 },
            992: { slidesPerView: 4, spaceBetween: 30 },
          }}
          className="w-full"
        >
          {filteredProducts.map((product) => (
            <SwiperSlide key={product.id}>
              <ProductCard product={product} onWatchlist={onWatchlist} onCompare={onCompare} />
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Mobile Pagination Dots */}
        <div className="tabbed-pagination mt-4 flex justify-center gap-1 xl:hidden" />
      </div>
    </section>
  );
}

// Pre-configured Feature/Toprate/On Sale variant
export function FeaturedProductTabs({
  products,
  onWatchlist,
  onCompare,
}: {
  products: ProductData[];
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
}) {
  const tabs: TabConfig[] = [
    {
      id: 'featured',
      label: 'Featured',
      filter: (p) => p.discount !== undefined || p.inWatchlist === true,
    },
    {
      id: 'toprate',
      label: 'Top Rated',
      filter: (p) => (p.rating || 0) >= 4.5,
    },
    {
      id: 'onsale',
      label: 'On Sale',
      filter: (p) => p.originalPrice !== undefined && p.originalPrice > p.price,
    },
  ];

  return (
    <TabbedProductSection
      tabs={tabs}
      products={products}
      defaultTab="featured"
      onWatchlist={onWatchlist}
      onCompare={onCompare}
    />
  );
}
