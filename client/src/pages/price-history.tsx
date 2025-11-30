import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  PriceHistoryChart,
  type PriceHistoryData,
  PriceInsightsWidget,
  PriceAlertsManager,
  DealTracker
} from "@/components/price-history";
import { usePriceHistory, usePriceStats, usePriceSnapshots } from "@/hooks/use-price-history";
import {
  ArrowLeft,
  Download,
  TrendingDown,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertCircle,
  Info,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PriceHistoryPage() {
  const [, params] = useRoute("/products/:id/price-history");
  const productId = params?.id ? parseInt(params.id) : undefined;

  // For this demo, we'll use the first offer. In production, you might want to:
  // 1. Fetch the product first to get offers
  // 2. Allow user to select which offer to view
  // 3. Or show aggregated data across all offers
  const [selectedOfferId, _setSelectedOfferId] = useState<number | undefined>();

  const { data: history, isLoading: historyLoading, error: historyError } = usePriceHistory(
    productId,
    selectedOfferId,
    { limit: 500 }
  );

  const { data: stats, isLoading: statsLoading } = usePriceStats(
    productId,
    selectedOfferId,
    365
  );

  const { data: _snapshots, isLoading: snapshotsLoading } = usePriceSnapshots(
    productId,
    { startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
  );

  const isLoading = historyLoading || statsLoading || snapshotsLoading;

  // Transform data for chart
  const chartData: PriceHistoryData | null = history && stats ? {
    productName: `Product #${productId}`,
    currentPrice: stats.currentPrice,
    lowestPrice: stats.lowestPrice,
    highestPrice: stats.highestPrice,
    averagePrice: stats.averagePrice,
    priceChange24h: stats.priceChange24h || 0,
    priceChangePercent24h: stats.priceChangePercent24h || 0,
    priceChange7d: stats.priceChange7d,
    priceChangePercent7d: stats.priceChangePercent7d,
    dataPoints: history.map(h => ({
      date: (h.recordedAt || h.createdAt || new Date()).toString(),
      price: Number(h.price)
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  } : null;

  // Export to CSV
  const exportToCSV = () => {
    if (!history || history.length === 0) return;

    const headers = ['Date', 'Price', 'Original Price', 'Source', 'Confidence'];
    const rows = history.map(h => [
      new Date(h.recordedAt || h.createdAt || '').toLocaleString(),
      h.price,
      h.originalPrice || '',
      h.source || '',
      h.confidence || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `price-history-product-${productId}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Calculate additional insights
  const insights = stats ? {
    volatility: ((stats.highestPrice - stats.lowestPrice) / stats.averagePrice * 100).toFixed(1),
    currentVsAvg: ((stats.currentPrice - stats.averagePrice) / stats.averagePrice * 100).toFixed(1),
    bestDealPercentage: ((stats.highestPrice - stats.lowestPrice) / stats.highestPrice * 100).toFixed(1),
    daysTracked: history?.length || 0
  } : null;

  if (!productId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid product ID. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (historyError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load price history. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Price History - Product #{productId} | PriceCompare</title>
        <meta name="description" content={`View detailed price history and trends for product #${productId}`} />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/products">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Price History</h1>
              <p className="text-muted-foreground mt-2">
                Detailed price tracking and analysis for Product #{productId}
              </p>
            </div>

            {history && history.length > 0 && (
              <Button onClick={exportToCSV} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-[400px] w-full" />
            <div className="grid md:grid-cols-3 gap-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        )}

        {!isLoading && !chartData && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No price history available</p>
                <p className="text-sm mt-2">
                  Price tracking will begin now. Check back later to see historical data.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && chartData && chartData.dataPoints.length > 0 && (
          <div className="space-y-6">
            {/* Main Chart */}
            <PriceHistoryChart data={chartData} showStats={true} />

            {/* Additional Analytics */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Volatility Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Price Volatility
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{insights?.volatility}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Price range relative to average
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    ${(chartData.highestPrice - chartData.lowestPrice).toFixed(2)} spread
                  </Badge>
                </CardContent>
              </Card>

              {/* Current vs Average */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Current vs Average
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "text-2xl font-bold",
                    Number(insights?.currentVsAvg) < 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {Number(insights?.currentVsAvg) > 0 ? '+' : ''}{insights?.currentVsAvg}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Number(insights?.currentVsAvg) < 0 ? 'Below' : 'Above'} average price
                  </p>
                  <Badge
                    variant={Number(insights?.currentVsAvg) < 0 ? 'default' : 'destructive'}
                    className="mt-2"
                  >
                    ${Math.abs(chartData.currentPrice - chartData.averagePrice).toFixed(2)} difference
                  </Badge>
                </CardContent>
              </Card>

              {/* Tracking Duration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Tracking Duration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{insights?.daysTracked}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Price data points recorded
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {chartData.dataPoints.length > 0 && (
                      <>
                        {Math.ceil((new Date(chartData.dataPoints[chartData.dataPoints.length - 1].date).getTime() -
                          new Date(chartData.dataPoints[0].date).getTime()) / (1000 * 60 * 60 * 24))} days tracked
                      </>
                    )}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Insights & Recommendations */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Price Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>Price Insights</CardTitle>
                  <CardDescription>
                    Analysis based on historical data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    {chartData.currentPrice <= chartData.lowestPrice * 1.05 ? (
                      <TrendingDown className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-amber-600 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">
                        {chartData.currentPrice <= chartData.lowestPrice * 1.05
                          ? 'At or near lowest price'
                          : 'Above recent low'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Current price is ${(chartData.currentPrice - chartData.lowestPrice).toFixed(2)} from the lowest recorded
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {Number(insights?.currentVsAvg) < 0 ? 'Below average price' : 'Above average price'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {Number(insights?.currentVsAvg) < 0
                          ? `Saving $${(chartData.averagePrice - chartData.currentPrice).toFixed(2)} compared to average`
                          : `Paying $${(chartData.currentPrice - chartData.averagePrice).toFixed(2)} more than average`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Potential savings</p>
                      <p className="text-sm text-muted-foreground">
                        You could save up to ${(chartData.highestPrice - chartData.lowestPrice).toFixed(2)} ({insights?.bestDealPercentage}%) by buying at the lowest price
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Buy Recommendation */}
              <Card>
                <CardHeader>
                  <CardTitle>Buying Recommendation</CardTitle>
                  <CardDescription>
                    Based on current market conditions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {chartData.currentPrice <= chartData.lowestPrice * 1.05 ? (
                    <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="font-semibold text-green-900 dark:text-green-100 mb-2">
                        ✓ Excellent time to buy!
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        The current price is at or very close to the lowest recorded price. This is a great opportunity to purchase.
                      </p>
                    </div>
                  ) : chartData.currentPrice <= chartData.averagePrice ? (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Good time to buy
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        The price is below average. While not the absolute lowest, this is still a good deal.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                        Consider waiting
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        The current price is above average. You might want to wait for a price drop or set up a price alert.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Quick Stats:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Best Price:</span>
                        <p className="font-medium text-green-600">${chartData.lowestPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Worst Price:</span>
                        <p className="font-medium text-red-600">${chartData.highestPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Average:</span>
                        <p className="font-medium">${chartData.averagePrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current:</span>
                        <p className="font-medium">${chartData.currentPrice.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" asChild>
                    <Link href="/products">
                      View All Products
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Separator className="my-8" />

            {/* Phase 2.3: Advanced Insights Dashboard */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Price Insights Widget */}
              <PriceInsightsWidget
                productId={productId}
                offerId={selectedOfferId}
              />

              {/* Price Alerts Manager */}
              <PriceAlertsManager
                productId={productId}
                currentPrice={chartData.currentPrice}
              />

              {/* Deal Tracker (full width) */}
              <div className="lg:col-span-2">
                <DealTracker
                  productId={productId}
                  offerId={selectedOfferId}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
