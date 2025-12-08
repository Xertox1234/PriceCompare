import * as React from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  Flame,
  Clock,
  Sparkles,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ProductCard, ProductData } from './product-card';
import { cn, getProductImageUrl, handleImageError } from '@/lib/utils';

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  products: ProductData[];
  seeAllLink?: string;
  seeAllText?: string;
  variant?: 'grid' | 'list' | 'featured' | 'mixed';
  columns?: 2 | 3 | 4 | 5 | 6;
  showCountdown?: boolean;
  countdownEnd?: Date;
  onWatchlist?: (product: ProductData) => void;
  onCompare?: (product: ProductData) => void;
  className?: string;
}

export function ProductSection({
  title,
  subtitle,
  icon,
  products,
  seeAllLink,
  seeAllText = 'See All',
  variant = 'grid',
  columns = 4,
  showCountdown,
  countdownEnd,
  onWatchlist,
  onCompare,
  className,
}: ProductSectionProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <section className={cn('py-8', className)}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="bg-muted text-primary flex h-10 w-10 items-center justify-center rounded-xl">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-foreground flex items-center gap-2 text-xl font-bold lg:text-2xl">
                {title}
              </h2>
              {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {showCountdown && countdownEnd && <CountdownTimer endDate={countdownEnd} />}
            {seeAllLink && (
              <Link
                href={seeAllLink}
                className="text-primary hover:text-primary-hover flex items-center gap-1 text-sm font-medium transition-colors"
              >
                {seeAllText}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Products Grid */}
        {variant === 'grid' && (
          <div className={cn('grid gap-4 lg:gap-6', gridCols[columns])}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onWatchlist={onWatchlist}
                onCompare={onCompare}
              />
            ))}
          </div>
        )}

        {variant === 'list' && (
          <div className="space-y-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant="horizontal"
                onWatchlist={onWatchlist}
              />
            ))}
          </div>
        )}

        {variant === 'featured' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {products.slice(0, 1).map((product) => (
              <div key={product.id} className="lg:col-span-2">
                <ProductCard product={product} variant="featured" onWatchlist={onWatchlist} />
              </div>
            ))}
            <div className="space-y-4">
              {products.slice(1, 5).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  variant="horizontal"
                  onWatchlist={onWatchlist}
                />
              ))}
            </div>
          </div>
        )}

        {variant === 'mixed' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {/* Featured product takes 2 columns */}
            <div className="lg:col-span-2 lg:row-span-2">
              <ProductCard
                product={products[0]}
                variant="featured"
                onWatchlist={onWatchlist}
                className="h-full"
              />
            </div>
            {/* Regular products */}
            {products.slice(1, 5).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onWatchlist={onWatchlist}
                onCompare={onCompare}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Pre-configured section variants
export function DealOfTheDay({
  products,
  onWatchlist,
}: {
  products: ProductData[];
  onWatchlist?: (product: ProductData) => void;
}) {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return (
    <ProductSection
      title="Deal of the Day"
      icon={<Flame className="h-5 w-5" />}
      products={products}
      variant="featured"
      seeAllLink="/shop?deals=true"
      seeAllText="View All Deals"
      showCountdown
      countdownEnd={endOfDay}
      onWatchlist={onWatchlist}
    />
  );
}

export function TrendingNow({
  products,
  onWatchlist,
}: {
  products: ProductData[];
  onWatchlist?: (product: ProductData) => void;
}) {
  return (
    <ProductSection
      title="Trending Now"
      subtitle="Most watched products this week"
      icon={<TrendingUp className="h-5 w-5" />}
      products={products}
      columns={5}
      seeAllLink="/shop?sort=trending"
      seeAllText="See All Trending"
      onWatchlist={onWatchlist}
    />
  );
}

export function NewArrivals({
  products,
  onWatchlist,
}: {
  products: ProductData[];
  onWatchlist?: (product: ProductData) => void;
}) {
  return (
    <ProductSection
      title="New Arrivals"
      subtitle="Just added to our price tracker"
      icon={<Sparkles className="h-5 w-5" />}
      products={products}
      columns={4}
      seeAllLink="/shop?sort=newest"
      seeAllText="Browse New Products"
      onWatchlist={onWatchlist}
    />
  );
}

// Countdown Timer Component - Live updating
function CountdownTimer({ endDate }: { endDate: Date }) {
  const [timeLeft, setTimeLeft] = React.useState(() => {
    const diff = endDate.getTime() - Date.now();
    return Math.max(0, diff);
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      const diff = endDate.getTime() - Date.now();
      setTimeLeft(Math.max(0, diff));
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div className="flex items-center gap-2">
      <Clock className="text-template-primary h-4 w-4" />
      <div className="flex items-center gap-1 font-mono text-sm">
        <TimeUnit value={hours} label="h" />
        <span className="text-muted-foreground">:</span>
        <TimeUnit value={minutes} label="m" />
        <span className="text-muted-foreground">:</span>
        <TimeUnit value={seconds} label="s" />
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <span className="bg-muted text-template-primary rounded px-2 py-1 font-bold">
      {value.toString().padStart(2, '0')}
      {label}
    </span>
  );
}

// Category Carousel Section with smooth CSS transform-based infinite loop
interface CategoryData {
  id: string;
  name: string;
  image: string;
  productCount: number;
  link: string;
}

export function CategoryGrid({ categories }: { categories: CategoryData[] }) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const trackRef = React.useRef<HTMLDivElement>(null);

  const cardWidth = 220; // card width (200) + gap (20)
  const visibleCards = 5; // approximate visible cards
  const totalOriginal = categories.length;

  // Create extended array: [last few] + [all] + [first few]
  const buffer = visibleCards;
  const extendedCategories = [
    ...categories.slice(-buffer),
    ...categories,
    ...categories.slice(0, buffer),
  ];

  const getTranslateX = () => {
    return -((currentIndex + buffer) * cardWidth);
  };

  // Handle the seamless jump after transition ends
  const handleTransitionEnd = () => {
    setIsTransitioning(false);

    // If we've scrolled past the end, jump to the real start
    if (currentIndex >= totalOriginal) {
      setCurrentIndex(currentIndex - totalOriginal);
    }
    // If we've scrolled before the start, jump to the real end
    else if (currentIndex < 0) {
      setCurrentIndex(currentIndex + totalOriginal);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    if (direction === 'right') {
      setCurrentIndex((prev) => prev + 2);
    } else {
      setCurrentIndex((prev) => prev - 2);
    }
  };

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        {/* Header with navigation */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-foreground text-xl font-bold lg:text-2xl">Browse by Category</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              className={cn(
                'border-border flex h-10 w-10 items-center justify-center rounded-full border transition-all',
                'bg-background hover:bg-muted hover:border-primary text-foreground'
              )}
              style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className={cn(
                'border-border flex h-10 w-10 items-center justify-center rounded-full border transition-all',
                'bg-background hover:bg-muted hover:border-primary text-foreground'
              )}
              style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Carousel container */}
        <div className="overflow-hidden">
          <div
            ref={trackRef}
            className="flex gap-5"
            style={{
              transform: `translateX(${getTranslateX()}px)`,
              transition: isTransitioning
                ? 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)'
                : 'none',
              willChange: 'transform',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {extendedCategories.map((category, index) => (
              <Link key={`${category.id}-${index}`} href={category.link}>
                <div className="group bg-card border-border hover:border-primary w-[200px] flex-shrink-0 overflow-hidden rounded-xl border transition-shadow hover:shadow-lg">
                  <div className="bg-muted aspect-square overflow-hidden">
                    <img
                      src={getProductImageUrl(category.image)}
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={handleImageError}
                    />
                  </div>
                  <div className="p-4 text-center">
                    <h3 className="text-foreground font-semibold">{category.name}</h3>
                    <p className="text-muted-foreground text-sm">
                      {category.productCount} products
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
