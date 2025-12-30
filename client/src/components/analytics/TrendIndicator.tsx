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
        return 'text-destructive';
      case 'downtrend':
        return 'text-success';
      case 'stable':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
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
        return 'text-success';
      case 'medium':
        return 'text-warning';
      case 'low':
        return 'text-secondary';
      default:
        return 'text-muted-foreground';
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
