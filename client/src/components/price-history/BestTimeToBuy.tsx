import { ShoppingCart, Clock, TrendingDown, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Price } from '@/components/ui/price';

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
        <div className="text-muted-foreground text-center text-sm">
          Not enough data for analysis
        </div>
      </Card>
    );
  }

  const getRecommendationConfig = () => {
    switch (data.recommendation) {
      case 'good_deal':
        return {
          icon: <ShoppingCart className="h-6 w-6" />,
          title: 'Great Deal!',
          message: 'This is an excellent time to buy. The price is near its historical low.',
          bgColor: 'bg-success/5 border-success/20',
          textColor: 'text-success',
          badgeVariant: 'default' as const,
          badgeColor: 'bg-success',
        };
      case 'wait':
        return {
          icon: <Clock className="h-6 w-6" />,
          title: 'Consider Waiting',
          message: 'The price may drop further. Consider monitoring for a better deal.',
          bgColor: 'bg-warning/5 border-warning/20',
          textColor: 'text-warning',
          badgeVariant: 'secondary' as const,
          badgeColor: 'bg-warning',
        };
      default:
        return {
          icon: <AlertCircle className="h-6 w-6" />,
          title: 'Fair Price',
          message: 'The current price is reasonable based on historical data.',
          bgColor: 'bg-info/5 border-info/20',
          textColor: 'text-info',
          badgeVariant: 'outline' as const,
          badgeColor: 'bg-info',
        };
    }
  };

  const config = getRecommendationConfig();
  const percentBelowAverage =
    ((data.historicalAverage - data.currentPrice) / data.historicalAverage) * 100;
  const percentAboveLowest =
    ((data.currentPrice - data.lowestPriceLast90Days) / data.lowestPriceLast90Days) * 100;

  return (
    <Card className={`border-2 p-6 ${config.bgColor}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`${config.textColor}`}>{config.icon}</div>
            <div>
              <h3 className={`text-lg font-semibold ${config.textColor}`}>{config.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{config.message}</p>
            </div>
          </div>
          <Badge className={config.badgeColor}>
            {Math.round(data.confidenceScore * 100)}% confidence
          </Badge>
        </div>

        {/* Price Comparison */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm">Current Price</div>
            <Price value={data.currentPrice} className="text-2xl font-bold" />
            {percentBelowAverage !== 0 && (
              <div
                className={`text-sm font-medium ${percentBelowAverage > 0 ? 'text-success' : 'text-destructive'}`}
              >
                {percentBelowAverage > 0 ? '↓' : '↑'} {Math.abs(percentBelowAverage).toFixed(1)}% vs
                avg
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm">Lowest (90 days)</div>
            <Price value={data.lowestPriceLast90Days} className="text-2xl font-bold text-success" />
            <div className="text-muted-foreground text-sm">{data.daysSinceLowest} days ago</div>
          </div>
        </div>

        {/* Additional Insights */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Historical Average</span>
            <Price value={data.historicalAverage} className="font-medium" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Difference from Lowest</span>
            <span
              className={`font-medium ${percentAboveLowest < 5 ? 'text-success' : 'text-foreground'}`}
            >
              +<Price value={data.currentPrice - data.lowestPriceLast90Days} size="sm" /> (
              {percentAboveLowest.toFixed(1)}%)
            </span>
          </div>
          {Math.abs(data.priceChangeVelocity) > 0.1 && (
            <div className="flex items-center gap-2 border-t pt-2 text-sm">
              {data.priceChangeVelocity < 0 ? (
                <TrendingDown className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 rotate-180 text-destructive" />
              )}
              <span className="text-muted-foreground">
                Price {data.priceChangeVelocity < 0 ? 'decreasing' : 'increasing'} by
                <span className="ml-1 font-medium">
                  <Price value={Math.abs(data.priceChangeVelocity)} size="sm" />/day
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
