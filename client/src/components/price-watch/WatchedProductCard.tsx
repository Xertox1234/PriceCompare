import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingDown, X, ExternalLink, Bell, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/constants';

interface WatchedProductCardProps {
  product: {
    productId: number;
    productName: string;
    imageUrl: string | null;
    currentPrice: number;
    lowestPrice: number;
    priceDropPercent: number;
    savingsPotential: number;
    last7Days: Array<{ date: string; price: number }>;
    alertStatus: 'active' | 'triggered' | 'none';
    addedAt: string;
  };
  watchListId: number;
  onRemove?: () => void;
}

export function WatchedProductCard({ product, watchListId, onRemove }: WatchedProductCardProps) {
  const hasPriceDrop = product.priceDropPercent > 0;
  const hasSavings = product.savingsPotential > 0;

  // Format chart data for Recharts
  const chartData = product.last7Days.map((point) => ({
    date: point.date,
    price: point.price,
  }));

  // Determine alert badge variant
  const alertBadgeProps = {
    active: { className: 'bg-primary text-primary-foreground', icon: Bell },
    triggered: { className: 'bg-green-600 text-white dark:bg-green-500', icon: Bell },
    none: { className: 'bg-muted text-muted-foreground', icon: BellOff },
  }[product.alertStatus];

  const AlertIcon = alertBadgeProps.icon;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-4">
        {/* Header with image and basic info */}
        <div className="flex gap-4 mb-4">
          {/* Product Image */}
          <div className="flex-shrink-0">
            <img
              src={product.imageUrl || DEFAULT_PRODUCT_IMAGE}
              alt={product.productName}
              className="w-20 h-20 object-cover rounded-md"
              loading="lazy"
            />
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base line-clamp-2 mb-2">
              {product.productName}
            </h3>

            {/* Price and Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-bold text-foreground">
                ${product.currentPrice.toFixed(2)}
              </span>

              {hasPriceDrop && (
                <Badge className="bg-green-600 text-white dark:bg-green-500 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  {product.priceDropPercent.toFixed(0)}% off
                </Badge>
              )}
            </div>

            {/* Savings indicator */}
            {hasSavings && (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
                Save ${product.savingsPotential.toFixed(2)} vs. lowest price
              </p>
            )}
          </div>

          {/* Remove button */}
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove from watch list"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* 7-day sparkline mini chart */}
        <div className="mb-3">
          <div className="h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={hasPriceDrop ? '#22c55e' : '#3b82f6'}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Last 7 days
          </p>
        </div>

        {/* Footer with alert status and actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          {/* Alert Status Badge */}
          <Badge variant="outline" className={cn('flex items-center gap-1', alertBadgeProps.className)}>
            <AlertIcon className="w-3 h-3" />
            <span className="capitalize">{product.alertStatus === 'active' ? 'Active Alert' : product.alertStatus === 'triggered' ? 'Alert Triggered' : 'No Alert'}</span>
          </Badge>

          {/* View Details Link */}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-primary"
            onClick={() => {
              // Navigate to product details page
              window.location.href = `/products/${product.productId}/price-history`;
            }}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View Details
          </Button>
        </div>

        {/* Added date */}
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">
            Added {new Date(product.addedAt).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
