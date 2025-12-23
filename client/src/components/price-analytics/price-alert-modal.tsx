/**
 * Price Alert Modal Component
 *
 * Modal for creating price alerts, can be triggered from chart data point clicks.
 * Pre-fills the target price based on the clicked data point.
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Bell } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface PriceAlertModalProps {
  productId: number;
  productName?: string;
  prefilledPrice?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function PriceAlertModal({
  productId,
  productName = 'Product',
  prefilledPrice,
  isOpen,
  onClose,
}: PriceAlertModalProps) {
  const [targetPrice, setTargetPrice] = useState<string>(prefilledPrice?.toFixed(2) || '');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Update target price when prefilledPrice changes
  useEffect(() => {
    if (prefilledPrice !== undefined) {
      setTargetPrice(prefilledPrice.toFixed(2));
    }
  }, [prefilledPrice]);

  const createAlertMutation = useMutation({
    mutationFn: async (price: number) => {
      return apiRequest('/api/price-alerts', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          targetPrice: price,
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
      toast({
        title: 'Price alert created',
        description: `We'll notify you when the price drops to $${targetPrice}`,
      });
      onClose();
      setTargetPrice('');
    },
    onError: (error: Error & { code?: string; limit?: number; current?: number }) => {
      // Handle alert limit error with specific message
      if (error.code === 'ALERT_LIMIT_REACHED') {
        toast({
          title: 'Alert Limit Reached',
          description: `You can only have ${error.limit || 50} active alerts. Delete some alerts to create new ones.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to create alert',
          description: error.message,
          variant: 'destructive',
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: 'Invalid price',
        description: 'Please enter a valid price greater than $0',
        variant: 'destructive',
      });
      return;
    }

    createAlertMutation.mutate(price);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="alert-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Create Price Alert
          </DialogTitle>
          <DialogDescription>
            Get notified when {productName} drops to your target price
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="target-price">Target Price</Label>
              <div className="relative">
                <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                  $
                </span>
                <Input
                  id="target-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                  required
                />
              </div>
              <p className="text-muted-foreground text-xs">
                We'll send you an email when the price drops to or below this amount
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAlertMutation.isPending}>
              {createAlertMutation.isPending ? 'Creating...' : 'Create Alert'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
