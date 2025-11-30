import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingDown, TrendingUp, Activity, Calendar, ShoppingCart, Sparkles, AlertTriangle } from "lucide-react";
import { usePriceStats, usePriceHistory } from "@/hooks/use-price-history";
import { Skeleton } from "@/components/ui/skeleton";

interface PriceInsightsWidgetProps {
  productId: number;
  offerId?: number;
  className?: string;
}

interface SeasonalPattern {
  month: string;
  trend: 'high' | 'low' | 'normal';
  averagePrice: number;
  confidence: number;
}

interface BuyRecommendation {
  status: 'excellent' | 'good' | 'fair' | 'wait';
  confidence: number;
  reason: string;
  savingsPercent?: number;
}

export function PriceInsightsWidget({ productId, offerId, className }: PriceInsightsWidgetProps) {
  const { data: stats, isLoading: statsLoading } = usePriceStats(productId, offerId, 365);
  const { data: history, isLoading: historyLoading } = usePriceHistory(productId, offerId, { days: 365 });

  const isLoading = statsLoading || historyLoading;

  // Calculate seasonal patterns
  const seasonalPatterns = calculateSeasonalPatterns(history || []);

  // Generate buy recommendation
  const buyRecommendation = generateBuyRecommendation(stats as LocalPriceStats | undefined, history || []);

  // Calculate price volatility
  const volatility = stats ? calculateVolatility(stats as LocalPriceStats) : null;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || !history || history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Price Insights
          </CardTitle>
          <CardDescription>Smart recommendations based on historical data</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Not enough historical data to generate insights. Check back after more price data is collected.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Price Insights
        </CardTitle>
        <CardDescription>Smart recommendations based on {history.length} days of data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Buy Recommendation */}
        <BuyRecommendationSection recommendation={buyRecommendation} currentPrice={stats.currentPrice} />

        {/* Price Volatility */}
        {volatility && <PriceVolatilitySection volatility={volatility} />}

        {/* Seasonal Patterns */}
        {seasonalPatterns.length > 0 && (
          <SeasonalPatternsSection patterns={seasonalPatterns} />
        )}

        {/* Historical Insights */}
        <HistoricalInsightsSection stats={stats} history={history} />
      </CardContent>
    </Card>
  );
}

// Buy Recommendation Section
function BuyRecommendationSection({ recommendation, currentPrice }: { recommendation: BuyRecommendation; currentPrice: number }) {
  const statusConfig = {
    excellent: {
      icon: TrendingDown,
      color: 'bg-green-50 border-green-200 text-green-800',
      badgeColor: 'bg-green-100 text-green-800',
      title: '🎯 Excellent Time to Buy!',
    },
    good: {
      icon: ShoppingCart,
      color: 'bg-blue-50 border-blue-200 text-blue-800',
      badgeColor: 'bg-blue-100 text-blue-800',
      title: '👍 Good Time to Buy',
    },
    fair: {
      icon: Activity,
      color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      badgeColor: 'bg-yellow-100 text-yellow-800',
      title: '⚖️ Fair Price',
    },
    wait: {
      icon: AlertTriangle,
      color: 'bg-amber-50 border-amber-200 text-amber-800',
      badgeColor: 'bg-amber-100 text-amber-800',
      title: '⏳ Consider Waiting',
    },
  };

  const config = statusConfig[recommendation.status];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border-2 ${config.color}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <h3 className="font-semibold">{config.title}</h3>
        </div>
        <Badge className={config.badgeColor}>{Math.round(recommendation.confidence * 100)}% confidence</Badge>
      </div>
      <p className="text-sm mb-2">{recommendation.reason}</p>
      {recommendation.savingsPercent !== undefined && recommendation.savingsPercent > 0 && (
        <p className="text-sm font-medium">
          Potential savings: {recommendation.savingsPercent.toFixed(1)}% compared to average
        </p>
      )}
      <p className="text-xs mt-2 opacity-75">Current price: ${currentPrice.toFixed(2)}</p>
    </div>
  );
}

