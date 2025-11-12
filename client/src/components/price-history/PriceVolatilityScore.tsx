import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <div className="text-center text-muted-foreground">
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
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-700',
          badge: 'bg-green-100 text-green-800 border-green-200',
          icon: <Minus className="w-5 h-5" />,
        };
      case 'moderate':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          badge: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <TrendingUp className="w-5 h-5" />,
        };
      case 'high':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-700',
          badge: 'bg-orange-100 text-orange-800 border-orange-200',
          icon: <TrendingUp className="w-5 h-5" />,
        };
      case 'very-high':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          badge: 'bg-red-100 text-red-800 border-red-200',
          icon: <TrendingDown className="w-5 h-5" />,
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-700',
          badge: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <Minus className="w-5 h-5" />,
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
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Volatility measures how much prices fluctuate over time. Lower
                    volatility means more stable, predictable pricing.
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
        <div className={`p-4 rounded-lg border-2 ${colors.bg} ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={colors.text}>{colors.icon}</div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Volatility Score
                </div>
                <div className={`text-3xl font-bold ${colors.text}`}>
                  {data.score}/100
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Std. Deviation</div>
              <div className="text-lg font-semibold">
                ${data.standardDeviation.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Price Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Min Price</div>
            <div className="text-lg font-semibold">
              ${data.priceRange.min.toFixed(2)}
            </div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Avg Price</div>
            <div className="text-lg font-semibold">
              ${data.averagePrice.toFixed(2)}
            </div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Max Price</div>
            <div className="text-lg font-semibold">
              ${data.priceRange.max.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="pt-3 border-t">
          <div className="text-sm font-medium mb-2">Recommendation</div>
          <p className="text-sm text-muted-foreground">{data.recommendation}</p>
        </div>
      </div>
    </Card>
  );
}
