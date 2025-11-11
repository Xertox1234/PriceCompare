import { ShoppingCart, Clock, TrendingDown, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface BestTimeAnalysis {
  productId: number;
  currentPrice: number;
  historicalAverage: number;
  lowestPriceLast90Days: number;
  daysSinceLowest: number;
  recommendation: 'buy_now' | 'wait' | 'good_deal';
  confidenceScore: number;
  priceChangeVelocity: number;
}

interface BestTimeToBuyProps {
  data: BestTimeAnalysis | null;
  isLoading?: boolean;
}

export function BestTimeToBuy({ data, isLoading }: BestTimeToBuyProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-48 w-full" />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <div className="text-center text-sm text-muted-foreground">
          Not enough data for analysis
        </div>
      </Card>
    );
  }

  const getRecommendationConfig = () => {
    switch (data.recommendation) {
      case 'good_deal':
        return {
          icon: <ShoppingCart className="w-6 h-6" />,
          title: 'Great Deal!',
          message: 'This is an excellent time to buy. The price is near its historical low.',
          bgColor: 'bg-green-50 border-green-200',
          textColor: 'text-green-700',
          badgeVariant: 'default' as const,
          badgeColor: 'bg-green-600',
        };
      case 'wait':
        return {
          icon: <Clock className="w-6 h-6" />,
          title: 'Consider Waiting',
          message: 'The price may drop further. Consider monitoring for a better deal.',
          bgColor: 'bg-amber-50 border-amber-200',
          textColor: 'text-amber-700',
          badgeVariant: 'secondary' as const,
          badgeColor: 'bg-amber-600',
        };
      default:
        return {
          icon: <AlertCircle className="w-6 h-6" />,
          title: 'Fair Price',
          message: 'The current price is reasonable based on historical data.',
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-700',
          badgeVariant: 'outline' as const,
          badgeColor: 'bg-blue-600',
        };
    }
  };

  const config = getRecommendationConfig();
  const percentBelowAverage = ((data.historicalAverage - data.currentPrice) / data.historicalAverage) * 100;
  const percentAboveLowest = ((data.currentPrice - data.lowestPriceLast90Days) / data.lowestPriceLast90Days) * 100;

  return (
    <Card className={`p-6 border-2 ${config.bgColor}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`${config.textColor}`}>
              {config.icon}
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${config.textColor}`}>
                {config.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {config.message}
              </p>
            </div>
          </div>
          <Badge className={config.badgeColor}>
            {Math.round(data.confidenceScore * 100)}% confidence
          </Badge>
        </div>

        {/* Price Comparison */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Current Price</div>
            <div className="text-2xl font-bold">
              ${data.currentPrice.toFixed(2)}
            </div>
            {percentBelowAverage !== 0 && (
              <div className={`text-sm font-medium ${percentBelowAverage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {percentBelowAverage > 0 ? '↓' : '↑'} {Math.abs(percentBelowAverage).toFixed(1)}% vs avg
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Lowest (90 days)</div>
            <div className="text-2xl font-bold text-green-600">
              ${data.lowestPriceLast90Days.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              {data.daysSinceLowest} days ago
            </div>
          </div>
        </div>

        {/* Additional Insights */}
        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Historical Average</span>
            <span className="font-medium">${data.historicalAverage.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Difference from Lowest</span>
            <span className={`font-medium ${percentAboveLowest < 5 ? 'text-green-600' : 'text-gray-700'}`}>
              +${(data.currentPrice - data.lowestPriceLast90Days).toFixed(2)}
              ({percentAboveLowest.toFixed(1)}%)
            </span>
          </div>
          {Math.abs(data.priceChangeVelocity) > 0.1 && (
            <div className="flex items-center gap-2 text-sm pt-2 border-t">
              {data.priceChangeVelocity < 0 ? (
                <TrendingDown className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600 rotate-180" />
              )}
              <span className="text-muted-foreground">
                Price {data.priceChangeVelocity < 0 ? 'decreasing' : 'increasing'} by
                <span className="font-medium ml-1">
                  ${Math.abs(data.priceChangeVelocity).toFixed(2)}/day
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
