import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingDown, Award, Calendar, DollarSign, Percent, History, Sparkles } from "lucide-react";
import { usePriceHistory, usePriceStats } from "@/hooks/use-price-history";

interface DealTrackerProps {
  productId: number;
  offerId?: number;
  className?: string;
}

interface Deal {
  date: string;
  price: number;
  originalPrice?: number;
  discountPercent: number;
  savingsAmount: number;
  daysAgo: number;
}

export function DealTracker({ productId, offerId, className }: DealTrackerProps) {
  const { data: history, isLoading: historyLoading } = usePriceHistory(productId, offerId, { days: 365 });
  const { data: stats, isLoading: statsLoading } = usePriceStats(productId, offerId, 365);

  const isLoading = historyLoading || statsLoading;

  // Calculate deal data
  const dealData = history && stats ? calculateDealData(history, stats) : null;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0 || !stats || !dealData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Deal Tracker
          </CardTitle>
          <CardDescription>Historical price analysis and savings</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Not enough data to track deals. Check back after more price history is collected.
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
          <Award className="w-5 h-5" />
          Deal Tracker
        </CardTitle>
        <CardDescription>
          Historical analysis from {history.length} days of data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Best Deal Ever */}
        <BestDealSection deal={dealData.bestDeal} currentPrice={stats.currentPrice} />

        {/* Deal Frequency */}
        <DealFrequencySection dealData={dealData} />

        {/* Savings Calculator */}
        <SavingsCalculatorSection
          stats={stats}
          currentPrice={stats.currentPrice}
          lowestPrice={stats.lowestPrice}
        />

        {/* Recent Deals */}
        {dealData.recentDeals.length > 0 && (
          <RecentDealsSection deals={dealData.recentDeals} />
        )}
      </CardContent>
    </Card>
  );
}

