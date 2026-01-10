import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TrendingDown,
  Award,
  Calendar,
  DollarSign,
  Percent,
  History,
  Sparkles,
} from 'lucide-react';
import { usePriceHistory, usePriceStats } from '@/hooks/use-price-history';

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
  const { data: history, isLoading: historyLoading } = usePriceHistory(productId, offerId, {
    days: 365,
  });
  const { data: stats, isLoading: statsLoading } = usePriceStats(productId, offerId, 365);

  const isLoading = historyLoading || statsLoading;

  // Calculate deal data
  const dealData =
    history && stats
      ? calculateDealData(
          history.data as DealCalculationHistory[],
          stats as DealCalculationStats
        )
      : null;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!history || history.data.length === 0 || !stats || !dealData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
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
          <Award className="h-5 w-5" />
          Deal Tracker
        </CardTitle>
        <CardDescription>Historical analysis from {history.data.length} days of data</CardDescription>

      </CardHeader>
      <CardContent className="space-y-6">
        {/* Best Deal Ever */}
        <BestDealSection deal={dealData.bestDeal} currentPrice={stats.currentPrice} />

        {/* Deal Frequency */}
        <DealFrequencySection dealData={dealData} />

        {/* Savings Calculator */}
        <SavingsCalculatorSection
          stats={stats as SavingsStats}
          currentPrice={stats.currentPrice}
          lowestPrice={stats.lowestPrice}
        />

        {/* Recent Deals */}
        {dealData.recentDeals.length > 0 && <RecentDealsSection deals={dealData.recentDeals} />}
      </CardContent>
    </Card>
  );
}