// Price Volatility Section
function PriceVolatilitySection({ volatility }: { volatility: { level: string; percentage: number; description: string } }) {
  const colorMap: Record<string, string> = {
    'Very Stable': 'text-green-600',
    'Stable': 'text-blue-600',
    'Moderate': 'text-yellow-600',
    'Volatile': 'text-orange-600',
    'Very Volatile': 'text-red-600',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          <h4 className="font-medium">Price Volatility</h4>
        </div>
        <Badge variant="outline" className={colorMap[volatility.level]}>
          {volatility.level}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{volatility.description}</p>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Volatility Index:</span>
        <span className="font-medium">{volatility.percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// Seasonal Patterns Section
function SeasonalPatternsSection({ patterns }: { patterns: SeasonalPattern[] }) {
  const bestMonth = patterns.reduce((best, current) =>
    current.averagePrice < best.averagePrice ? current : best
  );

  const worstMonth = patterns.reduce((worst, current) =>
    current.averagePrice > worst.averagePrice ? current : worst
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        <h4 className="font-medium">Seasonal Patterns</h4>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-800">Best Month</span>
          </div>
          <p className="text-sm font-semibold text-green-900">{bestMonth.month}</p>
          <p className="text-xs text-green-700">${bestMonth.averagePrice.toFixed(2)} avg</p>
        </div>

        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-800">Worst Month</span>
          </div>
          <p className="text-sm font-semibold text-red-900">{worstMonth.month}</p>
          <p className="text-xs text-red-700">${worstMonth.averagePrice.toFixed(2)} avg</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Save up to ${(worstMonth.averagePrice - bestMonth.averagePrice).toFixed(2)} by buying in {bestMonth.month}
      </p>
    </div>
  );
}

// Historical Insights Section
function HistoricalInsightsSection({ stats, history }: { stats: LocalPriceStats | undefined; history: LocalPriceHistoryItem[] }) {
  if (!stats) return null;

  const daysSinceLowest = history.findIndex(h => parseFloat(h.price) === stats.lowestPrice);
  const daysSinceHighest = history.findIndex(h => parseFloat(h.price) === stats.highestPrice);

  const priceRange = stats.highestPrice - stats.lowestPrice;
  const avgDailyChange = priceRange / history.length;

  return (
    <div className="space-y-2 pt-2 border-t">
      <h4 className="font-medium text-sm">Historical Facts</h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-muted/50">
          <p className="text-muted-foreground">Lowest Price</p>
          <p className="font-semibold">${stats.lowestPrice.toFixed(2)}</p>
          {daysSinceLowest >= 0 && (
            <p className="text-muted-foreground">{daysSinceLowest} days ago</p>
          )}
        </div>
        <div className="p-2 rounded bg-muted/50">
          <p className="text-muted-foreground">Highest Price</p>
          <p className="font-semibold">${stats.highestPrice.toFixed(2)}</p>
          {daysSinceHighest >= 0 && (
            <p className="text-muted-foreground">{daysSinceHighest} days ago</p>
          )}
        </div>
        <div className="p-2 rounded bg-muted/50">
          <p className="text-muted-foreground">Average Price</p>
          <p className="font-semibold">${stats.averagePrice.toFixed(2)}</p>
        </div>
        <div className="p-2 rounded bg-muted/50">
          <p className="text-muted-foreground">Avg Daily Change</p>
          <p className="font-semibold">${avgDailyChange.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

// Helper Functions

function calculateSeasonalPatterns(history: LocalPriceHistoryItem[]): SeasonalPattern[] {
  if (history.length < 90) return []; // Need at least 3 months of data

  const monthlyData: Record<string, number[]> = {};

  history.forEach(entry => {
    const dateValue = entry.recordedAt || entry.createdAt || new Date();
    const date = new Date(dateValue);
    const month = date.toLocaleString('default', { month: 'short' });

    if (!monthlyData[month]) {
      monthlyData[month] = [];
    }
    monthlyData[month].push(parseFloat(entry.price));
  });

  const patterns: SeasonalPattern[] = [];

  for (const [month, prices] of Object.entries(monthlyData)) {
    if (prices.length < 3) continue; // Need at least 3 data points

    const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const allPrices = history.map(h => parseFloat(h.price));
    const overallAverage = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;

    const deviation = ((averagePrice - overallAverage) / overallAverage) * 100;

    let trend: 'high' | 'low' | 'normal' = 'normal';
    if (deviation < -5) trend = 'low';
    else if (deviation > 5) trend = 'high';

    patterns.push({
      month,
      trend,
      averagePrice,
      confidence: Math.min(prices.length / 10, 1), // Max confidence with 10+ data points
    });
  }

  return patterns;
}

interface LocalPriceStats {
  currentPrice: number;
  lowestPrice: number;
  averagePrice: number;
  highestPrice: number;
}

interface LocalPriceHistoryItem {
  price: string;
  recordedAt: Date | string;
  createdAt: Date | string | null;
  [key: string]: unknown;
}

function generateBuyRecommendation(stats: LocalPriceStats | undefined, history: LocalPriceHistoryItem[]): BuyRecommendation {
  if (!stats || history.length === 0) {
    return {
      status: 'fair',
      confidence: 0,
      reason: 'Not enough data to generate recommendation',
    };
  }

  const currentPrice = stats.currentPrice;
  const lowestPrice = stats.lowestPrice;
  const averagePrice = stats.averagePrice;
  const _highestPrice = stats.highestPrice;

  const percentOfLowest = (currentPrice / lowestPrice - 1) * 100;
  const percentOfAverage = (currentPrice / averagePrice - 1) * 100;

  // Calculate trend (last 7 days)
  const recentHistory = history.slice(0, Math.min(7, history.length));
  const recentAvg = recentHistory.reduce((sum, h) => sum + parseFloat(h.price), 0) / recentHistory.length;
  const isDropping = currentPrice < recentAvg;

  // Confidence based on data points
  const confidence = Math.min(history.length / 90, 1); // Max confidence with 90+ days

  // Excellent: Within 5% of lowest AND dropping
  if (percentOfLowest <= 5 && isDropping) {
    return {
      status: 'excellent',
      confidence: confidence * 0.95,
      reason: `This is one of the lowest prices ever recorded! Currently ${percentOfLowest.toFixed(1)}% above the historical low and trending down.`,
      savingsPercent: Math.abs(percentOfAverage),
    };
  }

  // Excellent: Within 5% of lowest
  if (percentOfLowest <= 5) {
    return {
      status: 'excellent',
      confidence: confidence * 0.9,
      reason: `Excellent deal! Price is within ${percentOfLowest.toFixed(1)}% of the all-time low.`,
      savingsPercent: Math.abs(percentOfAverage),
    };
  }

  // Good: Below average AND dropping
  if (percentOfAverage < 0 && isDropping) {
    return {
      status: 'good',
      confidence: confidence * 0.85,
      reason: `Good time to buy! Price is ${Math.abs(percentOfAverage).toFixed(1)}% below average and currently dropping.`,
      savingsPercent: Math.abs(percentOfAverage),
    };
  }

  // Good: Below average
  if (percentOfAverage < -5) {
    return {
      status: 'good',
      confidence: confidence * 0.8,
      reason: `Price is ${Math.abs(percentOfAverage).toFixed(1)}% below the historical average.`,
      savingsPercent: Math.abs(percentOfAverage),
    };
  }

  // Fair: Near average
  if (Math.abs(percentOfAverage) <= 5) {
    return {
      status: 'fair',
      confidence: confidence * 0.7,
      reason: `Price is around the historical average. Not a bad deal, but not exceptional.`,
    };
  }

  // Wait: Above average
  const percentAboveAverage = percentOfAverage;
  return {
    status: 'wait',
    confidence: confidence * 0.8,
    reason: `Price is ${percentAboveAverage.toFixed(1)}% above average. Consider waiting for a better deal or set up a price alert.`,
  };
}

function calculateVolatility(stats: LocalPriceStats): { level: string; percentage: number; description: string } {
  const range = stats.highestPrice - stats.lowestPrice;
  const percentage = (range / stats.averagePrice) * 100;

  if (percentage < 5) {
    return {
      level: 'Very Stable',
      percentage,
      description: 'Price has been very consistent with minimal fluctuations.',
    };
  } else if (percentage < 10) {
    return {
      level: 'Stable',
      percentage,
      description: 'Price shows minor variations but remains relatively steady.',
    };
  } else if (percentage < 20) {
    return {
      level: 'Moderate',
      percentage,
      description: 'Price experiences moderate fluctuations. Good opportunity for timing purchases.',
    };
  } else if (percentage < 35) {
    return {
      level: 'Volatile',
      percentage,
      description: 'Price varies significantly. Setting up alerts recommended for best deals.',
    };
  } else {
    return {
      level: 'Very Volatile',
      percentage,
      description: 'Price is highly unpredictable with major swings. Wait for significant drops.',
    };
  }
}
