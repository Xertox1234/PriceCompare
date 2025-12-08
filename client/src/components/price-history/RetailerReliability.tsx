import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Shield, Star, TrendingUp, Package, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

interface ReliabilityMetrics {
  priceStability: number;
  availability: number;
  competitiveness: number;
  consistency: number;
}

interface ReliabilityScore {
  retailerId: number;
  retailerName: string;
  overallScore: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  metrics: ReliabilityMetrics;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

interface RetailerReliabilityProps {
  data: ReliabilityScore[] | null;
  isLoading?: boolean;
}

export function RetailerReliability({ data, isLoading }: RetailerReliabilityProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-muted-foreground text-center">
          <p>No retailer reliability data available</p>
          <p className="mt-2 text-sm">Requires price history from multiple retailers</p>
        </div>
      </Card>
    );
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-700',
          badge: 'bg-green-100 text-green-800 border-green-300',
          progress: 'bg-green-500',
        };
      case 'good':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          badge: 'bg-blue-100 text-blue-800 border-blue-300',
          progress: 'bg-blue-500',
        };
      case 'fair':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-700',
          badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          progress: 'bg-yellow-500',
        };
      case 'poor':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          badge: 'bg-red-100 text-red-800 border-red-300',
          progress: 'bg-red-500',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-700',
          badge: 'bg-gray-100 text-gray-800 border-gray-300',
          progress: 'bg-gray-500',
        };
    }
  };

  const sortedData = [...data].sort((a, b) => b.overallScore - a.overallScore);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-primary h-5 w-5" />
            <h3 className="text-lg font-semibold">Retailer Reliability</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="text-muted-foreground h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Reliability scores are based on price stability, stock availability,
                    competitiveness, and pricing consistency.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Retailer Cards */}
        <div className="space-y-4">
          {sortedData.map((retailer, index) => {
            const colors = getRatingColor(retailer.rating);

            return (
              <div
                key={retailer.retailerId}
                className={`rounded-lg border-2 p-4 ${colors.bg} ${colors.border}`}
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {index === 0 && retailer.rating === 'excellent' && (
                      <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                    )}
                    <div>
                      <h4 className="text-lg font-semibold">{retailer.retailerName}</h4>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-3xl font-bold ${colors.text}`}>
                          {retailer.overallScore}
                        </span>
                        <span className="text-muted-foreground text-sm">/100</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={colors.badge}>
                    {retailer.rating.toUpperCase()}
                  </Badge>
                </div>

                {/* Metrics Grid */}
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <MetricItem
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Price Stability"
                    value={retailer.metrics.priceStability}
                    color={colors.progress}
                  />
                  <MetricItem
                    icon={<Package className="h-4 w-4" />}
                    label="Availability"
                    value={retailer.metrics.availability}
                    color={colors.progress}
                  />
                  <MetricItem
                    icon={<Star className="h-4 w-4" />}
                    label="Competitiveness"
                    value={retailer.metrics.competitiveness}
                    color={colors.progress}
                  />
                  <MetricItem
                    icon={<Shield className="h-4 w-4" />}
                    label="Consistency"
                    value={retailer.metrics.consistency}
                    color={colors.progress}
                  />
                </div>

                {/* Strengths and Weaknesses */}
                {(retailer.strengths.length > 0 || retailer.weaknesses.length > 0) && (
                  <div className="mb-3 space-y-2">
                    {retailer.strengths.length > 0 && (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                        <div className="flex-1">
                          <div className="text-muted-foreground mb-1 text-xs font-medium">
                            Strengths
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {retailer.strengths.map((strength, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="border-green-200 bg-green-50 text-xs text-green-700"
                              >
                                {strength}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {retailer.weaknesses.length > 0 && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                        <div className="flex-1">
                          <div className="text-muted-foreground mb-1 text-xs font-medium">
                            Weaknesses
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {retailer.weaknesses.map((weakness, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="border-orange-200 bg-orange-50 text-xs text-orange-700"
                              >
                                {weakness}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendation */}
                <div className="border-border border-t pt-3">
                  <p className="text-muted-foreground text-sm">{retailer.recommendation}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="border-t pt-3">
          <p className="text-muted-foreground text-xs">
            Scores are calculated based on historical price and availability data. Higher scores
            indicate more reliable retailers.
          </p>
        </div>
      </div>
    </Card>
  );
}

function MetricItem({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-xs font-semibold">{value}%</span>
      </div>
      <Progress value={value} className="h-2" indicatorClassName={color} />
    </div>
  );
}
