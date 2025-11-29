import { memo, useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  emoji: string;
}

interface CategoryPillsBarProps {
  selectedCategory?: string;
  onCategoryChange?: (categoryId: string) => void;
  className?: string;
}

/**
 * Default categories for the pills bar
 * Can be customized by passing different categories via props if needed in the future
 */
const defaultCategories: Category[] = [
  { id: 'all', name: 'Hot Deals', emoji: '🔥' },
  { id: 'electronics', name: 'Electronics', emoji: '💻' },
  { id: 'fashion', name: 'Fashion', emoji: '👗' },
  { id: 'home', name: 'Home', emoji: '🏠' },
  { id: 'gaming', name: 'Gaming', emoji: '🎮' },
  { id: 'phones', name: 'Phones', emoji: '📱' },
];

/**
 * CategoryPillsBar - Horizontally scrollable category filter pills
 *
 * Features:
 * - Horizontally scrollable pill buttons
 * - Active state for selected category
 * - Emoji icons on each pill
 * - Click handler to filter content
 * - Gradient fade on edges to indicate scroll
 */
export const CategoryPillsBar = memo(({
  selectedCategory = 'all',
  onCategoryChange,
  className,
}: CategoryPillsBarProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position and update gradient states
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

  // Handle category selection
  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      onCategoryChange?.(categoryId);
    },
    [onCategoryChange]
  );

  // Scroll selected category into view when selection changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const selectedButton = container.querySelector(
      `[data-category="${selectedCategory}"]`
    );

    if (selectedButton) {
      // Scroll the selected button into view with some padding
      const containerRect = container.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();

      // Check if button is outside visible area
      if (buttonRect.left < containerRect.left + 32) {
        // Scroll left
        container.scrollBy({
          left: buttonRect.left - containerRect.left - 32,
          behavior: 'smooth',
        });
      } else if (buttonRect.right > containerRect.right - 32) {
        // Scroll right
        container.scrollBy({
          left: buttonRect.right - containerRect.right + 32,
          behavior: 'smooth',
        });
      }
    }
  }, [selectedCategory]);

  return (
    <div className={cn('relative', className)}>
      {/* Left gradient fade indicator */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none',
          'bg-gradient-to-r from-background to-transparent',
          'transition-opacity duration-200',
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden="true"
      />

      {/* Right gradient fade indicator */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none',
          'bg-gradient-to-l from-background to-transparent',
          'transition-opacity duration-200',
          canScrollRight ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden="true"
      />

      {/* Scrollable pills container */}
      <div
        ref={scrollContainerRef}
        role="tablist"
        aria-label="Category filters"
        className={cn(
          'flex gap-2 overflow-x-auto',
          // Hide scrollbar
          'scrollbar-hide',
          '[&::-webkit-scrollbar]:hidden',
          '[-ms-overflow-style:none]',
          '[scrollbar-width:none]',
          // Padding for gradient overlap
          'px-1 py-1'
        )}
      >
        {defaultCategories.map((category) => {
          const isSelected = selectedCategory === category.id;

          return (
            <Button
              key={category.id}
              role="tab"
              aria-selected={isSelected}
              data-category={category.id}
              variant="ghost"
              onClick={() => handleCategoryClick(category.id)}
              className={cn(
                // Base pill styles
                'flex-shrink-0 rounded-full px-4 py-2 h-auto',
                'text-sm font-medium',
                'transition-all duration-200',
                // Active/inactive states
                isSelected
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              <span className="mr-1.5" aria-hidden="true">
                {category.emoji}
              </span>
              {category.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
});

CategoryPillsBar.displayName = 'CategoryPillsBar';
