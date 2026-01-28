import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Price } from '@/components/ui/price';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingDown, X, ExternalLink, Bell, BellOff, Edit2, Check, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/constants';
import { CreatePriceAlertDialog } from '../watchlist/create-price-alert-dialog';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
    alertId: number | null; // Price alert ID for inline editing
    alertTargetPrice: number | null; // Price alert target price
  };
  watchListId: number;
  onRemove?: () => void;
}

export function WatchedProductCard({
  product,
  watchListId: _watchListId,
  onRemove,
}: WatchedProductCardProps) {
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrice, setEditedPrice] = useState<number>(product.alertTargetPrice || 0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const hasPriceDrop = product.priceDropPercent > 0;
  const hasSavings = product.savingsPotential > 0;

  // Mutation for updating alert target price
  const updateAlertMutation = useMutation({
    mutationFn: async (newTargetPrice: number) => {
      if (!product.alertId) {
        throw new Error('No alert ID available');
      }
      return apiRequest<{ id: number }>(`/api/price-alerts/${product.alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({ targetPrice: newTargetPrice }),
      });
    },
    onSuccess: () => {
      // Invalidate ALL relevant queries
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/products'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });

      toast({
        title: 'Target price updated',
        description: `New target: $${editedPrice.toFixed(2)}`,
      });

      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update price',
        description: error.message || 'Please try again later',
        variant: 'destructive',
      });
    },
  });

  const handleSaveEdit = () => {
    // Client-side validation
    if (editedPrice <= 0) {
      toast({
        title: 'Invalid price',
        description: 'Target price must be greater than $0',
        variant: 'destructive',
      });
      return;
    }

    if (editedPrice >= product.currentPrice) {
      toast({
        title: 'Invalid price',
        description: 'Target price should be lower than current price',
        variant: 'destructive',
      });
      return;
    }

    updateAlertMutation.mutate(editedPrice);
  };

  const handleCancelEdit = () => {
    setEditedPrice(product.alertTargetPrice || 0);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setEditedPrice(product.alertTargetPrice || 0);
    setIsEditing(true);
  };

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
    <Card className="overflow-hidden transition-shadow duration-200 hover:shadow-lg">
      <CardContent className="p-4">
        {/* Header with image and basic info */}
        <div className="mb-4 flex gap-4">
          {/* Product Image */}
          <div className="flex-shrink-0">
            <img
              src={product.imageUrl || DEFAULT_PRODUCT_IMAGE}
              alt={product.productName}
              className="h-20 w-20 rounded-md object-cover"
              loading="lazy"
            />
          </div>

          {/* Product Info */}
          <div className="min-w-0 flex-1">
            <h3 className="mb-2 line-clamp-2 text-base font-semibold">{product.productName}</h3>

            {/* Price and Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Price value={product.currentPrice} className="text-foreground text-2xl font-bold" />

              {hasPriceDrop && (
                <Badge className="flex items-center gap-1 bg-green-600 text-white dark:bg-green-500">
                  <TrendingDown className="h-3 w-3" />
                  {product.priceDropPercent.toFixed(0)}% off
                </Badge>
              )}
            </div>

            {/* Savings indicator */}
            {hasSavings && (
              <p className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">
                Save <Price value={product.savingsPotential} size="sm" /> vs. lowest price
              </p>
            )}
          </div>

          {/* Remove button */}
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
              aria-label="Remove from watch list"
            >
              <X className="h-4 w-4" />
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
          <p className="text-muted-foreground mt-1 text-center text-xs">Last 7 days</p>
        </div>

        {/* Footer with alert status and actions */}
        <div className="border-border flex items-center justify-between border-t pt-3">
          {/* Alert Status Badge */}
          <Badge
            variant="outline"
            className={cn('flex items-center gap-1', alertBadgeProps.className)}
          >
            <AlertIcon className="h-3 w-3" />
            <span className="capitalize">
              {product.alertStatus === 'active'
                ? 'Active Alert'
                : product.alertStatus === 'triggered'
                  ? 'Alert Triggered'
                  : 'No Alert'}
            </span>
          </Badge>

          {/* View Details Link */}
          <Button
            variant="link"
            size="sm"
            className="text-primary h-auto p-0"
            onClick={() => {
              // Navigate to product details page
              window.location.href = `/products/${product.productId}/price-history`;
            }}
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            View Details
          </Button>
        </div>

        {/* Alert Target Price (show when alert exists) */}
        {(product.alertStatus === 'active' || product.alertStatus === 'triggered') &&
          product.alertTargetPrice !== null && (
            <div className="border-border mt-3 border-t pt-3">
              {isEditing ? (
                // Editing mode
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[80px] text-sm font-medium">
                      Target Price:
                    </span>
                    <div className="flex flex-1 items-center gap-1">
                      <span className="text-muted-foreground text-lg font-medium">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={product.currentPrice}
                        value={editedPrice}
                        onChange={(e) => setEditedPrice(parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        autoFocus
                        disabled={updateAlertMutation.isPending}
                      />
                    </div>
                  </div>
                  {/* Real-time savings calculation */}
                  {editedPrice > 0 && editedPrice < product.currentPrice && (
                    <p className="text-muted-foreground text-xs">
                      Save ${(product.currentPrice - editedPrice).toFixed(2)} (
                      {Math.round(
                        ((product.currentPrice - editedPrice) / product.currentPrice) * 100
                      )}
                      % off)
                    </p>
                  )}
                  {/* Save/Cancel buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={
                        updateAlertMutation.isPending ||
                        editedPrice <= 0 ||
                        editedPrice >= product.currentPrice
                      }
                      className="flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" />
                      {updateAlertMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={updateAlertMutation.isPending}
                      className="flex items-center gap-1"
                    >
                      <XCircle className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Target:</span>
                    <Price value={product.alertTargetPrice} className="text-primary text-lg font-bold" />
                    {product.currentPrice <= product.alertTargetPrice && (
                      <Badge className="bg-green-600 text-xs text-white dark:bg-green-500">
                        TARGET MET!
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartEdit}
                    className="text-muted-foreground hover:text-foreground h-7 px-2"
                    aria-label="Edit target price"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

        {/* Set Price Alert Button (only show if no alert exists) */}
        {product.alertStatus === 'none' && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAlertDialog(true)}
            >
              <Bell className="mr-2 h-4 w-4" />
              Set Price Alert
            </Button>
          </div>
        )}

        {/* Price Alert Dialog */}
        <CreatePriceAlertDialog
          productId={product.productId}
          productName={product.productName}
          currentPrice={product.currentPrice}
          open={showAlertDialog}
          onOpenChange={setShowAlertDialog}
        />

        {/* Added date */}
        <div className="mt-2">
          <p className="text-muted-foreground text-xs">
            Added {new Date(product.addedAt).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
