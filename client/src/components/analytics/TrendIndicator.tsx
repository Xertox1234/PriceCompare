import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PriceTrend } from '@/hooks/use-price-analytics';

interface TrendIndicatorProps {
  trend: PriceTrend;
  showDetails?: boolean;
  className?: string;
}

export function TrendIndicator({ trend, showDetails = false, className }: TrendIndicatorProps) {
  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'uptrend':
        return 'text-red-600 dark:text-red-400';
      case 'downtrend':
        return 'text-green-600 dark:text-green-400';
      case 'stable':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600';
    }
  };

  const _getTrendBadgeVariant = (direction: string) => {
    switch (direction) {
      case 'uptrend':
        return 'destructive';
      case 'downtrend':
        return 'default';
      case 'stable':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'uptrend':
        return <TrendingUp className="h-4 w-4" />;
      case 'downtrend':
        return <TrendingDown className="h-4 w-4" />;
      case 'stable':
        return <Minus className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (level: string | null) => {
    switch (level) {
      case 'high':
        return 'text-green-600 dark:text-green-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'low':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600';
    }
  };

  const trendStrength = trend.trendStrength ? parseFloat(trend.trendStrength) : 0;
  const strengthPercentage = (trendStrength * 100).toFixed(1);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center gap-1', getTrendColor(trend.trendDirection))}>
          {getTrendIcon(trend.trendDirection)}
          <span className="font-semibold capitalize">{trend.trendDirection}</span>
        </div>
        {trend.confidenceLevel && (
          <Badge variant="outline" className={getConfidenceColor(trend.confidenceLevel)}>
            {trend.confidenceLevel} confidence
          </Badge>
        )}
      </div>

      {showDetails && (
        <div className="text-muted-foreground space-y-1 text-sm">
          {trend.trendStrength && (
            <div>
              Strength: {strengthPercentage}% (R² = {trendStrength.toFixed(3)})
            </div>
          )}
          {trend.trendSlope && <div>Slope: ${parseFloat(trend.trendSlope).toFixed(4)}/day</div>}
          {trend.predictedNextPrice && (
            <div>Predicted: ${parseFloat(trend.predictedNextPrice).toFixed(2)}</div>
          )}
          <div className="text-xs">
            Analyzed: {new Date(trend.lastAnalyzedAt).toLocaleDateString()} (
            {trend.analysisPeriodDays} days)
          </div>
        </div>
      )}
    </div>
  );
}
