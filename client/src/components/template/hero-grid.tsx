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

export function HeroGrid({
  slides = defaultSlides,
  dealCards = defaultDealCards,
}: HeroGridProps) {
  const [items, setItems] = React.useState(slides);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);

  const handleNext = React.useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    // Move first item to end
    setItems(prev => [...prev.slice(1), prev[0]]);
    setTimeout(() => setIsAnimating(false), 500);
  }, [isAnimating]);

  const handlePrev = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    // Move last item to beginning
    setItems(prev => [prev[prev.length - 1], ...prev.slice(0, -1)]);
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
  const activeSlide = items[1] || items[0];

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
            className="relative overflow-hidden rounded-[10px] min-h-[550px]"
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
            <div className="absolute bottom-6 left-10 flex gap-3 z-10">
              <button
                onClick={handlePrev}
                className="w-10 h-9 rounded-lg border-2 border-black/70 bg-white/60 hover:bg-white hover:scale-110 transition-all flex items-center justify-center"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={handleNext}
                className="w-10 h-9 rounded-lg border-2 border-black/70 bg-white/60 hover:bg-white hover:scale-110 transition-all flex items-center justify-center"
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
      <div className="group relative overflow-hidden rounded-[10px] h-full min-h-[265px] cursor-pointer">
        {/* Background Image */}
        <img
          src={image}
          alt={`${title} ${subtitle}`}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-slate-900/40" />

        {/* Content */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between">
          {/* Text Content - Top */}
          <div>
            <p className="text-slate-200 text-sm uppercase tracking-wider">
              {title}
            </p>
            <p className="text-white text-2xl font-bold uppercase">
              {subtitle}
            </p>
            <p className="text-slate-200 text-sm uppercase">
              {category}
            </p>
          </div>

          {/* CTA Button - Bottom */}
          <button className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors w-fit">
            <span>Shop now</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Sale Badge - Top Right */}
        <div className="absolute top-6 right-6 bg-template-gold text-black rounded-lg px-3 py-2 text-center min-w-[60px]">
          <p className="text-[10px] uppercase font-medium leading-tight">Sale</p>
          <p className="text-xl font-bold leading-tight">{discount}%</p>
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
    <section className="relative py-12 lg:py-16 overflow-hidden">
      {/* Background */}
      {backgroundImage ? (
        <div className="absolute inset-0">
          <img
            src={backgroundImage}
            alt=""
            className="w-full h-full object-cover opacity-20 dark:opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background to-muted" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-muted via-background to-muted" />
      )}

      {/* Content */}
      <div className="container mx-auto px-4 relative">
        <div className="max-w-2xl">
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-lg text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