// Best Deal Section
function BestDealSection({ deal, currentPrice }: { deal: Deal; currentPrice: number }) {
  const savingsVsCurrent = currentPrice - deal.price;
  const percentVsCurrent = (savingsVsCurrent / currentPrice) * 100;

  return (
    <div className="rounded-lg border-2 border-warning/20 bg-gradient-to-br from-warning/5 to-warning/10 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-warning" />
          <h3 className="font-semibold text-foreground">Best Deal Ever</h3>
        </div>
        <Badge className="bg-warning text-white">{deal.discountPercent.toFixed(0)}% off</Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">${deal.price.toFixed(2)}</span>
          {deal.originalPrice && (
            <span className="text-lg text-muted-foreground line-through">
              ${deal.originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-warning">Saved</p>
            <p className="font-semibold text-foreground">${deal.savingsAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-warning">Date</p>
            <p className="font-semibold text-foreground">{deal.daysAgo} days ago</p>
          </div>
        </div>

        {savingsVsCurrent > 0 && (
          <div className="mt-2 border-t border-warning/20 pt-2">
            <p className="text-xs text-warning">
              ${savingsVsCurrent.toFixed(2)} ({percentVsCurrent.toFixed(1)}%) cheaper than current
              price
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Deal Frequency Section
interface DealFrequencyData {
  dealFrequency: string;
  averageDealDiscount: number;
  daysToNextDeal: number;
  recentDeals: Deal[];
  [key: string]: unknown;
}

function DealFrequencySection({ dealData }: { dealData: DealFrequencyData }) {
  const { dealFrequency, averageDealDiscount, daysToNextDeal } = dealData;
  const dealFrequencyNum = parseFloat(dealFrequency);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4" />
        <h4 className="font-medium">Deal Frequency</h4>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-primary/10 border-primary/20 rounded-lg border p-3">
          <div className="mb-1 flex items-center gap-1">
            <Calendar className="text-primary h-4 w-4" />
            <span className="text-primary/80 text-xs">Frequency</span>
          </div>
          <p className="text-primary text-lg font-semibold">{dealFrequency}</p>
          <p className="text-primary/70 text-xs">deals/month</p>
        </div>

        <div className="rounded-lg border border-success/20 bg-success/5 p-3">
          <div className="mb-1 flex items-center gap-1">
            <Percent className="h-4 w-4 text-success" />
            <span className="text-xs text-success">Avg Discount</span>
          </div>
          <p className="text-lg font-semibold text-foreground">{averageDealDiscount.toFixed(0)}%</p>
          <p className="text-xs text-success">when on sale</p>
        </div>

        <div className="bg-secondary/10 border-secondary/20 rounded-lg border p-3">
          <div className="mb-1 flex items-center gap-1">
            <Sparkles className="text-secondary h-4 w-4" />
            <span className="text-secondary/80 text-xs">Next Deal</span>
          </div>
          <p className="text-secondary text-lg font-semibold">~{daysToNextDeal}</p>
          <p className="text-secondary/70 text-xs">days (est.)</p>
        </div>
      </div>

      {!isNaN(dealFrequencyNum) && dealFrequencyNum > 2 && (
        <p className="text-muted-foreground text-xs">
          💡 This product goes on sale frequently. Consider waiting for a deal!
        </p>
      )}
    </div>
  );
}

// Savings Calculator Section
interface SavingsStats {
  averagePrice: number;
}

function SavingsCalculatorSection({
  stats,
  currentPrice,
  lowestPrice,
}: {
  stats: SavingsStats;
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
        <DollarSign className="h-4 w-4" />
        <h4 className="font-medium">Savings Potential</h4>
      </div>

      <div className="space-y-3">
        {/* Deal Quality Score */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Deal Quality Score</span>
            <span className="text-sm font-semibold">{dealQualityScore.toFixed(0)}/100</span>
          </div>
          <Progress
            value={dealQualityScore}
            className="h-2"
            aria-label={`Deal Quality Score: ${dealQualityScore.toFixed(0)}%`}
          />
          <p className="text-muted-foreground mt-1 text-xs">
            {dealQualityScore >= 90 && '🌟 Excellent deal!'}
            {dealQualityScore >= 70 && dealQualityScore < 90 && '👍 Good deal'}
            {dealQualityScore >= 50 && dealQualityScore < 70 && '⚖️ Fair price'}
            {dealQualityScore < 50 && '⏳ Wait for better price'}
          </p>
        </div>

        {/* Potential Savings */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground mb-1 text-xs">vs. Lowest Price</p>
              <p className="text-lg font-semibold">
                {potentialSavings > 0 ? '+' : ''}${Math.abs(potentialSavings).toFixed(2)}
              </p>
              <p className={`text-xs ${potentialSavings > 0 ? 'text-destructive' : 'text-success'}`}>
                {potentialSavings > 0 ? '+' : ''}
                {potentialPercent.toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="text-muted-foreground mb-1 text-xs">vs. Average Price</p>
              <p className="text-lg font-semibold">
                {vsAverage > 0 ? '+' : ''}${Math.abs(vsAverage).toFixed(2)}
              </p>
              <p className={`text-xs ${vsAverage > 0 ? 'text-destructive' : 'text-success'}`}>
                {vsAverage > 0 ? '+' : ''}
                {vsAveragePercent.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {potentialSavings > 5 && (
          <div className="rounded border border-warning/20 bg-warning/5 p-2">
            <p className="text-xs text-warning">
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
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <TrendingDown className="h-4 w-4" />
        <h4 className="font-medium">Recent Deals</h4>
        <Badge variant="outline" className="text-xs">
          {deals.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {deals.slice(0, 5).map((deal, index) => (
          <div key={index} className="bg-muted/30 flex items-center justify-between rounded-lg p-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">${deal.price.toFixed(2)}</span>
                {deal.originalPrice && (
                  <span className="text-muted-foreground text-xs line-through">
                    ${deal.originalPrice.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">{deal.daysAgo} days ago</p>
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

interface DealCalculationHistory {
  recordedAt: Date | string;
  createdAt: Date | string | null;
  price: string;
  originalPrice?: string;
  [key: string]: unknown;
}

interface DealCalculationStats {
  averagePrice: number;
  lowestPrice: number;
}

// Helper Function: Calculate Deal Data
function calculateDealData(history: DealCalculationHistory[], stats: DealCalculationStats) {
  // Identify deals (significant price drops)
  const deals: Deal[] = [];
  const priceData = history.map((h) => parseFloat(h.price));
  const avgPrice = priceData.reduce((sum, p) => sum + p, 0) / priceData.length;

  history.forEach((entry, _index) => {
    const price = parseFloat(entry.price);
    const originalPrice = entry.originalPrice ? parseFloat(entry.originalPrice) : null;
    const dateValue = entry.recordedAt || entry.createdAt || new Date();
    const date = new Date(dateValue);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

    // Consider it a deal if:
    // 1. It has an original price and it's lower
    // 2. It's significantly below average (>10%)
    const isDeal = (originalPrice && price < originalPrice * 0.95) || price < avgPrice * 0.9;

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
    date: new Date(history[0].recordedAt || history[0].createdAt || new Date()).toISOString(),
    price: stats.lowestPrice,
    discountPercent: 0,
    savingsAmount: 0,
    daysAgo: Math.floor(
      (Date.now() -
        new Date(history[0].recordedAt || history[0].createdAt || new Date()).getTime()) /
        (1000 * 60 * 60 * 24)
    ),
  };

  // Calculate deal frequency (deals per month)
  const daysSpan = history.length;
  const monthsSpan = daysSpan / 30;
  const dealFrequency = monthsSpan > 0 ? deals.length / monthsSpan : 0;

  // Average deal discount
  const averageDealDiscount =
    deals.length > 0 ? deals.reduce((sum, d) => sum + d.discountPercent, 0) / deals.length : 0;

  // Estimate days to next deal
  const avgDaysBetweenDeals = deals.length > 1 ? daysSpan / deals.length : daysSpan;
  const lastDealDaysAgo = deals.length > 0 ? deals[deals.length - 1].daysAgo : daysSpan;
  const daysToNextDeal = Math.max(0, Math.round(avgDaysBetweenDeals - lastDealDaysAgo));

  // Recent deals (last 90 days)
  const recentDeals = deals.filter((d) => d.daysAgo <= 90);

  return {
    bestDeal,
    dealFrequency: dealFrequency.toFixed(1),
    averageDealDiscount,
    daysToNextDeal,
    recentDeals,
    totalDeals: deals.length,
  };
}
