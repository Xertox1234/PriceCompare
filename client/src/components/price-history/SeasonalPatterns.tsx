import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingDown, TrendingUp, Info, Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <div className="text-center text-muted-foreground">
          <p>No seasonal data available</p>
          <p className="text-sm mt-2">Requires at least 10 price records to analyze patterns</p>
        </div>
      </Card>
    );
  }

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      high: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200',
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
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Seasonal Price Patterns</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Analyzes historical price data to identify seasonal trends and the best times to buy.
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
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              Seasonal pattern detected! Timing your purchase can save you money.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <Info className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-700">
              No significant seasonal pattern detected. Prices are relatively stable year-round.
            </span>
          </div>
        )}

        {/* Recommendation */}
        {data.recommendation && data.recommendation.expectedSavings > 0 && (
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <TrendingDown className="w-6 h-6 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-green-900 mb-1">
                  Best Time to Buy: {data.recommendation.timeframe}
                </div>
                <p className="text-sm text-green-800 mb-2">
                  {data.recommendation.reason}
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-green-200">
                  <span className="text-xs font-medium text-green-700">
                    Potential Savings:
                  </span>
                  <span className="text-sm font-bold text-green-900">
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
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">BEST MONTH</span>
              </div>
              <div className="text-lg font-bold text-green-900">
                {data.bestMonthToBuy.monthName}
              </div>
              <div className="text-sm text-green-700 mt-1">
                Avg: ${data.bestMonthToBuy.averagePrice.toFixed(2)}
              </div>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-red-700">WORST MONTH</span>
              </div>
              <div className="text-lg font-bold text-red-900">
                {data.worstMonthToBuy.monthName}
              </div>
              <div className="text-sm text-red-700 mt-1">
                Avg: ${data.worstMonthToBuy.averagePrice.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Seasonal Breakdown */}
        {data.seasonalPatterns.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Price by Season</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.seasonalPatterns
                .sort((a, b) => a.averagePrice - b.averagePrice)
                .map((pattern, index) => {
                  const isBest = index === 0;
                  return (
                    <div
                      key={pattern.season}
                      className={`p-3 rounded-lg border ${
                        isBest
                          ? 'bg-green-50 border-green-300'
                          : 'bg-muted/50 border-border'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">
                          {getSeasonIcon(pattern.season)}
                        </div>
                        <div className="text-xs font-medium capitalize mb-1">
                          {pattern.season}
                        </div>
                        <div className={`text-sm font-semibold ${
                          isBest ? 'text-green-700' : 'text-foreground'
                        }`}>
                          ${pattern.averagePrice.toFixed(2)}
                        </div>
                        {isBest && (
                          <Badge variant="outline" className="mt-1 text-xs bg-green-100 text-green-800 border-green-200">
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
            <h4 className="text-sm font-semibold mb-3">Monthly Price Trends</h4>
            <div className="space-y-2">
              {data.monthlyPatterns.map((pattern) => {
                const isLowest = pattern.month === data.bestMonthToBuy?.month;
                const isHighest = pattern.month === data.worstMonthToBuy?.month;
                const maxPrice = Math.max(...data.monthlyPatterns.map(p => p.averagePrice));
                const barWidth = (pattern.averagePrice / maxPrice) * 100;

                return (
                  <div key={pattern.month} className="flex items-center gap-3">
                    <div className="w-20 text-xs font-medium text-muted-foreground">
                      {pattern.monthName.substring(0, 3)}
                    </div>
                    <div className="flex-1 relative">
                      <div className="h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            isLowest
                              ? 'bg-green-500'
                              : isHighest
                              ? 'bg-red-400'
                              : 'bg-blue-400'
                          } transition-all`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-sm font-medium text-right">
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
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground italic">
              Note: Limited historical data available. Patterns may become more accurate as more price data is collected.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
