// React hooks
import { useRoute, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendIndicator, AggregatesChart } from "@/components/analytics";
import {
  useWeeklyAggregates,
  useMonthlyAggregates,
  useProductTrends,
  useAnalyticsOverview,
} from "@/hooks/use-price-analytics";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Calendar,
  AlertCircle,
} from "lucide-react";

export default function AnalyticsPage() {
  const [, params] = useRoute("/products/:id/analytics");
  const productId = params?.id ? parseInt(params.id) : undefined;

  const { data: weeklyData, isLoading: weeklyLoading, error: weeklyError } = useWeeklyAggregates(
    productId,
    { limit: 12 }
  );

  const { data: monthlyData, isLoading: monthlyLoading, error: monthlyError } = useMonthlyAggregates(
    productId,
    { limit: 12 }
  );

  const { data: trends, isLoading: trendsLoading, error: trendsError } = useProductTrends(productId);

  const { data: overview, isLoading: _overviewLoading } = useAnalyticsOverview();

  const isLoading = weeklyLoading || monthlyLoading || trendsLoading;
  const hasError = weeklyError || monthlyError || trendsError;

  if (!productId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Invalid product ID</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Price Analytics - PriceCompare</title>
        <meta name="description" content="Advanced price analytics and trend analysis" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/products/${productId}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Product
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Price Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive price trends, aggregates, and predictions
          </p>
        </div>

        {hasError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load analytics data. Please try again later.
            </AlertDescription>
          </Alert>
        )}

        {/* Overview Stats */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalTrends}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-red-600" />
                  Uptrends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {overview.trendBreakdown.uptrend}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  Downtrends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {overview.trendBreakdown.downtrend}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Minus className="h-4 w-4 text-gray-600" />
                  Stable
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">
                  {overview.trendBreakdown.stable}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs for different views */}
        <Tabs defaultValue="aggregates" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="aggregates" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Price Aggregates
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trend Analysis
            </TabsTrigger>
          </TabsList>

          {/* Aggregates Tab */}
          <TabsContent value="aggregates" className="space-y-6">
            {isLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-[400px] w-full" />
                <Skeleton className="h-[400px] w-full" />
              </div>
            ) : (
              <>
                {weeklyData && weeklyData.length > 0 && (
                  <AggregatesChart
                    data={weeklyData}
                    type="weekly"
                    title="Weekly Price Aggregates"
                    description="Price trends aggregated by week (last 12 weeks)"
                  />
                )}

                {monthlyData && monthlyData.length > 0 && (
                  <AggregatesChart
                    data={monthlyData}
                    type="monthly"
                    title="Monthly Price Aggregates"
                    description="Price trends aggregated by month (last 12 months)"
                  />
                )}

                {(!weeklyData || weeklyData.length === 0) &&
                  (!monthlyData || monthlyData.length === 0) && (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No aggregate data available yet.</p>
                          <p className="text-sm mt-2">
                            Aggregates are calculated weekly and monthly by the system.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </>
            )}
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            {trendsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : trends && trends.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trends.map((trend) => (
                  <Card key={trend.id}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        {trend.retailerLogo && (
                          <img
                            src={trend.retailerLogo}
                            alt={trend.retailerName || "Retailer"}
                            className="h-6 w-6 rounded object-contain"
                          />
                        )}
                        <CardTitle className="text-base">
                          {trend.retailerName || `Retailer ${trend.retailerId}`}
                        </CardTitle>
                      </div>
                      <CardDescription>
                        {trend.analysisPeriodDays}-day trend analysis
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TrendIndicator trend={trend} showDetails={true} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No trend data available yet.</p>
                    <p className="text-sm mt-2">
                      Trend analysis is performed daily on products with sufficient price history.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
