import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";

interface CreatePriceAlertDialogProps {
  productId: number;
  productName: string;
  currentPrice: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreateAlertInput {
  productId: number;
  targetPrice: number;
  notifyForum?: boolean;
}

export function CreatePriceAlertDialog({
  productId,
  productName,
  currentPrice,
  open,
  onOpenChange
}: CreatePriceAlertDialogProps) {
  // Default to 10% off current price
  const defaultTargetPrice = Math.round(currentPrice * 0.9 * 100) / 100;
  const [targetPrice, setTargetPrice] = useState<number>(defaultTargetPrice);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createAlert = useMutation({
    mutationFn: async (data: CreateAlertInput) => {
      return apiRequest<{ id: number }>('/api/price-alerts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh alert status
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/products'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/stats'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });

      toast({
        title: "Alert created",
        description: `You'll be notified when ${productName} drops to $${targetPrice.toFixed(2)}`,
      });

      // Close dialog
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create alert",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (targetPrice <= 0) {
      toast({
        title: "Invalid price",
        description: "Target price must be greater than $0",
        variant: "destructive",
      });
      return;
    }

    if (targetPrice >= currentPrice) {
      toast({
        title: "Invalid price",
        description: "Target price should be lower than current price",
        variant: "destructive",
      });
      return;
    }

    createAlert.mutate({
      productId,
      targetPrice,
      notifyForum: false,
    });
  };

  // Reset to default when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTargetPrice(defaultTargetPrice);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Set Price Alert
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Name */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Product
            </Label>
            <p className="text-sm font-medium mt-1 line-clamp-2">
              {productName}
            </p>
          </div>

          {/* Current Price */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Current Price
            </Label>
            <p className="text-lg font-bold mt-1">
              ${currentPrice.toFixed(2)}
            </p>
          </div>

          {/* Target Price Input */}
          <div>
            <Label htmlFor="target-price" className="text-sm font-medium">
              Alert me when price drops to:
            </Label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-medium text-muted-foreground">$</span>
              <Input
                id="target-price"
                type="number"
                step="0.01"
                min="0.01"
                max={currentPrice}
                value={targetPrice}
                onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                className="text-lg font-semibold"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {targetPrice > 0 && targetPrice < currentPrice
                ? `Save $${(currentPrice - targetPrice).toFixed(2)} (${Math.round(((currentPrice - targetPrice) / currentPrice) * 100)}% off)`
                : '\u00A0'
              }
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createAlert.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createAlert.isPending || targetPrice <= 0 || targetPrice >= currentPrice}
          >
            {createAlert.isPending ? "Creating..." : "Create Alert"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
