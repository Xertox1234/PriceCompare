'use client';
import * as React from 'react';
import { Link } from 'wouter';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import { cn } from '@/lib/utils';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

export interface DualBannerItem {
  id: number;
  title: string;
  subtitle?: string;
  priceFrom?: number;
  backgroundImage: string;
  productImage?: string;
  link: string;
  variant?: 'default' | 'dark' | 'gradient';
}

interface DualBannerCarouselProps {
  banners: DualBannerItem[];
  className?: string;
}

export function DualBannerCarousel({
  banners,
  className,
}: DualBannerCarouselProps) {
  return (
    <section className={cn('py-8', className)}>
      <div className="container mx-auto px-4">
        <Swiper
          modules={[Pagination]}
          spaceBetween={15}
          slidesPerView={1}
          pagination={{
            clickable: true,
            el: '.dual-banner-pagination',
          }}
          breakpoints={{
            0: { slidesPerView: 1, spaceBetween: 10 },
            768: { slidesPerView: 2, spaceBetween: 20 },
            992: { slidesPerView: 2, spaceBetween: 30 },
          }}
          className="w-full overflow-visible"
        >
          {banners.map((banner) => (
            <SwiperSlide key={banner.id}>
              <DualBannerCard banner={banner} />
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Pagination Dots */}
        <div className="flex dual-banner-pagination justify-center mt-4 gap-1" />
      </div>
    </section>
  );
}

function DualBannerCard({ banner }: { banner: DualBannerItem }) {
  const variant = banner.variant || 'default';

  return (
    <Link href={banner.link}>
      <div className="group relative h-[200px] sm:h-[240px] lg:h-[280px] rounded-xl overflow-hidden cursor-pointer">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url('${banner.backgroundImage}')` }}
        />

        {/* Overlay */}
        <div
          className={cn(
            'absolute inset-0',
            variant === 'dark' && 'bg-slate-900/70',
            variant === 'gradient' && 'bg-gradient-to-r from-slate-900/80 to-slate-900/40',
            variant === 'default' && 'bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-transparent'
          )}
        />

        {/* Product Image (floating) */}
        {banner.productImage && (
          <div className="absolute bottom-0 right-4 lg:right-8 w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 z-10">
            <img
              src={banner.productImage}
              alt=""
              className="w-full h-full object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-110"
            />
          </div>
        )}

        {/* Content */}
        <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between">
          {/* Price Badge */}
          {banner.priceFrom && (
            <div className="self-start bg-template-gold text-black px-3 py-1.5 rounded-lg">
              <p className="text-[10px] uppercase font-medium">From</p>
              <p className="text-lg sm:text-xl font-bold">${banner.priceFrom.toLocaleString()}</p>
            </div>
          )}

          {/* Title & Subtitle */}
          <div className="mt-auto">
            <h3 className="text-white text-lg sm:text-xl lg:text-2xl font-normal leading-tight">
              {banner.title}
              {banner.subtitle && (
                <>
                  <br />
                  <span className="font-bold">{banner.subtitle}</span>
                </>
              )}
            </h3>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Default banner data
export const defaultDualBanners: DualBannerItem[] = [
  {
    id: 1,
    title: 'ThinkPad X1',
    subtitle: 'Carbon 4K HDR',
    priceFrom: 1399,
    backgroundImage: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80',
    productImage: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80',
    link: '/shop?category=laptops',
    variant: 'gradient',
  },
  {
    id: 2,
    title: 'Lenovo ThinkBook',
    subtitle: '8GB/MX450 2GB',
    priceFrom: 399,
    backgroundImage: 'https://images.unsplash.com/photo-1504707748692-419802cf939d?w=800&q=80',
    productImage: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400&q=80',
    link: '/shop?category=laptops',
    variant: 'dark',
  },
];
