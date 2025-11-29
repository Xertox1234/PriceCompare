import { memo, useCallback } from 'react';
import { ProductCarousel } from './product-carousel';
import { ProductDealCard } from './product-deal-card';
import { getFlashDeals, MockProduct } from '@/lib/mock-deals';
import { cn } from '@/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface FlashDealsSectionProps {
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * FlashDealsSection - A specialized section showcasing time-limited deals
 *
 * Features:
 * - Uses ProductCarousel as wrapper component
 * - Red/orange urgent styling with gradient background accent
 * - Displays flash deal products using ProductDealCard with variant="flash"
 * - Urgency messaging for time-limited offers
 */
export const FlashDealsSection = memo(({
  className,
}: FlashDealsSectionProps) => {
  const flashDeals = getFlashDeals();

  // Handle view deal action
  const handleViewDeal = useCallback((product: MockProduct) => {
    // Navigate to product detail or external retailer page
    window.open(`/products/${product.id}`, '_blank');
  }, []);

  // Handle watchlist toggle
  const handleWatchlist = useCallback((product: MockProduct) => {
    // Toggle watchlist status - would integrate with actual watchlist state
    console.info(`Toggled watchlist for product: ${product.id}`);
  }, []);

  // Don't render if no flash deals available
  if (flashDeals.length === 0) {
    return null;
  }

  return (
    <section className={cn('relative', className)}>
      {/* Urgency background accent */}
      <div
        className={cn(
          'absolute inset-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-6 -my-6 rounded-xl',
          'bg-gradient-to-r from-destructive/5 via-orange-500/5 to-destructive/5',
          'border border-destructive/10'
        )}
        aria-hidden="true"
      />

      {/* Content container with relative positioning */}
      <div className="relative">
        {/* Urgency banner */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full',
              'bg-destructive text-destructive-foreground text-xs font-bold',
              'animate-pulse'
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive-foreground opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive-foreground" />
            </span>
            LIVE NOW
          </span>
          <span className="text-sm font-medium text-destructive">
            Ends Soon!
          </span>
        </div>

        <ProductCarousel
          title="FLASH DEALS - Limited Time Only"
          emoji="&#x26A1;"
          seeAllLink="/deals/flash"
        >
          {flashDeals.map((product) => (
            <ProductDealCard
              key={product.id}
              product={product}
              variant="flash"
              onViewDeal={handleViewDeal}
              onWatchlist={handleWatchlist}
            />
          ))}
        </ProductCarousel>
      </div>
    </section>
  );
});

FlashDealsSection.displayName = 'FlashDealsSection';

export default FlashDealsSection;
