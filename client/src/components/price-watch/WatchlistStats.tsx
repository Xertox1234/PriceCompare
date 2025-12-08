import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Package, Bell, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WatchlistStatsProps {
  stats: {
    totalWatchLists: number;
    totalProducts: number;
    totalPotentialSavings: number;
    activeAlerts: number;
    triggeredAlerts: number;
    bestDeals: Array<{
      productId: number;
      productName: string;
      currentPrice: number;
      lowestPrice: number;
      discountPercent: number;
    }>;
    weeklyStats: {
      newDeals: number;
      triggeredAlerts: number;
    };
  };
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function StatCard({ label, value, icon: Icon, color, trend }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-muted-foreground mb-1 text-sm font-medium">{label}</p>
            <p className="text-foreground text-3xl font-bold">{value}</p>
            {trend && (
              <div
                className={cn(
                  'mt-2 flex items-center gap-1 text-sm font-medium',
                  trend.isPositive
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{Math.abs(trend.value)} this week</span>
              </div>
            )}
          </div>
          <div className={cn('rounded-full p-3', color)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WatchlistStats({ stats }: WatchlistStatsProps) {
  const statsCards = [
    {
      label: 'Potential Savings',
      value: `$${stats.totalPotentialSavings.toFixed(2)}`,
      icon: Wallet,
      color: 'bg-green-500/10 text-green-500',
      trend: undefined,
    },
    {
      label: 'Products Watched',
      value: stats.totalProducts,
      icon: Package,
      color: 'bg-primary/10 text-primary',
      trend: undefined,
    },
    {
      label: 'Active Alerts',
      value: stats.activeAlerts,
      icon: Bell,
      color: 'bg-amber-500/10 text-amber-500',
      trend:
        stats.weeklyStats.triggeredAlerts > 0
          ? {
              value: stats.weeklyStats.triggeredAlerts,
              isPositive: true,
            }
          : undefined,
    },
    {
      label: 'Deals This Week',
      value: stats.weeklyStats.newDeals,
      icon: TrendingUp,
      color: 'bg-blue-500/10 text-blue-500',
      trend:
        stats.weeklyStats.newDeals > 0
          ? {
              value: stats.weeklyStats.newDeals,
              isPositive: true,
            }
          : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Best Deals Section */}
      {stats.bestDeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <TrendingDown className="h-5 w-5 text-green-500" />
              Best Deals Right Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.bestDeals.slice(0, 5).map((deal, index) => (
                <div
                  key={deal.productId}
                  className="bg-card hover:bg-accent flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors"
                  onClick={() => {
                    window.location.href = `/products/${deal.productId}/price-history`;
                  }}
                >
                  <div className="flex flex-1 items-center gap-3">
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                      #{index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">{deal.productName}</p>
                      <p className="text-muted-foreground text-sm">
                        Current: ${deal.currentPrice.toFixed(2)} • Lowest: $
                        {deal.lowestPrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <div className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-bold text-green-600 dark:text-green-400">
                      -{deal.discountPercent.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {stats.bestDeals.length === 0 && (
              <div className="text-muted-foreground py-8 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="font-medium">No deals available yet</p>
                <p className="text-sm">Start watching products to track price drops</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
