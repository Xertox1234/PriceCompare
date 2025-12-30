import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingDown, TrendingUp, Info, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MonthlyPattern {
  month: number;
  monthName: string;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  dataPoints: number;
}

interface SeasonalPattern {
  season: 'winter' | 'spring' | 'summer' | 'fall';
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  dataPoints: number;
}

interface BestTimeRecommendation {
  timeframe: string;
  reason: string;
  expectedSavings: number;
}

interface SeasonalAnalysis {
  hasSeasonalPattern: boolean;
  monthlyPatterns: MonthlyPattern[];
  seasonalPatterns: SeasonalPattern[];
  bestMonthToBuy: MonthlyPattern | null;
  worstMonthToBuy: MonthlyPattern | null;
  bestSeasonToBuy: SeasonalPattern | null;
  recommendation: BestTimeRecommendation | null;
  confidence: 'low' | 'medium' | 'high';
}

interface SeasonalPatternsProps {
  data: SeasonalAnalysis | null;
  isLoading?: boolean;
}

export function SeasonalPatterns({ data, isLoading }: SeasonalPatternsProps) {
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
        <div className="text-muted-foreground text-center">
          <p>No seasonal data available</p>
          <p className="mt-2 text-sm">Requires at least 10 price records to analyze patterns</p>
        </div>
      </Card>
    );
  }

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      high: 'bg-success/10 text-success border-success',
      medium: 'bg-warning/10 text-warning border-warning',
      low: 'bg-muted/10 text-muted-foreground border-border',
    };
    return variants[confidence as keyof typeof variants] || variants.low;
  };

  const getSeasonIcon = (season: string) => {
    const icons = {
      winter: '❄️',
      spring: '🌸',
      summer: '☀️',
      fall: '🍂',
    };
    return icons[season as keyof typeof icons] || '📅';
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="text-primary h-5 w-5" />
            <h3 className="text-lg font-semibold">Seasonal Price Patterns</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="text-muted-foreground h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Analyzes historical price data to identify seasonal trends and the best times to
                    buy.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="outline" className={getConfidenceBadge(data.confidence)}>
            {data.confidence.toUpperCase()} CONFIDENCE
          </Badge>
        </div>

        {/* Pattern Detection Status */}
        {data.hasSeasonalPattern ? (
          <div className="flex items-center gap-2 rounded-lg border border-info bg-info/5 p-3">
            <Sparkles className="h-5 w-5 text-info" />
            <span className="text-sm font-medium">
              Seasonal pattern detected! Timing your purchase can save you money.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/5 p-3">
            <Info className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              No significant seasonal pattern detected. Prices are relatively stable year-round.
            </span>
          </div>
        )}

        {/* Recommendation */}
        {data.recommendation && data.recommendation.expectedSavings > 0 && (
          <div className="rounded-lg border-2 border-success bg-success/5 p-4">
            <div className="flex items-start gap-3">
              <TrendingDown className="mt-0.5 h-6 w-6 text-success" />
              <div className="flex-1">
                <div className="mb-1 font-semibold">
                  Best Time to Buy: {data.recommendation.timeframe}
                </div>
                <p className="mb-2 text-sm text-muted-foreground">{data.recommendation.reason}</p>
                <div className="inline-flex items-center gap-2 rounded-full border border-success bg-background px-3 py-1">
                  <span className="text-xs font-medium text-success">Potential Savings:</span>
                  <span className="text-sm font-bold">
                    {data.recommendation.expectedSavings.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Best and Worst Months */}
        {data.bestMonthToBuy && data.worstMonthToBuy && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-success bg-success/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-success" />
                <span className="text-xs font-medium text-success">BEST MONTH</span>
              </div>
              <div className="text-lg font-bold">
                {data.bestMonthToBuy.monthName}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Avg: ${data.bestMonthToBuy.averagePrice.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-destructive bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-destructive" />
                <span className="text-xs font-medium text-destructive">WORST MONTH</span>
              </div>
              <div className="text-lg font-bold">{data.worstMonthToBuy.monthName}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Avg: ${data.worstMonthToBuy.averagePrice.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Seasonal Breakdown */}
        {data.seasonalPatterns.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">Price by Season</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.seasonalPatterns
                .sort((a, b) => a.averagePrice - b.averagePrice)
                .map((pattern, index) => {
                  const isBest = index === 0;
                  return (
                    <div
                      key={pattern.season}
                      className={`rounded-lg border p-3 ${
                        isBest ? 'border-success bg-success/5' : 'bg-muted/50 border-border'
                      }`}
                    >
                      <div className="text-center">
                        <div className="mb-1 text-2xl">{getSeasonIcon(pattern.season)}</div>
                        <div className="mb-1 text-xs font-medium capitalize">{pattern.season}</div>
                        <div
                          className={`text-sm font-semibold ${
                            isBest ? 'text-success' : 'text-foreground'
                          }`}
                        >
                          ${pattern.averagePrice.toFixed(2)}
                        </div>
                        {isBest && (
                          <Badge
                            variant="outline"
                            className="mt-1 border-success bg-success/10 text-xs text-success"
                          >
                            Best
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Monthly Price Chart */}
        {data.monthlyPatterns.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">Monthly Price Trends</h4>
            <div className="space-y-2">
              {data.monthlyPatterns.map((pattern) => {
                const isLowest = pattern.month === data.bestMonthToBuy?.month;
                const isHighest = pattern.month === data.worstMonthToBuy?.month;
                const maxPrice = Math.max(...data.monthlyPatterns.map((p) => p.averagePrice));
                const barWidth = (pattern.averagePrice / maxPrice) * 100;

                return (
                  <div key={pattern.month} className="flex items-center gap-3">
                    <div className="text-muted-foreground w-20 text-xs font-medium">
                      {pattern.monthName.substring(0, 3)}
                    </div>
                    <div className="relative flex-1">
                      <div className="bg-muted h-6 overflow-hidden rounded-full">
                        <div
                          className={`h-full ${
                            isLowest ? 'bg-success' : isHighest ? 'bg-destructive' : 'bg-info'
                          } transition-all`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm font-medium">
                      ${pattern.averagePrice.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Quality Indicator */}
        {data.confidence === 'low' && (
          <div className="border-t pt-3">
            <p className="text-muted-foreground text-xs italic">
              Note: Limited historical data available. Patterns may become more accurate as more
              price data is collected.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