// Best Deal Section
function BestDealSection({ deal, currentPrice }: { deal: Deal; currentPrice: number }) {
  const savingsVsCurrent = currentPrice - deal.price;
  const percentVsCurrent = (savingsVsCurrent / currentPrice) * 100;

  return (
    <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-amber-900">Best Deal Ever</h3>
        </div>
        <Badge className="bg-amber-600 text-white">{deal.discountPercent.toFixed(0)}% off</Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-amber-900">${deal.price.toFixed(2)}</span>
          {deal.originalPrice && (
            <span className="text-lg text-amber-700 line-through">${deal.originalPrice.toFixed(2)}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-amber-700">Saved</p>
            <p className="font-semibold text-amber-900">${deal.savingsAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-amber-700">Date</p>
            <p className="font-semibold text-amber-900">{deal.daysAgo} days ago</p>
          </div>
        </div>

        {savingsVsCurrent > 0 && (
          <div className="pt-2 mt-2 border-t border-amber-200">
            <p className="text-xs text-amber-700">
              ${savingsVsCurrent.toFixed(2)} ({percentVsCurrent.toFixed(1)}%) cheaper than current price
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Deal Frequency Section
function DealFrequencySection({ dealData }: { dealData: any }) {
  const { dealFrequency, averageDealDiscount, daysToNextDeal } = dealData;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4" />
        <h4 className="font-medium">Deal Frequency</h4>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-1 mb-1">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-blue-700">Frequency</span>
          </div>
          <p className="text-lg font-semibold text-blue-900">{dealFrequency}</p>
          <p className="text-xs text-blue-600">deals/month</p>
        </div>

        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <div className="flex items-center gap-1 mb-1">
            <Percent className="w-4 h-4 text-green-600" />
            <span className="text-xs text-green-700">Avg Discount</span>
          </div>
          <p className="text-lg font-semibold text-green-900">{averageDealDiscount.toFixed(0)}%</p>
          <p className="text-xs text-green-600">when on sale</p>
        </div>

        <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-purple-700">Next Deal</span>
          </div>
          <p className="text-lg font-semibold text-purple-900">~{daysToNextDeal}</p>
          <p className="text-xs text-purple-600">days (est.)</p>
        </div>
      </div>

      {dealFrequency > 2 && (
        <p className="text-xs text-muted-foreground">
          💡 This product goes on sale frequently. Consider waiting for a deal!
        </p>
      )}
    </div>
  );
}

// Savings Calculator Section
function SavingsCalculatorSection({
  stats,
  currentPrice,
  lowestPrice,
}: {
  stats: any;
  currentPrice: number;
  lowestPrice: number;
}) {
  const potentialSavings = currentPrice - lowestPrice;
  const potentialPercent = (potentialSavings / currentPrice) * 100;

  const vsAverage = currentPrice - stats.averagePrice;
  const vsAveragePercent = (vsAverage / currentPrice) * 100;

  const dealQualityScore = Math.max(0, Math.min(100, 100 - potentialPercent * 2));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4" />
        <h4 className="font-medium">Savings Potential</h4>
      </div>

      <div className="space-y-3">
        {/* Deal Quality Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Deal Quality Score</span>
            <span className="text-sm font-semibold">{dealQualityScore.toFixed(0)}/100</span>
          </div>
          <Progress value={dealQualityScore} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {dealQualityScore >= 90 && "🌟 Excellent deal!"}
            {dealQualityScore >= 70 && dealQualityScore < 90 && "👍 Good deal"}
            {dealQualityScore >= 50 && dealQualityScore < 70 && "⚖️ Fair price"}
            {dealQualityScore < 50 && "⏳ Wait for better price"}
          </p>
        </div>

        {/* Potential Savings */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">vs. Lowest Price</p>
              <p className="text-lg font-semibold">
                {potentialSavings > 0 ? '+' : ''}${Math.abs(potentialSavings).toFixed(2)}
              </p>
              <p className={`text-xs ${potentialSavings > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {potentialSavings > 0 ? '+' : ''}{potentialPercent.toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">vs. Average Price</p>
              <p className="text-lg font-semibold">
                {vsAverage > 0 ? '+' : ''}${Math.abs(vsAverage).toFixed(2)}
              </p>
              <p className={`text-xs ${vsAverage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {vsAverage > 0 ? '+' : ''}{vsAveragePercent.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {potentialSavings > 5 && (
          <div className="p-2 rounded bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-800">
              💰 You could save ${potentialSavings.toFixed(2)} by waiting for a better price
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Recent Deals Section
function RecentDealsSection({ deals }: { deals: Deal[] }) {
  return (
    <div className="space-y-3 pt-4 border-t">
      <div className="flex items-center gap-2">
        <TrendingDown className="w-4 h-4" />
        <h4 className="font-medium">Recent Deals</h4>
        <Badge variant="outline" className="text-xs">{deals.length}</Badge>
      </div>

      <div className="space-y-2">
        {deals.slice(0, 5).map((deal, index) => (
          <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">${deal.price.toFixed(2)}</span>
                {deal.originalPrice && (
                  <span className="text-xs text-muted-foreground line-through">
                    ${deal.originalPrice.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{deal.daysAgo} days ago</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              -{deal.discountPercent.toFixed(0)}%
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper Function: Calculate Deal Data
function calculateDealData(history: any[], stats: any) {
  // Identify deals (significant price drops)
  const deals: Deal[] = [];
  const priceData = history.map(h => parseFloat(h.price));
  const avgPrice = priceData.reduce((sum, p) => sum + p, 0) / priceData.length;

  history.forEach((entry, index) => {
    const price = parseFloat(entry.price);
    const originalPrice = entry.originalPrice ? parseFloat(entry.originalPrice) : null;
    const date = new Date(entry.recordedAt || entry.createdAt);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

    // Consider it a deal if:
    // 1. It has an original price and it's lower
    // 2. It's significantly below average (>10%)
    const isDeal = (originalPrice && price < originalPrice * 0.95) || (price < avgPrice * 0.9);

    if (isDeal) {
      const referencePrice = originalPrice || avgPrice;
      const savingsAmount = referencePrice - price;
      const discountPercent = (savingsAmount / referencePrice) * 100;

      deals.push({
        date: date.toISOString(),
        price,
        originalPrice: originalPrice || undefined,
        discountPercent,
        savingsAmount,
        daysAgo,
      });
    }
  });

  // Sort deals by discount percentage (best first)
  deals.sort((a, b) => b.discountPercent - a.discountPercent);

  // Find best deal
  const bestDeal = deals[0] || {
    date: new Date(history[0].recordedAt || history[0].createdAt).toISOString(),
    price: stats.lowestPrice,
    discountPercent: 0,
    savingsAmount: 0,
    daysAgo: Math.floor((Date.now() - new Date(history[0].recordedAt || history[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)),
  };

  // Calculate deal frequency (deals per month)
  const daysSpan = history.length;
  const monthsSpan = daysSpan / 30;
  const dealFrequency = monthsSpan > 0 ? deals.length / monthsSpan : 0;

  // Average deal discount
  const averageDealDiscount = deals.length > 0
    ? deals.reduce((sum, d) => sum + d.discountPercent, 0) / deals.length
    : 0;

  // Estimate days to next deal
  const avgDaysBetweenDeals = deals.length > 1 ? daysSpan / deals.length : daysSpan;
  const lastDealDaysAgo = deals.length > 0 ? deals[deals.length - 1].daysAgo : daysSpan;
  const daysToNextDeal = Math.max(0, Math.round(avgDaysBetweenDeals - lastDealDaysAgo));

  // Recent deals (last 90 days)
  const recentDeals = deals.filter(d => d.daysAgo <= 90);

  return {
    bestDeal,
    dealFrequency: dealFrequency.toFixed(1),
    averageDealDiscount,
    daysToNextDeal,
    recentDeals,
    totalDeals: deals.length,
  };
}
