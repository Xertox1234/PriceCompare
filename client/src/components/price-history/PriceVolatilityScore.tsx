import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VolatilityData {
  score: number; // 0-100
  level: 'low' | 'moderate' | 'high' | 'very-high';
  standardDeviation: number;
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  recommendation: string;
}

interface PriceVolatilityScoreProps {
  data: VolatilityData | null;
  isLoading?: boolean;
}

export function PriceVolatilityScore({ data, isLoading }: PriceVolatilityScoreProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <div className="text-muted-foreground text-center">
          <p>No volatility data available</p>
        </div>
      </Card>
    );
  }

  // Determine color scheme based on volatility level
  const getColorScheme = (level: string) => {
    switch (level) {
      case 'low':
        return {
          bg: 'bg-success/5',
          border: 'border-success/20',
          text: 'text-success',
          badge: 'bg-success/10 text-success border-success/20',
          icon: <Minus className="h-5 w-5" />,
        };
      case 'moderate':
        return {
          bg: 'bg-info/5',
          border: 'border-info/20',
          text: 'text-info',
          badge: 'bg-info/10 text-info border-info/20',
          icon: <TrendingUp className="h-5 w-5" />,
        };
      case 'high':
        return {
          bg: 'bg-warning/5',
          border: 'border-warning/20',
          text: 'text-warning',
          badge: 'bg-warning/10 text-warning border-warning/20',
          icon: <TrendingUp className="h-5 w-5" />,
        };
      case 'very-high':
        return {
          bg: 'bg-destructive/5',
          border: 'border-destructive/20',
          text: 'text-destructive',
          badge: 'bg-destructive/10 text-destructive border-destructive/20',
          icon: <TrendingDown className="h-5 w-5" />,
        };
      default:
        return {
          bg: 'bg-muted/5',
          border: 'border-border',
          text: 'text-muted-foreground',
          badge: 'bg-muted/10 text-muted-foreground border-border',
          icon: <Minus className="h-5 w-5" />,
        };
    }
  };

  const colors = getColorScheme(data.level);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Price Volatility</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="text-muted-foreground h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Volatility measures how much prices fluctuate over time. Lower volatility means
                    more stable, predictable pricing.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="outline" className={colors.badge}>
            {data.level.replace('-', ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Volatility Score */}
        <div className={`rounded-lg border-2 p-4 ${colors.bg} ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={colors.text}>{colors.icon}</div>
              <div>
                <div className="text-muted-foreground text-sm font-medium">Volatility Score</div>
                <div className={`text-3xl font-bold ${colors.text}`}>{data.score}/100</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground text-sm">Std. Deviation</div>
              <Price value={data.standardDeviation} className="text-lg font-semibold" />
            </div>
          </div>
        </div>

        {/* Price Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-muted-foreground mb-1 text-xs">Min Price</div>
            <Price value={data.priceRange.min} className="text-lg font-semibold" />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-muted-foreground mb-1 text-xs">Avg Price</div>
            <Price value={data.averagePrice} className="text-lg font-semibold" />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-muted-foreground mb-1 text-xs">Max Price</div>
            <Price value={data.priceRange.max} className="text-lg font-semibold" />
          </div>
        </div>

        {/* Recommendation */}
        <div className="border-t pt-3">
          <div className="mb-2 text-sm font-medium">Recommendation</div>
          <p className="text-muted-foreground text-sm">{data.recommendation}</p>
        </div>
      </div>
    </Card>
  );
}
