import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePriceStats } from '@/hooks/use-price-history';

interface PriceChangeBadgeProps {
  productId: number;
  offerId: number;
  variant?: 'default' | 'detailed';
  className?: string;
}

export function PriceChangeBadge({
  productId,
  offerId,
  variant = 'default',
  className,
}: PriceChangeBadgeProps) {
  const { data: stats, isLoading, isError } = usePriceStats(productId, offerId, 90);

  if (isLoading) {
    return (
      <Badge variant="secondary" className={cn('text-xs', className)}>
        <Minus className="mr-1 h-3 w-3" />
        Loading...
      </Badge>
    );
  }

  if (isError || !stats || stats.priceChange24h === undefined) {
    return null;
  }

  const change = stats.priceChange24h;
  const changePercent = stats.priceChangePercent24h || 0;
  const isDecrease = change < 0;
  const isIncrease = change > 0;

  const TrendIcon = isDecrease ? TrendingDown : isIncrease ? TrendingUp : Minus;
  const badgeVariant = isDecrease ? 'default' : isIncrease ? 'destructive' : 'secondary';

  if (variant === 'detailed') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={badgeVariant} className={cn('cursor-help text-xs', className)}>
              <TrendIcon className="mr-1 h-3 w-3" />
              {changePercent > 0 ? '+' : ''}
              {changePercent.toFixed(1)}% (24h)
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <div className="font-semibold">Price Changes</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">24h:</span>
                  <span
                    className={cn(
                      'font-medium',
                      isDecrease && 'text-success',
                      isIncrease && 'text-destructive'
                    )}
                  >
                    {change < 0 ? '' : '+'}
                    {change.toFixed(2)} ({changePercent.toFixed(1)}%)
                  </span>
                </div>
                {stats.priceChange7d !== undefined && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">7d:</span>
                    <span
                      className={cn(
                        'font-medium',
                        stats.priceChange7d < 0 && 'text-success',
                        stats.priceChange7d > 0 && 'text-destructive'
                      )}
                    >
                      {stats.priceChange7d < 0 ? '' : '+'}
                      {stats.priceChange7d.toFixed(2)} ({stats.priceChangePercent7d?.toFixed(1)}%)
                    </span>
                  </div>
                )}
                {stats.priceChange30d !== undefined && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">30d:</span>
                    <span
                      className={cn(
                        'font-medium',
                        stats.priceChange30d < 0 && 'text-success',
                        stats.priceChange30d > 0 && 'text-destructive'
                      )}
                    >
                      {stats.priceChange30d < 0 ? '' : '+'}
                      {stats.priceChange30d.toFixed(2)} ({stats.priceChangePercent30d?.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1 border-t pt-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Lowest:</span>
                  <span className="font-medium text-success">
                    ${stats.lowestPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Highest:</span>
                  <span className="font-medium text-destructive">${stats.highestPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Average:</span>
                  <span className="font-medium">${stats.averagePrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant={badgeVariant} className={cn('text-xs', className)}>
      <TrendIcon className="mr-1 h-3 w-3" />
      {changePercent > 0 ? '+' : ''}
      {changePercent.toFixed(1)}%
    </Badge>
  );
}

/**
 * Compact badge showing if price is at lowest point
 */
export function LowestPriceBadge({
  productId,
  offerId,
  className,
}: Omit<PriceChangeBadgeProps, 'variant'>) {
  const { data: stats, isLoading } = usePriceStats(productId, offerId, 90);

  if (isLoading || !stats) {
    return null;
  }

  // Check if current price is within 1% of the lowest price
  const isLowest = Math.abs(stats.currentPrice - stats.lowestPrice) / stats.lowestPrice < 0.01;

  if (!isLowest) {
    return null;
  }

  return (
    <Badge variant="default" className={cn('bg-success text-xs', className)}>
      <TrendingDown className="mr-1 h-3 w-3" />
      Lowest Price!
    </Badge>
  );
}

/**
 * Simple badge showing price trend icon
 */
export function PriceTrendIcon({
  productId,
  offerId,
  className,
}: Omit<PriceChangeBadgeProps, 'variant'>) {
  const { data: stats, isLoading } = usePriceStats(productId, offerId, 30);

  if (isLoading || !stats || stats.priceChange24h === undefined) {
    return null;
  }

  const change = stats.priceChange24h;
  const TrendIcon = change < 0 ? TrendingDown : change > 0 ? TrendingUp : Minus;
  const colorClass =
    change < 0 ? 'text-success' : change > 0 ? 'text-destructive' : 'text-muted-foreground';

  return <TrendIcon className={cn('h-4 w-4', colorClass, className)} />;
}
