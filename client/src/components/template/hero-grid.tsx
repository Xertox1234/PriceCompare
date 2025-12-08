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
  dealCards?: Array<{
    title: string;
    subtitle: string;
    discount: number;
    image: string;
    link: string;
    category: string;
  }>;
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
];

const defaultDealCards = [
  {
    title: 'CATCH BIG',
    subtitle: 'DEALS',
    discount: 70,
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80',
    link: '/shop?category=cameras',
    category: 'ON THE CAMERAS',
  },
  {
    title: 'CATCH BIG',
    subtitle: 'DEALS',
    discount: 70,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
    link: '/shop?category=audio',
    category: 'ON THE AUDIO',
  },
];

export function HeroGrid({ slides = defaultSlides, dealCards = defaultDealCards }: HeroGridProps) {
  const [items, setItems] = React.useState(slides);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);

  const handleNext = React.useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    // Move first item to end
    setItems((prev) => [...prev.slice(1), prev[0]]);
    setTimeout(() => setIsAnimating(false), 500);
  }, [isAnimating]);

  const handlePrev = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    // Move last item to beginning
    setItems((prev) => [prev[prev.length - 1], ...prev.slice(0, -1)]);
    setTimeout(() => setIsAnimating(false), 500);
  };

  // Auto-scroll every 3 seconds
  React.useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      handleNext();
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused, handleNext]);

  // The active slide is always the second item (index 1) due to the animation pattern
  const _activeSlide = items[1] || items[0];

  return (
    <section className="py-5">
      <div className="container mx-auto px-4">
        {/* CSS Grid Layout matching template: bb bb aa / bb bb cc */}
        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: '1fr 1fr 1fr',
            gridTemplateAreas: `
              "main main side1"
              "main main side2"
            `,
          }}
        >
          {/* Main Featured Banner with Slider - Takes 2x2 */}
          <div
            className="relative min-h-[550px] overflow-hidden rounded-[10px]"
            style={{ gridArea: 'main' }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Slider Container */}
            <div className="hero-slider absolute inset-0">
              {items.map((slide, index) => (
                <div
                  key={slide.id}
                  className="hero-slide"
                  data-index={index}
                  style={{
                    backgroundImage: `url('${slide.image}')`,
                  }}
                >
                  {/* Content only shows on active slide (index 1) */}
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
                onClick={handlePrev}
                className="flex h-9 w-10 items-center justify-center rounded-lg border-2 border-black/70 bg-white/60 transition-all hover:scale-110 hover:bg-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={handleNext}
                className="flex h-9 w-10 items-center justify-center rounded-lg border-2 border-black/70 bg-white/60 transition-all hover:scale-110 hover:bg-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Deal Card 1 - Top Right */}
          <div style={{ gridArea: 'side1' }}>
            <DealCard {...dealCards[0]} />
          </div>

          {/* Deal Card 2 - Bottom Right */}
          <div style={{ gridArea: 'side2' }}>
            <DealCard {...dealCards[1]} />
          </div>
        </div>
      </div>
    </section>
  );
}

interface DealCardProps {
  title: string;
  subtitle: string;
  discount: number;
  image: string;
  link: string;
  category: string;
}

function DealCard({ title, subtitle, discount, image, link, category }: DealCardProps) {
  return (
    <Link href={link}>
      <div className="group relative h-full min-h-[265px] cursor-pointer overflow-hidden rounded-[10px]">
        {/* Background Image */}
        <img
          src={image}
          alt={`${title} ${subtitle}`}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-slate-900/40" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-between p-6">
          {/* Text Content - Top */}
          <div>
            <p className="text-sm tracking-wider text-slate-200 uppercase">{title}</p>
            <p className="text-2xl font-bold text-white uppercase">{subtitle}</p>
            <p className="text-sm text-slate-200 uppercase">{category}</p>
          </div>

          {/* CTA Button - Bottom */}
          <button className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700">
            <span>Shop now</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Sale Badge - Top Right */}
        <div className="bg-template-gold absolute top-6 right-6 min-w-[60px] rounded-lg px-3 py-2 text-center text-black">
          <p className="text-2xs font-medium uppercase">Sale</p>
          <p className="text-xl leading-tight font-bold">{discount}%</p>
        </div>
      </div>
    </Link>
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
