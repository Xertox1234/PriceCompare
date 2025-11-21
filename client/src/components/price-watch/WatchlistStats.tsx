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
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {label}
            </p>
            <p className="text-3xl font-bold text-foreground">
              {value}
            </p>
            {trend && (
              <div className={cn(
                'flex items-center gap-1 mt-2 text-sm font-medium',
                trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}>
                {trend.isPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>{Math.abs(trend.value)} this week</span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-full', color)}>
            <Icon className="w-6 h-6" />
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
      trend: stats.weeklyStats.triggeredAlerts > 0 ? {
        value: stats.weeklyStats.triggeredAlerts,
        isPositive: true,
      } : undefined,
    },
    {
      label: 'Deals This Week',
      value: stats.weeklyStats.newDeals,
      icon: TrendingUp,
      color: 'bg-blue-500/10 text-blue-500',
      trend: stats.weeklyStats.newDeals > 0 ? {
        value: stats.weeklyStats.newDeals,
        isPositive: true,
      } : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Best Deals Section */}
      {stats.bestDeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-green-500" />
              Best Deals Right Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.bestDeals.slice(0, 5).map((deal, index) => (
                <div
                  key={deal.productId}
                  className="flex items-center justify-between p-3 rounded-lg bg-card hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => {
                    window.location.href = `/products/${deal.productId}/price-history`;
                  }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {deal.productName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Current: ${deal.currentPrice.toFixed(2)} • Lowest: ${deal.lowestPrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <div className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-bold text-sm">
                      -{deal.discountPercent.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {stats.bestDeals.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
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
