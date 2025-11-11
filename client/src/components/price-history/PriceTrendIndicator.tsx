import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PriceTrendData {
  productId: number;
  currentPrice: number;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  trend: 'rising' | 'falling' | 'stable';
  changePercentage: number;
  daysAnalyzed: number;
}

interface PriceTrendIndicatorProps {
  data: PriceTrendData | null;
  isLoading?: boolean;
}

export function PriceTrendIndicator({ data, isLoading }: PriceTrendIndicatorProps) {
  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  if (!data || data.daysAnalyzed === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-sm text-muted-foreground">
          No trend data available yet
        </div>
      </Card>
    );
  }

  const getTrendColor = () => {
    if (data.trend === 'falling') return 'text-green-600';
    if (data.trend === 'rising') return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendIcon = () => {
    if (data.trend === 'falling') return <TrendingDown className="w-5 h-5" />;
    if (data.trend === 'rising') return <TrendingUp className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  const getTrendText = () => {
    if (data.trend === 'falling') return 'Price is falling';
    if (data.trend === 'rising') return 'Price is rising';
    return 'Price is stable';
  };

  const getTrendBgColor = () => {
    if (data.trend === 'falling') return 'bg-green-50 border-green-200';
    if (data.trend === 'rising') return 'bg-red-50 border-red-200';
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <Card className={`p-4 border-2 ${getTrendBgColor()}`}>
      <div className="space-y-3">
        {/* Trend Header */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="font-semibold">{getTrendText()}</span>
          </div>
          <div className={`text-lg font-bold ${getTrendColor()}`}>
            {data.changePercentage > 0 ? '+' : ''}
            {data.changePercentage.toFixed(1)}%
          </div>
        </div>

        {/* Price Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">Current Price</div>
            <div className="font-semibold text-lg">
              ${data.currentPrice.toFixed(2)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Average Price</div>
            <div className="font-semibold text-lg">
              ${data.averagePrice.toFixed(2)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Lowest</div>
            <div className="font-semibold text-green-600">
              ${data.lowestPrice.toFixed(2)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Highest</div>
            <div className="font-semibold text-red-600">
              ${data.highestPrice.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Analysis Period */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Based on {data.daysAnalyzed} day{data.daysAnalyzed !== 1 ? 's' : ''} of data
        </div>
      </div>
    </Card>
  );
}
