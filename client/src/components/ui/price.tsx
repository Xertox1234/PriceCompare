/**
 * Price Display Component (TODO 251)
 *
 * Displays prices with proper currency formatting based on user's country selection.
 * Uses the CountryContext for currency symbol and formatting.
 *
 * @example
 * ```tsx
 * <Price value={99.99} />                    // $99.99 or C$99.99
 * <Price value={99.99} className="text-xl" /> // Custom styling
 * <Price value="149.99" />                   // Accepts strings too
 * ```
 */

import React from 'react';
import { useCountry } from '@/context/country-context';
import { cn } from '@/lib/utils';

interface PriceProps {
  /** Price value (number or string) */
  value: number | string | null | undefined;
  /** Additional CSS classes */
  className?: string;
  /** Show strikethrough styling (for original prices) */
  strikethrough?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
};

// Memoized to prevent unnecessary re-renders in product lists (TODO 260)
function PriceComponent({
  value,
  className,
  strikethrough = false,
  size = 'md',
}: PriceProps) {
  const { formatPrice } = useCountry();

  if (value === null || value === undefined) {
    return <span className={cn(sizeClasses[size], className)}>—</span>;
  }

  const formatted = formatPrice(value);

  return (
    <span
      className={cn(
        sizeClasses[size],
        strikethrough && 'text-muted-foreground line-through',
        className
      )}
    >
      {formatted}
    </span>
  );
}

PriceComponent.displayName = 'Price';
export const Price = React.memo(PriceComponent);

/**
 * Price with discount display
 *
 * Shows current price and optionally the original price with savings.
 *
 * @example
 * ```tsx
 * <PriceWithDiscount price={79.99} originalPrice={99.99} />
 * ```
 */
interface PriceWithDiscountProps {
  /** Current/discounted price */
  price: number | string;
  /** Original price (before discount) */
  originalPrice?: number | string | null;
  /** Show savings amount */
  showSavings?: boolean;
  /** Size variant for the main price */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes for container */
  className?: string;
}

export function PriceWithDiscount({
  price,
  originalPrice,
  showSavings = true,
  size = 'lg',
  className,
}: PriceWithDiscountProps) {
  const { formatPrice } = useCountry();

  const currentPrice = typeof price === 'string' ? parseFloat(price) : price;
  const origPrice = originalPrice
    ? typeof originalPrice === 'string'
      ? parseFloat(originalPrice)
      : originalPrice
    : null;

  const hasDiscount = origPrice && origPrice > currentPrice;
  const savings = hasDiscount ? origPrice - currentPrice : 0;

  return (
    <div className={cn('flex flex-wrap items-baseline gap-2', className)}>
      <Price value={price} size={size} className="text-primary font-bold" />
      
      {hasDiscount && (
        <>
          <Price value={originalPrice} size="sm" strikethrough />
          {showSavings && savings > 0 && (
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              Save {formatPrice(savings)}
            </span>
          )}
        </>
      )}
    </div>
  );
}
