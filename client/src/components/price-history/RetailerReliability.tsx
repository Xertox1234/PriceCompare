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
          bg: 'bg-success/5',
          border: 'border-success/20',
          text: 'text-success',
          badge: 'bg-success/10 text-success border-success/30',
          progress: 'bg-success',
        };
      case 'good':
        return {
          bg: 'bg-info/5',
          border: 'border-info/20',
          text: 'text-info',
          badge: 'bg-info/10 text-info border-info/30',
          progress: 'bg-info',
        };
      case 'fair':
        return {
          bg: 'bg-warning/5',
          border: 'border-warning/20',
          text: 'text-warning',
          badge: 'bg-warning/10 text-warning border-warning/30',
          progress: 'bg-warning',
        };
      case 'poor':
        return {
          bg: 'bg-destructive/5',
          border: 'border-destructive/20',
          text: 'text-destructive',
          badge: 'bg-destructive/10 text-destructive border-destructive/30',
          progress: 'bg-destructive',
        };
      default:
        return {
          bg: 'bg-muted/5',
          border: 'border-border',
          text: 'text-muted-foreground',
          badge: 'bg-muted/10 text-muted-foreground border-border',
          progress: 'bg-muted-foreground',
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
                      <Star className="h-5 w-5 fill-warning text-warning" />
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
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                        <div className="flex-1">
                          <div className="text-muted-foreground mb-1 text-xs font-medium">
                            Strengths
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {retailer.strengths.map((strength, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="border-success/20 bg-success/5 text-xs text-success"
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
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                        <div className="flex-1">
                          <div className="text-muted-foreground mb-1 text-xs font-medium">
                            Weaknesses
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {retailer.weaknesses.map((weakness, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="border-warning/20 bg-warning/5 text-xs text-warning"
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
