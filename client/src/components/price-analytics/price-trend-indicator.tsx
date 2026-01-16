/**
 * Price Trend Indicator Component
 *
 * Calculates and displays price trend direction (rising, falling, stable)
 * Compares recent prices (last 7 days) vs previous 7 days.
 */
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Trend change threshold percentage (below this is considered stable)
const STABLE_THRESHOLD_PERCENT = 2;

interface PriceDataPoint {
  price: string | number;
  recordedAt: Date | string;
}

interface PriceTrendIndicatorProps {
  priceHistory: PriceDataPoint[];
  className?: string;
  showPercentage?: boolean;
}

type TrendDirection = 'rising' | 'falling' | 'stable';

interface TrendCalculation {
  direction: TrendDirection;
  percentageChange: number;
}

/**
 * Calculate price trend by comparing recent vs previous period
 * Recent period: Last 7 days
 * Previous period: 7 days before that
 */
function calculateTrend(priceHistory: PriceDataPoint[]): TrendCalculation {
  if (!priceHistory || priceHistory.length < 2) {
    return { direction: 'stable', percentageChange: 0 };
  }

  // Sort by date (most recent first)
  const sorted = [...priceHistory].sort((a, b) => {
    const dateA = typeof a.recordedAt === 'string' ? new Date(a.recordedAt) : a.recordedAt;
    const dateB = typeof b.recordedAt === 'string' ? new Date(b.recordedAt) : b.recordedAt;
    return dateB.getTime() - dateA.getTime();
  });

  const now = new Date();
  const DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  const sevenDaysAgo = new Date(now.getTime() - DAYS_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 2 * DAYS_MS);

  // Split into recent (last 7 days) and previous (7-14 days ago)
  const recentPrices = sorted.filter((item) => {
    const date = typeof item.recordedAt === 'string' ? new Date(item.recordedAt) : item.recordedAt;
    return date >= sevenDaysAgo && date <= now;
  });

  const previousPrices = sorted.filter((item) => {
    const date = typeof item.recordedAt === 'string' ? new Date(item.recordedAt) : item.recordedAt;
    return date >= fourteenDaysAgo && date < sevenDaysAgo;
  });

  // If we don't have data for both periods, use simple first-to-last comparison
  if (recentPrices.length === 0 || previousPrices.length === 0) {
    const firstPrice = parseFloat(sorted[sorted.length - 1].price.toString());
    const lastPrice = parseFloat(sorted[0].price.toString());
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;

    if (Math.abs(change) < STABLE_THRESHOLD_PERCENT) {
      return { direction: 'stable', percentageChange: change };
    }
    return {
      direction: change > 0 ? 'rising' : 'falling',
      percentageChange: change,
    };
  }

  // Calculate average prices for both periods
  const recentAvg =
    recentPrices.reduce((sum, item) => sum + parseFloat(item.price.toString()), 0) /
    recentPrices.length;
  const previousAvg =
    previousPrices.reduce((sum, item) => sum + parseFloat(item.price.toString()), 0) /
    previousPrices.length;

  // Calculate percentage change
  const percentageChange = ((recentAvg - previousAvg) / previousAvg) * 100;

  // Determine trend direction
  if (Math.abs(percentageChange) < STABLE_THRESHOLD_PERCENT) {
    return { direction: 'stable', percentageChange };
  }

  return {
    direction: percentageChange > 0 ? 'rising' : 'falling',
    percentageChange,
  };
}

export function PriceTrendIndicator({
  priceHistory,
  className,
  showPercentage = true,
}: PriceTrendIndicatorProps) {
  const trend = useMemo(() => calculateTrend(priceHistory), [priceHistory]);

  const trendConfig = {
    rising: {
      icon: TrendingUp,
      label: 'Price is Rising',
      variant: 'destructive' as const,
      iconColor: 'text-destructive',
    },
    falling: {
      icon: TrendingDown,
      label: 'Price is Falling',
      variant: 'default' as const,
      iconColor: 'text-primary',
    },
    stable: {
      icon: Minus,
      label: 'Price is Stable',
      variant: 'outline' as const,
      iconColor: 'text-muted-foreground',
    },
  };

  const config = trendConfig[trend.direction];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)} data-testid="price-trend-indicator">
      <Badge variant={config.variant} className="gap-1.5">
        <Icon className={cn('h-3 w-3', config.iconColor)} />
        <span>{config.label}</span>
        {showPercentage && Math.abs(trend.percentageChange) > 0 && (
          <span className="font-mono text-xs">
            {trend.percentageChange > 0 ? '+' : ''}
            {trend.percentageChange.toFixed(1)}%
          </span>
        )}
      </Badge>
    </div>
  );
}
