'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { ProductCard, type ProductData } from './product-card';
import { cn } from '@/lib/utils';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface CategoryCarouselProps {
  title: string;
  category?: string;
  products: ProductData[];
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  className?: string;
  seeAllLink?: string;
}

export function CategoryCarousel({
  title,
  products,
  onWatchlist,
  onCompare,
  className,
}: CategoryCarouselProps) {
  const navigationPrevRef = React.useRef<HTMLButtonElement>(null);
  const navigationNextRef = React.useRef<HTMLButtonElement>(null);
  const uniqueId = React.useId().replace(/:/g, '');

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
            el: `.category-pagination-${uniqueId}`,
          }}
          breakpoints={{
            0: { slidesPerView: 2, spaceBetween: 10 },
            575: { slidesPerView: 3, spaceBetween: 15 },
            768: { slidesPerView: 4, spaceBetween: 20 },
            992: { slidesPerView: 4, spaceBetween: 30 },
          }}
          className="w-full"
        >
          {products.map((product) => (
            <SwiperSlide key={product.id}>
              <ProductCard product={product} onWatchlist={onWatchlist} onCompare={onCompare} />
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Mobile Pagination Dots */}
        <div
          className={`flex xl:hidden category-pagination-${uniqueId} mt-4 justify-center gap-1`}
        />
      </div>
    </section>
  );
}

// Pre-configured variants for common categories
export function LaptopsAndComputers({
  products,
  onWatchlist,
  onCompare,
}: {
  products: ProductData[];
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
}) {
  const filtered = products.filter(
    (p) =>
      p.category?.toLowerCase().includes('laptop') ||
      p.category?.toLowerCase().includes('computer') ||
      p.category?.toLowerCase().includes('tablet')
  );

  return (
    <CategoryCarousel
      title="Laptops, Computers & Tablets"
      products={filtered.length > 0 ? filtered : products.slice(0, 8)}
      onWatchlist={onWatchlist}
      onCompare={onCompare}
    />
  );
}

export function SmartHomeAppliances({
  products,
  onWatchlist,
  onCompare,
}: {
  products: ProductData[];
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
}) {
  const filtered = products.filter(
    (p) =>
      p.category?.toLowerCase().includes('home') ||
      p.category?.toLowerCase().includes('smart') ||
      p.category?.toLowerCase().includes('appliance')
  );

  return (
    <CategoryCarousel
      title="Smart Home Appliances"
      products={filtered.length > 0 ? filtered : products.slice(0, 8)}
      onWatchlist={onWatchlist}
      onCompare={onCompare}
    />
  );
}

export function AudioEquipment({
  products,
  onWatchlist,
  onCompare,
}: {
  products: ProductData[];
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
}) {
  const filtered = products.filter(
    (p) =>
      p.category?.toLowerCase().includes('audio') ||
      p.category?.toLowerCase().includes('headphone') ||
      p.category?.toLowerCase().includes('speaker')
  );

  return (
    <CategoryCarousel
      title="Audio Equipment"
      products={filtered.length > 0 ? filtered : products.slice(0, 8)}
      onWatchlist={onWatchlist}
      onCompare={onCompare}
    />
  );
}
