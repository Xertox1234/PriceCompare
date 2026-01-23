import * as React from 'react';
import { Link } from 'wouter';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroSlide {
  id: number;
  name: string;
  tagline: string;
  price: number;
  originalPrice?: number;
  image: string;
  discount?: number;
  link: string;
}

interface HeroGridProps {
  slides?: HeroSlide[];
}

const defaultSlides: HeroSlide[] = [
  {
    id: 1,
    name: 'Amazfit GTS 3\nSmartwatch',
    tagline: 'Let power flow through you',
    price: 450,
    originalPrice: 550,
    image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800&q=80',
    discount: 18,
    link: '/product/1',
  },
  {
    id: 2,
    name: 'Sony WH-1000XM5\nHeadphones',
    tagline: 'Immerse yourself in sound',
    price: 328,
    originalPrice: 399,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    discount: 18,
    link: '/product/2',
  },
  {
    id: 3,
    name: 'Canon EOS R6\nMirrorless Camera',
    tagline: 'Capture every moment',
    price: 2299,
    originalPrice: 2499,
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
    discount: 8,
    link: '/product/3',
  },
  {
    id: 4,
    name: 'MacBook Pro 14"\nM3 Pro Chip',
    tagline: 'Power meets portability',
    price: 1799,
    originalPrice: 1999,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
    discount: 10,
    link: '/product/4',
  },
  {
    id: 5,
    name: 'iPad Pro 12.9"\nM2 Chip',
    tagline: 'Your next computer is not a computer',
    price: 999,
    originalPrice: 1099,
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80',
    discount: 9,
    link: '/product/5',
  },
  {
    id: 6,
    name: 'AirPods Pro\n2nd Generation',
    tagline: 'Adaptive Audio. Now playing.',
    price: 229,
    originalPrice: 249,
    image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&q=80',
    discount: 8,
    link: '/product/6',
  },
];

export function HeroGrid({ slides = defaultSlides }: HeroGridProps) {
  const sliderRef = React.useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = React.useState(false);

  // Next: Move first item to the end (like appendChild in original)
  const handleNext = () => {
    if (isAnimating || !sliderRef.current) return;
    setIsAnimating(true);
    const items = sliderRef.current.querySelectorAll('.hero-slide');
    if (items.length > 0) {
      sliderRef.current.appendChild(items[0]);
    }
    setTimeout(() => setIsAnimating(false), 500);
  };

  // Prev: Move last item to the beginning (like prepend in original)
  const handlePrev = () => {
    if (isAnimating || !sliderRef.current) return;
    setIsAnimating(true);
    const items = sliderRef.current.querySelectorAll('.hero-slide');
    if (items.length > 0) {
      sliderRef.current.prepend(items[items.length - 1]);
    }
    setTimeout(() => setIsAnimating(false), 500);
  };

  // Click on thumbnail slides (nth-child 3+) to go next
  const handleSlideClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const slide = target.closest('.hero-slide');
    if (!slide || !sliderRef.current) return;
    
    const items = Array.from(sliderRef.current.querySelectorAll('.hero-slide'));
    const index = items.indexOf(slide);
    
    // Only thumbnail slides (index 2+) are clickable
    if (index >= 2) {
      handleNext();
    }
  };

  return (
    <section className="py-5 overflow-x-clip">
      <div className="container mx-auto px-4 overflow-visible">
        {/* Full-width Hero Slider - overflow visible on right for partial thumbnail */}
        <div
          className="relative rounded-[10px] overflow-visible"
        >
            {/* Slider Container */}
            <div 
              ref={sliderRef} 
              className="hero-slider"
              onClick={handleSlideClick}
            >
              {slides.map((slide) => (
                <div
                  key={slide.id}
                  className="hero-slide"
                  style={{
                    backgroundImage: `url('${slide.image}')`,
                  }}
                >
                  {/* Content only shows on active slide (nth-child(2) in CSS) */}
                  <div className="hero-slide-content">
                    <p className="hero-slide-tagline">{slide.tagline}</p>
                    <h2 className="hero-slide-name">{slide.name}</h2>
                    <div className="hero-slide-price-block">
                      <p className="hero-slide-price-label">Price</p>
                      <p className="hero-slide-price">${slide.price}</p>
                    </div>
                    <Link href={slide.link}>
                      <button className="hero-slide-button">
                        <span>Now Available</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="absolute bottom-6 left-10 z-10 flex gap-3">
              <button
                type="button"
                onClick={handleNext}
                className="flex h-9 w-10 items-center justify-center rounded-lg border-2 border-black/70 bg-white/60 transition-all hover:scale-110 hover:bg-white"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handlePrev}
                className="flex h-9 w-10 items-center justify-center rounded-lg border-2 border-black/70 bg-white/60 transition-all hover:scale-110 hover:bg-white"
                aria-label="Next slide"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
      </div>
    </section>
  );
}

// Compact hero variant for secondary pages
export function HeroCompact({
  title,
  subtitle,
  backgroundImage,
}: {
  title: string;
  subtitle?: string;
  backgroundImage?: string;
}) {
  return (
    <section className="relative overflow-hidden py-12 lg:py-16">
      {/* Background */}
      {backgroundImage ? (
        <div className="absolute inset-0">
          <img
            src={backgroundImage}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-20 dark:opacity-10"
          />
          <div className="from-background via-background to-muted absolute inset-0 bg-gradient-to-r" />
        </div>
      ) : (
        <div className="from-muted via-background to-muted absolute inset-0 bg-gradient-to-br" />
      )}

      {/* Content */}
      <div className="relative container mx-auto px-4">
        <div className="max-w-2xl">
          <h1 className="text-foreground mb-2 text-3xl font-bold lg:text-4xl">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-lg">{subtitle}</p>}
        </div>
      </div>
    </section>
  );
}
