import { memo, useCallback, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProductDealCard } from './product-deal-card';
import { getProductsByRetailer, retailers, MockProduct } from '@/lib/mock-deals';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

// ============================================================================
// Type Definitions
// ============================================================================

interface RetailerSpotlightProps {
  retailerId: string;
  tagline?: string;
  className?: string;
}

// ============================================================================
// Retailer Brand Configuration
// ============================================================================

interface RetailerBrandConfig {
  name: string;
  gradient: string;
  textColor: string;
  buttonVariant: 'default' | 'secondary' | 'outline';
  buttonClass: string;
}

const retailerBrandConfigs: Record<string, RetailerBrandConfig> = {
  '1': {
    // Amazon
    name: 'Amazon',
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    textColor: 'text-white',
    buttonVariant: 'secondary',
    buttonClass: 'bg-white/90 text-amber-900 hover:bg-white',
  },
  '2': {
    // Target
    name: 'Target',
    gradient: 'from-red-600 via-red-500 to-rose-600',
    textColor: 'text-white',
    buttonVariant: 'secondary',
    buttonClass: 'bg-white/90 text-red-900 hover:bg-white',
  },
  '3': {
    // Best Buy
    name: 'Best Buy',
    gradient: 'from-blue-700 via-blue-600 to-yellow-500',
    textColor: 'text-white',
    buttonVariant: 'secondary',
    buttonClass: 'bg-yellow-400 text-blue-900 hover:bg-yellow-300',
  },
  '4': {
    // Walmart
    name: 'Walmart',
    gradient: 'from-blue-600 via-blue-500 to-blue-700',
    textColor: 'text-white',
    buttonVariant: 'secondary',
    buttonClass: 'bg-yellow-400 text-blue-900 hover:bg-yellow-300',
  },
  '5': {
    // Costco
    name: 'Costco',
    gradient: 'from-red-700 via-red-600 to-blue-800',
    textColor: 'text-white',
    buttonVariant: 'secondary',
    buttonClass: 'bg-white/90 text-red-900 hover:bg-white',
  },
};

// Default brand config for unknown retailers
const defaultBrandConfig: RetailerBrandConfig = {
  name: 'Retailer',
  gradient: 'from-primary via-primary/80 to-primary',
  textColor: 'text-primary-foreground',
  buttonVariant: 'secondary',
  buttonClass: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * RetailerSpotlight - A full-width promotional banner featuring a specific retailer
 *
 * Features:
 * - Full-width card/banner with retailer branding
 * - Retailer name and promotional tagline
 * - Background gradient using retailer's brand color
 * - Mini carousel of that retailer's deals (4-6 products)
 * - "Shop All [Retailer] Deals" CTA button
 * - Uses ProductDealCard for the mini carousel items
 */
export const RetailerSpotlight = memo(({
  retailerId,
  tagline,
  className,
}: RetailerSpotlightProps) => {
  // Get retailer products
  const retailerProducts = useMemo(() => {
    const numericId = parseInt(retailerId, 10);
    if (isNaN(numericId)) return [];
    return getProductsByRetailer(numericId).slice(0, 6);
  }, [retailerId]);

  // Get retailer info
  const retailer = useMemo(() => {
    const numericId = parseInt(retailerId, 10);
    return retailers.find((r) => r.id === numericId);
  }, [retailerId]);

  // Get brand configuration
  const brandConfig = useMemo(() => {
    return retailerBrandConfigs[retailerId] || defaultBrandConfig;
  }, [retailerId]);

  // Generate default tagline if not provided
  const displayTagline = useMemo(() => {
    if (tagline) return tagline;
    return `Exclusive deals from ${brandConfig.name} - Save big today!`;
  }, [tagline, brandConfig.name]);

  // Handle view deal action
  const handleViewDeal = useCallback((product: MockProduct) => {
    window.open(`/products/${product.id}`, '_blank');
  }, []);

  // Handle watchlist toggle
  const handleWatchlist = useCallback((product: MockProduct) => {
    console.info(`Toggled watchlist for product: ${product.id}`);
  }, []);

  // Don't render if no products available
  if (retailerProducts.length === 0 || !retailer) {
    return null;
  }

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-0 shadow-xl',
        className
      )}
    >
      {/* Gradient Background */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-r',
          brandConfig.gradient
        )}
        aria-hidden="true"
      />

      {/* Content Container */}
      <div className="relative p-6 md:p-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="space-y-2">
            {/* Retailer Logo/Name */}
            <div className="flex items-center gap-3">
              {retailer.logo && (
                <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm p-1.5 flex items-center justify-center">
                  <img
                    src={retailer.logo}
                    alt={`${retailer.name} logo`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </div>
              )}
              <h2
                className={cn(
                  'text-2xl md:text-3xl font-bold',
                  brandConfig.textColor
                )}
              >
                {retailer.name} Spotlight
              </h2>
            </div>

            {/* Tagline */}
            <p
              className={cn(
                'text-sm md:text-base opacity-90',
                brandConfig.textColor
              )}
            >
              {displayTagline}
            </p>
          </div>

          {/* CTA Button */}
          <Link href={`/retailers/${retailerId}/deals`}>
            <Button
              variant={brandConfig.buttonVariant}
              size="lg"
              className={cn(
                'shadow-lg font-semibold whitespace-nowrap',
                brandConfig.buttonClass
              )}
            >
              Shop All {retailer.name} Deals
              <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
            </Button>
          </Link>
        </div>

        {/* Products Mini Carousel */}
        <div
          className={cn(
            'flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2',
            // Hide scrollbar
            'scrollbar-hide',
            '[&::-webkit-scrollbar]:hidden',
            '[-ms-overflow-style:none]',
            '[scrollbar-width:none]'
          )}
        >
          {retailerProducts.map((product) => (
            <div
              key={product.id}
              className={cn(
                'flex-shrink-0 snap-start',
                // Responsive widths: 1.5 on mobile, 2.5 on tablet, 4 on desktop
                'w-[calc(100%/1.5-12px)]',
                'sm:w-[calc(100%/2.5-12px)]',
                'lg:w-[calc(100%/4-12px)]'
              )}
            >
              <ProductDealCard
                product={product}
                variant="default"
                onViewDeal={handleViewDeal}
                onWatchlist={handleWatchlist}
              />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
});

RetailerSpotlight.displayName = 'RetailerSpotlight';

export default RetailerSpotlight;
