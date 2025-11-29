import { memo, useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

interface ProductCarouselProps {
  title: string;
  emoji?: string;
  seeAllLink?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * ProductCarousel - A reusable horizontal scrolling carousel wrapper
 *
 * Features:
 * - Section header with emoji + title + "See All" link
 * - Horizontally scrollable container with smooth scroll
 * - Left/right navigation arrows (visible on hover, desktop only)
 * - Scroll buttons disabled at edges
 * - Touch/swipe native support on mobile
 * - Peek next card to indicate more content
 * - Responsive: 4 cards desktop, 2.5 tablet, 1.5 mobile
 */
export const ProductCarousel = memo(({
  title,
  emoji,
  seeAllLink,
  children,
  className,
}: ProductCarouselProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Check scroll position and update button states
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    // Add small threshold for floating point comparison
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  // Initialize and update scroll state
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Initial check
    checkScrollPosition();

    // Listen for scroll events
    container.addEventListener('scroll', checkScrollPosition, { passive: true });

    // Listen for resize events
    const resizeObserver = new ResizeObserver(checkScrollPosition);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
      resizeObserver.disconnect();
    };
  }, [checkScrollPosition]);

  // Scroll by card width on arrow click
  const scroll = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Calculate scroll amount based on visible card width
    // Approximate card width + gap (280px card + 16px gap)
    const cardWidth = 296;
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;

    container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  const handleScrollLeft = useCallback(() => scroll('left'), [scroll]);
  const handleScrollRight = useCallback(() => scroll('right'), [scroll]);

  return (
    <section className={cn('relative', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          {emoji && <span aria-hidden="true">{emoji}</span>}
          {title}
        </h2>
        {seeAllLink && (
          <Link
            href={seeAllLink}
            className="text-primary hover:underline font-medium text-sm flex items-center gap-1 transition-colors"
          >
            See All
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* Carousel container with navigation */}
      <div
        className="relative group"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Left navigation arrow - desktop only, visible on hover */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleScrollLeft}
          disabled={!canScrollLeft}
          aria-label="Scroll left"
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-10',
            'hidden md:flex',
            'h-12 w-12 rounded-full',
            'bg-background/80 backdrop-blur-sm shadow-lg border border-border',
            'hover:bg-background hover:shadow-xl',
            'disabled:opacity-0 disabled:pointer-events-none',
            'transition-all duration-200',
            isHovering && canScrollLeft ? 'opacity-100 -translate-x-2' : 'opacity-0'
          )}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Right navigation arrow - desktop only, visible on hover */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleScrollRight}
          disabled={!canScrollRight}
          aria-label="Scroll right"
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 z-10',
            'hidden md:flex',
            'h-12 w-12 rounded-full',
            'bg-background/80 backdrop-blur-sm shadow-lg border border-border',
            'hover:bg-background hover:shadow-xl',
            'disabled:opacity-0 disabled:pointer-events-none',
            'transition-all duration-200',
            isHovering && canScrollRight ? 'opacity-100 translate-x-2' : 'opacity-0'
          )}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>

        {/* Gradient fade indicators on edges */}
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-8 z-[5] pointer-events-none',
            'bg-gradient-to-r from-background to-transparent',
            'transition-opacity duration-200',
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden="true"
        />
        <div
          className={cn(
            'absolute right-0 top-0 bottom-0 w-8 z-[5] pointer-events-none',
            'bg-gradient-to-l from-background to-transparent',
            'transition-opacity duration-200',
            canScrollRight ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden="true"
        />

        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className={cn(
            'flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory',
            // Hide scrollbar
            'scrollbar-hide',
            '[&::-webkit-scrollbar]:hidden',
            '[-ms-overflow-style:none]',
            '[scrollbar-width:none]',
            // Padding for peek effect
            'px-1 -mx-1',
            // Children card sizing for responsive layout
            // 1.5 cards on mobile, 2.5 on tablet, 4 on desktop
            '[&>*]:flex-shrink-0',
            '[&>*]:w-[calc(100%/1.5-12px)]',
            '[&>*]:sm:w-[calc(100%/2.5-12px)]',
            '[&>*]:lg:w-[calc(100%/4-12px)]',
            '[&>*]:snap-start'
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
});

ProductCarousel.displayName = 'ProductCarousel';
